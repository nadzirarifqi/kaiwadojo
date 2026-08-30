import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import { fetchStudents } from '../../lib/studentService'
import { getAdminWhatsAppUrl } from '../../lib/whatsappService'
import CustomAlertModal from '../../components/CustomAlertModal'

import { getDeviceInfo, generateNewClientSessionId, claimDeviceSession, getOrCreateClientSessionId } from '../../lib/deviceUtils'

export default function LoginPage() {
  const navigate = useNavigate()
  const { sessionExpiredNotice, clearSessionNotice } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  // Multi-Device Conflict Modal State
  const [conflictModal, setConflictModal] = useState<{
    isOpen: boolean
    activeDevice: string
    currentDevice: string
    pendingProfile: any
    pendingAuthData: any
  }>({
    isOpen: false,
    activeDevice: '',
    currentDevice: '',
    pendingProfile: null,
    pendingAuthData: null,
  })
  const [takeoverLoading, setTakeoverLoading] = useState(false)

  // Pop-up Alert Modal State
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    type?: 'lock' | 'warning' | 'info' | 'success'
    buttonText?: string
    actionUrl?: string
    actionText?: string
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
    buttonText = 'Mengerti',
    actionUrl?: string,
    actionText?: string
  ) {
    setAlertModal({
      isOpen: true,
      title,
      message,
      type,
      buttonText,
      actionUrl,
      actionText,
    })
  }

  async function handleConfirmTakeover() {
    if (!conflictModal.pendingProfile?.id) return
    setTakeoverLoading(true)

    const newSessId = generateNewClientSessionId()
    const myDevice = getDeviceInfo()

    try {
      await supabase
        .from('profiles')
        .update({
          current_session_id: newSessId,
          current_device_info: myDevice,
          last_session_at: new Date().toISOString(),
          last_active_at: new Date().toISOString(),
        })
        .eq('id', conflictModal.pendingProfile.id)

      sessionStorage.setItem('kaiwa_session_active', 'true')
      sessionStorage.setItem(
        'kaiwa_custom_profile',
        JSON.stringify({
          ...conflictModal.pendingProfile,
          current_session_id: newSessId,
          current_device_info: myDevice,
        })
      )
      window.dispatchEvent(new Event('kaiwa_profile_updated'))

      setConflictModal(prev => ({ ...prev, isOpen: false }))
      setTakeoverLoading(false)
      navigate('/dashboard')
    } catch (e) {
      console.warn('Takeover error:', e)
      setTakeoverLoading(false)
      setConflictModal(prev => ({ ...prev, isOpen: false }))
      navigate('/dashboard')
    }
  }

  async function handleCancelTakeover() {
    await supabase.auth.signOut().catch(() => {})
    sessionStorage.removeItem('kaiwa_session_active')
    sessionStorage.removeItem('kaiwa_custom_profile')
    sessionStorage.removeItem('kaiwa_client_session_id')
    setConflictModal(prev => ({ ...prev, isOpen: false, pendingProfile: null, pendingAuthData: null }))
    setLoading(false)
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
        const adminId = '00000000-0000-0000-0000-000000000099'
        let adminProf = {
          id: adminId,
          full_name: 'Admin Hiroshima',
          username: 'kaiwahiroshima',
          email: 'admin@kaiwadojo.com',
          bio: '',
          avatar_url: null as string | null,
          role: 'admin',
          status: 'approved',
          streak_days: 99,
          last_active_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        try {
          const { data: dbAdmin } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', adminId)
            .maybeSingle()

          if (dbAdmin) {
            adminProf = {
              ...adminProf,
              full_name: dbAdmin.full_name || adminProf.full_name,
              username: dbAdmin.username || adminProf.username,
              bio: dbAdmin.bio || adminProf.bio,
              avatar_url: dbAdmin.avatar_url || adminProf.avatar_url,
            }
          } else {
            await supabase.from('profiles').upsert({
              id: adminId,
              full_name: 'Admin Hiroshima',
              username: 'kaiwahiroshima',
              email: 'admin@kaiwadojo.com',
              role: 'admin',
              status: 'approved',
            })
          }
        } catch (e) {
          console.warn('Admin upsert note:', e)
        }

        await claimDeviceSession(adminId)
        sessionStorage.setItem('kaiwa_session_active', 'true')
        sessionStorage.setItem('kaiwa_custom_profile', JSON.stringify(adminProf))
        localStorage.setItem('kaiwa_custom_profile', JSON.stringify(adminProf))
        window.dispatchEvent(new Event('kaiwa_profile_updated'))

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
          `Pendaftaran akun Anda ("${studentMatch.full_name}") telah berhasil memverifikasi OTP.\n\nNamun saat ini akun Anda masih dalam **proses peninjauan & verifikasi oleh Admin**. Silakan hubungi Admin via WhatsApp untuk mempercepat verifikasi.`,
          'warning',
          'Tutup',
          getAdminWhatsAppUrl(studentMatch.username),
          '💬 Konfirmasi ke WhatsApp Admin'
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
          `Pendaftaran akun Anda ("${userProfile.full_name || username}") telah berhasil memverifikasi OTP.\n\nNamun saat ini akun Anda masih dalam **proses peninjauan & verifikasi oleh Admin**. Silakan hubungi Admin via WhatsApp untuk mempercepat verifikasi.`,
          'warning',
          'Tutup',
          getAdminWhatsAppUrl(userProfile.username || username),
          '💬 Konfirmasi ke WhatsApp Admin'
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
          `Pendaftaran akun Anda ("${emailProfile.full_name || username}") telah berhasil memverifikasi OTP.\n\nNamun saat ini akun Anda masih dalam **proses peninjauan & verifikasi oleh Admin**. Silakan hubungi Admin via WhatsApp untuk mempercepat verifikasi.`,
          'warning',
          'Tutup',
          getAdminWhatsAppUrl(username),
          '💬 Konfirmasi ke WhatsApp Admin'
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
            `Pendaftaran akun Anda ("${profData.full_name || username}") telah berhasil memverifikasi OTP.\n\nNamun saat ini akun Anda masih dalam **proses peninjauan & verifikasi oleh Admin**. Silakan hubungi Admin via WhatsApp untuk mempercepat verifikasi.`,
            'warning',
            'Tutup',
            getAdminWhatsAppUrl(profData.username || username),
            '💬 Konfirmasi ke WhatsApp Admin'
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

        // ── Check Multi-Device Concurrent Session ──
        const myClientSess = getOrCreateClientSessionId()
        const otherSessId = profData?.current_session_id
        const otherDevice = profData?.current_device_info || 'Perangkat Lain'

        if (otherSessId && otherSessId !== myClientSess) {
          // An active session exists on another device!
          setConflictModal({
            isOpen: true,
            activeDevice: otherDevice,
            currentDevice: getDeviceInfo(),
            pendingProfile: profData,
            pendingAuthData: authData,
          })
          setLoading(false)
          return
        }

        // No conflict: claim session and enter
        await claimDeviceSession(authData.user.id)
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
        actionUrl={alertModal.actionUrl}
        actionText={alertModal.actionText}
        onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* ── Multi-Device Conflict & Takeover Modal ── */}
      {conflictModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-amber-500/30 text-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl shadow-amber-500/10 animate-scale-up relative overflow-hidden">
            {/* Ambient glow */}
            <div className="absolute -top-16 -right-16 size-36 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 size-36 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

            <div className="text-center mb-5">
              <div className="size-16 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3.5 shadow-lg">
                ⚠️
              </div>
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[0.7rem] font-extrabold uppercase tracking-widest inline-block mb-1.5">
                Perangkat Lain Terdeteksi
              </span>
              <h2 className="text-xl font-black text-white">Akun Sedang Aktif di Perangkat Lain</h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Untuk mencegah terjadinya bentrok progres atau data ganda, KaiwaDojo membatasi <span className="text-white font-bold">1 sesi perangkat aktif</span> untuk setiap akun.
              </p>
            </div>

            {/* Device Comparison Card */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-6 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <span>📱</span> Perangkat Aktif Saat Ini:
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 font-extrabold text-[0.72rem]">
                  {conflictModal.activeDevice}
                </span>
              </div>
              <div className="h-px bg-slate-800" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <span>💻</span> Perangkat Ini (Baru):
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-extrabold text-[0.72rem]">
                  {conflictModal.currentDevice}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <button
                type="button"
                disabled={takeoverLoading}
                onClick={handleConfirmTakeover}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-black uppercase tracking-wider rounded-2xl border-none cursor-pointer transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
              >
                {takeoverLoading ? (
                  <span>Mengalihkan Sesi...</span>
                ) : (
                  <>
                    <span>🔑 Masuk di Perangkat Ini</span>
                    <span className="text-[0.65rem] opacity-80 lowercase font-normal">(keluarkan perangkat lain)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={takeoverLoading}
                onClick={handleCancelTakeover}
                className="w-full py-3 px-4 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-extrabold rounded-2xl border border-slate-700 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.98]"
              >
                ❌ Batal & Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
