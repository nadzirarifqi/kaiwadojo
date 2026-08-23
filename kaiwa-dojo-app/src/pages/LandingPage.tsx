import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function LandingPage() {
  const navigate = useNavigate()
  const { session, profile } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isLoggedIn = Boolean(session || profile)

  return (
    <div className="min-h-screen pt-16 sm:pt-18 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors selection:bg-primary/20 selection:text-primary bg-japanese-dots relative overflow-x-clip">
      
      {/* Decorative Floating Kanji Watermark (Desktop) */}
      <div className="hidden lg:block fixed left-6 top-32 z-0 writing-vertical-jp text-4xl font-black text-slate-200/60 dark:text-slate-800/40 pointer-events-none tracking-widest">
        日本語会話 ・ 会話道場
      </div>
      <div className="hidden lg:block fixed right-6 top-32 z-0 writing-vertical-jp text-4xl font-black text-slate-200/60 dark:text-slate-800/40 pointer-events-none tracking-widest">
        実践会話 ・ 50課修了
      </div>

      {/* ── HEADER NAVBAR ────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-2.5 sm:gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="size-9 sm:size-11 bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl shadow-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1 sm:p-1.5 overflow-hidden shrink-0">
              <img src="/kaiwa-logo.png" alt="KaiwaDojo" className="size-full object-contain" />
            </div>
            <div>
              <span className="text-base sm:text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1">
                Kaiwa<span className="text-primary dark:text-red-400">Dojo</span>
                <span className="text-[0.6rem] sm:text-[0.65rem] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary dark:text-red-400 font-jp font-bold ml-0.5">会話</span>
              </span>
              <span className="text-[0.6rem] font-bold text-slate-400 block -mt-1 tracking-wider uppercase">
                会話道場 ・ Bahasa Jepang
              </span>
            </div>
          </div>

          {/* Navigation Links (Desktop Shortcuts) */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-xs font-extrabold text-slate-600 dark:text-slate-300">
            <a href="#keunggulan" className="hover:text-primary dark:hover:text-red-400 transition-colors no-underline flex items-center gap-1">
              <span>✨ Keunggulan</span>
            </a>
            <a href="#fitur" className="hover:text-primary dark:hover:text-red-400 transition-colors no-underline flex items-center gap-1">
              <span>⚡ Fitur Utama</span>
            </a>
            <a href="#kurikulum" className="hover:text-primary dark:hover:text-red-400 transition-colors no-underline flex items-center gap-1">
              <span>📚 Kurikulum Bab</span>
            </a>
          </nav>

          {/* Right Action Buttons & Mobile Hamburger */}
          <div className="flex items-center gap-2 sm:gap-3">
            {isLoggedIn ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="px-3.5 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white text-xs font-black rounded-xl sm:rounded-2xl border-none cursor-pointer transition-all shadow-md hover:scale-105 active:scale-95 flex items-center gap-1.5"
              >
                <span>🏠 Dashboard</span>
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
                  className="px-4 py-2 bg-gradient-to-r from-primary to-primary-light text-white text-xs font-black rounded-xl border-none cursor-pointer transition-all shadow-md hover:scale-105 active:scale-95"
                >
                  Daftar Sekarang
                </button>
              </div>
            )}

            {/* Mobile Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden size-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-base font-bold border-none cursor-pointer shrink-0"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Shortcut & Auth Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white/98 dark:bg-slate-900/98 backdrop-blur-md px-4 py-4 flex flex-col gap-3 text-xs font-bold animate-slide-down shadow-xl">
            <a
              href="#keunggulan"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-primary no-underline flex items-center gap-2"
            >
              <span>✨ Keunggulan Platform</span>
            </a>
            <a
              href="#fitur"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-primary no-underline flex items-center gap-2"
            >
              <span>⚡ Fitur Utama</span>
            </a>
            <a
              href="#kurikulum"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-primary no-underline flex items-center gap-2"
            >
              <span>📚 Kurikulum 50 Bab</span>
            </a>

            {!isLoggedIn && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    navigate('/login')
                  }}
                  className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold rounded-xl text-xs border-none cursor-pointer"
                >
                  🔑 Masuk ke Akun
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    navigate('/register')
                  }}
                  className="w-full py-2.5 bg-gradient-to-r from-primary to-primary-light text-white font-black rounded-xl text-xs border-none cursor-pointer shadow-md"
                >
                  🚀 Buat Akun Baru
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ── HERO SECTION ─────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden py-10 sm:py-20 lg:py-28 bg-cover bg-center bg-no-repeat transition-all"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(255,255,255,0.88), rgba(248,250,252,0.96)), url('/japan-background.jpg')",
        }}
      >
        {/* Dark Mode Scenery Overlay Element */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-0 dark:opacity-100 transition-opacity pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, rgba(11,17,32,0.85), rgba(15,23,42,0.97)), url('/japan-background.jpg')",
          }}
        />

        {/* Glow & Hinomaru Effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] sm:w-[550px] h-[320px] sm:h-[550px] hinomaru-glow rounded-full pointer-events-none animate-pulse" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center flex flex-col items-center">
          
          {/* Japanese Crimson Badge */}
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3.5 py-1 sm:py-1.5 rounded-full bg-primary/10 dark:bg-red-950/70 border border-primary/30 dark:border-red-900/60 text-primary dark:text-red-400 text-[0.7rem] sm:text-xs font-black uppercase tracking-wider mb-4 sm:mb-6 animate-fade-in shadow-xs backdrop-blur-md">
            <span>🌸</span>
            <span className="font-jp font-bold mr-0.5">日本語</span>
            <span>Platform Interaktif Belajar Bahasa Jepang</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-2xl sm:text-4xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white max-w-4xl leading-tight sm:leading-[1.15] mb-4 sm:mb-6">
            Praktik Bicara Bahasa Jepang <span className="bg-gradient-to-r from-primary via-red-500 to-amber-500 bg-clip-text text-transparent">Lebih Percaya Diri</span> Lewat Kelas Terarah
          </h1>

          {/* Subtitle */}
          <p className="text-xs sm:text-base lg:text-lg text-slate-600 dark:text-slate-200 max-w-2xl leading-relaxed mb-6 sm:mb-8 font-medium">
            Kurikulum bertahap 50 bab, latihan kosakata harian, dan sesi interaktif online maupun offline bersama Sensei untuk membiasakanmu berbicara sejak awal.
          </p>

          {/* Clean Explore Anchor */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mb-8 sm:mb-14">
            {isLoggedIn ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white font-extrabold text-xs sm:text-sm rounded-xl sm:rounded-2xl border-none cursor-pointer shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span>🚀 Lanjutkan Belajar ke Dashboard</span>
              </button>
            ) : (
              <a
                href="#keunggulan"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold text-xs sm:text-sm rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-primary/40 hover:text-primary transition-all no-underline backdrop-blur-md w-full sm:w-auto"
              >
                <span>📚 Jelajahi Keunggulan & Modul ↓</span>
              </a>
            )}
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 w-full max-w-4xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg">
            <div className="p-3 bg-slate-50/70 dark:bg-slate-800/50 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 text-center">
              <span className="text-xl sm:text-3xl font-black text-primary dark:text-red-400 block">50 Bab</span>
              <span className="text-[0.65rem] sm:text-xs font-bold text-slate-500 dark:text-slate-400">Modul Terstruktur</span>
            </div>

            <div className="p-3 bg-slate-50/70 dark:bg-slate-800/50 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 text-center">
              <span className="text-xl sm:text-3xl font-black text-sky-600 dark:text-sky-400 block">10 orang</span>
              <span className="text-[0.65rem] sm:text-xs font-bold text-slate-500 dark:text-slate-400">Kuota Maks per Sesi</span>
            </div>

            <div className="p-3 bg-slate-50/70 dark:bg-slate-800/50 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 text-center">
              <span className="text-xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 block">31 Hari</span>
              <span className="text-[0.65rem] sm:text-xs font-bold text-slate-500 dark:text-slate-400">Target Belajar Mandiri</span>
            </div>

            <div className="p-3 bg-slate-50/70 dark:bg-slate-800/50 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 text-center">
              <span className="text-xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 block">Terarah</span>
              <span className="text-[0.65rem] sm:text-xs font-bold text-slate-500 dark:text-slate-400">Bimbingan Sensei</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── KEUNGGULAN SECTION ───────────────────────────────────── */}
      <section id="keunggulan" className="py-12 sm:py-20 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-16">
            <span className="text-[0.7rem] sm:text-xs font-black uppercase tracking-wider text-primary dark:text-red-400 block mb-1">
              Mengapa Memilih KaiwaDojo?
            </span>
            <h2 className="text-xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Metode Belajar Terbukti untuk Hasil Maksimal
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">
              Dirancang khusus untuk memudahkan pemula dan persiapan kerja atau magang di Jepang.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-8">
            
            {/* Card 1 */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col gap-3 sm:gap-4 hover:border-primary/40 transition-all">
              <div className="size-12 sm:size-14 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-red-400 flex items-center justify-center text-2xl sm:text-3xl font-bold">
                🎯
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">Rencana Belajar 31-Hari</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Pilih tanggal di kalender interaktif dan susun target misi video, kotoba, serta kuis harianmu tanpa rasa bingung.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col gap-3 sm:gap-4 hover:border-sky-500/40 transition-all">
              <div className="size-12 sm:size-14 rounded-2xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center text-2xl sm:text-3xl font-bold">
                🧠
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">Setoran Kotoba & Flashcard</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Simpan kosakata baru lengkap dengan kanji, romaji, dan makna. Lakukan tes evaluasi mandiri kapan saja!
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col gap-3 sm:gap-4 hover:border-emerald-500/40 transition-all">
              <div className="size-12 sm:size-14 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl sm:text-3xl font-bold">
                👥
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">Sesi Live Online & Offline</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Ikuti kelas langsung via Google Meet atau hadir di Kaiwa Dojo Center dengan kuota eksklusif maksimal 10 siswa per sesi.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── FITUR UTAMA SECTION ───────────────────────────────────── */}
      <section id="fitur" className="py-12 sm:py-20 bg-slate-50 dark:bg-slate-950 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-16">
            <span className="text-[0.7rem] sm:text-xs font-black uppercase tracking-wider text-primary dark:text-red-400 block mb-1">
              Fitur Lengkap Platform
            </span>
            <h2 className="text-xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Semua yang Kamu Butuhkan dalam Satu Tempat
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            
            {/* Feature 1 */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col gap-2.5">
              <span className="text-2xl">📚</span>
              <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">Modul 50 Bab Video</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Penjelasan tata bahasa (Bunpou), tata kalimat, dan latihan menyimak video percakapan alami.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col gap-2.5">
              <span className="text-2xl">📝</span>
              <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">Kuis Evaluasi Bab</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Uji pemahaman setelah menonton video dengan kuis interaktif berbobot nilai otomatis.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col gap-2.5">
              <span className="text-2xl">🗓️</span>
              <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">Presensi & Reservasi</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Pilih jadwal sesi kelas online mingguan atau offline bulanan secara langsung tanpa antre.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col gap-2.5">
              <span className="text-2xl">👨‍🏫</span>
              <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">Bimbingan Pemateri</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Dapatkan bimbingan dan umpan balik langsung dari Sensei berpengalaman di bidangnya.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── KURIKULUM HIGHLIGHT SECTION ───────────────────────────── */}
      <section id="kurikulum" className="py-12 sm:py-20 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-16">
            <span className="text-[0.7rem] sm:text-xs font-black uppercase tracking-wider text-primary dark:text-red-400 block mb-1">
              Struktur Pembelajaran
            </span>
            <h2 className="text-xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Kurikulum Jilid 1 & Jilid 2
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8">
            
            {/* Jilid 1 */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col gap-3 sm:gap-4 interactive-card">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary dark:text-red-400 font-extrabold text-[0.7rem] sm:text-xs">
                  📘 JILID 1 (Bab 1 - 25)
                </span>
                <span className="text-[0.7rem] sm:text-xs font-bold text-slate-400">Tingkat Dasar</span>
              </div>
              <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white">Dasar Percakapan & Tata Bahasa</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Mempelajari pengenalan perkenalan diri (Jikoshoukai), huruf Hiragana/Katakana, kata kerja bentuk ~masu, tata kalimat dasar, angka, jam, serta percakapan sehari-hari.
              </p>
            </div>

            {/* Jilid 2 */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col gap-3 sm:gap-4 interactive-card">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-extrabold text-[0.7rem] sm:text-xs">
                  📕 JILID 2 (Bab 26 - 50)
                </span>
                <span className="text-[0.7rem] sm:text-xs font-bold text-slate-400">Tingkat Lanjut</span>
              </div>
              <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white">Percakapan Alami & Lanjutan</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Mempelajari kalimat majemuk, bentuk pengandaian (~ba, ~tara), Keigo (Bahasa Sopan & Kehormatan), situasi tempat kerja, serta persiapan komunikasi aktif.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── CALL TO ACTION BANNER ─────────────────────────────────── */}
      <section
        className="py-14 sm:py-24 text-white relative overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(15,23,42,0.92), rgba(127,29,29,0.85), rgba(15,23,42,0.92)), url('/japan-background(3).jpg')",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 flex flex-col items-center gap-4 sm:gap-6">
          <span className="px-3.5 py-1 rounded-full bg-white/15 text-amber-300 text-[0.7rem] sm:text-xs font-black uppercase tracking-wider border border-white/20 backdrop-blur-md">
            🌸 日本へ行こう ・ Siap Memulai Perjalanan Bahasa Jepangmu?
          </span>
          
          <h2 className="text-xl sm:text-3xl lg:text-5xl font-black tracking-tight text-white max-w-2xl leading-tight drop-shadow-md">
            Gabung Sekarang dan Rasakan Kemudahan Belajar Bersama KaiwaDojo!
          </h2>

          <p className="text-xs sm:text-base text-slate-200 max-w-xl font-medium drop-shadow-sm">
            Daftarkan dirimu sekarang dan mulai akses modul materi serta jadwal kelas live hari ini.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto pt-2">
            {isLoggedIn ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full sm:w-auto px-7 py-3.5 bg-primary hover:bg-primary-dark text-white font-black text-xs sm:text-sm rounded-xl sm:rounded-2xl border-none cursor-pointer shadow-xl hover:scale-105 active:scale-95 transition-all"
              >
                🏠 Masuk ke Dashboard Saya
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/register')}
                  className="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white font-black text-xs sm:text-sm rounded-xl sm:rounded-2xl border-none cursor-pointer shadow-xl hover:scale-105 active:scale-95 transition-all"
                >
                  🚀 Buat Akun Baru
                </button>

                <button
                  onClick={() => navigate('/login')}
                  className="w-full sm:w-auto px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs sm:text-sm rounded-xl sm:rounded-2xl border border-white/25 cursor-pointer backdrop-blur-md hover:scale-105 active:scale-95 transition-all"
                >
                  🔑 Login Akun
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────── */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200/80 dark:border-slate-800/80 py-8 sm:py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 text-xs text-slate-500 font-medium text-center sm:text-left">
          
          <div className="flex items-center gap-2.5">
            <div className="size-7 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center p-1 shrink-0">
              <img src="/kaiwa-logo.png" alt="KaiwaDojo" className="size-full object-contain" />
            </div>
            <span className="font-extrabold text-slate-800 dark:text-white">
              KaiwaDojo © 2026. All Rights Reserved.
            </span>
          </div>

          <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-center">
            <a href="#keunggulan" className="hover:text-primary transition-colors no-underline">Keunggulan</a>
            <a href="#fitur" className="hover:text-primary transition-colors no-underline">Fitur</a>
            <a href="#kurikulum" className="hover:text-primary transition-colors no-underline">Kurikulum</a>
            <button onClick={() => navigate('/login')} className="hover:text-primary transition-colors bg-transparent border-none cursor-pointer text-xs font-medium text-slate-500">Login</button>
          </div>
        </div>
      </footer>

    </div>
  )
}
