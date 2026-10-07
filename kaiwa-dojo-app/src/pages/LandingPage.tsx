import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function LandingPage() {
  const navigate = useNavigate()
  const { session, profile } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
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

  const isLoggedIn = Boolean(session || profile)

  return (
    <div className="min-h-screen pt-16 sm:pt-18 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors selection:bg-primary/20 selection:text-primary relative overflow-x-clip">
      
      {/* Decorative Floating Kanji Watermark (Desktop) */}
      <div className="hidden xl:block fixed left-6 top-32 z-0 writing-vertical-jp text-3xl font-black text-slate-300/40 dark:text-slate-800/30 pointer-events-none tracking-widest select-none">
        日本語会話 ・ 会話道場
      </div>
      <div className="hidden xl:block fixed right-6 top-32 z-0 writing-vertical-jp text-3xl font-black text-slate-300/40 dark:text-slate-800/30 pointer-events-none tracking-widest select-none">
        実践会話 ・ 50課修了
      </div>

      {/* ── HEADER NAVBAR ────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shadow-xs transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => navigate('/')}>
            <div className="size-10 sm:size-11 bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1.5 overflow-hidden shrink-0">
              <img src="/kaiwa-logo.png" alt="KaiwaDojo" className="size-full object-contain" />
            </div>
            <div>
              <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                Kaiwa<span className="text-primary dark:text-red-400">Dojo</span>
                <span className="text-[0.65rem] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary dark:text-red-400 font-bold border border-primary/20">
                  会話
                </span>
              </span>
              <span className="text-[0.6rem] font-bold text-slate-400 dark:text-slate-500 block -mt-0.5 tracking-wider uppercase">
                Platform Belajar Bahasa Jepang
              </span>
            </div>
          </div>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-bold text-slate-600 dark:text-slate-300">
            <a href="#keunggulan" className="hover:text-primary dark:hover:text-red-400 transition-colors no-underline">
              Keunggulan
            </a>
            <a href="#fitur" className="hover:text-primary dark:hover:text-red-400 transition-colors no-underline">
              Fitur Utama
            </a>
            <a href="#kurikulum" className="hover:text-primary dark:hover:text-red-400 transition-colors no-underline">
              Kurikulum 50 Bab
            </a>
          </nav>

          {/* Right Action Buttons & Theme Toggle */}
          <div className="flex items-center gap-2.5">
            {/* Dark / Light Mode Toggle Button */}
            <button
              onClick={toggleTheme}
              title={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
              aria-label="Toggle Theme"
              className="size-9 sm:size-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center justify-center transition-all hover:scale-105 active:scale-95 shrink-0"
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

            {isLoggedIn ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="group px-4 py-2 sm:py-2.5 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white text-xs font-extrabold rounded-xl border-none cursor-pointer transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center gap-2"
              >
                <span>Dashboard</span>
                <span className="size-5 rounded-full bg-white/20 flex items-center justify-center text-[0.65rem] font-black group-hover:translate-x-0.5 transition-transform">
                  &gt;
                </span>
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <button
                  onClick={() => navigate('/login')}
                  className="px-3.5 py-2 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer transition-all"
                >
                  Masuk
                </button>

                <button
                  onClick={() => navigate('/register')}
                  className="group px-4 py-2 bg-gradient-to-r from-primary to-primary-light text-white text-xs font-bold rounded-xl border-none cursor-pointer transition-all shadow-md hover:shadow-primary/20 active:scale-95 flex items-center gap-1.5"
                >
                  <span>Daftar</span>
                  <span className="size-4.5 rounded-full bg-white/20 flex items-center justify-center text-[0.6rem] font-black group-hover:translate-x-0.5 transition-transform">
                    &gt;
                  </span>
                </button>
              </div>
            )}

            {/* Mobile Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden size-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-bold border border-slate-200 dark:border-slate-700 cursor-pointer shrink-0"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-4 flex flex-col gap-2.5 text-xs font-bold animate-fade-in shadow-xl">
            <a
              href="#keunggulan"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2.5 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-primary no-underline flex items-center justify-between"
            >
              <span>Keunggulan Platform</span>
              <span className="text-slate-400">&gt;</span>
            </a>
            <a
              href="#fitur"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2.5 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-primary no-underline flex items-center justify-between"
            >
              <span>Fitur Utama</span>
              <span className="text-slate-400">&gt;</span>
            </a>
            <a
              href="#kurikulum"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2.5 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-primary no-underline flex items-center justify-between"
            >
              <span>Kurikulum 50 Bab</span>
              <span className="text-slate-400">&gt;</span>
            </a>

            {!isLoggedIn && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    navigate('/login')
                  }}
                  className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold rounded-xl text-xs border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  Masuk ke Akun
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    navigate('/register')
                  }}
                  className="group w-full py-2.5 bg-gradient-to-r from-primary to-primary-light text-white font-bold rounded-xl text-xs border-none cursor-pointer shadow-md flex items-center justify-center gap-2"
                >
                  <span>Daftar Akun Baru</span>
                  <span className="size-4.5 rounded-full bg-white/20 flex items-center justify-center text-[0.6rem] font-black group-hover:translate-x-0.5 transition-transform">
                    &gt;
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ── HERO SECTION ─────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden py-12 sm:py-20 lg:py-24 bg-cover bg-center bg-no-repeat transition-colors"
        style={{
          backgroundImage: isDark
            ? "linear-gradient(to bottom, rgba(15,23,42,0.85), rgba(15,23,42,0.96)), url('/japan-background.jpg')"
            : "linear-gradient(to bottom, rgba(255,255,255,0.88), rgba(248,250,252,0.97)), url('/japan-background.jpg')",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center flex flex-col items-center">
          
          {/* Badge Tag */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 dark:bg-primary/20 border border-primary/20 text-primary dark:text-red-400 text-xs font-extrabold uppercase tracking-wider mb-5 shadow-xs backdrop-blur-md">
            <span className="size-2 rounded-full bg-primary animate-pulse" />
            <span>Platform Belajar Bahasa Jepang Interaktif</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white max-w-4xl leading-tight sm:leading-[1.15] mb-5">
            Praktik Percakapan Bahasa Jepang <span className="bg-gradient-to-r from-primary via-red-500 to-amber-500 bg-clip-text text-transparent">Lebih Percaya Diri</span> & Terarah
          </h1>

          {/* Subtitle */}
          <p className="text-xs sm:text-base lg:text-lg text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed mb-8 font-medium">
            Kurikulum terstruktur 50 bab, hafalan kotoba harian, serta bimbingan sesi kelas online dan offline bersama Sensei untuk mengasah kemampuan komunikasi Anda.
          </p>

          {/* Hero Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mb-10 sm:mb-16">
            {isLoggedIn ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="group w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white font-extrabold text-sm rounded-xl sm:rounded-2xl border-none cursor-pointer shadow-xl hover:shadow-primary/25 active:scale-95 transition-all flex items-center justify-center gap-2.5"
              >
                <span>Buka Dashboard Belajar</span>
                <span className="size-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-black group-hover:translate-x-0.5 transition-transform">
                  &gt;
                </span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/register')}
                  className="group w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white font-extrabold text-sm rounded-xl sm:rounded-2xl border-none cursor-pointer shadow-xl hover:shadow-primary/25 active:scale-95 transition-all flex items-center justify-center gap-2.5"
                >
                  <span>Mulai Belajar Sekarang</span>
                  <span className="size-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-black group-hover:translate-x-0.5 transition-transform">
                    &gt;
                  </span>
                </button>

                <a
                  href="#kurikulum"
                  className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold text-xs sm:text-sm rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-primary/40 hover:text-primary dark:hover:text-red-400 transition-all no-underline backdrop-blur-md w-full sm:w-auto"
                >
                  <span>Lihat Modul & Kurikulum</span>
                  <span className="size-5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[0.65rem] font-bold group-hover:translate-x-0.5 transition-transform">
                    &gt;
                  </span>
                </a>
              </>
            )}
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full max-w-4xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 text-center">
              <span className="text-xl sm:text-3xl font-black text-primary dark:text-red-400 block">50 Bab</span>
              <span className="text-[0.65rem] sm:text-xs font-bold text-slate-500 dark:text-slate-400">Modul Lengkap</span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 text-center">
              <span className="text-xl sm:text-3xl font-black text-sky-600 dark:text-sky-400 block">10 Siswa</span>
              <span className="text-[0.65rem] sm:text-xs font-bold text-slate-500 dark:text-slate-400">Maks Kuota per Sesi</span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 text-center">
              <span className="text-xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 block">Harian</span>
              <span className="text-[0.65rem] sm:text-xs font-bold text-slate-500 dark:text-slate-400">Target Kotoba & Misi</span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 text-center">
              <span className="text-xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 block">Sensei</span>
              <span className="text-[0.65rem] sm:text-xs font-bold text-slate-500 dark:text-slate-400">Bimbingan Praktik</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── KEUNGGULAN SECTION ───────────────────────────────────── */}
      <section id="keunggulan" className="py-14 sm:py-20 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <span className="text-[0.7rem] sm:text-xs font-black uppercase tracking-wider text-primary dark:text-red-400 block mb-1.5">
              Mengapa KaiwaDojo?
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Metode Belajar Terbukti & Praktis
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">
              Dirancang khusus untuk persiapan kerja, magang di Jepang (Tokutei Ginou/Trainee), maupun studi lanjut.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 1 */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 sm:p-7 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col gap-4 hover:border-primary/40 transition-all shadow-xs">
              <div className="size-12 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-red-400 flex items-center justify-center">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">Rencana Belajar Mandiri Harian</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Pilih tanggal di kalender interaktif dan susun target misi video, kotoba, serta kuis harianmu dengan mudah dan terpantau.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 sm:p-7 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col gap-4 hover:border-sky-500/40 transition-all shadow-xs">
              <div className="size-12 rounded-2xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">Kotoba & Evaluasi Mandiri</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Simpan kosakata baru lengkap dengan kanji, romaji, dan makna. Lakukan uji pemahaman kosakata kapan pun tanpa batasan.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 sm:p-7 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col gap-4 hover:border-emerald-500/40 transition-all shadow-xs">
              <div className="size-12 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">Kelas Live Online & Offline</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Sesi interaktif daring via Google Meet dan tatap muka intensif dengan kuota terbatas maksimal 10 siswa per kelas.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── FITUR UTAMA SECTION ───────────────────────────────────── */}
      <section id="fitur" className="py-14 sm:py-20 bg-slate-50 dark:bg-slate-950 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <span className="text-[0.7rem] sm:text-xs font-black uppercase tracking-wider text-primary dark:text-red-400 block mb-1.5">
              Fitur Lengkap
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Platform All-in-One untuk Pembelajar
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            
            {/* Feature 1 */}
            <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col gap-3">
              <div className="size-10 rounded-xl bg-primary/10 text-primary dark:text-red-400 flex items-center justify-center">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">Video Modul 50 Bab</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Penjelasan tata bahasa (Bunpou), pola kalimat, serta latihan menyimak dialog percakapan alami.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col gap-3">
              <div className="size-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">Kuis Evaluasi Tiap Bab</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Uji pemahaman Anda setelah menonton video dengan kuis interaktif berpenilaian otomatis.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col gap-3">
              <div className="size-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">Reservasi Jadwal Praktis</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Pilih sesi kelas online mingguan atau offline sesuai ketersediaan slot tanpa proses rumit.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col gap-3">
              <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
              </div>
              <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">Umpan Balik & Koreksi</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Dapatkan masukan langsung dari pemateri terhadap pelafalan dan struktur kalimat percakapan.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── KURIKULUM SECTION ─────────────────────────────────────── */}
      <section id="kurikulum" className="py-14 sm:py-20 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <span className="text-[0.7rem] sm:text-xs font-black uppercase tracking-wider text-primary dark:text-red-400 block mb-1.5">
              Struktur Pembelajaran
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Kurikulum Modul 50 Bab
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Jilid 1 */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary dark:text-red-400 font-extrabold text-xs">
                  JILID 1 (Bab 1 - 25)
                </span>
                <span className="text-xs font-bold text-slate-400">Tingkat Dasar (N5)</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">Dasar Percakapan & Tata Bahasa</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Mencakup perkenalan diri (Jikoshoukai), huruf Hiragana & Katakana, kata kerja bentuk ~masu, tata kalimat esensial, serta percakapan harian di lingkungan umum.
              </p>
            </div>

            {/* Jilid 2 */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-extrabold text-xs">
                  JILID 2 (Bab 26 - 50)
                </span>
                <span className="text-xs font-bold text-slate-400">Tingkat Menengah (N4)</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">Percakapan Kompleks & Keigo</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Mempelajari kalimat majemuk, bentuk pengandaian (~ba, ~tara), bahasa sopan & kehormatan (Keigo), situasi kerja di Jepang, dan persiapan wawancara.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── CALL TO ACTION BANNER ─────────────────────────────────── */}
      <section
        className="py-14 sm:py-20 text-white relative overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(15,23,42,0.94), rgba(127,29,29,0.88), rgba(15,23,42,0.94)), url('/japan-background(3).jpg')",
        }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 flex flex-col items-center gap-5">
          <span className="px-3.5 py-1 rounded-full bg-white/10 text-amber-300 text-xs font-bold uppercase tracking-wider border border-white/20 backdrop-blur-md">
            Siap Memulai Perjalanan Bahasa Jepang Anda?
          </span>
          
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white max-w-2xl leading-tight">
            Gabung Bersama KaiwaDojo Sekarang
          </h2>

          <p className="text-xs sm:text-base text-slate-200 max-w-xl font-medium">
            Daftarkan diri Anda untuk langsung mengakses modul materi, latihan kotoba, dan reservasi jadwal sesi bersama Sensei.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto pt-2">
            {isLoggedIn ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="group w-full sm:w-auto px-7 py-3.5 bg-primary hover:bg-primary-dark text-white font-black text-sm rounded-xl sm:rounded-2xl border-none cursor-pointer shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2.5"
              >
                <span>Masuk ke Dashboard Saya</span>
                <span className="size-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-black group-hover:translate-x-0.5 transition-transform">
                  &gt;
                </span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/register')}
                  className="group w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white font-black text-sm rounded-xl sm:rounded-2xl border-none cursor-pointer shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2.5"
                >
                  <span>Daftar Akun Baru</span>
                  <span className="size-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-black group-hover:translate-x-0.5 transition-transform">
                    &gt;
                  </span>
                </button>

                <button
                  onClick={() => navigate('/login')}
                  className="group w-full sm:w-auto px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-extrabold text-sm rounded-xl sm:rounded-2xl border border-white/25 cursor-pointer backdrop-blur-md active:scale-95 transition-all flex items-center justify-center gap-2.5"
                >
                  <span>Masuk ke Akun</span>
                  <span className="size-6 rounded-full bg-white/15 flex items-center justify-center text-xs font-black group-hover:translate-x-0.5 transition-transform">
                    &gt;
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────── */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200/80 dark:border-slate-800/80 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-medium text-center sm:text-left">
          
          <div className="flex items-center gap-2.5">
            <div className="size-7 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center p-1 shrink-0">
              <img src="/kaiwa-logo.png" alt="KaiwaDojo" className="size-full object-contain" />
            </div>
            <span className="font-extrabold text-slate-800 dark:text-white">
              KaiwaDojo &copy; {new Date().getFullYear()}. All Rights Reserved.
            </span>
          </div>

          <div className="flex items-center gap-5 flex-wrap justify-center">
            <a href="#keunggulan" className="hover:text-primary transition-colors no-underline">Keunggulan</a>
            <a href="#fitur" className="hover:text-primary transition-colors no-underline">Fitur</a>
            <a href="#kurikulum" className="hover:text-primary transition-colors no-underline">Kurikulum</a>
            <button onClick={() => navigate('/login')} className="hover:text-primary transition-colors bg-transparent border-none cursor-pointer text-xs font-medium text-slate-500">
              Login
            </button>
          </div>
        </div>
      </footer>

    </div>
  )
}
