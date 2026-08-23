import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

const ADMIN_CORRECT_PIN = '899876'

export default function AdminLoginPage() {
  const navigate = useNavigate()

  // Phase 1: PIN Gate (ALWAYS requires PIN 899876 on every page load/refresh)
  const [pinVerified, setPinVerified] = useState<boolean>(false)

  // PIN Form State
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinShake, setPinShake] = useState(false)

  // Login Credentials State
  const [username, setUsername] = useState('kaiwahiroshima')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function handleVerifyPin(e: React.FormEvent) {
    e.preventDefault()
    setPinError(null)

    if (pinInput.trim() === ADMIN_CORRECT_PIN) {
      setPinVerified(true)
    } else {
      setPinError('❌ PIN Keamanan Salah! Akses Admin Ditolak.')
      setPinShake(true)
      setTimeout(() => setPinShake(false), 500)
    }
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError(null)
    setLoading(true)

    const cleanUser = username.trim().toLowerCase()

    if (cleanUser === 'kaiwahiroshima' && password === 'inaconnextkaiwa6') {
      const adminProf = {
        id: '00000000-0000-0000-0000-000000000099',
        full_name: 'Super Admin Hiroshima',
        username: 'kaiwahiroshima',
        email: 'admin@kaiwadojo.com',
        role: 'admin',
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
          full_name: 'Super Admin Hiroshima',
          username: 'kaiwahiroshima',
          email: 'admin@kaiwadojo.com',
          role: 'admin',
        })
      } catch (err) {
        console.warn('Admin upsert note:', err)
      }

      setLoading(false)
      navigate('/dashboard')
      return
    }

    // Try standard auth login for admin
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: cleanUser.includes('@') ? cleanUser : 'admin@kaiwadojo.com',
      password,
    })

    if (authError) {
      if (authError.message === 'Email not confirmed') {
        setLoginError('Email belum dikonfirmasi. Silakan cek inbox/spam email kamu.')
      } else if (authError.message === 'Invalid login credentials') {
        setLoginError('Username atau password salah. Coba lagi.')
      } else {
        setLoginError(authError.message)
      }
      setLoading(false)
    } else {
      sessionStorage.setItem('kaiwa_session_active', 'true')
      navigate('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Dynamic Background Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-scale-up">
        {/* Header Logo */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="size-16 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex items-center justify-center mb-3 p-2">
            <img src="/kaiwa-logo.png" alt="KaiwaDoJo" className="size-11 object-contain" />
          </div>
          <span className="px-3 py-1 rounded-full bg-primary/20 text-red-400 border border-primary/30 text-[0.7rem] font-black uppercase tracking-widest mb-1">
            🛡️ Restricted Portal Admin /admin
          </span>
          <h1 className="text-2xl font-black tracking-tight text-white">KaiwaDoJo Admin System</h1>
        </div>

        {/* ── PHASE 1: PIN SECURITY GATE (899876) ────────────────── */}
        {!pinVerified ? (
          <div className={`bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl transition-all ${pinShake ? 'animate-shake border-red-500/50' : ''}`}>
            <div className="text-center mb-6">
              <div className="size-14 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3">
                🔐
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
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="• • • • • •"
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center tracking-[0.5em] text-2xl font-black py-3 px-4 rounded-2xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all placeholder:tracking-normal placeholder:text-slate-600"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white text-xs font-black uppercase tracking-wider rounded-2xl border-none cursor-pointer transition-all shadow-lg shadow-primary/25 mt-2"
              >
                🔓 Verifikasi PIN Admin
              </button>
            </form>
          </div>
        ) : (
          /* ── PHASE 2: ADMIN CREDENTIALS LOGIN (kaiwahiroshima / inaconnextkaiwa6) ── */
          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl animate-fade-in">
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[0.68rem] font-extrabold">
                  ✅ PIN Verifikasi Berhasil
                </span>
              </div>
              <h2 className="text-xl font-black text-white">Login Admin Hiroshima</h2>
              <p className="text-xs text-slate-400 mt-1">
                Masukkan username dan password admin untuk masuk ke Dashboard.
              </p>
            </div>

            {loginError && (
              <div className="mb-4 p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-extrabold text-center">
                ❌ {loginError}
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Username Admin</label>
                <input
                  type="text"
                  required
                  placeholder="kaiwahiroshima"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white text-xs font-bold outline-none focus:border-primary transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Password Admin</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    placeholder="Masukkan password admin"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white text-xs font-bold outline-none focus:border-primary transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs border-none bg-transparent cursor-pointer font-bold"
                  >
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white text-xs font-black uppercase tracking-wider rounded-2xl border-none cursor-pointer transition-all shadow-lg shadow-primary/25 mt-2"
              >
                {loading ? 'Authenticating Admin...' : '🔑 Masuk ke Admin Dashboard'}
              </button>
            </form>

            <button
              onClick={() => {
                setPinVerified(false)
                setPinInput('')
              }}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300 font-bold mt-4 border-none bg-transparent cursor-pointer"
            >
              🔒 Kunci Kembali Portal PIN
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
