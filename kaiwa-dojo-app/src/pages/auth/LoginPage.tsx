import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import { fetchStudents } from '../../lib/studentService'
import CustomAlertModal from '../../components/CustomAlertModal'

export default function LoginPage() {
  const navigate = useNavigate()
  const { sessionExpiredNotice, clearSessionNotice } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  // Pop-up Alert Modal State
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    type?: 'lock' | 'warning' | 'info' | 'success'
    buttonText?: string
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    buttonText: 'Mengerti',
  })

  function showAlert(
    title: string,
    message: string,
    type: 'lock' | 'warning' | 'info' | 'success' = 'warning',
    buttonText = 'Mengerti'
  ) {
    setAlertModal({
      isOpen: true,
      title,
      message,
      type,
      buttonText,
    })
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    clearSessionNotice()
    setError(null)
    setLoading(true)

    const inputClean = username.trim().toLowerCase()

    if (!inputClean) {
      setLoading(false)
      showAlert('⚠️ Username Belum Diisi', 'Silakan masukkan username atau email Anda terlebih dahulu.')
      return
    }

    if (!password) {
      setLoading(false)
      showAlert('🔒 Password Belum Diisi', 'Silakan masukkan password akun Anda terlebih dahulu.', 'lock', 'Isi Password')
      return
    }

    // 1. Special Admin Login Credentials
    if (inputClean === 'kaiwahiroshima') {
      if (password === 'inaconnextkaiwa6') {
        const adminProf = {
          id: '00000000-0000-0000-0000-000000000099',
          full_name: 'Admin Hiroshima',
          username: 'kaiwahiroshima',
          email: 'admin@kaiwadojo.com',
          role: 'admin',
          status: 'approved',
          streak_days: 99,
          last_active_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        sessionStorage.setItem('kaiwa_session_active', 'true')
        sessionStorage.setItem('kaiwa_custom_profile', JSON.stringify(adminProf))
        window.dispatchEvent(new Event('kaiwa_profile_updated'))

        try {
          await supabase.from('profiles').upsert({
            id: '00000000-0000-0000-0000-000000000099',
            full_name: 'Admin Hiroshima',
            username: 'kaiwahiroshima',
            email: 'admin@kaiwadojo.com',
            role: 'admin',
            status: 'approved',
          })
        } catch (e) {
          console.warn('Admin upsert note:', e)
        }

        setLoading(false)
        navigate('/dashboard')
        return
      } else {
        setLoading(false)
        showAlert(
          '🔑 Password Salah',
          `Password yang Anda masukkan untuk akun Admin "${username}" salah.\n\nSilakan periksa kembali huruf besar/kecil (Caps Lock) password Anda dan coba lagi.`,
          'lock',
          'Coba Password Lagi'
        )
        return
      }
    }

    // Check student list cache / local DB for verification status
    const allStudents = await fetchStudents()
    const studentMatch = allStudents.find(
      s => s.username.toLowerCase() === inputClean || s.email.toLowerCase() === inputClean
    )

    if (studentMatch) {
      if (studentMatch.status === 'pending') {
        setLoading(false)
        showAlert(
          '⏳ Akun Menunggu Verifikasi Admin',
          `Pendaftaran akun Anda ("${studentMatch.full_name}") telah berhasil memverifikasi OTP.\n\nNamun saat ini akun Anda masih dalam **proses peninjauan & verifikasi oleh Admin**. Silakan tunggu persetujuan Admin sebelum Anda dapat masuk ke Dashboard.`,
          'warning',
          'Mengerti'
        )
        return
      }

      if (studentMatch.status === 'rejected') {
        setLoading(false)
        showAlert(
          '❌ Akun Ditolak / Nonaktif',
          `Akun Anda ("${studentMatch.full_name}") telah ditolak atau dinonaktifkan oleh Admin KaiwaDojo. Silakan hubungi tim pengelola jika terjadi kekeliruan.`,
          'warning',
          'Mengerti'
        )
        return
      }
    }

    // 2. Resolve Target Email from Username or Check if Profile Exists
    let targetEmail = inputClean
    let userFoundInDb = false

    if (!inputClean.includes('@')) {
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('username, email, status, full_name')
        .eq('username', inputClean)
        .maybeSingle()

      if (profileError) {
        console.error('Error fetching profile:', profileError)
      }

      if (!userProfile) {
        // Username is NOT found in database
        setLoading(false)
        showAlert(
          '❌ Username Tidak Ditemukan',
          `Username "**${username}**" belum terdaftar di sistem KaiwaDojo.\n\nSilakan periksa kembali ejaan username Anda atau daftar akun baru jika belum memiliki akun.`,
          'warning',
          'Periksa Username'
        )
        return
      }

      if (userProfile.status === 'pending') {
        setLoading(false)
        showAlert(
          '⏳ Akun Menunggu Verifikasi Admin',
          `Pendaftaran akun Anda ("${userProfile.full_name || username}") telah berhasil memverifikasi OTP.\n\nNamun saat ini akun Anda masih dalam **proses peninjauan & verifikasi oleh Admin**. Silakan tunggu persetujuan Admin sebelum dapat masuk ke Dashboard.`,
          'warning',
          'Mengerti'
        )
        return
      }

      if (userProfile.status === 'rejected') {
        setLoading(false)
        showAlert(
          '❌ Akun Ditolak / Nonaktif',
          `Akun Anda ("${userProfile.full_name || username}") telah ditolak atau dinonaktifkan oleh Admin KaiwaDojo.`,
          'warning',
          'Mengerti'
        )
        return
      }

      if (!userProfile.email) {
        setLoading(false)
        showAlert(
          '⚠️ Email Tidak Terkait',
          `Akun untuk username "**${username}**" belum memiliki email aktif di database.`,
          'warning'
        )
        return
      }

      targetEmail = userProfile.email
      userFoundInDb = true
    } else {
      // Check if email exists in database
      const { data: emailProfile } = await supabase
        .from('profiles')
        .select('email, status, full_name')
        .eq('email', inputClean)
        .maybeSingle()

      if (emailProfile?.status === 'pending') {
        setLoading(false)
        showAlert(
          '⏳ Akun Menunggu Verifikasi Admin',
          `Pendaftaran akun Anda ("${emailProfile.full_name || username}") telah berhasil memverifikasi OTP.\n\nNamun saat ini akun Anda masih dalam **proses peninjauan & verifikasi oleh Admin**. Silakan tunggu persetujuan Admin sebelum dapat masuk ke Dashboard.`,
          'warning',
          'Mengerti'
        )
        return
      }

      if (emailProfile?.status === 'rejected') {
        setLoading(false)
        showAlert(
          '❌ Akun Ditolak / Nonaktif',
          `Akun Anda ("${emailProfile.full_name || username}") telah ditolak atau dinonaktifkan oleh Admin KaiwaDojo.`,
          'warning',
          'Mengerti'
        )
        return
      }

      userFoundInDb = Boolean(emailProfile)
    }

    // 3. Supabase Authentication Sign In
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password,
    })

    if (authError) {
      setLoading(false)
      if (authError.message === 'Email not confirmed') {
        showAlert(
          '✉️ Email Belum Dikonfirmasi',
          `Email untuk akun ini belum dikonfirmasi.\n\nSilakan cek inbox atau folder spam email Anda untuk verifikasi.`,
          'info',
          'Mengerti'
        )
      } else if (authError.message === 'Invalid login credentials') {
        if (!userFoundInDb && inputClean.includes('@')) {
          showAlert(
            '❌ Email Tidak Ditemukan',
            `Email "**${username}**" belum terdaftar di sistem KaiwaDojo.\n\nSilakan periksa kembali ejaan email Anda atau buat akun baru.`,
            'warning',
            'Periksa Email'
          )
        } else {
          showAlert(
            '🔑 Password Salah',
            `Password yang Anda masukkan untuk akun "**${username}**" salah.\n\nSilakan periksa kembali huruf besar/kecil (Caps Lock) password Anda dan coba lagi.`,
            'lock',
            'Coba Password Lagi'
          )
        }
      } else {
        showAlert('⚠️ Gagal Masuk', `Terjadi kendala saat login: ${authError.message}`, 'warning')
      }
    } else {
      // Fetch user profile to cache in session
      if (authData?.user?.id) {
        const { data: profData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle()

        if (profData?.status === 'pending') {
          setLoading(false)
          showAlert(
            '⏳ Akun Menunggu Verifikasi Admin',
            `Pendaftaran akun Anda ("${profData.full_name || username}") telah berhasil memverifikasi OTP.\n\nNamun saat ini akun Anda masih dalam **proses peninjauan & verifikasi oleh Admin**. Silakan tunggu persetujuan Admin sebelum dapat masuk ke Dashboard.`,
            'warning',
            'Mengerti'
          )
          return
        }

        if (profData?.status === 'rejected') {
          setLoading(false)
          showAlert(
            '❌ Akun Ditolak / Nonaktif',
            `Akun Anda ("${profData.full_name || username}") telah ditolak atau dinonaktifkan oleh Admin KaiwaDojo.`,
            'warning',
            'Mengerti'
          )
          return
        }

        sessionStorage.setItem('kaiwa_session_active', 'true')
        if (profData) {
          sessionStorage.setItem('kaiwa_custom_profile', JSON.stringify(profData))
        }
        window.dispatchEvent(new Event('kaiwa_profile_updated'))
      } else {
        sessionStorage.setItem('kaiwa_session_active', 'true')
      }
      setLoading(false)
      navigate('/dashboard')
    }
  }

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center p-4 transition-colors relative"
      style={{
        backgroundImage:
          "linear-gradient(to bottom, rgba(15,23,42,0.75), rgba(15,23,42,0.88)), url('/japan-background(5).jpg')",
      }}
    >

      {/* Floating Back to Landing Page Button */}
      <button
        onClick={() => navigate('/')}
        className="fixed top-4 left-4 z-50 inline-flex items-center gap-2 px-4 py-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:text-primary dark:hover:text-red-400 font-extrabold text-xs rounded-2xl shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
      >
        <span>← Kembali ke Landing Page</span>
      </button>

      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/10 dark:bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] bg-primary/10 dark:bg-primary/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md animate-scale-up relative z-10">

        {/* Header Logo */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="size-16 bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 flex items-center justify-center mb-3 overflow-hidden">
            <img src="/kaiwa-logo.png" alt="KaiwaDoJo" className="size-11 object-contain" />
          </div>
          <h1 className="text-2xl font-black text-primary dark:text-red-400 tracking-tight">KaiwaDoJo</h1>
          <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5 font-medium">Platform Belajar Bahasa Jepang</p>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8">
          <div className="mb-6 text-left">
            <h2 className="text-xl font-black text-slate-800 dark:text-white">Masuk ke Akun</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Selamat datang kembali! Silakan masukkan username dan password kamu.
            </p>
          </div>

          {sessionExpiredNotice && (
            <div className="mb-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-2xl p-3.5 flex items-start justify-between gap-3 text-xs text-amber-800 dark:text-amber-200 font-semibold animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="text-base shrink-0">🔒</span>
                <span>{sessionExpiredNotice}</span>
              </div>
              <button
                onClick={clearSessionNotice}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-base border-none bg-transparent cursor-pointer shrink-0"
              >
                ×
              </button>
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-4">

            {/* Username / Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-username" className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Username atau Email
              </label>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                placeholder="username atau nama@email.com"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-primary dark:focus:border-red-400 focus:ring-2 focus:ring-primary/10 transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 font-medium"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Password
                </label>
                <button type="button" className="text-xs text-primary dark:text-red-400 hover:underline font-bold border-none bg-transparent cursor-pointer">
                  Lupa password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-primary dark:focus:border-red-400 focus:ring-2 focus:ring-primary/10 transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 font-medium pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs border-none bg-transparent cursor-pointer font-bold"
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 text-xs sm:text-sm text-red-600 dark:text-red-400 font-bold">
                ⚠️ {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              id="btn-login"
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white font-extrabold py-3.5 rounded-xl transition-all duration-200 text-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer border-none mt-2 shadow-md hover:shadow-lg active:scale-[0.98]"
            >
              {loading ? 'Memproses Masuk...' : 'Masuk →'}
            </button>
          </form>

          {/* Registration Link & Back to Landing Page */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center flex flex-col items-center gap-3">
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Belum punya akun?{' '}
              <Link to="/register" className="text-primary dark:text-red-400 font-extrabold hover:underline">
                Daftar sekarang
              </Link>
            </p>
            <button
              onClick={() => navigate('/')}
              className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-red-400 transition-colors border-none bg-transparent cursor-pointer flex items-center gap-1.5"
            >
              <span>🏠 Kembali ke Halaman Utama</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6 font-medium">
          © {new Date().getFullYear()} KaiwaDoJo. All rights reserved.
        </p>
      </div>

      {/* Pop-Up Alert Modal */}
      <CustomAlertModal
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        buttonText={alertModal.buttonText}
        onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}
