import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/* ── Custom Character Avatars for Live Kaiwa Simulation ── */
function SenseiAvatar({ isSpeaking }: { isSpeaking: boolean }) {
  return (
    <div
      className={`relative size-10 sm:size-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-0.5 shadow-md transition-all duration-300 shrink-0 ${
        isSpeaking ? 'scale-105 sm:scale-110 ring-4 ring-amber-400/30 shadow-amber-500/30 -translate-y-0.5' : ''
      }`}
    >
      <div className="size-full bg-slate-900 rounded-[10px] sm:rounded-[14px] flex items-center justify-center overflow-hidden relative">
        <svg viewBox="0 0 40 40" className="size-9 sm:size-10 text-amber-100" fill="none">
          <circle cx="20" cy="15" r="8" fill="#FDE68A" />
          <path d="M12 13 C12 7, 28 7, 28 13 C28 15, 26 18, 20 18 C14 18, 12 15, 12 13 Z" fill="#1F2937" />
          {/* Glasses */}
          <rect x="15" y="14" width="4" height="3" rx="1" stroke="#111827" strokeWidth="1" fill="none" />
          <rect x="21" y="14" width="4" height="3" rx="1" stroke="#111827" strokeWidth="1" fill="none" />
          <line x1="19" y1="15.5" x2="21" y2="15.5" stroke="#111827" strokeWidth="1" />
          {/* Mouth Reaction */}
          <path
            d={isSpeaking ? 'M17 19 Q20 23 23 19 Z' : 'M18 19 Q20 21 22 19'}
            stroke="#B45309"
            strokeWidth="1.2"
            fill={isSpeaking ? '#B45309' : 'none'}
            strokeLinecap="round"
          />
          {/* Outfit */}
          <path d="M8 38 C8 27, 32 27, 32 38 Z" fill="#374151" />
          <path d="M16 27 L20 34 L24 27 Z" fill="#F3F4F6" />
          <path d="M19 29 L20 33 L21 29 Z" fill="#DC2626" />
        </svg>
        {isSpeaking && (
          <span className="absolute top-1 right-1 size-2 bg-emerald-400 rounded-full animate-ping" />
        )}
      </div>
    </div>
  )
}

function StudentAvatar({ isSpeaking }: { isSpeaking: boolean }) {
  return (
    <div
      className={`relative size-10 sm:size-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 p-0.5 shadow-md transition-all duration-300 shrink-0 ${
        isSpeaking ? 'scale-105 sm:scale-110 ring-4 ring-red-400/30 shadow-red-500/30 -translate-y-0.5' : ''
      }`}
    >
      <div className="size-full bg-slate-900 rounded-[10px] sm:rounded-[14px] flex items-center justify-center overflow-hidden relative">
        <svg viewBox="0 0 40 40" className="size-9 sm:size-10" fill="none">
          <circle cx="20" cy="15" r="8" fill="#FED7AA" />
          {/* Hair */}
          <path d="M11 14 C11 6, 29 6, 29 14 C27 12, 24 10, 20 10 C16 10, 13 12, 11 14 Z" fill="#18181B" />
          {/* Headband with red dot */}
          <rect x="12" y="11" width="16" height="3" rx="0.5" fill="#FFFFFF" />
          <circle cx="20" cy="12.5" r="1.1" fill="#DC2626" />
          {/* Eyes */}
          <circle cx="16.5" cy="15.5" r="1" fill="#18181B" />
          <circle cx="23.5" cy="15.5" r="1" fill="#18181B" />
          {/* Mouth Reaction */}
          <path
            d={isSpeaking ? 'M17 18.5 Q20 23 23 18.5 Z' : 'M18 19 Q20 21.5 22 19'}
            stroke="#EA580C"
            strokeWidth="1.2"
            fill={isSpeaking ? '#EA580C' : 'none'}
            strokeLinecap="round"
          />
          {/* Dojo uniform */}
          <path d="M8 38 C8 27, 32 27, 32 38 Z" fill="#DC2626" />
          <path d="M16 27 L20 34 L24 27 Z" fill="#FFFFFF" />
        </svg>
        {isSpeaking && (
          <span className="absolute top-1 right-1 size-2 bg-emerald-400 rounded-full animate-ping" />
        )}
      </div>
    </div>
  )
}

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

  // Theme Sync
  useEffect(() => {
    const handleStorage = () => {
      if (typeof document !== 'undefined') {
        setIsDark(document.documentElement.classList.contains('dark'))
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // Auto-scroll on mount if hash present in URL
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const targetId = window.location.hash.slice(1)
      const el = document.getElementById(targetId)
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 150)
      }
    }
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

  // ── Scenarios adjusted directly to Bab 1 & Bab 10 (From My Courses) ──
  const scenarios = [
    {
      title: 'Bab 1: Perkenalan Diri',
      shortTitle: 'Bab 1: Perkenalan',
      courseSubtitle: 'わたしはエンジニアです (Saya adalah insinyur)',
      tag: 'Bab 1 • Dasar N5',
      speakerA: 'Tanaka Sensei',
      roleA: 'Sensei Pengajar',
      japaneseA: 'はじめまして、田中です。お仕事は何ですか？',
      romajiA: 'Hajimemashite, Tanaka desu. Oshigoto wa nan desu ka?',
      meaningA: 'Salam kenal, saya Tanaka. Apa profesi/pekerjaan Anda?',
      speakerB: 'Budi (Siswa)',
      roleB: 'Peserta Pelatihan',
      japaneseB: '初めまして！ブディです。わたしはエンジニアです。よろしくお願いします！',
      romajiB: 'Hajimemashite! Budi desu. Watashi wa enjinia desu. Yoroshiku onegaishimasu!',
      meaningB: 'Salam kenal! Saya Budi. Saya adalah seorang insinyur. Mohon kerja samanya!',
      score: '98%',
      scoreLabel: 'Pelafalan Bunpou Sangat Akurat',
    },
    {
      title: 'Bab 10: Keberadaan Benda & Orang',
      shortTitle: 'Bab 10: Keberadaan',
      courseSubtitle: '机の上に本があります (Ada buku di atas meja)',
      tag: 'Bab 10 • Imasu & Arimasu',
      speakerA: 'Tanaka Sensei',
      roleA: 'Sensei Pengajar',
      japaneseA: 'ブディさん、教室に誰がいますか？机の上に何がありますか？',
      romajiA: 'Budi-san, kyoushitsu ni dare ga imasu ka? Tsukue no ue ni nani ga arimasu ka?',
      meaningA: 'Budi-san, ada siapa di dalam ruang kelas? Dan ada apa di atas meja?',
      speakerB: 'Budi (Siswa)',
      roleB: 'Peserta Pelatihan',
      japaneseB: '教室に学生がいます。そして机の上に日本語の本があります！',
      romajiB: 'Kyoushitsu ni gakusei ga imasu. Soshite tsukue no ue ni Nihongo no hon ga arimasu!',
      meaningB: 'Di dalam kelas ada siswa (orang). Dan di atas meja ada buku bahasa Jepang (benda)!',
      score: '99%',
      scoreLabel: 'Penggunaan Imasu & Arimasu Tepat',
    },
  ]

  const [activeScenario, setActiveScenario] = useState<number>(0)
  const [showRomaji, setShowRomaji] = useState<boolean>(true)
  const [hoveredSpeaker, setHoveredSpeaker] = useState<'A' | 'B' | null>(null)

  // Curriculum active tab
  const [curriculumTab, setCurriculumTab] = useState<'jilid1' | 'jilid2'>('jilid1')

  const scrollToSimulator = (e?: React.MouseEvent) => {
    if (e) e.preventDefault()
    const el = document.getElementById('simulator')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="min-h-screen pt-14 sm:pt-16 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors selection:bg-primary/20 selection:text-primary relative overflow-x-clip">
      
      {/* ── HEADER NAVBAR ────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shadow-xs transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <div
            className="flex items-center gap-2.5 cursor-pointer select-none group touch-manipulation"
            onClick={() => navigate('/')}
          >
            <div className="size-8 sm:size-10 bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1 sm:p-1.5 overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
              <img src="/kaiwa-logo.png" alt="KaiwaDojo" className="size-full object-contain" />
            </div>
            <div>
              <span className="text-sm sm:text-base font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                Kaiwa<span className="text-primary dark:text-red-400">Dojo</span>
                <span className="text-[0.58rem] sm:text-[0.62rem] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary dark:text-red-400 font-extrabold border border-primary/20">
                  会話
                </span>
              </span>
              <span className="text-[0.52rem] sm:text-[0.58rem] font-bold text-slate-400 dark:text-slate-500 block -mt-0.5 tracking-wider uppercase">
                Platform Belajar Bahasa Jepang
              </span>
            </div>
          </div>

          {/* Navigation Links with Hover Animation (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-7 text-xs font-bold">
            <a
              href="#simulator"
              className="relative py-1 text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-red-400 transition-colors no-underline group"
            >
              <span>Simulasi Percakapan</span>
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-red-400 group-hover:w-full transition-all duration-300 rounded-full" />
            </a>
            <a
              href="#keunggulan"
              className="relative py-1 text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-red-400 transition-colors no-underline group"
            >
              <span>Keunggulan</span>
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-red-400 group-hover:w-full transition-all duration-300 rounded-full" />
            </a>
            <a
              href="#fitur"
              className="relative py-1 text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-red-400 transition-colors no-underline group"
            >
              <span>Fitur</span>
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-red-400 group-hover:w-full transition-all duration-300 rounded-full" />
            </a>
            <a
              href="#kurikulum"
              className="relative py-1 text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-red-400 transition-colors no-underline group"
            >
              <span>Kurikulum 50 Bab</span>
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-red-400 group-hover:w-full transition-all duration-300 rounded-full" />
            </a>
          </nav>

          {/* Right Action Buttons & Theme Toggle */}
          <div className="flex items-center gap-2">
            {/* Dark / Light Mode Toggle Button with Hover Animation */}
            <button
              onClick={toggleTheme}
              title={isDark ? 'Mode Terang' : 'Mode Gelap'}
              aria-label="Toggle Theme"
              className="size-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center justify-center transition-all hover:scale-105 active:scale-95 shrink-0 touch-manipulation"
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
                className="group px-3.5 sm:px-4 py-2 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white text-xs font-extrabold rounded-xl border-none cursor-pointer transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center gap-1.5 touch-manipulation min-h-[38px]"
              >
                <span>Dashboard</span>
                <span className="size-4.5 rounded-full bg-white/20 flex items-center justify-center text-[0.6rem] font-black group-hover:translate-x-0.5 transition-transform">
                  &gt;
                </span>
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <button
                  onClick={() => navigate('/login')}
                  className="px-3.5 py-2 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer transition-all hover:border-primary/40 min-h-[38px]"
                >
                  Masuk
                </button>

                <button
                  onClick={() => navigate('/register')}
                  className="group px-4 py-2 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white text-xs font-bold rounded-xl border-none cursor-pointer transition-all shadow-md hover:shadow-primary/25 hover:scale-105 active:scale-95 flex items-center gap-1.5 min-h-[38px]"
                >
                  <span>Daftar</span>
                  <span className="size-4.5 rounded-full bg-white/20 flex items-center justify-center text-[0.6rem] font-black group-hover:translate-x-0.5 transition-transform">
                    &gt;
                  </span>
                </button>
              </div>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden size-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-bold border border-slate-200 dark:border-slate-700 cursor-pointer shrink-0 touch-manipulation"
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

        {/* Mobile Dropdown Menu with Touch Friendly Hit Areas */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-4 py-3 flex flex-col gap-1.5 text-xs font-bold animate-fade-in shadow-xl">
            <a
              href="#simulator"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2.5 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-primary no-underline flex items-center justify-between touch-manipulation min-h-[44px]"
            >
              <span>Simulasi Percakapan</span>
              <span className="size-5 rounded-full bg-slate-200/60 dark:bg-slate-800 flex items-center justify-center text-[0.65rem] text-slate-500">&gt;</span>
            </a>
            <a
              href="#keunggulan"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2.5 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-primary no-underline flex items-center justify-between touch-manipulation min-h-[44px]"
            >
              <span>Keunggulan Platform</span>
              <span className="size-5 rounded-full bg-slate-200/60 dark:bg-slate-800 flex items-center justify-center text-[0.65rem] text-slate-500">&gt;</span>
            </a>
            <a
              href="#fitur"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2.5 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-primary no-underline flex items-center justify-between touch-manipulation min-h-[44px]"
            >
              <span>Fitur Utama</span>
              <span className="size-5 rounded-full bg-slate-200/60 dark:bg-slate-800 flex items-center justify-center text-[0.65rem] text-slate-500">&gt;</span>
            </a>
            <a
              href="#kurikulum"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2.5 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-primary no-underline flex items-center justify-between touch-manipulation min-h-[44px]"
            >
              <span>Kurikulum 50 Bab</span>
              <span className="size-5 rounded-full bg-slate-200/60 dark:bg-slate-800 flex items-center justify-center text-[0.65rem] text-slate-500">&gt;</span>
            </a>

            {!isLoggedIn && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    navigate('/login')
                  }}
                  className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold rounded-xl text-xs border border-slate-200 dark:border-slate-700 cursor-pointer touch-manipulation min-h-[44px]"
                >
                  Masuk ke Akun
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    navigate('/register')
                  }}
                  className="group w-full py-2.5 bg-gradient-to-r from-primary to-primary-light text-white font-bold rounded-xl text-xs border-none cursor-pointer shadow-md flex items-center justify-center gap-2 touch-manipulation min-h-[44px]"
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

      {/* ── HERO SECTION (FULL SCREEN ON MOBILE & RICH ON DESKTOP) ──────── */}
      <section
        className="relative overflow-hidden h-[calc(100svh-3.5rem)] sm:h-[calc(100dvh-4rem)] lg:h-auto lg:min-h-[calc(100dvh-4rem)] flex flex-col justify-between py-3.5 sm:py-6 lg:py-14 bg-cover bg-center bg-no-repeat transition-colors select-none"
        style={{
          backgroundImage: isDark
            ? "radial-gradient(ellipse at 70% 30%, rgba(185, 28, 28, 0.16), transparent 60%), linear-gradient(to bottom, rgba(15,23,42,0.85), rgba(15,23,42,0.96)), url('/japan-background.jpg')"
            : "radial-gradient(ellipse at 70% 30%, rgba(220, 38, 38, 0.08), transparent 60%), linear-gradient(to bottom, rgba(255,255,255,0.88), rgba(248,250,252,0.98)), url('/japan-background.jpg')",
        }}
      >
        {/* Subtle decorative glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 sm:w-96 h-72 sm:h-96 bg-primary/10 dark:bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Hero Content Wrapper */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full flex-1 flex flex-col justify-between lg:justify-center">
          
          {/* Main Grid: Responsive 1-col on mobile, 2-col on desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-10 items-center my-auto lg:my-0">
            
            {/* Left Content / Mobile Center Content */}
            <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
              
              {/* Eyebrow Tag */}
              <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 border border-primary/25 dark:border-red-500/30 text-primary dark:text-red-400 text-[0.62rem] sm:text-xs font-black uppercase tracking-wider mb-2 sm:mb-3.5 shadow-xs backdrop-blur-md">
                <span className="size-1.5 sm:size-2 rounded-full bg-primary animate-pulse" />
                <span>Metode Kaiwa Minna no Nihongo</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-[1.65rem] xs:text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.18] sm:leading-[1.15] mb-2 sm:mb-3 max-w-2xl">
                Kuasai Percakapan Bahasa Jepang.{' '}
                <span className="bg-gradient-to-r from-primary via-red-500 to-amber-500 bg-clip-text text-transparent block sm:inline">
                  Bicara Alami & Percaya Diri.
                </span>
              </h1>

              {/* Subheading */}
              <p className="text-[0.76rem] sm:text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-medium max-w-lg mb-2.5 sm:mb-3.5 px-1 sm:px-0">
                Pelajari 50 bab percakapan praktis Minna no Nihongo, hafalan kotoba harian dengan Daily SRS, dan asah kemampuan berbicara langsung bersama Sensei.
              </p>


              {/* Mobile Hero Illustration (2 People Conversing & Core Features) */}
              <div className="lg:hidden w-full max-w-[300px] xs:max-w-xs mx-auto my-2 relative">
                <div className="relative rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800/80 shadow-md bg-white/90 dark:bg-slate-900/90 p-1.5 backdrop-blur-md">
                  <img
                    src="/hero-conversation.jpg"
                    alt="Ilustrasi Percakapan Bahasa Jepang Sensei dan Siswa"
                    className="w-full h-32 xs:h-36 object-cover object-[center_12%] rounded-xl"
                  />
                  <div className="absolute bottom-2.5 inset-x-3 px-2 py-0.5 rounded-lg bg-slate-950/80 backdrop-blur-md text-white text-[0.62rem] font-bold flex items-center justify-center gap-1.5 shadow-xs">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Praktik Kaiwa 50 Bab Minna no Nihongo</span>
                  </div>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 w-full sm:w-auto mb-2.5 sm:mb-4">
                {isLoggedIn ? (
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="group w-full sm:w-auto px-6 py-2.5 sm:py-3 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white font-extrabold text-xs sm:text-sm rounded-xl sm:rounded-2xl border-none cursor-pointer shadow-lg hover:shadow-primary/25 active:scale-95 transition-all flex items-center justify-center gap-2 touch-manipulation min-h-[42px]"
                  >
                    <span>Buka Dashboard</span>
                    <span className="size-4.5 sm:size-5 rounded-full bg-white/20 flex items-center justify-center text-[0.65rem] font-black group-hover:translate-x-0.5 transition-transform">
                      &gt;
                    </span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => navigate('/register')}
                      className="group w-full sm:w-auto px-6 py-2.5 sm:py-3 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white font-extrabold text-xs sm:text-sm rounded-xl sm:rounded-2xl border-none cursor-pointer shadow-lg hover:shadow-primary/25 active:scale-95 transition-all flex items-center justify-center gap-2 touch-manipulation min-h-[42px]"
                    >
                      <span>Mulai Belajar Sekarang</span>
                      <span className="size-4.5 sm:size-5 rounded-full bg-white/20 flex items-center justify-center text-[0.65rem] font-black group-hover:translate-x-0.5 transition-transform">
                        &gt;
                      </span>
                    </button>

                    <button
                      onClick={scrollToSimulator}
                      className="group inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:py-3 bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold text-xs sm:text-sm rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-primary/40 hover:text-primary dark:hover:text-red-400 transition-all cursor-pointer backdrop-blur-md w-full sm:w-auto touch-manipulation min-h-[42px]"
                    >
                      <span>Coba Simulasi Percakapan</span>
                      <span className="size-4.5 sm:size-5 rounded-full bg-primary/10 text-primary dark:text-red-400 flex items-center justify-center text-[0.7rem] font-bold group-hover:translate-y-0.5 transition-transform">
                        ↓
                      </span>
                    </button>
                  </>
                )}
              </div>

              {/* 4 Stat Cards: Unified grid for both mobile and desktop */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-3 w-full max-w-xl">
                <div className="p-2 sm:p-3 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800/80 text-center shadow-xs">
                  <span className="text-sm sm:text-xl font-black text-primary dark:text-red-400 block tracking-tight">50 Bab</span>
                  <span className="text-[0.6rem] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 block truncate">Minna no Nihongo</span>
                </div>
                <div className="p-2 sm:p-3 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800/80 text-center shadow-xs">
                  <span className="text-sm sm:text-xl font-black text-sky-600 dark:text-sky-400 block tracking-tight">10 Siswa</span>
                  <span className="text-[0.6rem] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 block truncate">Maks. per Sesi</span>
                </div>
                <div className="p-2 sm:p-3 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800/80 text-center shadow-xs">
                  <span className="text-sm sm:text-xl font-black text-emerald-600 dark:text-emerald-400 block tracking-tight">Daily SRS</span>
                  <span className="text-[0.6rem] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 block truncate">Target Hafalan</span>
                </div>
                <div className="p-2 sm:p-3 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800/80 text-center shadow-xs">
                  <span className="text-sm sm:text-xl font-black text-purple-600 dark:text-purple-400 block tracking-tight">Sensei</span>
                  <span className="text-[0.6rem] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 block truncate">Praktik Langsung</span>
                </div>
              </div>

            </div>

            {/* Right Showcase: 2 People Conversing Illustration (Desktop Only) */}
            <div className="hidden lg:block col-span-5 relative">
              {/* Floating badges around the illustration */}
              <div className="absolute -top-3 -right-2 z-20 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/80 shadow-lg flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100 animate-bounce [animation-duration:3.5s]">
                <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                <span>🔥 7 Hari Kotoba Streak</span>
              </div>

              <div className="absolute -bottom-3 -left-3 z-20 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/80 shadow-lg flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
                <span className="text-primary font-black">🥋</span>
                <span>JLPT N5 - N4 Ready</span>
              </div>

              <div className="absolute top-1/2 -right-4 -translate-y-1/2 z-20 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/80 shadow-md hidden xl:flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                <span className="text-sky-500 font-black">👥</span>
                <span>Maks. 10 Siswa/Sesi</span>
              </div>

              {/* Main Visual Illustration Box */}
              <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xl p-3 relative overflow-hidden group">
                <img
                  src="/hero-conversation.jpg"
                  alt="Ilustrasi Percakapan Bahasa Jepang Sensei dan Siswa"
                  className="w-full h-auto rounded-2xl object-cover shadow-xs group-hover:scale-[1.02] transition-transform duration-500"
                />
                
                {/* Subtle caption bar below the image */}
                <div className="pt-2.5 px-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[0.72rem] font-bold text-slate-700 dark:text-slate-300">
                      Praktik Kaiwa Alami & Interaktif
                    </span>
                  </div>
                  <button
                    onClick={scrollToSimulator}
                    className="text-[0.7rem] font-extrabold text-primary dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-none"
                  >
                    <span>Coba simulasi di bawah</span>
                    <span>&darr;</span>
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* Bottom Scroll Indicator (Subtle anchor at bottom of section) */}
          <div className="text-center pt-1 pb-1">
            <button
              type="button"
              onClick={scrollToSimulator}
              className="inline-flex items-center gap-1.5 text-[0.65rem] font-bold text-slate-400 hover:text-primary dark:hover:text-red-400 transition-colors bg-transparent border-none cursor-pointer py-0.5 px-2 touch-manipulation"
            >
              <span>Scroll untuk melihat simulasi</span>
              <svg className="size-3.5 animate-bounce text-primary dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

        </div>
      </section>

      {/* ── INTERACTIVE KAIWA SIMULATOR SECTION (DEDICATED BELOW HERO) ── */}
      <section
        id="simulator"
        className="py-12 sm:py-20 bg-slate-100/70 dark:bg-slate-900/40 border-t border-slate-200/80 dark:border-slate-800/80 scroll-mt-14 sm:scroll-mt-16 relative"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10">
          
          {/* Section Header */}
          <div className="text-center max-w-xl mx-auto mb-6 sm:mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[0.65rem] sm:text-xs font-black uppercase tracking-wider mb-2">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Simulasi Interaktif</span>
            </div>
            <h2 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Latihan Percakapan Nyata Minna no Nihongo
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
              Sentuh atau arahkan kursor ke balon percakapan untuk melihat reaksi ekspresi Sensei dan Murid secara real-time.
            </p>
          </div>

          {/* Simulator Box */}
          <div className="max-w-3xl mx-auto">
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-xl p-4 sm:p-6 relative transition-all">
              
              {/* Header: Title & 2-Topic Segmented Control */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                      Simulasi Percakapan Nyata
                    </h2>
                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <p className="text-[0.68rem] sm:text-[0.72rem] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    Sentuh atau arahkan kursor ke balon chat untuk melihat reaksi berbicara
                  </p>
                </div>

                {/* 2-Topic Segmented Switcher (Bab 1 & Bab 10) */}
                <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto">
                  {scenarios.map((sc, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setActiveScenario(i)
                        setHoveredSpeaker(null)
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[0.68rem] sm:text-xs font-bold transition-all text-center cursor-pointer border-none touch-manipulation ${
                        activeScenario === i
                          ? 'bg-primary text-white shadow-xs'
                          : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span className="sm:hidden">{sc.shortTitle}</span>
                      <span className="hidden sm:inline">{sc.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Course Subtitle Pill */}
              <div className="my-2.5 p-2 sm:p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-300 text-[0.72rem] sm:text-xs truncate">
                  Topik Kursus: <strong className="text-slate-900 dark:text-white">{scenarios[activeScenario].courseSubtitle}</strong>
                </span>
                <span className="text-[0.62rem] sm:text-[0.65rem] font-black px-2 py-0.5 rounded-md bg-primary/10 text-primary dark:text-red-400 shrink-0 self-start sm:self-auto">
                  {scenarios[activeScenario].tag}
                </span>
              </div>

              {/* Dialogue Box with Interactive Character Reactions */}
              <div className="py-1 space-y-3 sm:space-y-4">
                
                {/* ── Speaker A: Tanaka Sensei ── */}
                <div
                  onMouseEnter={() => setHoveredSpeaker('A')}
                  onMouseLeave={() => setHoveredSpeaker(null)}
                  onClick={() => setHoveredSpeaker(hoveredSpeaker === 'A' ? null : 'A')}
                  className="relative group cursor-pointer touch-manipulation"
                >
                  {/* Floating Talking Status Pill */}
                  <div
                    className={`transition-all duration-300 flex items-center gap-1.5 text-[0.65rem] sm:text-[0.68rem] font-black text-amber-600 dark:text-amber-400 mb-1 ml-12 sm:ml-14 ${
                      hoveredSpeaker === 'A' ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
                    }`}
                  >
                    <span className="size-1.5 rounded-full bg-amber-500 animate-ping" />
                    <span>Sensei Tanaka berbicara kepada Anda</span>
                    <div className="flex items-center gap-0.5 h-3 ml-1">
                      <span className="w-0.5 h-2 bg-amber-500 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-0.5 h-3 bg-amber-500 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-0.5 h-1.5 bg-amber-500 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <SenseiAvatar isSpeaking={hoveredSpeaker === 'A'} />

                    <div
                      className={`flex-1 p-3 sm:p-4 rounded-xl sm:rounded-2xl rounded-tl-xs border transition-all duration-200 shadow-xs ${
                        hoveredSpeaker === 'A'
                          ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 ring-2 ring-amber-400/20 scale-[1.01]'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[0.68rem] sm:text-[0.72rem] font-black text-amber-700 dark:text-amber-400">
                          {scenarios[activeScenario].speakerA}
                        </span>
                        <span className="text-[0.58rem] sm:text-[0.62rem] px-1.5 sm:px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                          {scenarios[activeScenario].roleA}
                        </span>
                      </div>
                      <p className="text-xs sm:text-base font-black text-slate-900 dark:text-white leading-snug">
                        {scenarios[activeScenario].japaneseA}
                      </p>
                      {showRomaji && (
                        <p className="text-[0.68rem] sm:text-[0.72rem] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 italic font-mono">
                          {scenarios[activeScenario].romajiA}
                        </p>
                      )}
                      <p className="text-[0.68rem] sm:text-[0.72rem] font-medium text-slate-600 dark:text-slate-300 mt-1 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                        "{scenarios[activeScenario].meaningA}"
                      </p>
                    </div>
                  </div>
                </div>

                {/* ── Speaker B: Budi (Student) ── */}
                <div
                  onMouseEnter={() => setHoveredSpeaker('B')}
                  onMouseLeave={() => setHoveredSpeaker(null)}
                  onClick={() => setHoveredSpeaker(hoveredSpeaker === 'B' ? null : 'B')}
                  className="relative group cursor-pointer touch-manipulation"
                >
                  {/* Floating Talking Status Pill */}
                  <div
                    className={`transition-all duration-300 flex items-center justify-end gap-1.5 text-[0.65rem] sm:text-[0.68rem] font-black text-emerald-600 dark:text-emerald-400 mb-1 mr-12 sm:mr-14 ${
                      hoveredSpeaker === 'B' ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
                    }`}
                  >
                    <div className="flex items-center gap-0.5 h-3 mr-1">
                      <span className="w-0.5 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-0.5 h-3 bg-emerald-500 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-0.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                    <span>Budi merespons percakapan</span>
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                  </div>

                  <div className="flex items-start gap-2.5 sm:gap-3 flex-row-reverse">
                    <StudentAvatar isSpeaking={hoveredSpeaker === 'B'} />

                    <div
                      className={`flex-1 p-3 sm:p-4 rounded-xl sm:rounded-2xl rounded-tr-xs border transition-all duration-200 shadow-xs ${
                        hoveredSpeaker === 'B'
                          ? 'bg-rose-50/80 dark:bg-red-950/40 border-primary dark:border-red-500 ring-2 ring-primary/20 scale-[1.01]'
                          : 'bg-gradient-to-br from-primary/5 via-primary/10 to-transparent dark:from-primary/15 dark:via-primary/5 border-primary/20 dark:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[0.58rem] sm:text-[0.62rem] px-1.5 sm:px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          <svg className="size-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          <span>{scenarios[activeScenario].scoreLabel}</span>
                        </span>
                        <span className="text-[0.68rem] sm:text-[0.72rem] font-black text-primary dark:text-red-400">
                          {scenarios[activeScenario].speakerB}
                        </span>
                      </div>
                      <p className="text-xs sm:text-base font-black text-slate-900 dark:text-white leading-snug">
                        {scenarios[activeScenario].japaneseB}
                      </p>
                      {showRomaji && (
                        <p className="text-[0.68rem] sm:text-[0.72rem] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 italic font-mono">
                          {scenarios[activeScenario].romajiB}
                        </p>
                      )}
                      <p className="text-[0.68rem] sm:text-[0.72rem] font-medium text-slate-600 dark:text-slate-300 mt-1 pt-1 border-t border-primary/10 dark:border-primary/20">
                        "{scenarios[activeScenario].meaningB}"
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Dialogue Footer Controls */}
              <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                
                {/* Audio Wave Simulation Bar */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5 h-4 px-2 rounded-full bg-slate-100 dark:bg-slate-800">
                    <span className="w-0.5 h-2 bg-primary rounded-full animate-pulse" />
                    <span className="w-0.5 h-3.5 bg-primary rounded-full animate-pulse [animation-delay:150ms]" />
                    <span className="w-0.5 h-1.5 bg-primary rounded-full animate-pulse [animation-delay:300ms]" />
                    <span className="w-0.5 h-3 bg-primary rounded-full animate-pulse [animation-delay:200ms]" />
                    <span className="w-0.5 h-2 bg-primary rounded-full animate-pulse [animation-delay:100ms]" />
                  </div>
                  <span className="text-[0.65rem] sm:text-[0.68rem] font-bold text-slate-500 dark:text-slate-400">
                    Skor: <strong className="text-emerald-600 dark:text-emerald-400 font-black">{scenarios[activeScenario].score}</strong>
                  </span>
                </div>

                {/* Romaji toggle */}
                <button
                  type="button"
                  onClick={() => setShowRomaji(!showRomaji)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[0.65rem] sm:text-[0.68rem] border border-slate-200 dark:border-slate-700 transition-all cursor-pointer touch-manipulation"
                >
                  {showRomaji ? 'Sembunyikan Romaji' : 'Tampilkan Romaji'}
                </button>

              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ── KEUNGGULAN SECTION ───────────────────────────────────── */}
      <section id="keunggulan" className="py-10 sm:py-14 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-xl mx-auto mb-6 sm:mb-10">
            <span className="text-[0.65rem] sm:text-xs font-black uppercase tracking-wider text-primary dark:text-red-400 block mb-1">
              Mengapa KaiwaDojo?
            </span>
            <h2 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Metode Praktik Efektif & Terarah
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Dirancang untuk percepatan komunikasi kerja, magang di Jepang, dan persiapan ujian JLPT.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-5">
            
            {/* Card 1 */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col gap-2.5 hover:border-primary/40 transition-all shadow-xs">
              <div className="size-10 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-red-400 flex items-center justify-center">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">Rencana Belajar Mandiri</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Pilih tanggal di kalender interaktif dan pantau target misi video, kotoba harian, serta kuis tanpa terlewat.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col gap-2.5 hover:border-sky-500/40 transition-all shadow-xs">
              <div className="size-10 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">Kotoba & Evaluasi Mandiri</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Simpan kosakata lengkap kanji dan romaji. Lakukan uji setoran hafalan kotoba kapan pun secara mandiri.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col gap-2.5 hover:border-emerald-500/40 transition-all shadow-xs">
              <div className="size-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">Kelas Live Online & Offline</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Sesi interaktif daring via Google Meet dan tatap muka intensif dengan batas maksimal 10 siswa per kelas.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── BENTO GRID: FITUR UTAMA ──────────────────────────────── */}
      <section id="fitur" className="py-10 sm:py-14 bg-slate-50 dark:bg-slate-950 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-xl mx-auto mb-6 sm:mb-10">
            <span className="text-[0.65rem] sm:text-xs font-black uppercase tracking-wider text-primary dark:text-red-400 block mb-1">
              Fitur Lengkap
            </span>
            <h2 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Ekosistem Belajar Lengkap All-in-One
            </h2>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-5">
            
            {/* Bento 1: Span 2 - Rencana Belajar */}
            <div className="md:col-span-2 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between hover:border-primary/40 transition-all shadow-xs">
              <div>
                <div className="size-10 rounded-xl bg-primary/10 text-primary dark:text-red-400 flex items-center justify-center mb-3 sm:mb-4">
                  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white mb-1">
                  Kalender Target Belajar & Streak Misi Harian
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium max-w-lg">
                  Atur ritme belajar mandiri dengan kalender interaktif. Pantau penyelesaian video bab, setoran kotoba, dan kehadiran kelas tanpa rasa terbebani.
                </p>
              </div>

              {/* Mini Widget Preview */}
              <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2">
                <div className="bg-slate-50 dark:bg-slate-800/60 p-2 sm:p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-center">
                  <span className="text-[0.6rem] font-bold text-slate-400 block uppercase">Senin</span>
                  <span className="text-xs font-black text-slate-800 dark:text-white mt-0.5 block">Bab 1 Video</span>
                  <span className="inline-block mt-0.5 text-[0.58rem] sm:text-[0.6rem] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">Selesai</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 p-2 sm:p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-center">
                  <span className="text-[0.6rem] font-bold text-slate-400 block uppercase">Selasa</span>
                  <span className="text-xs font-black text-slate-800 dark:text-white mt-0.5 block">Setor Kotoba</span>
                  <span className="inline-block mt-0.5 text-[0.58rem] sm:text-[0.6rem] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">Selesai</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 p-2 sm:p-2.5 rounded-xl border border-primary/40 dark:border-primary/50 text-center">
                  <span className="text-[0.6rem] font-bold text-primary dark:text-red-400 block uppercase">Hari Ini</span>
                  <span className="text-xs font-black text-slate-800 dark:text-white mt-0.5 block">Kelas Meet</span>
                  <span className="inline-block mt-0.5 text-[0.58rem] sm:text-[0.6rem] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">19:30</span>
                </div>
              </div>
            </div>

            {/* Bento 2: Kotoba Vault */}
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between hover:border-emerald-500/40 transition-all shadow-xs">
              <div>
                <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 sm:mb-4">
                  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white mb-1">
                  Kotoba Tracker & Hafalan
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  Bank kosakata terintegrasi kanji, romaji, dan makna. Lakukan setoran kotoba harian dengan sistem pengujian otomatis.
                </p>
              </div>

              <div className="mt-4 p-2.5 sm:p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-center">
                <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white block">会話 (かいわ)</span>
                <span className="text-[0.65rem] font-mono text-slate-500 dark:text-slate-400">kaiwa • percakapan</span>
              </div>
            </div>

            {/* Bento 3: Kelas Live Interaktif */}
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between hover:border-sky-500/40 transition-all shadow-xs">
              <div>
                <div className="size-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-3 sm:mb-4">
                  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white mb-1">
                  Kelas Live Online & Offline
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  Sesi interaktif daring via Google Meet dan tatap muka intensif. Kuota terbatas 10 siswa per sesi agar setiap siswa aktif berbicara.
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[0.68rem] sm:text-xs font-bold text-slate-700 dark:text-slate-300">Sisa Kuota Sesi</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-[0.65rem]">
                  2 Kursi Tersedia
                </span>
              </div>
            </div>

            {/* Bento 4: Span 2 - Kuis Evaluasi (Tingkat Ketuntasan Removed as requested) */}
            <div className="md:col-span-2 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between hover:border-amber-500/40 transition-all shadow-xs">
              <div>
                <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 sm:mb-4">
                  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white mb-1">
                  Kuis Evaluasi Tiap Bab & Penilaian Otomatis
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium max-w-lg">
                  Setiap bab dilengkapi evaluasi kuis pilihan ganda dan latihan pemahaman percakapan. Dapatkan umpan balik langsung untuk mengukur kemajuan bunpou dan choukai Anda.
                </p>
              </div>

              {/* Clean Feature Tag Badges (No Progress Bar) */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-wrap">
                <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Kuis 1: Tata Bahasa & Bunpou
                </span>
                <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Kuis 2: Pemahaman & Kaiwa
                </span>
                <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  Koreksi Nilai Otomatis
                </span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── KURIKULUM SECTION ─────────────────────────────────────── */}
      <section id="kurikulum" className="py-10 sm:py-14 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-xl mx-auto mb-6 sm:mb-8">
            <span className="text-[0.65rem] sm:text-xs font-black uppercase tracking-wider text-primary dark:text-red-400 block mb-1">
              Kurikulum Lengkap
            </span>
            <h2 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Kurikulum 50 Bab Berstandar Minna no Nihongo
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Sesuai dengan topik kursus yang Anda pelajari di halaman My Courses.
            </p>
          </div>

          {/* Tab Selector Responsive Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md mx-auto mb-6">
            <button
              type="button"
              onClick={() => setCurriculumTab('jilid1')}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer border touch-manipulation min-h-[42px] ${
                curriculumTab === 'jilid1'
                  ? 'bg-primary text-white border-primary shadow-md'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Jilid 1 (Bab 1 - 25: Dasar N5)
            </button>
            <button
              type="button"
              onClick={() => setCurriculumTab('jilid2')}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer border touch-manipulation min-h-[42px] ${
                curriculumTab === 'jilid2'
                  ? 'bg-sky-600 text-white border-sky-600 shadow-md'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Jilid 2 (Bab 26 - 50: Menengah N4)
            </button>
          </div>

          {/* Curriculum Content Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-5">
            {curriculumTab === 'jilid1' ? (
              <>
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-primary dark:text-red-400">Bab 1 - 12</span>
                    <span className="text-[0.62rem] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">Dasar Fondasi</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    Perkenalan, Waktu & Aktivitas Sehari-hari
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    Mencakup perkenalan diri (わたしはエンジニアです), keberadaan benda/orang di Bab 10 (机の上に本があります), penunjuk lokasi, dan kata kerja ~masu.
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[0.62rem] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Perkenalan Diri</span>
                    <span className="text-[0.62rem] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Keberadaan (Bab 10)</span>
                    <span className="text-[0.62rem] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Kata Kerja ~masu</span>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-primary dark:text-red-400">Bab 13 - 25</span>
                    <span className="text-[0.62rem] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">Pola Lanjutan N5</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    Keinginan, Permohonan & Bentuk ~Te / ~Nai
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    Mengungkapkan keinginan (日本へ行きたいです), bentuk permohonan (~te kudasai), izin & larangan, serta bentuk kamus dan lampau (~ta).
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[0.62rem] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Bentuk ~Tai</span>
                    <span className="text-[0.62rem] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Bentuk ~Te</span>
                    <span className="text-[0.62rem] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Bentuk Kamus</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-sky-600 dark:text-sky-400">Bab 26 - 38</span>
                    <span className="text-[0.62rem] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold">Menengah Bawah</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    Bentuk Potensial, Pengandaian & Kondisi
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    Kemampuan berbicara potensial (日本語が話せます), bentuk maksud (volitional), syarat pengandaian (~ba/~tara), dan bentuk pasif (ukemi).
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[0.62rem] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Potensial (Dekiru)</span>
                    <span className="text-[0.62rem] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Pengandaian (~ba)</span>
                    <span className="text-[0.62rem] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Pasif (Ukemi)</span>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-sky-600 dark:text-sky-400">Bab 39 - 50</span>
                    <span className="text-[0.62rem] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold">Keigo & Profesional</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    Hormat Keigo & Etika Kerja Perusahaan
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    Bentuk kausatif (saseru), bahasa penghormatan Sonkeigo & bahasa merendah Kenjougo (私が参ります) untuk kesiapan kerja dan wawancara.
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[0.62rem] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Sonkeigo</span>
                    <span className="text-[0.62rem] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Kenjougo</span>
                    <span className="text-[0.62rem] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Wawancara Mensetsu</span>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      </section>

      {/* ── CALL TO ACTION BANNER ─────────────────────────────────── */}
      <section
        className="py-10 sm:py-14 text-white relative overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(15,23,42,0.96), rgba(185,28,28,0.88), rgba(15,23,42,0.96)), url('/japan-background(3).jpg')",
        }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10 flex flex-col items-center gap-3.5">
          <span className="px-3 py-1 rounded-full bg-white/10 text-amber-300 text-[0.65rem] sm:text-xs font-black uppercase tracking-wider border border-white/20 backdrop-blur-md">
            Mulai Belajar Bersama Sensei Sekarang
          </span>
          
          <h2 className="text-xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white max-w-lg leading-tight">
            Tingkatkan Rasa Percaya Diri Berbahasa Jepang Hari Ini
          </h2>

          <p className="text-xs sm:text-sm text-slate-200 max-w-md font-medium leading-relaxed px-1">
            Daftar akun sekarang dan dapatkan akses langsung ke rencana belajar kalender, kotoba harian, dan reservasi sesi kelas.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto pt-1">
            {isLoggedIn ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="group w-full sm:w-auto px-7 py-3 bg-primary hover:bg-primary-dark text-white font-black text-xs sm:text-sm rounded-xl sm:rounded-2xl border-none cursor-pointer shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2.5 touch-manipulation min-h-[44px]"
              >
                <span>Buka Dashboard</span>
                <span className="size-5 rounded-full bg-white/20 flex items-center justify-center text-[0.65rem] font-black group-hover:translate-x-0.5 transition-transform">
                  &gt;
                </span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/register')}
                  className="group w-full sm:w-auto px-7 py-3 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white font-black text-xs sm:text-sm rounded-xl sm:rounded-2xl border-none cursor-pointer shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2.5 touch-manipulation min-h-[44px]"
                >
                  <span>Daftar Akun</span>
                  <span className="size-5 rounded-full bg-white/20 flex items-center justify-center text-[0.65rem] font-black group-hover:translate-x-0.5 transition-transform">
                    &gt;
                  </span>
                </button>

                <button
                  onClick={() => navigate('/login')}
                  className="group w-full sm:w-auto px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs sm:text-sm rounded-xl sm:rounded-2xl border border-white/25 cursor-pointer backdrop-blur-md active:scale-95 transition-all flex items-center justify-center gap-2.5 touch-manipulation min-h-[44px]"
                >
                  <span>Masuk ke Akun</span>
                  <span className="size-5 rounded-full bg-white/15 flex items-center justify-center text-[0.65rem] font-black group-hover:translate-x-0.5 transition-transform">
                    &gt;
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────── */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200/80 dark:border-slate-800/80 py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium text-center sm:text-left">
          
          <div className="flex items-center gap-2">
            <div className="size-6 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center p-1 shrink-0">
              <img src="/kaiwa-logo.png" alt="KaiwaDojo" className="size-full object-contain" />
            </div>
            <span className="font-extrabold text-slate-800 dark:text-white text-[0.72rem] sm:text-xs">
              KaiwaDojo &copy; {new Date().getFullYear()}. All Rights Reserved.
            </span>
          </div>

          <div className="flex items-center gap-4 flex-wrap justify-center text-[0.72rem] sm:text-xs">
            <a href="#simulator" className="hover:text-primary transition-colors no-underline">Simulasi</a>
            <a href="#keunggulan" className="hover:text-primary transition-colors no-underline">Keunggulan</a>
            <a href="#fitur" className="hover:text-primary transition-colors no-underline">Fitur</a>
            <a href="#kurikulum" className="hover:text-primary transition-colors no-underline">Kurikulum</a>
            <button onClick={() => navigate('/login')} className="hover:text-primary transition-colors bg-transparent border-none cursor-pointer font-medium text-slate-500 text-[0.72rem] sm:text-xs">
              Login
            </button>
          </div>
        </div>
      </footer>

    </div>
  )
}
