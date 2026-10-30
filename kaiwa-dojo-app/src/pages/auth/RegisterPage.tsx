import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { createStudentAccount } from '../../lib/studentService'
import { sendWhatsAppOtp, validateWhatsAppNumber, getAdminWhatsAppUrl } from '../../lib/whatsappService'
import { sanitizeInput, sanitizeUsername, sanitizePhoneNumber, isValidEmail, SecurityRateLimiter } from '../../lib/securityUtils'
import KaiwaLogo from '../../components/KaiwaLogo'
import { fetchRegistrationConfig, verifyReferralCode } from '../../lib/subscriptionService'

export default function RegisterPage() {
  const navigate = useNavigate()

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

  // Multi-step Wizard State
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)

  // Form Fields
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [institution, setInstitution] = useState('')

  const [referralCode, setReferralCode] = useState('')
  // Kode referral dari pendaftaran langganan (website bangunnegeri) — wajib bila server mengaktifkan REQUIRE_SUBSCRIPTION
  const [referralRequired, setReferralRequired] = useState(false)
  const [referralError, setReferralError] = useState<string | null>(null)
  const [referralPlan, setReferralPlan] = useState<string | null>(null)
  useEffect(() => {
    fetchRegistrationConfig().then(cfg => setReferralRequired(cfg.required))
  }, [])
  const [domisili, setDomisili] = useState('')
  const [kabupaten, setKabupaten] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)

  // Validation & Error States
  const [error, setError] = useState<string | null>(null)
  const [stepError, setStepError] = useState<string | null>(null)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  // OTP Verification Modal State
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [generatedOtp, setGeneratedOtp] = useState('')
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [otpError, setOtpError] = useState<string | null>(null)
  const [otpTimer, setOtpTimer] = useState<number>(60)
  const [verifyingOtp, setVerifyingOtp] = useState(false)

  const otpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  // OTP Countdown timer
  useEffect(() => {
    let interval: any = null
    if (showOtpModal && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer(prev => prev - 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [showOtpModal, otpTimer])

  // Password Strength Calculation
  const getPasswordStrength = () => {
    if (!password) return { score: 0, label: 'Belum diisi', color: 'bg-slate-200 dark:bg-slate-700' }
    let score = 0
    if (password.length >= 8) score += 1
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1
    if (/[0-9]/.test(password)) score += 1
    if (/[^A-Za-z0-9]/.test(password)) score += 1

    if (score <= 1) return { score: 1, label: 'Lemah', color: 'bg-red-500' }
    if (score === 2) return { score: 2, label: 'Cukup', color: 'bg-amber-500' }
    if (score === 3) return { score: 3, label: 'Kuat', color: 'bg-emerald-500' }
    return { score: 4, label: 'Sangat Kuat', color: 'bg-emerald-600' }
  }

  const passStrength = getPasswordStrength()

  async function generateNewOtp() {
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    setGeneratedOtp(code)
    setOtpDigits(['', '', '', '', '', ''])
    setOtpError(null)
    setOtpTimer(60)

    const res = await sendWhatsAppOtp({
      phoneNumber: phoneNumber || '081234567890',
      otpCode: code,
    })

    if (!res.success) {
      setOtpError(`Kendala WA Gateway: ${res.reason || 'Gagal mengirim OTP'}. Silakan periksa status perangkat WhatsApp.`)
    }

    setTimeout(() => {
      otpRefs[0].current?.focus()
    }, 100)
  }

  async function performDuplicateCheck(u: string, e: string, p: string) {
    const cleanUser = u.trim().toLowerCase()
    const cleanEmail = e.trim().toLowerCase()
    const rawPhone = p.trim()
    let cleanPhoneNum = rawPhone.replace(/[^0-9]/g, '')
    let formattedPhone = cleanPhoneNum
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.slice(1)
    }

    let isUserDupe = false
    let isEmailDupe = false
    let isPhoneDupe = false

    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('check_user_duplicates', {
        p_username: cleanUser,
        p_email: cleanEmail,
        p_phone: rawPhone,
      })

      if (!rpcErr && rpcData && rpcData.length > 0) {
        isUserDupe = !!rpcData[0].username_exists
        isEmailDupe = !!rpcData[0].email_exists
        isPhoneDupe = !!rpcData[0].phone_exists
        return { isUserDupe, isEmailDupe, isPhoneDupe, hasDuplicate: isUserDupe || isEmailDupe || isPhoneDupe }
      }
    } catch (rpcEx) {
      console.warn('RPC check_user_duplicates fallback:', rpcEx)
    }

    try {
      const { data: matchedProfiles } = await supabase
        .from('profiles')
        .select('username, email, phone_number')

      if (matchedProfiles && matchedProfiles.length > 0) {
        for (const row of matchedProfiles) {
          if (cleanUser && row.username && row.username.toLowerCase() === cleanUser) {
            isUserDupe = true
          }
          if (cleanEmail && row.email && row.email.toLowerCase() === cleanEmail) {
            isEmailDupe = true
          }
          if (rawPhone && row.phone_number) {
            const rowPhoneClean = row.phone_number.replace(/[^0-9]/g, '')
            if (row.phone_number === rawPhone || (cleanPhoneNum && rowPhoneClean === cleanPhoneNum) || (formattedPhone && rowPhoneClean === formattedPhone)) {
              isPhoneDupe = true
            }
          }
        }
      }
    } catch (dbErr) {
      console.warn('DB dupe check fallback error:', dbErr)
    }

    return { isUserDupe, isEmailDupe, isPhoneDupe, hasDuplicate: isUserDupe || isEmailDupe || isPhoneDupe }
  }

  async function handleCheckUsernameOnBlur() {
    if (!username.trim()) return
    const res = await performDuplicateCheck(username, '', '')
    if (res.isUserDupe) {
      setUsernameError(`Username @${username.trim().toLowerCase()} sudah terdaftar.`)
    }
  }

  async function handleCheckPhoneOnBlur() {
    if (!phoneNumber.trim()) return
    const res = await performDuplicateCheck('', '', phoneNumber)
    if (res.isPhoneDupe) {
      setPhoneError(`Nomor WhatsApp ${phoneNumber.trim()} sudah terdaftar.`)
    }
  }

  async function handleCheckEmailOnBlur() {
    if (!email.trim()) return
    const res = await performDuplicateCheck('', email, '')
    if (res.isEmailDupe) {
      setEmailError(`Email ${email.trim().toLowerCase()} sudah terdaftar.`)
    }
  }

  // Step Validation Handlers
  function handleNextStep() {
    setStepError(null)

    if (currentStep === 1) {
      if (!fullName.trim()) {
        setStepError('Mohon isi Nama Lengkap terlebih dahulu.')
        return
      }
      if (!username.trim()) {
        setStepError('Mohon isi Username akun Anda.')
        return
      }
      if (username.length < 3) {
        setStepError('Username minimal 3 karakter.')
        return
      }
      if (!phoneNumber.trim()) {
        setStepError('Mohon isi Nomor WhatsApp aktif.')
        return
      }
      if (phoneNumber.replace(/[^0-9]/g, '').length < 9) {
        setStepError('Format nomor WhatsApp terlalu pendek.')
        return
      }
      if (!institution.trim()) {
        setStepError('Mohon isi Asal Lembaga / Kampus Anda.')
        return
      }
      setCurrentStep(2)
      return
    }

    if (currentStep === 2) {
      if (!domisili.trim()) {
        setStepError('Mohon sebutkan kota domisili Anda.')
        return
      }
      setCurrentStep(3)
      return
    }
  }

  async function handleStartRegistration(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setStepError(null)
    setUsernameError(null)
    setPhoneError(null)
    setEmailError(null)
    setLoading(true)

    const cleanEmail = email.trim().toLowerCase()
    if (!isValidEmail(cleanEmail)) {
      setEmailError('Format email tidak valid.')
      setError('Format email tidak valid.')
      setLoading(false)
      return
    }

    if (password.length < 8) {
      setError('Password minimal 8 karakter.')
      setLoading(false)
      return
    }

    // Kode referral langganan + email harus cocok dengan data pendaftaran langganan
    setReferralError(null)
    const cleanReferral = referralCode.trim().toUpperCase()
    if (referralRequired && !cleanReferral) {
      setReferralError('Masukkan kode referral yang kamu terima setelah berlangganan.')
      setError('Kode referral wajib diisi.')
      setLoading(false)
      return
    }
    if (cleanReferral) {
      const check = await verifyReferralCode(cleanEmail, cleanReferral)
      if (check.valid) {
        setReferralPlan(check.planName || null)
      } else if (referralRequired) {
        setReferralError(check.message || 'Kode referral tidak valid.')
        setError(check.message || 'Kode referral tidak valid.')
        setLoading(false)
        return
      }
    }

    const cleanPhone = sanitizePhoneNumber(phoneNumber)
    const otpRateKey = `otp_phone_${cleanPhone}`
    const otpRateCheck = SecurityRateLimiter.check(otpRateKey, 4, 300)
    if (!otpRateCheck.allowed) {
      setError(`Terlalu banyak permintaan OTP untuk nomor ini. Silakan tunggu ${otpRateCheck.lockoutSecondsLeft} detik sebelum meminta kode baru.`)
      setLoading(false)
      return
    }

    const dupeRes = await performDuplicateCheck(username, cleanEmail, cleanPhone)
    let hasDuplicate = false
    if (dupeRes.isUserDupe) {
      setUsernameError(`Username @${username.trim().toLowerCase()} sudah terdaftar.`)
      hasDuplicate = true
    }
    if (dupeRes.isEmailDupe) {
      setEmailError(`Email ${cleanEmail} sudah terdaftar.`)
      hasDuplicate = true
    }
    if (dupeRes.isPhoneDupe) {
      setPhoneError(`Nomor WhatsApp ${cleanPhone} sudah terdaftar.`)
      hasDuplicate = true
    }

    if (hasDuplicate) {
      setLoading(false)
      setError('Terdapat data yang sudah terdaftar (Username, Email, atau No. WhatsApp). Silakan periksa kembali.')
      return
    }

    const waCheck = await validateWhatsAppNumber(cleanPhone)
    if (!waCheck.isValid) {
      setPhoneError(waCheck.message || 'Nomor WhatsApp tidak terdaftar / tidak aktif.')
      setLoading(false)
      return
    }

    SecurityRateLimiter.recordFailure(otpRateKey, 4, 300)

    await generateNewOtp()
    setLoading(false)
    setShowOtpModal(true)
  }

  function handleOtpDigitChange(index: number, value: string) {
    const val = value.replace(/[^0-9]/g, '')
    if (!val) {
      const newDigits = [...otpDigits]
      newDigits[index] = ''
      setOtpDigits(newDigits)
      setOtpError(null)
      return
    }

    if (val.length === 6) {
      const newDigits = val.split('')
      setOtpDigits(newDigits)
      setOtpError(null)
      otpRefs[5].current?.focus()
      return
    }

    const newDigits = [...otpDigits]
    newDigits[index] = val[val.length - 1]
    setOtpDigits(newDigits)
    setOtpError(null)

    if (val && index < 5) {
      otpRefs[index + 1].current?.focus()
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs[index - 1].current?.focus()
    }
  }

  async function handleVerifyOtpSubmit(e: React.FormEvent) {
    e.preventDefault()
    setOtpError(null)
    const entered = otpDigits.join('')

    if (entered.length < 6) {
      setOtpError('Mohon isi 6 digit kode OTP secara lengkap.')
      return
    }

    if (entered !== generatedOtp) {
      setOtpError('Kode OTP tidak sesuai. Silakan periksa kembali kode yang dikirim.')
      return
    }

    setVerifyingOtp(true)

    const cleanFullName = sanitizeInput(fullName, 100)
    const cleanUsername = sanitizeUsername(username)
    const cleanEmail = email.trim().toLowerCase()
    const cleanPhone = sanitizePhoneNumber(phoneNumber)
    const cleanInstitution = sanitizeInput(institution, 150)
    const cleanReferralCode = sanitizeInput(referralCode, 32)
    const cleanDomisili = sanitizeInput(domisili, 150)
    const cleanKelurahan = ''
    const cleanKecamatan = ''
    const cleanKabupaten = sanitizeInput(kabupaten || domisili, 100)

    let authUserId: string | undefined

    try {
      let { data: authData, error: signUpErr } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanFullName,
            username: cleanUsername,
            phone_number: cleanPhone,
            institution: cleanInstitution,
            referral_code: cleanReferralCode,
            domisili: cleanDomisili,
            kelurahan: cleanKelurahan,
            kecamatan: cleanKecamatan,
            kabupaten: cleanKabupaten,
            role: 'pelajar',
            status: 'pending',
          },
        },
      })

      if (signUpErr && signUpErr.message.toLowerCase().includes('database error saving new user')) {
        console.warn('Full metadata signUp failed DB trigger. Retrying minimal metadata signUp...')
        const fallbackSignUp = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: cleanFullName,
              username: cleanUsername,
            },
          },
        })
        if (!fallbackSignUp.error) {
          authData = fallbackSignUp.data
          signUpErr = null
        }
      }

      if (signUpErr) {
        if (signUpErr.message.toLowerCase().includes('already registered')) {
          const { data: existingProf } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', cleanEmail)
            .maybeSingle()

          if (existingProf) {
            setVerifyingOtp(false)
            setShowOtpModal(false)
            setDone(true)
            return
          }

          setVerifyingOtp(false)
          setOtpError('Email ini sudah terdaftar di sistem. Silakan menuju halaman Login.')
        } else {
          setVerifyingOtp(false)
          setOtpError(`Gagal mendaftar: ${signUpErr.message}`)
        }
        return
      }

      authUserId = authData?.user?.id
    } catch (e: any) {
      setVerifyingOtp(false)
      setOtpError(`Gagal menghubungi server pendaftaran: ${e?.message || 'Error'}`)
      return
    }

    if (!authUserId) {
      setVerifyingOtp(false)
      setOtpError('Gagal memperoleh ID pendaftaran dari Supabase. Silakan coba lagi.')
      return
    }

    const newStudent = await createStudentAccount({
      id: authUserId,
      full_name: cleanFullName,
      username: cleanUsername,
      email: cleanEmail,
      phone_number: cleanPhone,
      institution: cleanInstitution,
      referral_code: cleanReferralCode || null,
      domisili: cleanDomisili,
      kelurahan: cleanKelurahan,
      kecamatan: cleanKecamatan,
      kabupaten: cleanKabupaten,
      bio: 'Siswa Baru kaiwadojo',
      status: 'pending',
    })

    if (!newStudent) {
      const { data: checkProf } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authUserId)
        .maybeSingle()

      if (!checkProf) {
        setVerifyingOtp(false)
        setOtpError('Gagal menyimpan data akun ke database. Silakan coba lagi.')
        return
      }
    }

    setVerifyingOtp(false)
    setShowOtpModal(false)
    setDone(true)
  }

  // ── Success & Pending Admin Verification Screen ─────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-10 max-w-md w-full text-center animate-scale-up">
          <div className="size-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 dark:text-amber-400 flex items-center justify-center mx-auto mb-5">
            <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-3">
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>Verifikasi OTP Berhasil</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
            Menunggu Verifikasi Admin
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
            Pendaftaran akun <span className="font-bold text-slate-900 dark:text-white">{fullName}</span> telah selesai. Akun Anda saat ini sedang dalam proses aktivasi oleh Admin kaiwadojo.
          </p>

          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 mb-6 text-left leading-relaxed flex items-start gap-2.5">
            <svg className="size-5 shrink-0 text-amber-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Konfirmasikan pendaftaran Anda ke Admin via WhatsApp untuk mempercepat proses persetujuan akun.</span>
          </div>

          <div className="flex flex-col gap-3">
            <a
              href={getAdminWhatsAppUrl(username)}
              target="_blank"
              rel="noopener noreferrer"
              className="group w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all text-xs sm:text-sm flex items-center justify-center gap-2 no-underline shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
            >
              <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.669-.699c.983.536 1.776.814 2.791.814 3.18 0 5.766-2.587 5.767-5.766.001-3.18-2.585-5.766-5.767-5.766zm3.376 8.21c-.141.396-.704.723-1.077.781-.354.055-.788.083-2.316-.549-1.954-.809-3.21-2.799-3.308-2.929-.098-.13-1.229-1.636-1.229-3.12 0-1.484.776-2.213 1.053-2.518.277-.306.604-.383.805-.383.201 0 .402.002.578.01.186.009.434-.07.679.519.255.612.868 2.119.943 2.273.076.153.126.333.025.534-.1.2-.15.326-.299.499-.148.174-.313.388-.447.521-.148.147-.303.307-.13.606.173.299.769 1.269 1.651 2.054 1.135 1.01 2.091 1.323 2.39 1.472.298.149.472.13.647-.07.175-.2.753-.878.955-1.179.201-.301.402-.251.678-.151.276.1.175.776.85 1.151.675.375.141.574.226.772.085.198-.056.704-.381 1.077z" />
              </svg>
              <span>Konfirmasi ke WhatsApp Admin</span>
              <span className="size-5 rounded-full bg-white/20 flex items-center justify-center text-[0.65rem] font-black group-hover:translate-x-0.5 transition-transform">
                &gt;
              </span>
            </a>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="group w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl transition-all text-xs flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              <span>Ke Halaman Login</span>
              <span className="size-4.5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[0.6rem] font-black group-hover:translate-x-0.5 transition-transform">
                &gt;
              </span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-dvh bg-cover bg-center bg-no-repeat flex items-center justify-center p-3 sm:p-6 md:p-8 py-8 sm:py-12 transition-colors relative"
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

      <div className="w-full max-w-2xl animate-scale-up relative z-10 my-auto">
        {/* Header Branding */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="size-13 sm:size-14 bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center mb-3 p-2">
            <KaiwaLogo className="size-full object-contain" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Pendaftaran Akun
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
            Bergabung bersama kaiwadojo untuk belajar bahasa Jepang interaktif.
          </p>
        </div>

        {/* Multi-Step Card */}
        <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-8 backdrop-blur-xl transition-colors">
          
          {/* ── STEPPER BAR ── */}
          <div className="mb-6">
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
              {[
                { step: 1, title: 'Profil', desc: 'Data Diri' },
                { step: 2, title: 'Domisili', desc: 'Kota Tinggal' },
                { step: 3, title: 'Keamanan', desc: 'Akun & Sandi' },
              ].map(item => {
                const isActive = currentStep === item.step
                const isCompleted = currentStep > item.step

                return (
                  <button
                    key={item.step}
                    type="button"
                    onClick={() => {
                      if (item.step < currentStep) setCurrentStep(item.step as 1 | 2 | 3)
                    }}
                    className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-xl border text-left transition-all ${
                      isActive
                        ? 'bg-primary/10 border-primary/40 text-primary dark:text-red-400 shadow-xs'
                        : isCompleted
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div
                      className={`size-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'bg-primary text-white'
                          : isCompleted
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {isCompleted ? (
                        <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        item.step
                      )}
                    </div>
                    <div className="hidden xs:block sm:block min-w-0">
                      <p className={`text-xs font-bold leading-tight truncate ${isActive ? 'text-primary dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>
                        {item.title}
                      </p>
                      <p className="text-[0.65rem] text-slate-400 truncate">{item.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Visual Progress Line */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300 ease-out"
                style={{
                  width: currentStep === 1 ? '33.33%' : currentStep === 2 ? '66.66%' : '100%',
                }}
              />
            </div>
          </div>

          {/* Form Content */}
          <form onSubmit={handleStartRegistration} className="flex flex-col gap-4">
            
            {/* ── STEP 1: PROFIL & KONTAK ── */}
            {currentStep === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Nama Lengkap */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="reg-fullname" className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>Nama Lengkap</span>
                      <span className="text-[0.68rem] text-red-500">*Wajib</span>
                    </label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <input
                        id="reg-fullname"
                        type="text"
                        autoComplete="name"
                        autoCapitalize="words"
                        placeholder="Contoh: Budi Santoso"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-slate-50 dark:bg-slate-950/70 focus:bg-white dark:focus:bg-slate-900 transition-all"
                      />
                    </div>
                  </div>

                  {/* Username */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="reg-username" className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>Username</span>
                      <span className="text-[0.68rem] text-slate-400">Tanpa spasi</span>
                    </label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono font-bold">
                        @
                      </div>
                      <input
                        id="reg-username"
                        type="text"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="budisantoso"
                        value={username}
                        onChange={e => {
                          setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))
                          if (usernameError) setUsernameError(null)
                        }}
                        onBlur={handleCheckUsernameOnBlur}
                        className={`w-full pl-8 pr-3.5 py-2.5 rounded-xl border text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all bg-slate-50 dark:bg-slate-950/70 focus:bg-white dark:focus:bg-slate-900 ${
                          usernameError
                            ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                            : 'border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/10'
                        }`}
                      />
                    </div>
                    {usernameError && (
                      <span className="text-[0.7rem] font-semibold text-red-500 dark:text-red-400">
                        {usernameError}
                      </span>
                    )}
                  </div>

                  {/* Nomor WhatsApp */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="reg-phone" className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>Nomor WhatsApp Aktif</span>
                      <span className="text-[0.68rem] text-emerald-600 dark:text-emerald-400">Untuk OTP</span>
                    </label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <input
                        id="reg-phone"
                        type="tel"
                        inputMode="tel"
                        placeholder="Contoh: 081234567890"
                        value={phoneNumber}
                        onChange={e => {
                          setPhoneNumber(e.target.value.replace(/[^0-9+]/g, ''))
                          if (phoneError) setPhoneError(null)
                        }}
                        onBlur={handleCheckPhoneOnBlur}
                        className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all bg-slate-50 dark:bg-slate-950/70 focus:bg-white dark:focus:bg-slate-900 ${
                          phoneError
                            ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                            : 'border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/10'
                        }`}
                      />
                    </div>
                    {phoneError && (
                      <span className="text-[0.7rem] font-semibold text-red-500 dark:text-red-400">
                        {phoneError}
                      </span>
                    )}
                  </div>

                  {/* Asal Lembaga */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="reg-institution" className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>Asal Lembaga / Kampus</span>
                      <span className="text-[0.68rem] text-red-500">*Wajib</span>
                    </label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <input
                        id="reg-institution"
                        type="text"
                        autoCapitalize="words"
                        placeholder="Contoh: LPK Kaiwa / Universitas X"
                        value={institution}
                        onChange={e => setInstitution(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-slate-50 dark:bg-slate-950/70 focus:bg-white dark:focus:bg-slate-900 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Step Action Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="group w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-primary/20 active:scale-[0.99]"
                  >
                    <span>Lanjut</span>
                    <span className="size-5 rounded-full bg-white/20 flex items-center justify-center text-[0.65rem] font-black group-hover:translate-x-0.5 transition-transform">
                      &gt;
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 2: DOMISILI (KOTA) ── */}
            {currentStep === 2 && (
              <div className="space-y-4 animate-fade-in">
                {/* Kota Domisili */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="reg-domisili" className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Kota Domisili</span>
                    <span className="text-[0.68rem] text-red-500">*Wajib</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <input
                      id="reg-domisili"
                      type="text"
                      placeholder="Contoh: Jakarta Selatan, Surabaya, Bandung, dll."
                      value={domisili}
                      onChange={e => {
                        setDomisili(e.target.value)
                        setKabupaten(e.target.value)
                        if (stepError) setStepError(null)
                      }}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-slate-50 dark:bg-slate-950/70 focus:bg-white dark:focus:bg-slate-900 transition-all"
                    />
                  </div>
                  <p className="text-[0.72rem] text-slate-500 dark:text-slate-400">
                    Cukup sebutkan nama kota atau kabupaten domisili Anda saat ini (tidak perlu alamat jalan lengkap).
                  </p>
                </div>

                {/* Step Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStepError(null)
                      setCurrentStep(1)
                    }}
                    className="group w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-2 cursor-pointer border border-slate-200 dark:border-slate-700"
                  >
                    <span className="size-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[0.65rem] font-black group-hover:-translate-x-0.5 transition-transform">
                      &lt;
                    </span>
                    <span>Kembali</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="group w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-primary/20 active:scale-[0.99]"
                  >
                    <span>Lanjut</span>
                    <span className="size-5 rounded-full bg-white/20 flex items-center justify-center text-[0.65rem] font-black group-hover:translate-x-0.5 transition-transform">
                      &gt;
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: KEAMANAN & KONFIRMASI ── */}
            {currentStep === 3 && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Email */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="reg-email" className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>Email Aktif</span>
                      <span className="text-[0.68rem] text-slate-400">Untuk Login</span>
                    </label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <input
                        id="reg-email"
                        type="email"
                        inputMode="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="nama@email.com"
                        value={email}
                        onChange={e => {
                          setEmail(e.target.value)
                          if (emailError) setEmailError(null)
                        }}
                        onBlur={handleCheckEmailOnBlur}
                        className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all bg-slate-50 dark:bg-slate-950/70 focus:bg-white dark:focus:bg-slate-900 ${
                          emailError
                            ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                            : 'border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/10'
                        }`}
                      />
                    </div>
                    {emailError && (
                      <span className="text-[0.7rem] font-semibold text-red-500 dark:text-red-400">
                        {emailError}
                      </span>
                    )}
                  </div>

                  {/* Password */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="reg-password" className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>Password Akun</span>
                      <span className="text-[0.68rem] text-slate-400">Min. 8 Karakter</span>
                    </label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <input
                        id="reg-password"
                        type={showPass ? 'text' : 'password'}
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="Minimal 8 karakter"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-slate-50 dark:bg-slate-950/70 focus:bg-white dark:focus:bg-slate-900 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(p => !p)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white border-none bg-transparent cursor-pointer p-1"
                        aria-label="Toggle password"
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
                </div>

                {/* Password Strength Indicator */}
                {password && (
                  <div className="bg-slate-50 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Kekuatan Sandi:</span>
                      <span className="font-bold text-slate-800 dark:text-white">{passStrength.label}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 h-1.5">
                      {[1, 2, 3, 4].map(idx => (
                        <div
                          key={idx}
                          className={`rounded-full transition-all duration-300 ${
                            idx <= passStrength.score ? passStrength.color : 'bg-slate-200 dark:bg-slate-800'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Kode Referral */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="reg-referral" className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Kode Referral{referralRequired && <span className="text-red-500"> *</span>}</span>
                    <span className="text-[0.68rem] text-slate-400">{referralRequired ? 'Wajib' : 'Opsional'}</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    </div>
                    <input
                      id="reg-referral"
                      type="text"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      maxLength={32}
                      placeholder="Contoh: KD-7F3K9Q"
                      value={referralCode}
                      onChange={e => { setReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '')); setReferralError(null); setReferralPlan(null) }}
                      aria-invalid={Boolean(referralError)}
                      aria-describedby="reg-referral-hint"
                      required={referralRequired}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-slate-50 dark:bg-slate-950/70 focus:bg-white dark:focus:bg-slate-900 transition-all"
                    />
                  </div>
                  <p id="reg-referral-hint" className={`text-[0.7rem] ${referralError ? 'text-red-600 dark:text-red-400 font-semibold' : referralPlan ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                    {referralError
                      || (referralPlan ? `Kode valid · Paket ${referralPlan}` : referralRequired
                        ? 'Gunakan kode & email yang sama dengan saat berlangganan di bangunnegeri.'
                        : 'Isi jika kamu punya kode referral.')}
                  </p>
                </div>

                {/* Ringkasan Singkat Data */}
                <div className="bg-slate-50 dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Nama & Username:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{fullName} (@{username})</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">WhatsApp:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{phoneNumber}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Domisili:</span>
                    <span className="truncate max-w-[200px] sm:max-w-xs">{[domisili, kabupaten].filter(s => s.trim()).join(', ') || '-'}</span>
                  </div>
                  {referralCode && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Kode Referral:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{referralCode}</span>
                    </div>
                  )}
                </div>

                {/* Step Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStepError(null)
                      setCurrentStep(2)
                    }}
                    className="group w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3.5 rounded-xl transition-all text-sm flex items-center justify-center gap-2 cursor-pointer border border-slate-200 dark:border-slate-700"
                  >
                    <span className="size-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[0.65rem] font-black group-hover:-translate-x-0.5 transition-transform">
                      &lt;
                    </span>
                    <span>Kembali</span>
                  </button>
                  <button
                    id="btn-register"
                    type="submit"
                    disabled={loading}
                    className="group w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3.5 rounded-xl transition-all text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 active:scale-[0.99] disabled:opacity-60"
                  >
                    <span>{loading ? 'Memproses...' : 'Kirim OTP'}</span>
                    <span className="size-5 rounded-full bg-white/20 flex items-center justify-center text-[0.65rem] font-black group-hover:translate-x-0.5 transition-transform">
                      &gt;
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Error Notification Alert */}
            {(stepError || error) && (
              <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 rounded-xl p-3 text-xs flex items-center gap-2 animate-fade-in">
                <svg className="size-4 shrink-0 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{stepError || error}</span>
              </div>
            )}
          </form>

          {/* Login Redirection */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sudah memiliki akun?{' '}
              <Link to="/login" className="text-primary dark:text-red-400 font-bold underline hover:opacity-80 ml-1">
                Masuk ke Akun
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6">
          &copy; {new Date().getFullYear()} kaiwadojo. All rights reserved.
        </p>
      </div>

      {/* ── OTP MODAL (WHATSAPP) ── */}
      {showOtpModal && (
        <div className="modal-overlay fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md z-[600] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-scale-up border border-slate-200 dark:border-slate-800 flex flex-col">
            
            {/* Modal Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-800 dark:from-emerald-950 dark:via-slate-900 dark:to-slate-900 border-b border-emerald-500/30 dark:border-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-white/20 dark:bg-emerald-500/10 border border-white/20 dark:border-emerald-500/20 text-white dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.669-.699c.983.536 1.776.814 2.791.814 3.18 0 5.766-2.587 5.767-5.766.001-3.18-2.585-5.766-5.767-5.766zm3.376 8.21c-.141.396-.704.723-1.077.781-.354.055-.788.083-2.316-.549-1.954-.809-3.21-2.799-3.308-2.929-.098-.13-1.229-1.636-1.229-3.12 0-1.484.776-2.213 1.053-2.518.277-.306.604-.383.805-.383.201 0 .402.002.578.01.186.009.434-.07.679.519.255.612.868 2.119.943 2.273.076.153.126.333.025.534-.1.2-.15.326-.299.499-.148.174-.313.388-.447.521-.148.147-.303.307-.13.606.173.299.769 1.269 1.651 2.054 1.135 1.01 2.091 1.323 2.39 1.472.298.149.472.13.647-.07.175-.2.753-.878.955-1.179.201-.301.402-.251.678-.151.276.1.175.776.85 1.151.675.375.141.574.226.772.085.198-.056.704-.381 1.077z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Verifikasi Kode OTP</h3>
                  <p className="text-[0.68rem] text-emerald-100 dark:text-slate-400">Dikirim via WhatsApp ke {phoneNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setShowOtpModal(false)}
                className="size-8 rounded-lg bg-black/20 text-white hover:bg-black/30 border-none cursor-pointer flex items-center justify-center transition-colors"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleVerifyOtpSubmit} className="p-5 sm:p-6 flex flex-col gap-4">
              <p className="text-xs text-slate-600 dark:text-slate-300 text-center leading-relaxed">
                Silakan masukkan 6-digit kode OTP yang telah dikirimkan ke nomor WhatsApp Anda.
              </p>

              {/* 6 Digit Input Boxes */}
              <div className="flex items-center justify-center gap-2 sm:gap-2.5 my-2">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={otpRefs[idx]}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpDigitChange(idx, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(idx, e)}
                    className="size-11 sm:size-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-center text-xl sm:text-2xl font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 focus:border-primary focus:bg-white dark:focus:bg-slate-900 outline-none transition-all shadow-xs"
                  />
                ))}
              </div>

              {otpError && (
                <div className="text-center text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 p-2.5 rounded-xl border border-red-200 dark:border-red-900">
                  {otpError}
                </div>
              )}

              {/* Resend Cooldown */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                <span>
                  {otpTimer > 0 ? `Waktu tersisa: ${otpTimer}d` : 'Waktu habis'}
                </span>
                <button
                  type="button"
                  onClick={generateNewOtp}
                  disabled={otpTimer > 0}
                  className="text-xs text-primary dark:text-red-400 hover:underline font-bold border-none bg-transparent cursor-pointer disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                >
                  Kirim Ulang OTP
                </button>
              </div>

              <button
                type="submit"
                disabled={verifyingOtp}
                className="group w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-xl text-sm border-none cursor-pointer transition-all shadow-lg shadow-primary/20 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <span>{verifyingOtp ? 'Memverifikasi...' : 'Verifikasi & Selesaikan Pendaftaran'}</span>
                <span className="size-5 rounded-full bg-white/20 flex items-center justify-center text-[0.65rem] font-black group-hover:translate-x-0.5 transition-transform">
                  &gt;
                </span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
