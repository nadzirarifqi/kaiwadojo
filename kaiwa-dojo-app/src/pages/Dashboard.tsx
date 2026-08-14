import { useNavigate } from 'react-router-dom'

/* ── Mock Data ─────────────────────────────────────── */
const STUDENT = { name: 'Nadira', initials: 'NR' }

const HERO_STATS = [
  { icon: '📚', label: 'Kursus Diikuti', value: 4 },
  { icon: '✅', label: 'Selesai',        value: 1 },
  { icon: '🔥', label: 'Hari Streak',   value: 7 },
  { icon: '⏱️', label: 'Jam Belajar',  value: '18j' },
]

const STREAK = {
  current:       7,
  longest:       15,
  todayDone:     true,
  nextMilestone: 10,
  history: [true, true, false, true, true, true, true],
}

const RECENT_WATCH = {
  courseId:      'C001',
  courseTitle:   'React Dasar untuk Pemula',
  videoTitle:    'Hooks: useState & useEffect',
  emoji:         '⚛️',
  color:         '#dbeafe',
  videoProgress: 45,
  duration:      '40 menit',
  module:        'Modul 5',
}

const MY_COURSES_PREVIEW = [
  { id: 'C001', title: 'React Dasar untuk Pemula',  emoji: '⚛️', color: '#dbeafe', progress: 65 },
  { id: 'C002', title: 'UI/UX Design Fundamentals', emoji: '🎨', color: '#fce7f3', progress: 100 },
  { id: 'C003', title: 'Python untuk Data Science', emoji: '🐍', color: '#d1fae5', progress: 30 },
]

/* ── Helpers ───────────────────────────────────────── */
function getLast7DayLabels() {
  const labels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
  const today  = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (6 - i))
    return labels[d.getDay()]
  })
}

/* ── StreakCard ────────────────────────────────────── */
function StreakCard() {
  const { current, longest, todayDone, history, nextMilestone } = STREAK
  const dayLabels = getLast7DayLabels()
  const pct       = Math.min(Math.round((current / nextMilestone) * 100), 100)
  const milestones = [
    { days: 7,   icon: '🌱', label: '7 Hari' },
    { days: 30,  icon: '🌿', label: '30 Hari' },
    { days: 100, icon: '🌳', label: '100 Hari' },
  ]

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col gap-5">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-base sm:text-lg font-extrabold text-slate-800">🔥 Streak Belajar</h2>
        <span className="text-xs sm:text-sm text-slate-400 font-semibold bg-slate-100 px-2.5 py-1 rounded-full">
          Terpanjang: {longest} hari
        </span>
      </div>

      {/* Flame + calendar */}
      <div className="flex items-center gap-5 sm:gap-7">
        <div className="flex flex-col items-center shrink-0">
          <span className="text-[3.5rem] sm:text-[4.5rem] leading-none animate-flame select-none">🔥</span>
          <div className="text-[2.8rem] sm:text-[3.5rem] font-black text-orange-500 leading-none -mt-1">
            {current}
          </div>
          <div className="text-xs sm:text-sm text-slate-500 font-semibold mt-1 text-center whitespace-nowrap">
            hari berturut-turut
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {/* 7-day dots */}
          <div className="flex gap-1 mb-3">
            {history.map((done, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-full aspect-square max-w-[34px] rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  done
                    ? 'bg-gradient-to-br from-orange-400 to-red-400 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-200'
                }`}>
                  {done ? '🔥' : ''}
                </div>
                <span className="text-[0.65rem] sm:text-[0.72rem] text-slate-400 font-bold">{dayLabels[i]}</span>
              </div>
            ))}
          </div>

          {/* Progress to milestone */}
          <div>
            <div className="flex justify-between text-xs sm:text-sm font-semibold mb-1.5">
              <span className="text-slate-500">Menuju {nextMilestone} hari 🎯</span>
              <span className="text-orange-500 font-bold">{current}/{nextMilestone}</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-400 to-red-400 rounded-full transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Milestone badges */}
          <div className="flex gap-1.5 sm:gap-2 mt-3">
            {milestones.map(m => (
              <div
                key={m.days}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border ${
                  current >= m.days
                    ? 'bg-orange-50 border-orange-200 text-orange-600'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                {m.icon} {m.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Today status */}
      <div className={`p-3.5 rounded-xl text-sm font-semibold border ${
        todayDone
          ? 'bg-orange-50 text-orange-700 border-orange-200'
          : 'bg-blue-50 text-blue-700 border-blue-200'
      }`}>
        {todayDone
          ? '🎉 Keren! Kamu sudah belajar hari ini. Streak tetap terjaga!'
          : '⚡ Belum ada video selesai hari ini. Yuk, jangan putus streakmu!'}
      </div>
    </div>
  )
}

/* ── RecentWatchCard ───────────────────────────────── */
function RecentWatchCard() {
  const navigate = useNavigate()
  const rw = RECENT_WATCH

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col gap-4">
      <h2 className="text-base sm:text-lg font-extrabold text-slate-800">▶ Lanjutkan Belajar</h2>

      {/* 16:9 video thumbnail */}
      <div
        className="w-full aspect-video rounded-xl flex items-center justify-center text-[3rem] sm:text-[4rem] relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${rw.color}, ${rw.color}99)` }}
      >
        {rw.emoji}
        {/* Progress overlay bar at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/10">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary-light rounded-full"
            style={{ width: `${rw.videoProgress}%` }}
          />
        </div>
      </div>

      {/* Info */}
      <div>
        <div className="text-xs sm:text-sm text-slate-400 font-semibold mb-1">
          {rw.courseTitle} · {rw.module}
        </div>
        <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-snug mb-2">
          {rw.videoTitle}
        </h3>
        <div className="text-xs sm:text-sm text-slate-400 font-semibold mb-3">
          ⏱️ {rw.duration} total
        </div>

        {/* Progress */}
        <div className="flex justify-between text-xs sm:text-sm font-bold mb-1.5">
          <span className="text-primary">{rw.videoProgress}% ditonton</span>
          {rw.videoProgress >= 80 && (
            <span className="text-orange-500">✅ Streak terhitung!</span>
          )}
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary-light rounded-full"
            style={{ width: `${rw.videoProgress}%` }}
          />
        </div>
      </div>

      {/* Streak hint */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-orange-600 font-semibold">
        🔥 Tonton hingga <strong>80%</strong> untuk menjaga streak harianmu!
      </div>

      {/* CTA */}
      <button
        onClick={() => navigate('/my-courses')}
        className="w-full py-3.5 bg-gradient-to-br from-primary to-primary-light text-white text-sm sm:text-base font-bold rounded-xl border-none cursor-pointer transition-all shadow-md hover:-translate-y-0.5 hover:shadow-lg"
      >
        ▶ Lanjutkan — {rw.videoTitle.length > 26 ? rw.videoTitle.slice(0, 26) + '…' : rw.videoTitle}
      </button>
    </div>
  )
}

/* ── MiniCourseCard ────────────────────────────────── */
function MiniCourseCard({ course, onClick }: { course: typeof MY_COURSES_PREVIEW[0]; onClick: () => void }) {
  const { emoji, color, title, progress } = course
  const statusText = progress === 100 ? '✅ Selesai' : progress > 0 ? `📖 ${progress}%` : '🆕 Mulai'
  const statusCls  = progress === 100 ? 'text-emerald-600' : progress > 0 ? 'text-primary' : 'text-slate-400'

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 cursor-pointer transition-all hover:bg-blue-50 hover:shadow-sm"
    >
      <div
        className="size-11 sm:size-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl shrink-0"
        style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }}
      >
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm sm:text-base font-bold text-slate-700 truncate mb-1.5">{title}</div>
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary-light rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <span className={`text-xs sm:text-sm font-extrabold shrink-0 ml-2 ${statusCls}`}>{statusText}</span>
    </div>
  )
}

/* ── Main Page ──────────────────────────────────────── */
export default function StudentDashboard() {
  const navigate = useNavigate()

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-hidden">

      {/* ══ HERO ══ */}
      <header className="relative overflow-hidden bg-gradient-to-br from-primary to-primary-light rounded-2xl lg:rounded-[28px] px-6 py-8 sm:px-8 sm:py-10 lg:px-11 lg:py-12 mb-5 lg:mb-7 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shadow-lg animate-fade-in-up">
        <div className="absolute -top-14 -right-14 size-64 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute -bottom-16 right-20 size-48 bg-white/[0.04] rounded-full pointer-events-none" />

        <div className="relative z-10">
          <p className="text-white/75 text-sm sm:text-base font-semibold mb-2">Selamat datang kembali 👋</p>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mb-3 tracking-tight leading-snug">
            {STUDENT.name}, yuk terus belajar!
          </h1>
          <p className="text-white/70 text-sm sm:text-base leading-relaxed max-w-lg">
            Setiap video yang kamu selesaikan adalah investasi terbaik untuk masa depanmu. ✨
          </p>
        </div>

        {/* Stat cards */}
        <div className="flex gap-3 shrink-0 relative z-10 flex-wrap">
          {HERO_STATS.map(s => (
            <div key={s.label} className="bg-white/[0.12] backdrop-blur-md border border-white/20 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-3 sm:py-4 min-w-[80px] sm:min-w-[100px] text-center flex-1 sm:flex-none">
              <div className="text-lg sm:text-xl mb-1">{s.icon}</div>
              <div className="text-xl sm:text-2xl lg:text-3xl font-black text-white leading-none mb-1">{s.value}</div>
              <div className="text-[0.65rem] sm:text-xs text-white/70 font-bold uppercase tracking-wide leading-tight">{s.label}</div>
            </div>
          ))}
        </div>
      </header>

      {/* ══ STREAK + SHORTCUTS (kiri) | RECENT WATCH (kanan) ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4 sm:gap-5 mb-5 lg:mb-7 [animation:fadeInUp_0.5s_0.1s_ease_both]">

        {/* Kolom kiri: Streak + 2 shortcut buttons */}
        <div className="flex flex-col gap-4">
          <StreakCard />

          {/* Shortcut buttons — di bawah streak dalam kolom yang sama */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/my-courses')}
              className="bg-primary text-white rounded-2xl p-4 sm:p-5 flex items-center gap-3 shadow-md cursor-pointer border-none transition-all hover:-translate-y-1 hover:shadow-xl text-left"
            >
              <span className="text-2xl shrink-0">📚</span>
              <div className="min-w-0">
                <div className="text-sm sm:text-base font-extrabold leading-tight">Kursus Saya</div>
                <div className="text-white/70 text-xs mt-0.5">4 kursus aktif</div>
              </div>
              <span className="ml-auto text-white/60 text-base shrink-0">→</span>
            </button>

            <button
              onClick={() => navigate('/catalog')}
              className="bg-white text-primary rounded-2xl p-4 sm:p-5 flex items-center gap-3 shadow-sm border border-slate-200 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md hover:border-primary text-left"
            >
              <span className="text-2xl shrink-0">🔍</span>
              <div className="min-w-0">
                <div className="text-sm sm:text-base font-extrabold text-slate-800 leading-tight">Jelajahi</div>
                <div className="text-slate-400 text-xs mt-0.5">Kursus baru</div>
              </div>
              <span className="ml-auto text-slate-300 text-base shrink-0">→</span>
            </button>
          </div>
        </div>

        {/* Kolom kanan: Recent Watch */}
        <RecentWatchCard />
      </div>

      {/* ══ COURSE PROGRESS PREVIEW ══ */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm [animation:fadeInUp_0.5s_0.3s_ease_both]">
        <div className="flex justify-between items-center mb-4 sm:mb-5">
          <h2 className="text-base sm:text-lg font-extrabold text-slate-800">📖 Progress Kursus</h2>
          <button
            onClick={() => navigate('/my-courses')}
            className="text-primary text-sm sm:text-base font-bold bg-transparent border-none cursor-pointer hover:underline"
          >
            Lihat Semua →
          </button>
        </div>
        <div className="flex flex-col gap-2.5">
          {MY_COURSES_PREVIEW.map(c => (
            <MiniCourseCard key={c.id} course={c} onClick={() => navigate('/my-courses')} />
          ))}
        </div>
      </div>

    </main>
  )
}
