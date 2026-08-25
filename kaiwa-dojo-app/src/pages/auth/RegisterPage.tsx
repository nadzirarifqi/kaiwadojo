import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { createStudentAccount } from '../../lib/studentService'
import { sendWhatsAppOtp, validateWhatsAppNumber } from '../../lib/whatsappService'

export default function RegisterPage() {
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  // OTP Verification Modal State (WhatsApp Exclusively)
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

  function generateNewOtp() {
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    setGeneratedOtp(code)
    setOtpDigits(['', '', '', '', '', ''])
    setOtpError(null)
    setOtpTimer(60)

    // Kirim Kode OTP 6-Digit via WhatsApp
    sendWhatsAppOtp({
      phoneNumber: phoneNumber || '081234567890',
      otpCode: code,
    })

    setTimeout(() => {
      otpRefs[0].current?.focus()
    }, 100)
  }

  async function handleStartRegistration(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (password.length < 8) {
      setError('Password minimal 8 karakter!')
      setLoading(false)
      return
    }

    // 1. Validasi Keaktifan Nomor WhatsApp via Fonnte API /validate
    const waCheck = await validateWhatsAppNumber(phoneNumber)
    if (!waCheck.isValid) {
      setError(waCheck.message || 'Nomor WhatsApp tidak terdaftar / tidak aktif! Mohon periksa nomor Anda.')
      setLoading(false)
      return
    }

    // 2. Cek username unik sebelum daftar
    try {
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('username', username.trim().toLowerCase())

      if ((count ?? 0) > 0) {
        setError('Username sudah dipakai. Coba username lain.')
        setLoading(false)
        return
      }
    } catch {
      // Ignore
    }

    setLoading(false)
    // Pemicu OTP Modal
    generateNewOtp()
    setShowOtpModal(true)
  }

  function handleOtpDigitChange(index: number, value: string) {
    const val = value.replace(/[^0-9]/g, '')
    const newDigits = [...otpDigits]
    newDigits[index] = val ? val[val.length - 1] : ''
    setOtpDigits(newDigits)
    setOtpError(null)

    // Auto advance to next input box
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
      setOtpError('Mohon isi 6 digit kode OTP secara lengkap!')
      return
    }

    if (entered !== generatedOtp) {
      setOtpError('Kode OTP tidak sesuai. Silakan periksa kembali kode yang dikirim.')
      return
    }

    setVerifyingOtp(true)

    // Simpan Akun Pelajar Baru dengan status 'pending' (Menunggu Admin)
    await createStudentAccount({
      full_name: fullName.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      phone_number: phoneNumber.trim(),
      bio: 'Siswa Baru Kaiwa Dojo',
      status: 'pending',
    })

    try {
      await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            username: username.trim().toLowerCase(),
            phone_number: phoneNumber.trim(),
            role: 'pelajar',
            status: 'pending',
          },
        },
      })
    } catch (e) {
      console.warn('Supabase auth signup note:', e)
    }

    setVerifyingOtp(false)
    setShowOtpModal(false)
    setDone(true)
  }

  // ── Success & Pending Admin Verification Screen ─────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 md:p-10 max-w-md w-full text-center animate-scale-up">
          <div className="size-20 bg-amber-500/10 dark:bg-amber-500/20 rounded-full flex items-center justify-center text-4xl mx-auto mb-5 text-amber-500">
            ⏳
          </div>
          <div className="inline-block px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-black mb-2">
            ✅ Verifikasi OTP Berhasil!
          </div>
          <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white mb-2">
            Menunggu Verifikasi Admin
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
            Selamat <span className="font-bold text-slate-800 dark:text-white">{fullName}</span>! Pendaftaran dan verifikasi OTP Anda telah berhasil. Akun Anda saat ini sedang dalam <span className="font-bold text-amber-600 dark:text-amber-400">proses peninjauan & verifikasi oleh Admin</span>.
          </p>

          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs font-semibold text-amber-800 dark:text-amber-300 mb-6 text-left leading-relaxed">
            ℹ️ <span className="font-bold">Informasi:</span> Setelah Admin menyetujui akun Anda di panel kelola pelajar, Anda akan langsung dapat melakukan login dan masuk ke Dashboard KaiwaDojo.
          </div>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-2 no-underline shadow-md border-none cursor-pointer"
          >
            Ke Halaman Login →
          </button>
        </div>
      </div>
    )
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
            <h2 className="text-xl font-black text-slate-800 dark:text-white">Buat Akun Baru</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Daftar sekarang dan verifikasi OTP untuk mendaftar akun KaiwaDojo.
            </p>
          </div>

          <form onSubmit={handleStartRegistration} className="flex flex-col gap-4">
            {/* Nama Lengkap */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-fullname" className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Nama Lengkap
              </label>
              <input
                id="reg-fullname"
                type="text"
                placeholder="Budi Santoso"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-primary dark:focus:border-red-400 focus:ring-2 focus:ring-primary/10 transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 font-medium"
              />
            </div>

            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-username" className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold select-none">@</span>
                <input
                  id="reg-username"
                  type="text"
                  placeholder="budisantoso"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                  className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-primary dark:focus:border-red-400 focus:ring-2 focus:ring-primary/10 transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 font-medium"
                />
              </div>
            </div>

            {/* No Telepon */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-phone" className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Nomor WhatsApp
              </label>
              <input
                id="reg-phone"
                type="tel"
                placeholder="081234567890"
                required
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value.replace(/[^0-9+]/g, ''))}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-primary dark:focus:border-red-400 focus:ring-2 focus:ring-primary/10 transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 font-medium"
              />
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-email" className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Email
              </label>
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                placeholder="nama@email.com"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-primary dark:focus:border-red-400 focus:ring-2 focus:ring-primary/10 transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 font-medium"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-password" className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Password
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Min. 8 karakter"
                  required
                  minLength={8}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-primary dark:focus:border-red-400 focus:ring-2 focus:ring-primary/10 transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-base border-none bg-transparent cursor-pointer"
                  aria-label="Toggle password visibility"
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
              id="btn-register"
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-extrabold py-3.5 rounded-xl transition-all duration-200 text-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer border-none mt-2 shadow-md hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span>💬</span>
              <span>{loading ? 'Memproses...' : 'Kirim Kode OTP via WhatsApp →'}</span>
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center flex flex-col items-center gap-3">
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Sudah punya akun?{' '}
              <Link to="/login" className="text-primary dark:text-red-400 font-extrabold hover:underline">
                Masuk di sini
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6 font-medium">
          © {new Date().getFullYear()} KaiwaDoJo. All rights reserved.
        </p>
      </div>

      {/* ── OTP VERIFICATION MODAL (WHATSAPP) ───────────────────────────────────── */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[600] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-scale-up border border-slate-200 dark:border-slate-800 flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-emerald-900 via-emerald-800 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-xl shrink-0">
                  💬
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Verifikasi Kode OTP WhatsApp</h3>
                  <p className="text-[0.7rem] text-emerald-200">Dikirim ke {phoneNumber || 'Nomor WhatsApp'}</p>
                </div>
              </div>
              <button
                onClick={() => setShowOtpModal(false)}
                className="size-8 rounded-full bg-white/10 text-white hover:bg-white/20 border-none cursor-pointer text-lg flex items-center justify-center"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleVerifyOtpSubmit} className="p-6 flex flex-col gap-5">
              <div className="text-center">
                <div className="inline-block px-3.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-[0.68rem] font-black text-emerald-700 dark:text-emerald-300 mb-2 border border-emerald-300 dark:border-emerald-800">
                  💬 Kode OTP WhatsApp
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  Kode OTP 6-digit telah dikirimkan via WhatsApp ke nomor <span className="font-bold text-slate-900 dark:text-white">{phoneNumber}</span>. Silakan masukkan kode untuk memverifikasi pendaftaran.
                </p>
              </div>

              {/* 6 DIGIT OTP INPUT BOXES */}
              <div className="flex items-center justify-center gap-2 sm:gap-2.5 my-1">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={otpRefs[idx]}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpDigitChange(idx, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(idx, e)}
                    className="size-11 sm:size-12 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-center text-xl sm:text-2xl font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 focus:border-primary dark:focus:border-red-400 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all shadow-xs"
                  />
                ))}
              </div>

              {otpError && (
                <div className="text-center text-xs font-extrabold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 p-2.5 rounded-xl border border-red-200 dark:border-red-900">
                  ⚠️ {otpError}
                </div>
              )}

              {/* Resend Code & Timer */}
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 px-1">
                <span>
                  {otpTimer > 0 ? `Waktu tersisa: ${otpTimer} detik` : 'Waktu OTP habis'}
                </span>
                <button
                  type="button"
                  onClick={generateNewOtp}
                  disabled={otpTimer > 0}
                  className="text-xs text-primary dark:text-red-400 font-extrabold underline border-none bg-transparent cursor-pointer disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                >
                  Kirim Ulang OTP
                </button>
              </div>

              <button
                type="submit"
                disabled={verifyingOtp}
                className="w-full bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white font-extrabold py-3.5 rounded-xl text-xs sm:text-sm border-none cursor-pointer transition-all shadow-md hover:shadow-lg active:scale-[0.98] mt-2"
              >
                {verifyingOtp ? 'Memverifikasi Kode OTP...' : 'Verifikasi OTP & Daftar Akun ✓'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
