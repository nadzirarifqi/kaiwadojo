import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

/* ── Types ──────────────────────────────────────── */
interface ContentItem {
  id: string; title: string; type: 'Video'|'Artikel'|'Quiz'|'Live'; duration: string; watched: boolean
}
interface Course {
  id: string; title: string; description: string; category: string; emoji: string; color: string
  totalVideos: number; watchedVideos: number; duration: string
  updatedAt: string; contents: ContentItem[]
}

/* ── Mock Data ──────────────────────────────────── */
const ENROLLED_COURSES: Course[] = [
  {
    id: 'C001', title: 'React Dasar untuk Pemula',
    description: 'Pelajari fundamental React dari nol hingga bisa membuat aplikasi web interaktif. Cocok untuk pemula yang baru memulai perjalanan front-end development.',
    category: 'Teknologi', emoji: '⚛️', color: '#dbeafe',
    totalVideos: 12, watchedVideos: 8, duration: '8 Jam', updatedAt: '2026-08-12',
    contents: [
      { id: 'M001', title: 'Pengenalan React & JSX',      type: 'Video', duration: '25 min', watched: true },
      { id: 'M002', title: 'Komponen & Props',            type: 'Video', duration: '30 min', watched: true },
      { id: 'M003', title: 'State & Event Handling',      type: 'Video', duration: '35 min', watched: true },
      { id: 'M004', title: 'Quiz: Dasar React',           type: 'Quiz',  duration: '15 min', watched: true },
      { id: 'M005', title: 'Hooks: useState & useEffect', type: 'Video', duration: '40 min', watched: false },
    ],
  },
  {
    id: 'C002', title: 'UI/UX Design Fundamentals',
    description: 'Kuasai prinsip desain antarmuka dan pengalaman pengguna. Mulai dari riset pengguna, wireframing, hingga prototyping dengan tools modern.',
    category: 'Desain', emoji: '🎨', color: '#fce7f3',
    totalVideos: 9, watchedVideos: 9, duration: '6 Jam', updatedAt: '2026-08-10',
    contents: [
      { id: 'M001', title: 'Apa itu UX Design?',       type: 'Video',   duration: '20 min', watched: true },
      { id: 'M002', title: 'Prinsip Visual Design',    type: 'Artikel', duration: '15 min', watched: true },
      { id: 'M003', title: 'User Research Basics',     type: 'Video',   duration: '30 min', watched: true },
      { id: 'M004', title: 'Wireframing dengan Figma', type: 'Video',   duration: '45 min', watched: true },
    ],
  },
  {
    id: 'C003', title: 'Python untuk Data Science',
    description: 'Dari sintaks Python dasar hingga analisis data menggunakan Pandas, NumPy, dan visualisasi dengan Matplotlib.',
    category: 'Teknologi', emoji: '🐍', color: '#d1fae5',
    totalVideos: 15, watchedVideos: 4, duration: '12 Jam', updatedAt: '2026-08-08',
    contents: [
      { id: 'M001', title: 'Python Basics',     type: 'Video', duration: '30 min', watched: true },
      { id: 'M002', title: 'Numpy Essentials',  type: 'Video', duration: '40 min', watched: true },
      { id: 'M003', title: 'Pandas DataFrames', type: 'Video', duration: '50 min', watched: false },
      { id: 'M004', title: 'Matplotlib Viz',    type: 'Video', duration: '35 min', watched: false },
    ],
  },
  {
    id: 'C004', title: 'Desain Grafis dengan Figma',
    description: 'Pelajari Figma dari awal: tools dasar, auto-layout, komponen, dan cara membuat desain yang siap dev-handoff.',
    category: 'Desain', emoji: '✏️', color: '#ede9fe',
    totalVideos: 11, watchedVideos: 0, duration: '7 Jam', updatedAt: '2026-08-06',
    contents: [
      { id: 'M001', title: 'Tour Figma Interface',  type: 'Video', duration: '20 min', watched: false },
      { id: 'M002', title: 'Shapes & Vector Tools', type: 'Video', duration: '30 min', watched: false },
    ],
  },
  {
    id: 'C005', title: 'Komunikasi Efektif di Dunia Kerja',
    description: 'Tingkatkan kemampuan komunikasi profesional: presentasi, negosiasi, dan public speaking untuk karir yang lebih cemerlang.',
    category: 'Soft Skill', emoji: '🗣️', color: '#fee2e2',
    totalVideos: 8, watchedVideos: 8, duration: '4 Jam', updatedAt: '2026-07-30',
    contents: [
      { id: 'M001', title: 'Dasar Komunikasi Profesional', type: 'Video', duration: '25 min', watched: true },
      { id: 'M002', title: 'Public Speaking Tips',         type: 'Video', duration: '30 min', watched: true },
    ],
  },
]

/* ── Promo Slides ───────────────────────────────── */
const PROMO_SLIDES = [
  {
    id: 1,
    badge:    '✨ KURSUS BARU TERSEDIA',
    headline: 'Machine Learning dengan Python',
    sub:      'Kuasai AI & Data Science dari dasar hingga mahir. Bergabung dengan 3.000+ pelajar aktif sekarang!',
    cta:      'Lihat Kursus →',
    from:     '#1c4d8d',
    to:       '#3b82f6',
    emoji:    '🤖',
  },
  {
    id: 2,
    badge:    '💡 QUOTE BELAJAR HARI INI',
    headline: '"Investasi terbaik adalah investasi pada dirimu sendiri."',
    sub:      'Setiap video yang kamu selesaikan adalah langkah nyata menuju versi terbaik dirimu. Terus semangat!',
    cta:      'Mulai Belajar →',
    from:     '#7c3aed',
    to:       '#a855f7',
    emoji:    '📖',
  },
  {
    id: 3,
    badge:    '🏆 TANTANGAN MINGGU INI',
    headline: 'Selesaikan 5 Video, Raih Badge Eksklusif!',
    sub:      'Tonton minimal 80% dari setiap video dalam 7 hari dan dapatkan badge spesial "Pelajar Aktif" di profilmu.',
    cta:      'Ikut Tantangan →',
    from:     '#059669',
    to:       '#10b981',
    emoji:    '🎯',
  },
]

/* ── Helpers ────────────────────────────────────── */
const TYPE_ICONS: Record<string, string> = { Video: '🎬', Artikel: '📄', Quiz: '📝', Live: '🔴' }
const STATUS_FILTERS = ['Semua', 'Sedang Belajar', 'Selesai', 'Belum Dimulai'] as const
type StatusFilter = typeof STATUS_FILTERS[number]

function getCourseProgress(c: Course) {
  return c.totalVideos === 0 ? 0 : Math.round((c.watchedVideos / c.totalVideos) * 100)
}
function getCourseStatus(c: Course) {
  const p = getCourseProgress(c)
  if (p === 100) return 'Selesai'
  if (p > 0)    return 'Sedang Belajar'
  return 'Belum Dimulai'
}

/* ── PromoCarousel ──────────────────────────────── */
function PromoCarousel() {
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)
  const [fading, setFading]   = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const goTo = (idx: number) => {
    if (idx === current) return
    setFading(true)
    setTimeout(() => { setCurrent(idx); setFading(false) }, 220)
  }

  useEffect(() => {
    timerRef.current = setTimeout(() => goTo((current + 1) % PROMO_SLIDES.length), 4500)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [current])

  const s = PROMO_SLIDES[current]

  return (
    <div
      className="relative rounded-2xl overflow-hidden mb-5 sm:mb-6 shadow-md"
      style={{ background: `linear-gradient(135deg, ${s.from}, ${s.to})` }}
    >
      <div className="absolute -top-10 -right-10 size-52 bg-white/5 rounded-full pointer-events-none" />
      <div className="absolute -bottom-12 right-32 size-36 bg-white/[0.04] rounded-full pointer-events-none" />

      <div
        className={`relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 px-6 sm:px-9 py-7 sm:py-9 transition-opacity duration-200 ${fading ? 'opacity-0' : 'opacity-100'}`}
      >
        <div className="flex-1 min-w-0">
          <span className="inline-block text-xs font-extrabold bg-white/20 text-white px-3 py-1 rounded-full uppercase tracking-widest mb-3">
            {s.badge}
          </span>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white mb-2.5 leading-snug">
            {s.headline}
          </h2>
          <p className="text-white/75 text-sm sm:text-base leading-relaxed max-w-lg">
            {s.sub}
          </p>
        </div>

        <div className="flex flex-row sm:flex-col items-center sm:items-end gap-4 shrink-0">
          <span className="text-[4rem] sm:text-[5.5rem] leading-none">{s.emoji}</span>
          <button
            onClick={() => navigate('/catalog')}
            className="text-sm sm:text-base font-bold px-5 py-3 rounded-xl border-none cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg whitespace-nowrap bg-white"
            style={{ color: s.from }}
          >
            {s.cta}
          </button>
        </div>
      </div>

      {/* Dot indicators */}
      <div className="relative z-10 flex justify-center gap-2 pb-4">
        {PROMO_SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`border-none cursor-pointer rounded-full transition-all duration-300 ${
              i === current ? 'bg-white w-6 h-2' : 'bg-white/40 w-2 h-2'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

/* ── CourseCard (student) ───────────────────────── */
function CourseCard({ course, onClick }: { course: Course; onClick: () => void }) {
  const progress = getCourseProgress(course)
  const status   = getCourseStatus(course)

  const statusConfig = {
    'Selesai':        { cls: 'bg-emerald-100 text-emerald-700', badge: '✅ Selesai' },
    'Sedang Belajar': { cls: 'bg-blue-100 text-primary',        badge: '📖 Belajar' },
    'Belum Dimulai':  { cls: 'bg-slate-100 text-slate-500',     badge: '🆕 Baru' },
  }
  const { cls, badge } = statusConfig[status]

  const ctaLabel =
    status === 'Selesai'       ? '🔁 Ulangi Kursus'  :
    status === 'Sedang Belajar' ? '▶ Lanjutkan'       : '🚀 Mulai Belajar'

  const ctaCls =
    status === 'Selesai'       ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'                                          :
    status === 'Sedang Belajar' ? 'bg-gradient-to-br from-primary to-primary-light text-white shadow-sm hover:shadow-md hover:-translate-y-0.5' :
                                  'bg-slate-100 text-slate-600 hover:bg-slate-200'

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm cursor-pointer flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_-4px_rgba(28,77,141,0.14)] hover:border-transparent"
    >
      {/* ── 16:9 Thumbnail ── */}
      <div
        className="w-full aspect-video flex items-center justify-center text-[3.5rem] sm:text-[4.5rem] relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${course.color}, ${course.color}bb)` }}
      >
        {course.emoji}
        <span className={`absolute top-3 right-3 text-xs font-extrabold px-3 py-1.5 rounded-full uppercase tracking-wide z-10 ${cls}`}>
          {badge}
        </span>
        {/* Progress overlay bar at bottom */}
        {progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/10">
            <div
              className={`h-full ${progress === 100 ? 'bg-emerald-400' : 'bg-gradient-to-r from-primary to-primary-light'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col">
        <span className="inline-block text-xs font-bold text-primary bg-primary/[0.07] px-2.5 py-1 rounded-full uppercase tracking-wide mb-2.5 self-start">
          {course.category}
        </span>
        <h3 className="text-base font-bold text-slate-800 leading-snug mb-2 line-clamp-2">
          {course.title}
        </h3>
        <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 flex-1 mb-3">
          {course.description}
        </p>

        {/* Progress bar */}
        {progress > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-xs font-semibold mb-1.5">
              <span className="text-slate-400">{course.watchedVideos}/{course.totalVideos} video selesai</span>
              <span className={`font-bold ${progress === 100 ? 'text-emerald-600' : 'text-primary'}`}>{progress}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  progress === 100
                    ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                    : 'bg-gradient-to-r from-primary to-primary-light'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-400 font-semibold pt-3 border-t border-slate-100 mb-3.5">
          <span>📦 {course.totalVideos} materi</span>
          <span>⏱️ {course.duration}</span>
        </div>

        <button
          className={`w-full py-3 rounded-xl text-sm font-bold border-none cursor-pointer transition-all ${ctaCls}`}
          onClick={e => { e.stopPropagation(); onClick() }}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  )
}

/* ── CourseModal (student) ──────────────────────── */
function CourseModal({ course, onClose }: { course: Course; onClose: () => void }) {
  const [tab, setTab] = useState<'materi'|'info'>('materi')
  const progress = getCourseProgress(course)

  const tabBase    = 'px-4 sm:px-5 py-3 text-sm sm:text-base font-bold border-none bg-transparent cursor-pointer border-b-2 -mb-px transition-all duration-200 whitespace-nowrap'
  const tabActive  = 'text-primary border-primary'
  const tabInactive= 'text-slate-400 border-transparent hover:text-slate-600'

  return (
    <div
      className="fixed inset-0 bg-slate-900/55 backdrop-blur-[4px] z-[500] flex items-end sm:items-center justify-center sm:p-5 animate-fade-in"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      role="dialog" aria-modal="true"
    >
      <div className="bg-white w-full sm:max-w-[640px] max-h-[92vh] sm:max-h-[88vh] overflow-y-auto sm:rounded-[28px] rounded-t-[24px] shadow-2xl animate-fade-in-up">

        {/* ── 16:9 Thumbnail ── */}
        <div
          className="w-full aspect-video flex items-center justify-center text-[4.5rem] sm:text-[6rem] sm:rounded-t-[28px] rounded-t-[24px] relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${course.color}, ${course.color}cc)` }}
        >
          {course.emoji}
          {progress === 100 && (
            <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/20 rounded-t-[24px] sm:rounded-t-[28px]">
              <span className="text-base font-extrabold text-emerald-700 bg-emerald-100 px-5 py-2.5 rounded-full shadow">✅ Kursus Selesai!</span>
            </div>
          )}
          {/* Progress bar at bottom */}
          {progress > 0 && progress < 100 && (
            <div className="absolute bottom-0 left-0 right-0 h-2 bg-black/20">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary-light"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-7">
          {/* Header */}
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1 min-w-0">
              <span className="inline-block text-xs font-bold text-primary bg-primary/[0.07] px-3 py-1 rounded-full uppercase tracking-wide mb-2">
                {course.category}
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 leading-snug">{course.title}</h2>
            </div>
            <button onClick={onClose} className="size-9 sm:size-10 rounded-full border-none bg-slate-100 text-slate-500 text-xl cursor-pointer flex items-center justify-center hover:bg-slate-200 ml-4 shrink-0 leading-none">
              ×
            </button>
          </div>

          <p className="text-sm sm:text-base text-slate-500 leading-relaxed mb-5">{course.description}</p>

          {/* Progress overview */}
          {progress > 0 && (
            <div className="mb-5 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex justify-between text-sm font-bold mb-2.5">
                <span className="text-slate-600">{course.watchedVideos}/{course.totalVideos} video selesai</span>
                <span className={progress === 100 ? 'text-emerald-600' : 'text-primary'}>{progress}%</span>
              </div>
              <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${progress === 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-primary to-primary-light'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              {progress < 100 && (
                <div className="mt-2.5 text-xs sm:text-sm text-orange-600 font-semibold">
                  🔥 Tonton 80%+ setiap video untuk menjaga streak harianmu!
                </div>
              )}
            </div>
          )}

          {/* Meta pills */}
          <div className="flex gap-2 flex-wrap mb-5">
            {[`📦 ${course.totalVideos} Materi`, `⏱️ ${course.duration}`, `🗓️ ${new Date(course.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`].map(pill => (
              <span key={pill} className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                {pill}
              </span>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex border-b-2 border-slate-100 mb-4 gap-1 overflow-x-auto">
            <button className={`${tabBase} ${tab === 'materi' ? tabActive : tabInactive}`} onClick={() => setTab('materi')}>📦 Daftar Materi</button>
            <button className={`${tabBase} ${tab === 'info' ? tabActive : tabInactive}`} onClick={() => setTab('info')}>ℹ️ Info Kursus</button>
          </div>

          {tab === 'materi' ? (
            <div className="flex flex-col gap-2.5">
              {course.contents.map(item => (
                <div key={item.id} className={`flex items-center gap-3.5 p-3.5 rounded-xl transition-all cursor-pointer ${item.watched ? 'bg-emerald-50 hover:bg-emerald-100' : 'bg-slate-50 hover:bg-blue-50'}`}>
                  <div className="size-10 bg-white rounded-lg flex items-center justify-center text-lg shrink-0 shadow-sm">
                    {TYPE_ICONS[item.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm sm:text-base font-bold text-slate-700 truncate">{item.title}</div>
                    <div className="text-xs sm:text-sm text-slate-400 font-medium">{item.type} · {item.duration}</div>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase shrink-0 ${item.watched ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {item.watched ? '✅ Selesai' : 'Belum'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col">
              {[
                { label: 'Kategori',         value: course.category },
                { label: 'Total Durasi',     value: course.duration },
                { label: 'Total Materi',     value: `${course.totalVideos} modul` },
                { label: 'Video Selesai',    value: `${course.watchedVideos} dari ${course.totalVideos}` },
                { label: 'Progress',         value: `${progress}%` },
                { label: 'Terakhir Diakses', value: new Date(course.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-3 sm:py-3.5 border-b border-slate-100 last:border-0">
                  <span className="text-sm sm:text-base text-slate-500 font-semibold">{label}</span>
                  <span className="text-sm sm:text-base font-bold text-slate-800">{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* CTA */}
          <div className="mt-5 pt-5 border-t border-slate-100">
            {progress === 100 ? (
              <button onClick={onClose} className="w-full py-3.5 rounded-xl text-base font-bold border-none cursor-pointer bg-emerald-500 text-white hover:bg-emerald-600 transition-all">
                🏆 Lihat Sertifikat
              </button>
            ) : (
              <button onClick={onClose} className="w-full py-3.5 rounded-xl text-base font-bold border-none cursor-pointer transition-all bg-gradient-to-br from-primary to-primary-light text-white shadow-md hover:-translate-y-0.5 hover:shadow-lg">
                {progress > 0 ? '▶ Lanjutkan Belajar' : '🚀 Mulai Belajar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Main Page ──────────────────────────────────── */
export default function MyCourses() {
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState<StatusFilter>('Semua')
  const [selected, setSelected] = useState<Course | null>(null)

  const filtered = useMemo(() =>
    ENROLLED_COURSES.filter(c => {
      const q  = search.toLowerCase()
      const st = getCourseStatus(c)
      return (c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q))
          && (filter === 'Semua' || st === filter)
    }),
    [search, filter]
  )

  const counts = {
    'Semua':          ENROLLED_COURSES.length,
    'Sedang Belajar': ENROLLED_COURSES.filter(c => getCourseStatus(c) === 'Sedang Belajar').length,
    'Selesai':        ENROLLED_COURSES.filter(c => getCourseStatus(c) === 'Selesai').length,
    'Belum Dimulai':  ENROLLED_COURSES.filter(c => getCourseStatus(c) === 'Belum Dimulai').length,
  }

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-hidden">

      {/* ══ PROMO CAROUSEL ══ */}
      <PromoCarousel />

      {/* ══ PAGE HEADER ══ */}
      <div className="mb-4 sm:mb-5 animate-fade-in-up">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight mb-1.5">📚 Kursus Saya</h1>
        <p className="text-sm sm:text-base text-slate-500">
          {ENROLLED_COURSES.length} kursus diikuti · {counts['Selesai']} selesai · {counts['Sedang Belajar']} sedang berjalan
        </p>
      </div>

      {/* ══ SEARCH + FILTER ══ */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5 sm:mb-6 [animation:fadeInUp_0.4s_0.1s_ease_both]">
        <div className="flex-1 relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">🔍</span>
          <input
            id="course-search"
            type="text"
            placeholder="Cari kursus..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl text-base font-medium text-slate-700 bg-white outline-none transition-all focus:border-primary-light focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] placeholder:text-slate-400"
          />
        </div>

        <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-xl overflow-x-auto shrink-0">
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold border-none cursor-pointer transition-all whitespace-nowrap ${
                filter === f ? 'bg-white text-primary shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {f} <span className="opacity-55">({counts[f]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* ══ COURSE GRID ══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 [animation:fadeInUp_0.4s_0.2s_ease_both]">
        {filtered.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-400 gap-4 text-center">
            <span className="text-5xl opacity-35">🔍</span>
            <h3 className="text-base sm:text-lg font-bold text-slate-500">Tidak ada kursus ditemukan</h3>
            <p className="text-sm sm:text-base">Coba ubah kata kunci atau filter</p>
          </div>
        ) : (
          filtered.map(c => (
            <CourseCard key={c.id} course={c} onClick={() => setSelected(c)} />
          ))
        )}
      </div>

      {selected && <CourseModal course={selected} onClose={() => setSelected(null)} />}
    </main>
  )
}
