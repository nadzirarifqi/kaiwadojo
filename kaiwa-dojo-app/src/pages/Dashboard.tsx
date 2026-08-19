import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import {
  type DailyMissionData,
  type MissionProgress,
  getDailyMission,
  calculateMissionProgress,
  calculateStreakFromDates,
} from '../lib/dailyMission'

import AdaptiveIcon from '../components/AdaptiveIcon'

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

/* ── StreakCard Component ───────────────────────────── */
function StreakCard({ streakDays, history }: { streakDays: number; history: boolean[] }) {
  const navigate = useNavigate()
  const dayLabels = getLast7DayLabels()
  const nextMilestone = streakDays < 7 ? 7 : streakDays < 30 ? 30 : 100
  const pct = Math.min(Math.round((streakDays / nextMilestone) * 100), 100)
  const todayDone = history[history.length - 1] || false

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
          Level: {streakDays >= 30 ? 'Pakar' : streakDays >= 7 ? 'Aktif' : 'Pemula'}
        </span>
      </div>

      {/* Flame + calendar */}
      <div className="flex items-center gap-5 sm:gap-7">
        <div className="flex flex-col items-center shrink-0">
          <span className="text-[3.5rem] sm:text-[4.5rem] leading-none animate-flame select-none">🔥</span>
          <div className="text-[2.8rem] sm:text-[3.5rem] font-black text-orange-500 leading-none -mt-1">
            {streakDays}
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
                    : 'bg-slate-100 text-slate-300'
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
              <span className="text-slate-500">Target {nextMilestone} hari 🎯</span>
              <span className="text-orange-500 font-bold">{streakDays}/{nextMilestone}</span>
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
                  streakDays >= m.days
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

      {/* Today status & guide */}
      <div className={`p-3.5 rounded-xl text-sm font-semibold border flex items-center justify-between gap-3 ${
        todayDone
          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
          : 'bg-amber-50 text-amber-800 border-amber-200'
      }`}>
        {todayDone ? (
          <span>🎉 Keren! Misi hari ini selesai dan streak menyala! 🔥</span>
        ) : (
          <div className="flex justify-between items-center w-full">
            <span>🔥 Selesaikan misi hari ini untuk menyalakan streak!</span>
            <button
              onClick={() => navigate('/learning-plan')}
              className="text-xs font-bold text-amber-900 bg-amber-200/60 hover:bg-amber-200 px-3 py-1.5 rounded-xl border-none cursor-pointer shrink-0 ml-2 transition-all"
            >
              Lihat Misi →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── RecentWatchCard Component ─────────────────────── */
function RecentWatchCard({ recentWatch }: { recentWatch: any | null }) {
  const navigate = useNavigate()

  if (!recentWatch) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center gap-4 min-h-[320px]">
        <div className="size-16 bg-primary/10 rounded-2xl flex items-center justify-center text-3xl text-primary">
          📺
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-1">Belum Ada Video Ditonton</h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xs leading-relaxed">
            Yuk pilih kursus dan tonton materi pertamamu sekarang!
          </p>
        </div>
        <button
          onClick={() => navigate('/my-courses')}
          className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-xs sm:text-sm font-bold rounded-xl border-none cursor-pointer transition-all shadow-sm"
        >
          Lihat Kursus Saya →
        </button>
      </div>
    )
  }

  const { courseTitle, videoTitle, videoProgress } = recentWatch

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col gap-4">
      <h2 className="text-base sm:text-lg font-extrabold text-slate-800">▶ Lanjutkan Belajar</h2>

      {/* 16:9 Thumbnail placeholder */}
      <div className="w-full aspect-video rounded-xl bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-[3.5rem] relative overflow-hidden">
        📚
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/10">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary-light rounded-full"
            style={{ width: `${videoProgress}%` }}
          />
        </div>
      </div>

      {/* Info */}
      <div>
        <div className="text-xs sm:text-sm text-slate-400 font-semibold mb-1 truncate">
          {courseTitle}
        </div>
        <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-snug mb-3 truncate">
          {videoTitle}
        </h3>

        {/* Progress */}
        <div className="flex justify-between text-xs sm:text-sm font-bold mb-1.5">
          <span className="text-primary">{videoProgress}% ditonton</span>
          {videoProgress >= 80 && (
            <span className="text-orange-500">✅ Streak terhitung!</span>
          )}
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary-light rounded-full"
            style={{ width: `${videoProgress}%` }}
          />
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={() => navigate('/my-courses')}
        className="w-full py-3 bg-gradient-to-br from-primary to-primary-light text-white text-sm font-bold rounded-xl border-none cursor-pointer transition-all shadow-md hover:-translate-y-0.5"
      >
        ▶ Lanjutkan Belajar
      </button>
    </div>
  )
}

/* ── Main Dashboard ────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [stats, setStats] = useState({
    enrolledCoursesCount: 0,
    completedCoursesCount: 0,
    streakDays: 0,
  })
  const [streakHistory, setStreakHistory] = useState<boolean[]>([false, false, false, false, false, false, false])
  const [recentWatch, setRecentWatch] = useState<any | null>(null)

  // Minna no Nihongo Jilid 1 & 2 Book Progress
  const [bookProgress, setBookProgress] = useState({
    jilid1Pct: 0,
    jilid1DoneItems: 0,
    jilid2Pct: 0,
    jilid2DoneItems: 0,
  })

  // Daily Mission state
  const [dailyMission, setDailyMission]         = useState<DailyMissionData | null>(null)
  const [missionProgress, setMissionProgress] = useState<MissionProgress | null>(null)

  useEffect(() => {
    async function loadDashboardData() {
      if (!user || !profile) return

      // Daily Mission
      const mission = getDailyMission(user.id)
      setDailyMission(mission)
      if (mission) {
        const prog = await calculateMissionProgress(user.id, mission)
        setMissionProgress(prog)
      }

      // Calculate Minna no Nihongo Jilid 1 & 2 Progress
      const { data: userLessonProgress } = await supabase
        .from('lesson_progress')
        .select('lesson_id, is_completed')
        .eq('student_id', user.id)
        .eq('is_completed', true)

      let j1Count = 0
      let j2Count = 0

      if (userLessonProgress) {
        userLessonProgress.forEach((p: any) => {
          const match = p.lesson_id?.match(/bab_(\d+)_/)
          if (match) {
            const babNum = parseInt(match[1], 10)
            if (babNum >= 1 && babNum <= 25) j1Count++
            else if (babNum >= 26 && babNum <= 50) j2Count++
          }
        })
      }

      const totalItemsPerJilid = 125 // 25 Bab * 5 Items
      setBookProgress({
        jilid1Pct: Math.min(100, Math.round((j1Count / totalItemsPerJilid) * 100)),
        jilid1DoneItems: j1Count,
        jilid2Pct: Math.min(100, Math.round((j2Count / totalItemsPerJilid) * 100)),
        jilid2DoneItems: j2Count,
      })

      // Fetch enrollments
      const { data: enrollData } = await supabase
        .from('enrollments')
        .select(`
          id, progress_pct, course_id,
          course:courses!enrollments_course_id_fkey(id, title, category, thumbnail_url, total_lessons)
        `)
        .eq('student_id', user.id)

      const enrolled = enrollData || []
      const completed = enrolled.filter((e: any) => Number(e.progress_pct) === 100)

      // Fetch recent streaks and calculate live consecutive streak count
      const { data: streaksData } = await supabase
        .from('learning_streaks')
        .select('date')
        .eq('student_id', user.id)

      const streakDates = new Set((streaksData || []).map((s: any) => s.date))
      const liveStreakCount = calculateStreakFromDates(streakDates)

      const today = new Date()
      const history = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today)
        d.setDate(today.getDate() - (6 - i))
        const dateStr = d.toISOString().split('T')[0]
        return streakDates.has(dateStr)
      })

      // Fetch most recent lesson progress
      const { data: lastWatch } = await supabase
        .from('lesson_progress')
        .select(`
          last_watched_at, is_completed,
          lesson:lessons!lesson_progress_lesson_id_fkey(id, title, course_id),
          course:courses!lesson_progress_course_id_fkey(id, title)
        `)
        .eq('student_id', user.id)
        .order('last_watched_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastWatch && lastWatch.course && lastWatch.lesson) {
        setRecentWatch({
          courseTitle: (lastWatch.course as any).title,
          videoTitle: (lastWatch.lesson as any).title,
          videoProgress: lastWatch.is_completed ? 100 : 50,
        })
      }

      setStats(prev => ({
        ...prev,
        enrolledCoursesCount: enrolled.length,
        completedCoursesCount: completed.length,
        streakDays: liveStreakCount || profile?.streak_days || 0,
      }))

      setStreakHistory(history)
    }

    loadDashboardData()
  }, [user, profile])

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-hidden">

      {/* Hero Header */}
      <header className="relative overflow-hidden bg-gradient-to-br from-primary to-primary-light rounded-2xl lg:rounded-[28px] px-6 py-8 sm:px-8 sm:py-10 lg:px-11 lg:py-12 mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shadow-lg animate-fade-in-up">
        <div className="absolute -top-14 -right-14 size-64 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute -bottom-16 right-20 size-48 bg-white/[0.04] rounded-full pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-white/90 bg-white/20 px-3 py-1 rounded-full uppercase tracking-wider">
              Pelajar
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mb-2 tracking-tight leading-snug">
            Selamat datang, {profile?.full_name || 'User'}! 👋
          </h1>
          <p className="text-white/80 text-sm sm:text-base leading-relaxed max-w-lg">
            Setiap video yang kamu selesaikan adalah investasi terbaik untuk masa depanmu. ✨
          </p>
        </div>

        {/* Stats Cards */}
        <div className="flex gap-3 shrink-0 relative z-10 flex-wrap">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-5 py-4 text-center min-w-[90px] flex flex-col items-center justify-center">
            <AdaptiveIcon src="/book.png" alt="Kursus" className="size-6 object-contain shrink-0 mb-1" />
            <div className="text-2xl font-black text-white">{stats.enrolledCoursesCount}</div>
            <div className="text-[0.65rem] text-white/70 font-bold uppercase">Kursus</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-5 py-4 text-center min-w-[90px]">
            <div className="text-xl mb-1">🔥</div>
            <div className="text-2xl font-black text-white">{stats.streakDays}</div>
            <div className="text-[0.65rem] text-white/70 font-bold uppercase">Streak</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-5 py-4 text-center min-w-[90px]">
            <div className="text-xl mb-1">✅</div>
            <div className="text-2xl font-black text-white">{stats.completedCoursesCount}</div>
            <div className="text-[0.65rem] text-white/70 font-bold uppercase">Selesai</div>
          </div>
        </div>
      </header>

      {/* 🎯 Daily Mission Dashboard Widget */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm mb-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <AdaptiveIcon src="/target.png" alt="Target Misi" className="size-7 object-contain shrink-0" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white">Misi Harian Hari Ini</h2>
                {missionProgress?.isFullyCompleted ? (
                  <span className="text-[0.65rem] font-black bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    🎉 100% Selesai
                  </span>
                ) : (
                  <span className="text-[0.65rem] font-bold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">
                    {missionProgress ? `${missionProgress.overallPct}% Progress` : 'Belum Dibuat'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {dailyMission
                  ? `Target: ${dailyMission.selectedVideos.length} Video (${missionProgress?.targetReplays}x Replays), ${dailyMission.targetQuizCount} Kuis, ${dailyMission.targetKotobaCount} Kotoba`
                  : 'Buat misi harian kamu untuk mulai menambah streak hari ini!'}
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/learning-plan')}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border-none cursor-pointer transition-all shrink-0"
          >
            {dailyMission ? '⚙️ Ubah Misi' : '+ Buat Misi'}
          </button>
        </div>

        {dailyMission && missionProgress ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Target 1: Video */}
            <div className={`p-3.5 rounded-2xl border transition-all ${
              missionProgress.videoCompleted ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex justify-between text-xs font-bold text-slate-800 mb-1">
                <span>🎥 Video ({dailyMission.selectedVideos.length} Video)</span>
                <span className={missionProgress.videoCompleted ? 'text-emerald-700 font-extrabold' : 'text-primary font-bold'}>
                  {missionProgress.actualReplays}/{missionProgress.targetReplays}x
                </span>
              </div>
              <p className="text-[0.68rem] text-slate-400 mb-2">
                Target: {missionProgress.targetReplays}x pengulangan
              </p>
              <div className="h-2 bg-slate-200/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (missionProgress.actualReplays / missionProgress.targetReplays) * 100)}%` }}
                />
              </div>
            </div>

            {/* Target 2: Kuis */}
            <div className={`p-3.5 rounded-2xl border transition-all ${
              missionProgress.quizCompleted ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex justify-between text-xs font-bold text-slate-800 mb-1">
                <span>🎯 Kuis Bab</span>
                <span className={missionProgress.quizCompleted ? 'text-emerald-700 font-extrabold' : 'text-indigo-600 font-bold'}>
                  {missionProgress.actualQuizzes}/{missionProgress.targetQuizzes}
                </span>
              </div>
              <p className="text-[0.68rem] text-slate-400 mb-2">
                Target: {missionProgress.targetQuizzes} kuis selesai
              </p>
              <div className="h-2 bg-slate-200/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (missionProgress.actualQuizzes / missionProgress.targetQuizzes) * 100)}%` }}
                />
              </div>
            </div>

            {/* Target 3: Kotoba */}
            <div className={`p-3.5 rounded-2xl border transition-all ${
              missionProgress.kotobaCompleted ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex justify-between text-xs font-bold text-slate-800 mb-1">
                <span>🔤 Setoran Kotoba</span>
                <span className={missionProgress.kotobaCompleted ? 'text-emerald-700 font-extrabold' : 'text-amber-600 font-bold'}>
                  {missionProgress.actualKotoba}/{missionProgress.targetKotoba}
                </span>
              </div>
              <p className="text-[0.68rem] text-slate-400 mb-2">
                Target: {missionProgress.targetKotoba} setoran selesai
              </p>
              <div className="h-2 bg-slate-200/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (missionProgress.actualKotoba / missionProgress.targetKotoba) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-center flex flex-col items-center gap-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Kamu belum membuat Misi Harian untuk hari ini.
            </p>
            <button
              onClick={() => navigate('/learning-plan')}
              className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl border-none cursor-pointer transition-all hover:bg-primary-dark shadow-xs"
            >
              + Susun Misi Harian Sekarang →
            </button>
          </div>
        )}
      </div>

      {/* Student View: Streak & Recent Watch Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-5 mb-6">
        {/* Streak Card & Quick Shortcuts */}
        <div className="flex flex-col gap-5">
          <StreakCard streakDays={stats.streakDays} history={streakHistory} />

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/my-courses')}
              className="bg-primary text-white rounded-2xl p-4 sm:p-5 flex items-center gap-3 shadow-md cursor-pointer border-none transition-all hover:-translate-y-1 hover:shadow-xl text-left"
            >
              <AdaptiveIcon src="/book.png" alt="Kursus Saya" className="size-7 object-contain shrink-0" />
              <div className="min-w-0">
                <div className="text-sm sm:text-base font-extrabold leading-tight">Kursus Saya</div>
                <div className="text-white/70 text-xs mt-0.5">{stats.enrolledCoursesCount} kursus aktif</div>
              </div>
              <span className="ml-auto text-white/60 text-base shrink-0">→</span>
            </button>

            <button
              onClick={() => navigate('/learning-plan')}
              className="bg-white dark:bg-slate-900 text-primary rounded-2xl p-4 sm:p-5 flex items-center gap-3 shadow-sm border border-slate-200 dark:border-slate-800 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md hover:border-primary text-left"
            >
              <AdaptiveIcon src="/task.png" alt="Rencana Belajar" className="size-7 object-contain shrink-0" />
              <div className="min-w-0">
                <div className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-white leading-tight">Rencana Belajar</div>
                <div className="text-slate-400 text-xs mt-0.5">Atur targetmu</div>
              </div>
              <span className="ml-auto text-slate-300 text-base shrink-0">→</span>
            </button>
          </div>
        </div>

        {/* Recent Watch Card */}
        <RecentWatchCard recentWatch={recentWatch} />
      </div>

      {/* Progress Preview for Minna no Nihongo Jilid 1 & 2 */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white">📖 Progress Belajar Buku</h2>
            <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">Minna no Nihongo Jilid 1 & 2 (Bab 1 - 50)</p>
          </div>
          <button
            onClick={() => navigate('/my-courses')}
            className="text-primary dark:text-red-400 text-xs sm:text-sm font-bold bg-transparent border-none cursor-pointer hover:underline"
          >
            Buka Kursus →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1: Jilid 1 */}
          <div
            onClick={() => navigate('/my-courses')}
            className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/80 to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-blue-200/80 dark:border-blue-900/60 cursor-pointer transition-all hover:border-primary hover:shadow-md flex flex-col gap-3 group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-primary text-white flex items-center justify-center text-xl font-bold shadow-xs group-hover:scale-105 transition-transform">
                  📘
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">Minna no Nihongo Jilid 1</h3>
                  <span className="text-[0.75rem] font-medium text-slate-500 dark:text-slate-300">Bab 1 – 25 · 125 Materi & Evaluasi</span>
                </div>
              </div>
              <span className="text-sm font-black text-primary dark:text-red-400 bg-primary/10 dark:bg-primary/20 px-2.5 py-1 rounded-xl">
                {bookProgress.jilid1Pct}%
              </span>
            </div>

            <div>
              <div className="flex justify-between text-[0.7rem] text-slate-500 dark:text-slate-300 font-semibold mb-1">
                <span>Pencapaian: {bookProgress.jilid1DoneItems}/125 Selesai</span>
                <span>{bookProgress.jilid1Pct}%</span>
              </div>
              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${bookProgress.jilid1Pct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Jilid 2 */}
          <div
            onClick={() => navigate('/my-courses')}
            className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/80 to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-emerald-200/80 dark:border-emerald-900/60 cursor-pointer transition-all hover:border-emerald-500 hover:shadow-md flex flex-col gap-3 group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-xl font-bold shadow-xs group-hover:scale-105 transition-transform">
                  📗
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">Minna no Nihongo Jilid 2</h3>
                  <span className="text-[0.75rem] font-medium text-slate-500 dark:text-slate-300">Bab 26 – 50 · 125 Materi & Evaluasi</span>
                </div>
              </div>
              <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-1 rounded-xl">
                {bookProgress.jilid2Pct}%
              </span>
            </div>

            <div>
              <div className="flex justify-between text-[0.7rem] text-slate-500 dark:text-slate-300 font-semibold mb-1">
                <span>Pencapaian: {bookProgress.jilid2DoneItems}/125 Selesai</span>
                <span>{bookProgress.jilid2Pct}%</span>
              </div>
              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all duration-700"
                  style={{ width: `${bookProgress.jilid2Pct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

    </main>
  )
}
