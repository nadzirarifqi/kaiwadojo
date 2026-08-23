import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function LandingPage() {
  const navigate = useNavigate()
  const { session, profile } = useAuth()

  const isLoggedIn = Boolean(session || profile)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors selection:bg-primary/20 selection:text-primary">
      
      {/* ── HEADER NAVBAR ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="size-11 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1.5 overflow-hidden">
              <img src="/kaiwa-logo.png" alt="KaiwaDojo" className="size-full object-contain" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1">
                Kaiwa<span className="text-primary dark:text-red-400">Dojo</span>
              </span>
              <span className="text-[0.65rem] font-bold text-slate-400 block -mt-1 tracking-wider uppercase">
                会話道場 ・ Bahasa Jepang
              </span>
            </div>
          </div>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-extrabold text-slate-600 dark:text-slate-300">
            <a href="#keunggulan" className="hover:text-primary dark:hover:text-red-400 transition-colors no-underline">
              Keunggulan
            </a>
            <a href="#fitur" className="hover:text-primary dark:hover:text-red-400 transition-colors no-underline">
              Fitur Utama
            </a>
            <a href="#kurikulum" className="hover:text-primary dark:hover:text-red-400 transition-colors no-underline">
              Kurikulum Bab
            </a>
            <a href="#testimoni" className="hover:text-primary dark:hover:text-red-400 transition-colors no-underline">
              Testimoni
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white text-xs font-black rounded-2xl border-none cursor-pointer transition-all shadow-md hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                <span>🏠 Buka Dashboard</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="px-4 py-2.5 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-2xl border border-slate-300 dark:border-slate-700 cursor-pointer transition-all"
                >
                  Masuk
                </button>

                <button
                  onClick={() => navigate('/register')}
                  className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white text-xs font-black rounded-2xl border-none cursor-pointer transition-all shadow-md hover:scale-105 active:scale-95"
                >
                  Daftar Sekarang
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-16 sm:py-24 lg:py-28 bg-gradient-to-b from-white via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-primary/10 dark:bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-10 right-10 w-[300px] h-[300px] bg-sky-500/10 dark:bg-sky-500/20 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center flex flex-col items-center">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 dark:bg-red-950/60 border border-primary/20 dark:border-red-900/50 text-primary dark:text-red-400 text-xs font-black uppercase tracking-wider mb-6 animate-fade-in shadow-xs">
            <span>🇯🇵</span>
            <span>Platform Belajar Bahasa Jepang #1 Interaktif</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white max-w-4xl leading-[1.15] mb-6">
            Kuasai Percakapan Bahasa Jepang & <span className="bg-gradient-to-r from-primary via-red-500 to-amber-500 bg-clip-text text-transparent">JLPT Secara Nyata</span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed mb-8 font-medium">
            Belajar Bahasa Jepang dari nol hingga mahir dengan 50 Bab terstruktur, latihan Kotoba interaktif, rencana belajar 31-hari, serta sesi kelas live online & offline bersama Sensei berpengalaman.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto mb-14">
            {isLoggedIn ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white font-extrabold text-sm sm:text-base rounded-2xl border-none cursor-pointer shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                <span>🚀 Lanjutkan Belajar ke Dashboard</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/register')}
                  className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white font-extrabold text-sm sm:text-base rounded-2xl border-none cursor-pointer shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <span>🚀 Mulai Belajar Gratis</span>
                </button>

                <button
                  onClick={() => navigate('/login')}
                  className="w-full sm:w-auto px-7 py-4 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-white font-extrabold text-sm sm:text-base rounded-2xl border border-slate-200 dark:border-slate-800 cursor-pointer shadow-sm hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <span>🔑 Masuk ke Akun</span>
                </button>
              </>
            )}
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg">
            <div className="p-3 text-center border-r border-slate-100 dark:border-slate-800 last:border-r-0">
              <span className="text-2xl sm:text-3xl font-black text-primary dark:text-red-400 block">50 Bab</span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Modul Terstruktur</span>
            </div>

            <div className="p-3 text-center border-r border-slate-100 dark:border-slate-800 last:border-r-0">
              <span className="text-2xl sm:text-3xl font-black text-sky-600 dark:text-sky-400 block">10 orang</span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Kuota Maks per Sesi Live</span>
            </div>

            <div className="p-3 text-center border-r border-slate-100 dark:border-slate-800 last:border-r-0">
              <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 block">31 Hari</span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Tantangan Belajar Mandiri</span>
            </div>

            <div className="p-3 text-center">
              <span className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 block">N5 - N3</span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Standar JLPT Resmi</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── KEUNGGULAN SECTION ───────────────────────────────────── */}
      <section id="keunggulan" className="py-16 sm:py-24 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-black uppercase tracking-wider text-primary dark:text-red-400 block mb-1">
              Mengapa Memilih KaiwaDojo?
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Metode Belajar Terbukti untuk Hasil Maksimal
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">
              Dirancang khusus untuk memudahkan pemula dan persiapan kerja atau magang di Jepang.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Card 1 */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-3xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col gap-4 hover:border-primary/40 transition-all">
              <div className="size-14 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-red-400 flex items-center justify-center text-3xl font-bold">
                🎯
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Rencana Belajar 31-Hari</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Pilih tanggal di kalender interaktif dan susun target misi video, kotoba, serta kuis harianmu tanpa rasa bingung.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-3xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col gap-4 hover:border-sky-500/40 transition-all">
              <div className="size-14 rounded-2xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center text-3xl font-bold">
                🧠
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Setoran Kotoba & Flashcard</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Simpan kosakata baru lengkap dengan kanji, romaji, dan makna. Lakukan tes evaluasi mandiri kapan saja!
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-3xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col gap-4 hover:border-emerald-500/40 transition-all">
              <div className="size-14 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-3xl font-bold">
                👥
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Sesi Live Online & Offline</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Ikuti kelas langsung via Google Meet atau hadir di Kaiwa Dojo Center dengan kuota eksklusif maksimal 10 siswa per sesi.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── FITUR UTAMA SECTION ───────────────────────────────────── */}
      <section id="fitur" className="py-16 sm:py-24 bg-slate-50 dark:bg-slate-950 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-black uppercase tracking-wider text-primary dark:text-red-400 block mb-1">
              Fitur Lengkap Platform
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Semua yang Kamu Butuhkan dalam Satu Tempat
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Feature 1 */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col gap-3">
              <span className="text-2xl">📚</span>
              <h4 className="text-base font-extrabold text-slate-900 dark:text-white">Modul 50 Bab Video</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Penjelasan tata bahasa (Bunpou), tata kalimat, dan latihan menyimak video percakapan alami.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col gap-3">
              <span className="text-2xl">📝</span>
              <h4 className="text-base font-extrabold text-slate-900 dark:text-white">Kuis Evaluasi Bab</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Uji pemahaman setelah menonton video dengan kuis interaktif berbobot nilai otomatis.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col gap-3">
              <span className="text-2xl">🗓️</span>
              <h4 className="text-base font-extrabold text-slate-900 dark:text-white">Presensi & Reservasi Real-Time</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Pilih jadwal sesi kelas online mingguan atau offline bulanan secara langsung tanpa antre.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col gap-3">
              <span className="text-2xl">👨‍🏫</span>
              <h4 className="text-base font-extrabold text-slate-900 dark:text-white">Bimbingan Pemateri</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Dapatkan bimbingan dan umpan balik langsung dari Sensei berpengalaman di bidangnya.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── KURIKULUM HIGHLIGHT SECTION ───────────────────────────── */}
      <section id="kurikulum" className="py-16 sm:py-24 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-black uppercase tracking-wider text-primary dark:text-red-400 block mb-1">
              Struktur Pembelajaran
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Kurikulum Jilid 1 & Jilid 2
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Jilid 1 */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-8 rounded-3xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="px-3.5 py-1 rounded-full bg-primary/10 text-primary dark:text-red-400 font-extrabold text-xs">
                  📘 JILID 1 (Bab 1 - 25)
                </span>
                <span className="text-xs font-bold text-slate-400">Level N5 (Tingkat Dasar)</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Dasar Percakapan & Tata Bahasa N5</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Mempelajari pengenalan perkenalan diri (Jikoshoukai), huruf Hiragana/Katakana, kata kerja bentuk ~masu, tata kalimat dasar, angka, jam, serta percakapan sehari-hari.
              </p>
            </div>

            {/* Jilid 2 */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-8 rounded-3xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="px-3.5 py-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-extrabold text-xs">
                  📕 JILID 2 (Bab 26 - 50)
                </span>
                <span className="text-xs font-bold text-slate-400">Level N4 - N3 (Tingkat Lanjut)</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Percakapan Alami & Preparasi JLPT N4-N3</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Mempelajari kalimat majemuk, bentuk pengandaian (~ba, ~tara), Keigo (Bahasa Sopan & Kehormatan), situasi tempat kerja, serta persiapan ujian kelulusan JLPT.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── CALL TO ACTION BANNER ─────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 flex flex-col items-center gap-6">
          <span className="px-4 py-1.5 rounded-full bg-white/10 text-amber-300 text-xs font-black uppercase tracking-wider border border-white/20">
            🇯🇵 Siap Memulai Perjalanan Bahasa Jepangmu?
          </span>
          
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white max-w-2xl leading-tight">
            Gabung Sekarang dan Rasakan Kemudahan Belajar Bersama KaiwaDojo!
          </h2>

          <p className="text-xs sm:text-base text-slate-300 max-w-xl font-medium">
            Daftarkan dirimu secara gratis dan mulai akses modul materi serta jadwal kelas live hari ini.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto pt-2">
            {isLoggedIn ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-primary-dark text-white font-black text-sm rounded-2xl border-none cursor-pointer shadow-xl hover:scale-105 active:scale-95 transition-all"
              >
                🏠 Masuk ke Dashboard Saya
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/register')}
                  className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-primary-dark text-white font-black text-sm rounded-2xl border-none cursor-pointer shadow-xl hover:scale-105 active:scale-95 transition-all"
                >
                  🚀 Buat Akun Baru Gratis
                </button>

                <button
                  onClick={() => navigate('/login')}
                  className="w-full sm:w-auto px-7 py-4 bg-white/10 hover:bg-white/20 text-white font-extrabold text-sm rounded-2xl border border-white/20 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                >
                  🔑 Login Akun
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────── */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200/80 dark:border-slate-800/80 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-slate-500 font-medium">
          
          <div className="flex items-center gap-3">
            <div className="size-8 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center p-1">
              <img src="/kaiwa-logo.png" alt="KaiwaDojo" className="size-full object-contain" />
            </div>
            <span className="font-extrabold text-slate-800 dark:text-white">
              KaiwaDojo © 2026. All Rights Reserved.
            </span>
          </div>

          <div className="flex items-center gap-6">
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
