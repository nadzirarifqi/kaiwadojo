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

  // Interactive Live Kaiwa Scenario Switcher
  const [activeScenario, setActiveScenario] = useState<number>(0)
  const [showRomaji, setShowRomaji] = useState<boolean>(true)

  const scenarios = [
    {
      title: 'Salam & Perkenalan',
      tag: 'Bab 1 - Jikoshoukai',
      speakerA: 'Tanaka Sensei',
      roleA: 'Sensei Pengajar',
      japaneseA: 'はじめまして、田中です。どうぞよろしくお願いします。',
      romajiA: 'Hajimemashite, Tanaka desu. Douzo yoroshiku onegaishimasu.',
      meaningA: 'Senang berkenalan dengan Anda, saya Tanaka. Mohon bimbingannya.',
      speakerB: 'Budi (Siswa)',
      roleB: 'Peserta Pelatihan',
      japaneseB: '初めまして！ブディと申します。日本で働くのが楽しみです！',
      romajiB: 'Hajimemashite! Budi to moushimasu. Nihon de hataraku no ga tanoshimi desu!',
      meaningB: 'Salam kenal! Saya Budi. Saya sangat menantikan bekerja di Jepang!',
      score: '98%',
      scoreLabel: 'Pelafalan Sangat Akurat',
    },
    {
      title: 'Di Restoran / Izakaya',
      tag: 'Bab 13 - Memesan Menu',
      speakerA: 'Tenin (Pelayan)',
      roleA: 'Staf Restoran',
      japaneseA: 'いらっしゃいませ！ご注文はお決まりですか？',
      romajiA: 'Irasshaimase! Gochuumon wa okimari desu ka?',
      meaningA: 'Selamat datang! Apakah Anda sudah siap memesan?',
      speakerB: 'Budi (Siswa)',
      roleB: 'Tamu',
      japaneseB: 'おすすめのラーメンを一つと、お茶をお願いします。',
      romajiB: 'Osusume no raamen o hitotsu to, ocha o onegaishimasu.',
      meaningB: 'Tolong satu ramen rekomendasi, dan teh hijau hangat ya.',
      score: '96%',
      scoreLabel: 'Struktur Pola Kalimat Tepat',
    },
    {
      title: 'Wawancara Mensetsu',
      tag: 'Bab 48 - Keigo Bisnis',
      speakerA: 'Mensetsukan (Pewawancara)',
      roleA: 'HR Perusahaan Jepang',
      japaneseA: '日本で働きたい理由を教えていただけますか？',
      romajiA: 'Nihon de hatarakitai riyuu o oshiete itadakemasu ka?',
      meaningA: 'Bisakah Anda jelaskan alasan ingin bekerja di Jepang?',
      speakerB: 'Budi (Siswa)',
      roleB: 'Kandidat Trainee',
      japaneseB: '日本の技術と礼儀を学び、将来両国の架け橋になりたいからです。',
      romajiB: 'Nihon no gijutsu to reigi o manabi, shourai ryoukoku no kakehashi ni naritai kara desu.',
      meaningB: 'Karena saya ingin mempelajari teknologi dan etika kerja Jepang demi menjadi jembatan kedua negara.',
      score: '99%',
      scoreLabel: 'Keigo Alami & Percaya Diri',
    },
  ]

  // Curriculum active tab
  const [curriculumTab, setCurriculumTab] = useState<'jilid1' | 'jilid2'>('jilid1')

  return (
    <div className="min-h-screen pt-16 sm:pt-18 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors selection:bg-primary/20 selection:text-primary relative overflow-x-clip">
      
      {/* Decorative Kanji Watermarks */}
      <div className="hidden 2xl:block fixed left-6 top-32 z-0 writing-vertical-jp text-4xl font-black text-slate-200/50 dark:text-slate-800/25 pointer-events-none tracking-widest select-none">
        日本語会話 ・ 会話道場
      </div>
      <div className="hidden 2xl:block fixed right-6 top-32 z-0 writing-vertical-jp text-4xl font-black text-slate-200/50 dark:text-slate-800/25 pointer-events-none tracking-widest select-none">
        実践演習 ・ 50課修了
      </div>

      {/* ── HEADER NAVBAR ────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800/70 shadow-xs transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => navigate('/')}>
            <div className="size-10 sm:size-11 bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1.5 overflow-hidden shrink-0">
              <img src="/kaiwa-logo.png" alt="KaiwaDojo" className="size-full object-contain" />
            </div>
            <div>
              <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                Kaiwa<span className="text-primary dark:text-red-400">Dojo</span>
                <span className="text-[0.62rem] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary dark:text-red-400 font-extrabold border border-primary/20">
                  会話
                </span>
              </span>
              <span className="text-[0.58rem] font-bold text-slate-400 dark:text-slate-500 block -mt-0.5 tracking-wider uppercase">
                Platform Belajar Bahasa Jepang
              </span>
            </div>
          </div>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-bold text-slate-600 dark:text-slate-300">
            <a href="#simulator" className="hover:text-primary dark:hover:text-red-400 transition-colors no-underline">
              Simulasi Percakapan
            </a>
            <a href="#keunggulan" className="hover:text-primary dark:hover:text-red-400 transition-colors no-underline">
              Keunggulan
            </a>
            <a href="#fitur" className="hover:text-primary dark:hover:text-red-400 transition-colors no-underline">
              Fitur
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
              title={isDark ? 'Mode Terang' : 'Mode Gelap'}
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

            {/* Mobile Menu Toggle */}
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
              href="#simulator"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2.5 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-primary no-underline flex items-center justify-between"
            >
              <span>Simulasi Percakapan</span>
              <span className="size-5 rounded-full bg-slate-200/60 dark:bg-slate-800 flex items-center justify-center text-[0.65rem] text-slate-500">&gt;</span>
            </a>
            <a
              href="#keunggulan"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2.5 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-primary no-underline flex items-center justify-between"
            >
              <span>Keunggulan Platform</span>
              <span className="size-5 rounded-full bg-slate-200/60 dark:bg-slate-800 flex items-center justify-center text-[0.65rem] text-slate-500">&gt;</span>
            </a>
            <a
              href="#fitur"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2.5 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-primary no-underline flex items-center justify-between"
            >
              <span>Fitur Utama</span>
              <span className="size-5 rounded-full bg-slate-200/60 dark:bg-slate-800 flex items-center justify-center text-[0.65rem] text-slate-500">&gt;</span>
            </a>
            <a
              href="#kurikulum"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2.5 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-primary no-underline flex items-center justify-between"
            >
              <span>Kurikulum 50 Bab</span>
              <span className="size-5 rounded-full bg-slate-200/60 dark:bg-slate-800 flex items-center justify-center text-[0.65rem] text-slate-500">&gt;</span>
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
                  <span className="size-5 rounded-full bg-white/20 flex items-center justify-center text-[0.65rem] font-black group-hover:translate-x-0.5 transition-transform">
                    &gt;
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ── HERO SECTION WITH DYNAMIC VISUALS ────────────────────── */}
      <section
        className="relative overflow-hidden pt-10 pb-16 sm:pt-16 sm:pb-24 bg-cover bg-center bg-no-repeat transition-colors"
        style={{
          backgroundImage: isDark
            ? "linear-gradient(to bottom, rgba(15,23,42,0.88), rgba(15,23,42,0.97)), url('/japan-background.jpg')"
            : "linear-gradient(to bottom, rgba(255,255,255,0.90), rgba(248,250,252,0.98)), url('/japan-background.jpg')",
        }}
      >
        {/* Ambient Glowing Blobs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-primary/15 via-red-500/10 to-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            {/* Top Eyebrow Pill */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 dark:bg-slate-900/80 border border-primary/25 dark:border-red-500/30 text-primary dark:text-red-400 text-xs font-black uppercase tracking-wider mb-6 shadow-sm backdrop-blur-md">
              <span className="size-2 rounded-full bg-primary animate-ping" />
              <span>Platform Belajar Percakapan Bahasa Jepang Terstruktur</span>
            </div>

            {/* High-Impact Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.15] mb-6">
              Kuasai Percakapan Bahasa Jepang.{' '}
              <span className="bg-gradient-to-r from-primary via-red-500 to-amber-500 bg-clip-text text-transparent block sm:inline">
                Bicara Alami & Lebih Percaya Diri.
              </span>
            </h1>

            {/* Clean Subheading */}
            <p className="text-xs sm:text-base lg:text-lg text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed mb-8 font-medium">
              Pelajari 50 bab percakapan praktis, setor target hafalan kotoba harian, dan asah kemampuan komunikasi langsung bersama Sensei dalam kelas interaktif.
            </p>

            {/* Action CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mb-12 sm:mb-16">
              {isLoggedIn ? (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="group w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white font-black text-sm rounded-2xl border-none cursor-pointer shadow-xl hover:shadow-primary/25 active:scale-95 transition-all flex items-center justify-center gap-3"
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
                    className="group w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white font-black text-sm rounded-2xl border-none cursor-pointer shadow-xl hover:shadow-primary/25 active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    <span>Mulai Belajar</span>
                    <span className="size-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-black group-hover:translate-x-0.5 transition-transform">
                      &gt;
                    </span>
                  </button>

                  <a
                    href="#kurikulum"
                    className="group inline-flex items-center justify-center gap-2.5 px-7 py-3.5 bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold text-xs sm:text-sm rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-primary/40 hover:text-primary dark:hover:text-red-400 transition-all no-underline backdrop-blur-md w-full sm:w-auto"
                  >
                    <span>Lihat Kurikulum 50 Bab</span>
                    <span className="size-5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[0.65rem] font-bold group-hover:translate-x-0.5 transition-transform">
                      &gt;
                    </span>
                  </a>
                </>
              )}
            </div>
          </div>

          {/* ── CATCHY INTERACTIVE SIMULATOR CARD (HERO SPOTLIGHT) ── */}
          <div id="simulator" className="max-w-4xl mx-auto scroll-mt-24">
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-2xl p-5 sm:p-8 relative overflow-hidden transition-all">
              
              {/* Card Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-red-400 border border-primary/20 flex items-center justify-center shrink-0">
                    <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                        Simulasi Praktik Kaiwa Realistis
                      </h2>
                      <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Coba simulasi dialog percakapan situasional di bawah ini
                    </p>
                  </div>
                </div>

                {/* Scenario Selector Pills */}
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl overflow-x-auto">
                  {scenarios.map((sc, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveScenario(i)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer border-none ${
                        activeScenario === i
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {sc.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dialogue Box */}
              <div className="py-6 space-y-4">
                
                {/* Speaker A (Sensei / Host) */}
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="size-10 sm:size-11 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center font-black text-sm shrink-0">
                    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="flex-1 bg-slate-50 dark:bg-slate-800/60 p-4 sm:p-5 rounded-3xl rounded-tl-sm border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black text-amber-700 dark:text-amber-400">
                        {scenarios[activeScenario].speakerA}
                      </span>
                      <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                        {scenarios[activeScenario].roleA}
                      </span>
                    </div>
                    <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-relaxed">
                      {scenarios[activeScenario].japaneseA}
                    </p>
                    {showRomaji && (
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 italic font-mono">
                        {scenarios[activeScenario].romajiA}
                      </p>
                    )}
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                      "{scenarios[activeScenario].meaningA}"
                    </p>
                  </div>
                </div>

                {/* Speaker B (Student / Budi) */}
                <div className="flex items-start gap-3 sm:gap-4 flex-row-reverse">
                  <div className="size-10 sm:size-11 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-red-400 border border-primary/30 flex items-center justify-center font-black text-sm shrink-0">
                    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 bg-gradient-to-br from-primary/5 via-primary/10 to-transparent dark:from-primary/15 dark:via-primary/5 p-4 sm:p-5 rounded-3xl rounded-tr-sm border border-primary/20 dark:border-primary/30 shadow-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{scenarios[activeScenario].scoreLabel}</span>
                      </span>
                      <span className="text-xs font-black text-primary dark:text-red-400">
                        {scenarios[activeScenario].speakerB}
                      </span>
                    </div>
                    <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-relaxed">
                      {scenarios[activeScenario].japaneseB}
                    </p>
                    {showRomaji && (
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 italic font-mono">
                        {scenarios[activeScenario].romajiB}
                      </p>
                    )}
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1.5 pt-1.5 border-t border-primary/10 dark:border-primary/20">
                      "{scenarios[activeScenario].meaningB}"
                    </p>
                  </div>
                </div>

              </div>

              {/* Dialogue Footer Controls */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                
                {/* Audio Wave Simulation Bar */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 h-5 px-3 rounded-full bg-slate-100 dark:bg-slate-800">
                    <span className="w-1 h-3 bg-primary rounded-full animate-pulse" />
                    <span className="w-1 h-5 bg-primary rounded-full animate-pulse [animation-delay:150ms]" />
                    <span className="w-1 h-2 bg-primary rounded-full animate-pulse [animation-delay:300ms]" />
                    <span className="w-1 h-4 bg-primary rounded-full animate-pulse [animation-delay:200ms]" />
                    <span className="w-1 h-3 bg-primary rounded-full animate-pulse [animation-delay:100ms]" />
                  </div>
                  <span className="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400">
                    Akurasi Pelafalan: <strong className="text-emerald-600 dark:text-emerald-400 font-black">{scenarios[activeScenario].score}</strong>
                  </span>
                </div>

                {/* Romaji toggle */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRomaji(!showRomaji)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                  >
                    {showRomaji ? 'Sembunyikan Romaji' : 'Tampilkan Romaji'}
                  </button>
                  <span className="px-2.5 py-1 rounded-xl bg-primary/10 text-primary dark:text-red-400 font-black text-[0.68rem]">
                    {scenarios[activeScenario].tag}
                  </span>
                </div>

              </div>

            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto mt-8">
            <div className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/80 text-center shadow-xs">
              <span className="text-2xl sm:text-3xl font-black text-primary dark:text-red-400 block tracking-tight">50 Bab</span>
              <span className="text-[0.65rem] sm:text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5 block">Modul Terstruktur N5-N4</span>
            </div>

            <div className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/80 text-center shadow-xs">
              <span className="text-2xl sm:text-3xl font-black text-sky-600 dark:text-sky-400 block tracking-tight">10 Siswa</span>
              <span className="text-[0.65rem] sm:text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5 block">Maksimal per Sesi Kelas</span>
            </div>

            <div className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/80 text-center shadow-xs">
              <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 block tracking-tight">Daily SRS</span>
              <span className="text-[0.65rem] sm:text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5 block">Target Hafalan Kotoba</span>
            </div>

            <div className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/80 text-center shadow-xs">
              <span className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 block tracking-tight">Sensei</span>
              <span className="text-[0.65rem] sm:text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5 block">Bimbingan Langsung</span>
            </div>
          </div>

        </div>
      </section>

      {/* ── BENTO GRID: FITUR UTAMA ──────────────────────────────── */}
      <section id="fitur" className="py-16 sm:py-24 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            <span className="text-xs font-black uppercase tracking-wider text-primary dark:text-red-400 block mb-2">
              Ekosistem Belajar Lengkap
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Semua Fitur yang Anda Butuhkan untuk Fasih Berbicara
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">
              Bukan sekadar membaca teori, tapi membangun refleks berbicara melalui latihan harian terpantau.
            </p>
          </div>

          {/* Bento Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Bento 1: Large Span 2 - Rencana Belajar Kalender */}
            <div className="md:col-span-2 bg-slate-50 dark:bg-slate-800/50 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-between hover:border-primary/40 transition-all shadow-xs group">
              <div>
                <div className="size-12 rounded-2xl bg-primary/10 text-primary dark:text-red-400 flex items-center justify-center mb-5">
                  <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mb-2">
                  Kalender Rencana Belajar Harian & Streak Misi
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium max-w-xl">
                  Tentukan tanggal dan target belajar secara teratur. Pantau pencapaian misi video, hafalan kotoba, kuis, dan kehadiran kelas tanpa khawatir tertinggal.
                </p>
              </div>

              {/* Visual Mini Widget Preview */}
              <div className="mt-6 pt-6 border-t border-slate-200/60 dark:border-slate-700/60 grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 text-center">
                  <span className="text-[0.65rem] font-bold text-slate-400 block uppercase">Senin</span>
                  <span className="text-xs font-black text-slate-800 dark:text-white mt-1 block">Bab 1 Video</span>
                  <span className="inline-block mt-1 text-[0.65rem] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Selesai</span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 text-center">
                  <span className="text-[0.65rem] font-bold text-slate-400 block uppercase">Selasa</span>
                  <span className="text-xs font-black text-slate-800 dark:text-white mt-1 block">Setor 15 Kotoba</span>
                  <span className="inline-block mt-1 text-[0.65rem] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Selesai</span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-primary/40 dark:border-primary/50 text-center">
                  <span className="text-[0.65rem] font-bold text-primary dark:text-red-400 block uppercase">Hari Ini</span>
                  <span className="text-xs font-black text-slate-800 dark:text-white mt-1 block">Kelas Live Meet</span>
                  <span className="inline-block mt-1 text-[0.65rem] font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-full">19:30 WIB</span>
                </div>
              </div>
            </div>

            {/* Bento 2: Kotoba Vault */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-between hover:border-emerald-500/40 transition-all shadow-xs">
              <div>
                <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-5">
                  <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mb-2">
                  Kotoba Tracker & Pelafalan
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  Bank kosakata terintegrasi kanji, romaji, dan makna. Lakukan setoran kotoba harian dengan sistem pengujian otomatis.
                </p>
              </div>

              {/* Sample Flashcard */}
              <div className="mt-6 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 text-center">
                <span className="text-2xl font-black text-slate-900 dark:text-white block">会話 (かいわ)</span>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">kaiwa &bull; percakapan</span>
              </div>
            </div>

            {/* Bento 3: Kelas Live Interaktif */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-between hover:border-sky-500/40 transition-all shadow-xs">
              <div>
                <div className="size-12 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-5">
                  <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mb-2">
                  Kelas Live Online & Offline
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  Sesi interaktif daring via Google Meet dan tatap muka intensif. Kuota dibatasi ketat maksimal 10 siswa per sesi agar setiap siswa aktif berbicara.
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Sisa Kuota Sesi</span>
                <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-xs">
                  2 Kursi Tersedia
                </span>
              </div>
            </div>

            {/* Bento 4: Large Span 2 - Kurikulum & Kuis Evaluasi */}
            <div className="md:col-span-2 bg-slate-50 dark:bg-slate-800/50 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-between hover:border-amber-500/40 transition-all shadow-xs">
              <div>
                <div className="size-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-5">
                  <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mb-2">
                  Evaluasi Kuis Tiap Bab & Penilaian Otomatis
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium max-w-xl">
                  Setiap bab dilengkapi evaluasi pilihan ganda dan latihan percakapan. Dapatkan umpan balik langsung untuk mengukur kemajuan bunpou dan choukai Anda.
                </p>
              </div>

              {/* Progress bar showcase */}
              <div className="mt-6 pt-6 border-t border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-slate-600 dark:text-slate-400">Tingkat Ketuntasan Kurikulum Siswa</span>
                  <span className="font-black text-primary dark:text-red-400">Rata-rata 94% Lulus N4</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-amber-500 rounded-full w-[94%]" />
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── KURIKULUM 50 BAB EXPLORER ─────────────────────────────── */}
      <section id="kurikulum" className="py-16 sm:py-24 bg-slate-50 dark:bg-slate-950 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <span className="text-xs font-black uppercase tracking-wider text-primary dark:text-red-400 block mb-2">
              Jalur Pembelajaran Jelas
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Kurikulum 50 Bab Berstandar Minna no Nihongo
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">
              Dirancang sistematis dari tingkat pemula nol (N5) hingga percakapan lingkungan kerja dan wawancara (N4).
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center justify-center gap-2 mb-10">
            <button
              type="button"
              onClick={() => setCurriculumTab('jilid1')}
              className={`px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer border ${
                curriculumTab === 'jilid1'
                  ? 'bg-primary text-white border-primary shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Jilid 1 (Bab 1 - 25: Tingkat Dasar N5)
            </button>
            <button
              type="button"
              onClick={() => setCurriculumTab('jilid2')}
              className={`px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer border ${
                curriculumTab === 'jilid2'
                  ? 'bg-sky-600 text-white border-sky-600 shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Jilid 2 (Bab 26 - 50: Tingkat Menengah N4)
            </button>
          </div>

          {/* Curriculum Content Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {curriculumTab === 'jilid1' ? (
              <>
                <div className="bg-white dark:bg-slate-900 p-6 sm:p-7 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-primary dark:text-red-400">Bab 1 - 12</span>
                    <span className="text-[0.68rem] px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">Dasar Fondasi</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    Perkenalan, Identitas & Aktivitas Harian
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    Jikoshoukai, kepemilikan benda, penunjuk tempat (koko/soko/asoko), kata kerja bentuk ~masu, waktu, dan aktivitas sehari-hari.
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    <span className="text-[0.68rem] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Salam & Etika</span>
                    <span className="text-[0.68rem] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Kata Kerja ~masu</span>
                    <span className="text-[0.68rem] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Angka & Jam</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 sm:p-7 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-primary dark:text-red-400">Bab 13 - 25</span>
                    <span className="text-[0.68rem] px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">Pola Lanjutan N5</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    Keinginan, Permohonan & Bentuk ~Te/~Nai
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    Mengungkapkan keinginan (~tai/hoshii), izin & larangan (~te mo ii / ~te wa ikemasen), serta rangkaian kegiatan bersambung.
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    <span className="text-[0.68rem] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Bentuk ~Te</span>
                    <span className="text-[0.68rem] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Bentuk ~Nai</span>
                    <span className="text-[0.68rem] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Bentuk Kamus</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="bg-white dark:bg-slate-900 p-6 sm:p-7 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-sky-600 dark:text-sky-400">Bab 26 - 38</span>
                    <span className="text-[0.68rem] px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold">Menengah Bawah</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    Alasan, Pengandaian & Bentuk Potensial
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    Penjelasan mendalam partikel ~ndesu, kemampuan potensial (~reru/~rareru), syarat pengandaian (~tara/~ba), dan kalimat pasif.
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    <span className="text-[0.68rem] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Potensial (Kanoukei)</span>
                    <span className="text-[0.68rem] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Kondisi (~te shimau)</span>
                    <span className="text-[0.68rem] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Pengandaian (~tara)</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 sm:p-7 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-sky-600 dark:text-sky-400">Bab 39 - 50</span>
                    <span className="text-[0.68rem] px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold">Keigo & Profesional</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    Keigo Bisnis & Persiapan Wawancara Kerja
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    Penggunaan Sonkeigo (bahasa penghormatan) & Kenjougo (bahasa merendah), etika telepon kantor, serta simulasi mensetsu kerja di Jepang.
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    <span className="text-[0.68rem] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Sonkeigo</span>
                    <span className="text-[0.68rem] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Kenjougo</span>
                    <span className="text-[0.68rem] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Wawancara Mensetsu</span>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      </section>

      {/* ── CALL TO ACTION BANNER ─────────────────────────────────── */}
      <section
        className="py-16 sm:py-24 text-white relative overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(15,23,42,0.96), rgba(185,28,28,0.85), rgba(15,23,42,0.96)), url('/japan-background(3).jpg')",
        }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 flex flex-col items-center gap-6">
          <span className="px-4 py-1 rounded-full bg-white/10 text-amber-300 text-xs font-black uppercase tracking-wider border border-white/20 backdrop-blur-md">
            Mulai Belajar Bersama Sensei Sekarang
          </span>
          
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white max-w-2xl leading-tight">
            Tingkatkan Rasa Percaya Diri Berbahasa Jepang Hari Ini
          </h2>

          <p className="text-xs sm:text-base text-slate-200 max-w-xl font-medium leading-relaxed">
            Daftar akun sekarang dan dapatkan akses langsung ke rencana belajar kalender, kotoba harian, dan reservasi sesi kelas.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto pt-2">
            {isLoggedIn ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="group w-full sm:w-auto px-8 py-3.5 bg-primary hover:bg-primary-dark text-white font-black text-sm rounded-2xl border-none cursor-pointer shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                <span>Buka Dashboard</span>
                <span className="size-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-black group-hover:translate-x-0.5 transition-transform">
                  &gt;
                </span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/register')}
                  className="group w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white font-black text-sm rounded-2xl border-none cursor-pointer shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <span>Daftar Akun</span>
                  <span className="size-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-black group-hover:translate-x-0.5 transition-transform">
                    &gt;
                  </span>
                </button>

                <button
                  onClick={() => navigate('/login')}
                  className="group w-full sm:w-auto px-7 py-3.5 bg-white/10 hover:bg-white/20 text-white font-extrabold text-sm rounded-2xl border border-white/25 cursor-pointer backdrop-blur-md active:scale-95 transition-all flex items-center justify-center gap-3"
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
            <a href="#simulator" className="hover:text-primary transition-colors no-underline">Simulasi</a>
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
