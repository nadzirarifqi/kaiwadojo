import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { claimDeviceSession } from '../../lib/deviceUtils'
import { SecurityRateLimiter, sanitizeUsername } from '../../lib/securityUtils'
import KaiwaLogo from '../../components/KaiwaLogo'

const ADMIN_CORRECT_PIN = '899876'

export default function AdminLoginPage() {
  const navigate = useNavigate()

  // Phase 1: PIN Gate (ALWAYS requires PIN 899876 on every page load/refresh)
  const [pinVerified, setPinVerified] = useState<boolean>(false)

  // PIN Form State & Rate Limiting
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinShake, setPinShake] = useState(false)
  const [pinLockout, setPinLockout] = useState<number>(0)

  // Login Credentials State & Rate Limiting
  const [username, setUsername] = useState('kaiwahiroshima')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loginLockout, setLoginLockout] = useState<number>(0)

  // Check initial rate limits
  useEffect(() => {
    const pinCheck = SecurityRateLimiter.check('admin_pin_attempt', 5, 300)
    if (!pinCheck.allowed) {
      setPinLockout(pinCheck.lockoutSecondsLeft)
    }

    const authCheck = SecurityRateLimiter.check('admin_auth_attempt', 5, 300)
    if (!authCheck.allowed) {
      setLoginLockout(authCheck.lockoutSecondsLeft)
    }
  }, [])

  // Lockout countdown timer
  useEffect(() => {
    let timer: any = null
    if (pinLockout > 0 || loginLockout > 0) {
      timer = setInterval(() => {
        setPinLockout(prev => (prev > 0 ? prev - 1 : 0))
        setLoginLockout(prev => (prev > 0 ? prev - 1 : 0))
      }, 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [pinLockout, loginLockout])

  function handleVerifyPin(e: React.FormEvent) {
    e.preventDefault()
    setPinError(null)

    // Rate Limit Check (5 attempts, 5 minutes lockout)
    const check = SecurityRateLimiter.check('admin_pin_attempt', 5, 300)
    if (!check.allowed || pinLockout > 0) {
      const remainingSecs = pinLockout || check.lockoutSecondsLeft
      setPinLockout(remainingSecs)
      setPinError(`Terlalu banyak percobaan salah! Portal terkunci selama ${remainingSecs} detik.`)
      setPinShake(true)
      setTimeout(() => setPinShake(false), 500)
      return
    }

    if (pinInput.trim() === ADMIN_CORRECT_PIN) {
      SecurityRateLimiter.reset('admin_pin_attempt')
      setPinVerified(true)
    } else {
      const res = SecurityRateLimiter.recordFailure('admin_pin_attempt', 5, 300)
      if (res.locked) {
        setPinLockout(res.lockoutSecondsLeft)
        setPinError(`Terlalu banyak percobaan PIN salah. Portal terkunci selama ${res.lockoutSecondsLeft} detik.`)
      } else {
        setPinError(`PIN Keamanan Salah! Sisa percobaan: ${res.remainingAttempts}x sebelum portal terkunci.`)
      }
      setPinShake(true)
      setTimeout(() => setPinShake(false), 500)
    }
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError(null)

    // Rate limit check for credentials
    const check = SecurityRateLimiter.check('admin_auth_attempt', 5, 300)
    if (!check.allowed || loginLockout > 0) {
      const remainingSecs = loginLockout || check.lockoutSecondsLeft
      setLoginLockout(remainingSecs)
      setLoginError(`Terlalu banyak percobaan login gagal. Silakan tunggu ${remainingSecs} detik.`)
      return
    }

    setLoading(true)

    const cleanUser = sanitizeUsername(username)

    // 1. Special Admin Hiroshima Credentials
    if (cleanUser === 'kaiwahiroshima') {
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
          }
        } catch (err) {
          console.warn('Admin DB fetch note:', err)
        }

        await claimDeviceSession(adminId)
        sessionStorage.setItem('kaiwa_session_active', 'true')
        sessionStorage.setItem('kaiwa_custom_profile', JSON.stringify(adminProf))
        localStorage.removeItem('kaiwa_custom_profile')
        window.dispatchEvent(new Event('kaiwa_profile_updated'))

        SecurityRateLimiter.reset('admin_auth_attempt')
        setLoading(false)
        navigate('/dashboard')
        return
      } else {
        const res = SecurityRateLimiter.recordFailure('admin_auth_attempt', 5, 300)
        setLoading(false)
        if (res.locked) {
          setLoginLockout(res.lockoutSecondsLeft)
          setLoginError(`Terlalu banyak percobaan gagal. Akun dikunci sementara selama ${res.lockoutSecondsLeft} detik.`)
        } else {
          setLoginError(`Password salah untuk akun Admin. Sisa percobaan: ${res.remainingAttempts}x.`)
        }
        return
      }
    }

    // 2. Try standard auth login for other admin or instructor accounts
    try {
      let targetEmail = cleanUser
      if (!cleanUser.includes('@')) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, email, role, status')
          .ilike('username', cleanUser)
          .maybeSingle()

        if (prof?.email) {
          targetEmail = prof.email
        } else {
          const res = SecurityRateLimiter.recordFailure('admin_auth_attempt', 5, 300)
          setLoading(false)
          if (res.locked) {
            setLoginLockout(res.lockoutSecondsLeft)
            setLoginError(`Terlalu banyak percobaan gagal. Silakan tunggu ${res.lockoutSecondsLeft} detik.`)
          } else {
            setLoginError(`Akun admin atau instruktur tidak ditemukan. Sisa percobaan: ${res.remainingAttempts}x.`)
          }
          return
        }
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password,
      })

      if (authError) {
        const res = SecurityRateLimiter.recordFailure('admin_auth_attempt', 5, 300)
        if (res.locked) {
          setLoginLockout(res.lockoutSecondsLeft)
          setLoginError(`Terlalu banyak percobaan gagal. Silakan tunggu ${res.lockoutSecondsLeft} detik.`)
        } else if (authError.message.includes('Invalid login credentials') || authError.status === 400 || authError.status === 500) {
          setLoginError(`Username/email atau password salah. Sisa percobaan: ${res.remainingAttempts}x.`)
        } else if (authError.message.includes('Email not confirmed')) {
          setLoginError('Email belum dikonfirmasi. Silakan cek inbox/spam email kamu.')
        } else {
          setLoginError(authError.message)
        }
        setLoading(false)
        return
      }

      if (authData.user) {
        SecurityRateLimiter.reset('admin_auth_attempt')
        await claimDeviceSession(authData.user.id)
        sessionStorage.setItem('kaiwa_session_active', 'true')
        navigate('/dashboard')
      }
    } catch (err: any) {
      console.warn('Admin login error:', err)
      const res = SecurityRateLimiter.recordFailure('admin_auth_attempt', 5, 300)
      if (res.locked) {
        setLoginLockout(res.lockoutSecondsLeft)
        setLoginError(`Terlalu banyak percobaan gagal. Silakan tunggu ${res.lockoutSecondsLeft} detik.`)
      } else {
        setLoginError('Username/email atau password salah.')
      }
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-dvh bg-cover bg-center bg-no-repeat text-white flex items-center justify-center p-4 py-8 relative overflow-hidden font-sans"
      style={{
        backgroundImage:
          "linear-gradient(to bottom, rgba(15,23,42,0.85), rgba(15,23,42,0.92)), url('/japan-background(4).jpg')",
      }}
    >
      {/* Floating Back to Landing Page Button */}
      <button
        onClick={() => navigate('/')}
        className="fixed top-4 left-4 z-50 inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900/90 backdrop-blur-md border border-slate-800 text-slate-300 hover:text-white hover:border-red-500/50 font-extrabold text-xs rounded-2xl shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer touch-manipulation min-h-[40px]"
      >
        <span>← Kembali ke Landing Page</span>
      </button>
      {/* Dynamic Background Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-scale-up">
        {/* Header Logo */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="size-16 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex items-center justify-center mb-3 p-2">
            <KaiwaLogo mode="dark" className="size-11 object-contain" />
          </div>
          <span className="px-3 py-1 rounded-full bg-primary/20 text-red-400 border border-primary/30 text-[0.7rem] font-black uppercase tracking-widest mb-1 flex items-center gap-1.5">
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Restricted Portal Admin /admin</span>
          </span>
          <h1 className="text-2xl font-black tracking-tight text-white">kaiwadojo Admin System</h1>
        </div>

        {/* ── PHASE 1: PIN SECURITY GATE (899876) ────────────────── */}
        {!pinVerified ? (
          <div className={`bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl transition-all ${pinShake ? 'animate-shake border-red-500/50' : ''}`}>
            <div className="text-center mb-6">
              <div className="size-14 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-xl font-black text-white">Verifikasi PIN Keamanan</h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Masukkan 6 digit Kode PIN Keamanan khusus Admin untuk membuka formulir login.
              </p>
            </div>

            {pinError && (
              <div className="mb-4 p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-extrabold text-center">
                {pinError}
              </div>
            )}

            <form onSubmit={handleVerifyPin} className="flex flex-col gap-4">
              <div>
                <label className="text-[0.7rem] font-extrabold uppercase tracking-wider text-slate-400 block mb-2 text-center">
                  PIN Keamanan Admin (6 Digit)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  autoCapitalize="none"
                  autoCorrect="off"
                  enterKeyHint="go"
                  maxLength={6}
                  required
                  autoFocus
                  disabled={pinLockout > 0}
                  placeholder="• • • • • •"
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                  className={`w-full text-center tracking-[0.5em] text-2xl font-black py-3.5 px-4 rounded-2xl bg-slate-950 border text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all placeholder:tracking-normal placeholder:text-slate-600 touch-manipulation min-h-[48px] ${
                    pinLockout > 0 ? 'opacity-50 border-red-800 cursor-not-allowed' : 'border-slate-800'
                  }`}
                />
              </div>

              <button
                type="submit"
                disabled={pinLockout > 0}
                className="w-full py-3.5 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white text-xs font-black uppercase tracking-wider rounded-2xl border-none cursor-pointer transition-all shadow-lg shadow-primary/25 mt-2 min-h-[48px] touch-manipulation flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pinLockout > 0 ? `Terkunci (${pinLockout}s)` : 'Verifikasi PIN Admin'}
              </button>
            </form>
          </div>
        ) : (
          /* ── PHASE 2: ADMIN CREDENTIALS LOGIN (kaiwahiroshima / inaconnextkaiwa6) ── */
          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl animate-fade-in">
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[0.68rem] font-extrabold flex items-center gap-1">
                  <svg className="size-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>PIN Verifikasi Berhasil</span>
                </span>
              </div>
              <h2 className="text-xl font-black text-white">Login Admin Hiroshima</h2>
              <p className="text-xs text-slate-400 mt-1">
                Masukkan username dan password admin untuk masuk ke Dashboard.
              </p>
            </div>

            {loginError && (
              <div className="mb-4 p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-extrabold text-center">
                {loginError}
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Username Admin</label>
                <input
                  type="text"
                  required
                  disabled={loginLockout > 0 || loading}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  placeholder="kaiwahiroshima"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full px-4 py-3.5 sm:py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white text-base sm:text-xs font-bold outline-none focus:border-primary transition-all min-h-[44px] touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Password Admin</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    disabled={loginLockout > 0 || loading}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="go"
                    placeholder="Masukkan password admin"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3.5 sm:py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white text-base sm:text-xs font-bold outline-none focus:border-primary transition-all pr-12 min-h-[44px] touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-base border-none bg-transparent cursor-pointer font-bold min-h-[40px] min-w-[40px] flex items-center justify-center touch-manipulation"
                    aria-label="Toggle password visibility"
                  >
                    {showPass ? (
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || loginLockout > 0}
                className="w-full py-3.5 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white text-xs sm:text-sm font-black uppercase tracking-wider rounded-2xl border-none cursor-pointer transition-all shadow-lg shadow-primary/25 mt-2 min-h-[48px] touch-manipulation flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loginLockout > 0
                  ? `Terkunci (${loginLockout}s)`
                  : loading
                    ? 'Authenticating Admin...'
                    : 'Masuk ke Admin Dashboard'}
              </button>
            </form>

            <button
              onClick={() => {
                setPinVerified(false)
                setPinInput('')
              }}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300 font-bold mt-4 border-none bg-transparent cursor-pointer flex items-center justify-center gap-1.5"
            >
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Kunci Kembali Portal PIN</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
