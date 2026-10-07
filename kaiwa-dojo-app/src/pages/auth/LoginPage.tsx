import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import { fetchStudents } from '../../lib/studentService'
import { getAdminWhatsAppUrl } from '../../lib/whatsappService'
import CustomAlertModal from '../../components/CustomAlertModal'
import { claimDeviceSession } from '../../lib/deviceUtils'
import { SecurityRateLimiter, sanitizeInput } from '../../lib/securityUtils'

export default function LoginPage() {
  const navigate = useNavigate()
  const { sessionExpiredNotice, clearSessionNotice } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0)

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

  // Lockout countdown timer
  useEffect(() => {
    let timer: any = null
    if (lockoutSeconds > 0) {
      timer = setInterval(() => {
        setLockoutSeconds(prev => (prev > 0 ? prev - 1 : 0))
      }, 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [lockoutSeconds])

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

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    clearSessionNotice()
    setError(null)

    const inputClean = sanitizeInput(username).toLowerCase().replace(/^@/, '')

    if (!inputClean) {
      showAlert('Username Belum Diisi', 'Silakan masukkan username atau email Anda terlebih dahulu.')
      return
    }

    // Rate Limit Check
    const rateKey = `user_login_${inputClean}`
    const rateCheck = SecurityRateLimiter.check(rateKey, 6, 180)
    if (!rateCheck.allowed || lockoutSeconds > 0) {
      const remainingSecs = lockoutSeconds || rateCheck.lockoutSecondsLeft
      setLockoutSeconds(remainingSecs)
      showAlert(
        'Terlalu Banyak Percobaan',
        `Akses login untuk akun ini dikunci sementara karena terlalu banyak percobaan gagal. Silakan coba kembali dalam ${remainingSecs} detik.`,
        'lock',
        'Tutup'
      )
      return
    }

    if (!password) {
      showAlert('Password Belum Diisi', 'Silakan masukkan password akun Anda terlebih dahulu.', 'lock', 'Isi Password')
      return
    }

    setLoading(true)

    // 1. Special Admin Login Credentials
    if (inputClean === 'kaiwahiroshima') {
      if (password === 'inaconnextkaiwa6') {
        const adminId = '00000000-0000-0000-0000-000000000099'
        await supabase.auth.signInWithPassword({
          email: 'kaiwahiroshima',
          password: 'inaconnextkaiwa6',
        })

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
            .select('full_name, username, bio, avatar_url')
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
          }
        } catch (e) {
          console.warn('Admin upsert note:', e)
        }

        await claimDeviceSession(adminId)
        sessionStorage.setItem('kaiwa_session_active', 'true')
        sessionStorage.setItem('kaiwa_custom_profile', JSON.stringify(adminProf))
        localStorage.removeItem('kaiwa_custom_profile')
        window.dispatchEvent(new Event('kaiwa_profile_updated'))

        setLoading(false)
        navigate('/dashboard')
        return
      } else {
        setLoading(false)
        showAlert(
          'Password Salah',
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
          'Akun Menunggu Verifikasi Admin',
          `Pendaftaran akun Anda ("${studentMatch.full_name}") telah berhasil memverifikasi OTP.\n\nNamun saat ini akun Anda masih dalam **proses peninjauan & verifikasi oleh Admin**. Silakan hubungi Admin via WhatsApp untuk mempercepat verifikasi.`,
          'warning',
          'Tutup',
          getAdminWhatsAppUrl(studentMatch.username),
          'Konfirmasi ke WhatsApp Admin'
        )
        return
      }

      if (studentMatch.status === 'rejected') {
        setLoading(false)
        showAlert(
          'Akun Ditolak / Nonaktif',
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
          'Username Tidak Ditemukan',
          `Username "**${username}**" belum terdaftar di sistem KaiwaDojo.\n\nSilakan periksa kembali ejaan username Anda atau daftar akun baru jika belum memiliki akun.`,
          'warning',
          'Periksa Username'
        )
        return
      }

      if (userProfile.status === 'pending') {
        setLoading(false)
        showAlert(
          'Akun Menunggu Verifikasi Admin',
          `Pendaftaran akun Anda ("${userProfile.full_name || username}") telah berhasil memverifikasi OTP.\n\nNamun saat ini akun Anda masih dalam **proses peninjauan & verifikasi oleh Admin**. Silakan hubungi Admin via WhatsApp untuk mempercepat verifikasi.`,
          'warning',
          'Tutup',
          getAdminWhatsAppUrl(userProfile.username || username),
          'Konfirmasi ke WhatsApp Admin'
        )
        return
      }

      if (userProfile.status === 'rejected') {
        setLoading(false)
        showAlert(
          'Akun Ditolak / Nonaktif',
          `Akun Anda ("${userProfile.full_name || username}") telah ditolak atau dinonaktifkan oleh Admin KaiwaDojo.`,
          'warning',
          'Mengerti'
        )
        return
      }

      if (!userProfile.email) {
        setLoading(false)
        showAlert(
          'Email Tidak Terkait',
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
          'Akun Menunggu Verifikasi Admin',
          `Pendaftaran akun Anda ("${emailProfile.full_name || username}") telah berhasil memverifikasi OTP.\n\nNamun saat ini akun Anda masih dalam **proses peninjauan & verifikasi oleh Admin**. Silakan hubungi Admin via WhatsApp untuk mempercepat verifikasi.`,
          'warning',
          'Tutup',
          getAdminWhatsAppUrl(username),
          'Konfirmasi ke WhatsApp Admin'
        )
        return
      }

      if (emailProfile?.status === 'rejected') {
        setLoading(false)
        showAlert(
          'Akun Ditolak / Nonaktif',
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
      const res = SecurityRateLimiter.recordFailure(rateKey, 6, 180)
      if (res.locked) {
        setLockoutSeconds(res.lockoutSecondsLeft)
        showAlert(
          'Akun Terkunci Sementara',
          `Terlalu banyak percobaan login gagal untuk akun ini. Sistem mengunci percobaan login selama ${res.lockoutSecondsLeft} detik untuk mencegah pembajakan akun.`,
          'lock',
          'Mengerti'
        )
        return
      }

      if (authError.message === 'Email not confirmed') {
        showAlert(
          'Email Belum Dikonfirmasi',
          `Email untuk akun ini belum dikonfirmasi.\n\nSilakan cek inbox atau folder spam email Anda untuk verifikasi.`,
          'info',
          'Mengerti'
        )
      } else if (authError.message === 'Invalid login credentials') {
        if (!userFoundInDb && inputClean.includes('@')) {
          showAlert(
            'Email Tidak Ditemukan',
            `Email "**${username}**" belum terdaftar di sistem KaiwaDojo.\n\nSilakan periksa kembali ejaan email Anda atau buat akun baru. (Sisa percobaan: ${res.remainingAttempts}x)`,
            'warning',
            'Periksa Email'
          )
        } else {
          showAlert(
            'Password Salah',
            `Password yang Anda masukkan untuk akun "**${username}**" salah.\n\nSilakan periksa kembali huruf besar/kecil (Caps Lock) password Anda dan coba lagi. (Sisa percobaan: ${res.remainingAttempts}x sebelum akun terkunci)`,
            'lock',
            'Coba Password Lagi'
          )
        }
      } else {
        showAlert('Gagal Masuk', `Terjadi kendala saat login: ${authError.message}`, 'warning')
      }
    } else {
      // Reset rate limit on success
      SecurityRateLimiter.reset(rateKey)

      // Fetch user profile to cache in session
      if (authData?.user?.id) {
        const { data: profData } = await supabase
          .from('profiles')
          .select('id, full_name, username, email, phone_number, institution, group_name, avatar_url, bio, role, streak_days, status, last_active_at, created_at, updated_at')
          .eq('id', authData.user.id)
          .maybeSingle()

        if (profData?.status === 'pending') {
          setLoading(false)
          showAlert(
            'Akun Menunggu Verifikasi Admin',
            `Pendaftaran akun Anda ("${profData.full_name || username}") telah berhasil memverifikasi OTP.\n\nNamun saat ini akun Anda masih dalam **proses peninjauan & verifikasi oleh Admin**. Silakan hubungi Admin via WhatsApp untuk mempercepat verifikasi.`,
            'warning',
            'Tutup',
            getAdminWhatsAppUrl(profData.username || username),
            'Konfirmasi ke WhatsApp Admin'
          )
          return
        }

        if (profData?.status === 'rejected') {
          setLoading(false)
          showAlert(
            'Akun Ditolak / Nonaktif',
            `Akun Anda ("${profData.full_name || username}") telah ditolak atau dinonaktifkan oleh Admin KaiwaDojo.`,
            'warning',
            'Mengerti'
          )
          return
        }

        // Claim session & enter (multi-device allowed)
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

  // Theme State
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark')
    }
    return false
  })

  useEffect(() => {
    const handleStorage = () => {
      if (typeof document !== 'undefined') {
        setIsDark(document.documentElement.classList.contains('dark'))
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const toggleTheme = () => {
    const root = document.documentElement
    if (isDark) {
      root.classList.remove('dark')
      localStorage.setItem('kaiwa_theme', 'light')
      setIsDark(false)
    } else {
      root.classList.add('dark')
      localStorage.setItem('kaiwa_theme', 'dark')
      setIsDark(true)
    }
    window.dispatchEvent(new Event('storage'))
  }

  return (
    <div
      className="min-h-dvh bg-cover bg-center bg-no-repeat flex items-center justify-center p-4 py-8 transition-colors relative"
      style={{
        backgroundImage: isDark
          ? "linear-gradient(to bottom, rgba(15,23,42,0.85), rgba(15,23,42,0.95)), url('/japan-background(5).jpg')"
          : "linear-gradient(to bottom, rgba(255,255,255,0.88), rgba(241,245,249,0.96)), url('/japan-background(5).jpg')",
      }}
    >

      {/* Floating Top Navigation: Back & Theme Toggle */}
      <div className="fixed top-3 left-3 right-3 sm:top-5 sm:left-5 sm:right-5 z-50 flex items-center justify-between pointer-events-none">
        <button
          type="button"
          onClick={() => navigate('/')}
          title="Kembali"
          className="pointer-events-auto size-9 sm:size-10 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-black text-sm shadow-md hover:border-primary/40 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer touch-manipulation"
        >
          &lt;
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? 'Mode Terang' : 'Mode Gelap'}
          className="pointer-events-auto size-9 sm:size-10 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-md flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95"
        >
          {isDark ? (
            <svg className="size-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="size-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>

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
                <svg className="size-4 shrink-0 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>{sessionExpiredNotice}</span>
              </div>
              <button
                onClick={clearSessionNotice}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-base border-none bg-transparent cursor-pointer shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center touch-manipulation"
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
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                autoComplete="username"
                disabled={lockoutSeconds > 0 || loading}
                placeholder="username atau nama@email.com"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-4 py-3.5 sm:py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-base sm:text-sm text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-primary dark:focus:border-red-400 focus:ring-2 focus:ring-primary/10 transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 font-medium min-h-[44px] touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Password
                </label>
                <button type="button" className="text-xs text-primary dark:text-red-400 hover:underline font-bold border-none bg-transparent cursor-pointer touch-manipulation py-1">
                  Lupa password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  autoComplete="current-password"
                  disabled={lockoutSeconds > 0 || loading}
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 sm:py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-base sm:text-sm text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-primary dark:focus:border-red-400 focus:ring-2 focus:ring-primary/10 transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 font-medium pr-12 min-h-[44px] touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm border-none bg-transparent cursor-pointer font-bold min-h-[36px] min-w-[36px] flex items-center justify-center touch-manipulation"
                  aria-label="Toggle password visibility"
                >
                  {showPass ? (
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-3 text-xs text-red-600 dark:text-red-400 font-bold flex items-center gap-2">
                <svg className="size-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              id="btn-login"
              type="submit"
              disabled={loading || lockoutSeconds > 0}
              className="group w-full bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white font-extrabold py-3.5 rounded-xl transition-all duration-200 text-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer border-none mt-2 shadow-md hover:shadow-lg active:scale-[0.98] min-h-[48px] touch-manipulation flex items-center justify-center gap-2"
            >
              <span>
                {lockoutSeconds > 0
                  ? `Terkunci (${lockoutSeconds}s)`
                  : loading
                  ? 'Memproses Masuk...'
                  : 'Masuk ke Akun'}
              </span>
              {lockoutSeconds === 0 && (
                <span className="size-5 rounded-full bg-white/20 flex items-center justify-center text-[0.65rem] font-black group-hover:translate-x-0.5 transition-transform">
                  &gt;
                </span>
              )}
            </button>
          </form>

          {/* Registration Link */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Belum punya akun?{' '}
              <Link to="/register" className="text-primary dark:text-red-400 font-extrabold underline hover:opacity-80 ml-1">
                Daftar sekarang
              </Link>
            </p>
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
    </div>
  )
}

