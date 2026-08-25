import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import {
  type DailyMissionData,
  type MissionProgress,
  getDailyMission,
  fetchDailyMission,
  fetchAllUserMissions,
  calculateMissionProgress,
  calculateStreakFromDates,
  getTodayDateString,
} from '../lib/dailyMission'
import { useLanguage } from '../contexts/LanguageContext'

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
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-5">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white">🔥 Streak Belajar</h2>
        <span className="text-xs sm:text-sm text-slate-400 font-semibold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
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
          <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-semibold mt-1 text-center whitespace-nowrap">
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
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600'
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
              <span className="text-slate-500 dark:text-slate-400">Target {nextMilestone} hari 🎯</span>
              <span className="text-orange-500 font-bold">{streakDays}/{nextMilestone}</span>
            </div>
            <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
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
                    ? 'bg-orange-50 dark:bg-orange-950/60 border-orange-200 dark:border-orange-900 text-orange-600 dark:text-orange-400'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-400'
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
          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900'
      }`}>
        {todayDone ? (
          <span>🎉 Keren! Misi hari ini selesai dan streak menyala! 🔥</span>
        ) : (
          <div className="flex justify-between items-center w-full">
            <span>🔥 Selesaikan misi hari ini untuk menyalakan streak!</span>
            <button
              onClick={() => navigate('/learning-plan')}
              className="text-xs font-bold text-amber-900 dark:text-amber-100 bg-amber-200/60 dark:bg-amber-900/60 hover:bg-amber-200 px-3 py-1.5 rounded-xl border-none cursor-pointer shrink-0 ml-2 transition-all"
            >
              Lihat Misi →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── EmbeddedUserScheduleCard Component ─────────────────────── */
function EmbeddedUserScheduleCard({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const [userReservations, setUserReservations] = useState<any[]>([])
  const [userMissions, setUserMissions]         = useState<{ date: string; mission: DailyMissionData }[]>([])
  const [loading, setLoading]                   = useState(true)
  const [activeFilter, setActiveFilter]         = useState<'all' | 'mission' | 'class'>('all')

  const todayStr = new Date().toISOString().split('T')[0]

  useEffect(() => {
    async function loadSchedulesAndMissions() {
      if (!userId) return
      setLoading(true)

      // 1. Fetch all booked class schedules
      const { data } = await supabase
        .from('class_reservations')
        .select(`
          id, created_at,
          schedule:class_schedules!class_reservations_schedule_id_fkey(*)
        `)
        .eq('user_id', userId)

      let resList: any[] = []
      if (data) {
        resList = data
          .map((r: any) => r.schedule)
          .filter(Boolean)
          .sort((a: any, b: any) => (a.date || '').localeCompare(b.date || ''))
        setUserReservations(resList)
      }

      // 2. Fetch all planned daily missions across dates from DB & local cache
      const missionsMap = await fetchAllUserMissions(userId)
      const missionsList: { date: string; mission: DailyMissionData }[] = Array.from(missionsMap.entries()).map(
        ([date, mission]) => ({ date, mission })
      )

      missionsList.sort((a, b) => a.date.localeCompare(b.date))
      setUserMissions(missionsList)
      setLoading(false)
    }

    loadSchedulesAndMissions()
  }, [userId, todayStr])

  // Combine missions and reservations into a single timeline
  const combinedTimeline = [
    ...userMissions.map(m => ({
      id: `mission-${m.date}`,
      type: 'mission' as const,
      date: m.date,
      mission: m.mission,
    })),
    ...userReservations.map(r => ({
      id: `class-${r.id}`,
      type: 'class' as const,
      date: r.date,
      schedule: r,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const filteredTimeline = combinedTimeline.filter(item => {
    if (activeFilter === 'mission') return item.type === 'mission'
    if (activeFilter === 'class') return item.type === 'class'
    return true
  })

  const [selectedScheduleItem, setSelectedScheduleItem] = useState<any | null>(null)

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-3 h-full min-h-0">
      <div className="flex flex-col min-h-0 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📅</span>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white leading-tight">
                Jadwal & Agenda Saya
              </h2>
              <span className="text-[0.7rem] text-slate-400 font-medium">Linimasa Misi Harian & Kelas Live</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => navigate('/learning-plan')}
              className="text-xs font-bold text-primary dark:text-red-400 bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-xl border-none cursor-pointer transition-all shrink-0"
            >
              Kalender →
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 mb-3 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-lg text-[0.68rem] font-bold border-none cursor-pointer transition-all shrink-0 ${
              activeFilter === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Semua ({combinedTimeline.length})
          </button>
          <button
            onClick={() => setActiveFilter('mission')}
            className={`px-3 py-1 rounded-lg text-[0.68rem] font-bold border-none cursor-pointer transition-all shrink-0 ${
              activeFilter === 'mission'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-500 hover:text-amber-500'
            }`}
          >
            🎯 Misi Mandiri ({userMissions.length})
          </button>
          <button
            onClick={() => setActiveFilter('class')}
            className={`px-3 py-1 rounded-lg text-[0.68rem] font-bold border-none cursor-pointer transition-all shrink-0 ${
              activeFilter === 'class'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-sky-600'
            }`}
          >
            💻 🏢 Kelas Live ({userReservations.length})
          </button>
        </div>

        {/* Scrollable Timeline List */}
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Memuat linimasa jadwalku...</div>
        ) : filteredTimeline.length === 0 ? (
          <div className="p-6 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs text-slate-400 text-center flex flex-col items-center gap-2 flex-1 justify-center">
            <span>Belum ada agenda yang tersusun untuk kategori ini.</span>
            <button
              onClick={() => navigate('/learning-plan')}
              className="text-xs font-bold text-primary dark:text-red-400 bg-transparent border-none cursor-pointer hover:underline"
            >
              + Susun Agenda Sekarang →
            </button>
          </div>
        ) : (
          <div className="space-y-2.5 overflow-y-auto pr-1 max-h-[265px]">
            {filteredTimeline.map(item => {
              const isToday = item.date === todayStr

              if (item.type === 'mission') {
                const m = item.mission
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedScheduleItem(item)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all hover:border-amber-500 flex flex-col gap-1.5 group ${
                      isToday
                        ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between font-extrabold">
                      <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <span>🎯</span>
                        <span>Misi Harian</span>
                        {isToday && (
                          <span className="text-[0.6rem] bg-amber-500 text-white px-1.5 py-0.2 rounded-md font-bold uppercase">
                            Hari Ini
                          </span>
                        )}
                      </span>
                      <span className="text-[0.68rem] text-slate-500 dark:text-slate-400 font-semibold group-hover:text-amber-600 transition-colors">
                        📅 {item.date} 🔍
                      </span>
                    </div>

                    <div className="font-bold text-slate-800 dark:text-white truncate">
                      🎥 {m.selectedVideos.length > 0
                        ? m.selectedVideos.map(v => `Bab ${v.bab} (Part ${v.videoNum})`).join(', ')
                        : 'Misi Mandiri Non-Video'}
                    </div>

                    <div className="text-[0.68rem] text-slate-500 dark:text-slate-400 flex items-center justify-between font-medium">
                      <span>Target: {m.targetReplayCount}x Replays</span>
                      <span>• {m.targetQuizCount} Kuis • {m.targetKotobaCount} Kotoba</span>
                    </div>
                  </div>
                )
              } else {
                const sch = item.schedule
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedScheduleItem(item)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex flex-col gap-1.5 group ${
                      sch.type === 'online'
                        ? 'bg-sky-50/80 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-100 hover:border-sky-400'
                        : 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 hover:border-emerald-400'
                    }`}
                  >
                    <div className="flex items-center justify-between font-extrabold">
                      <span className="flex items-center gap-1">
                        <span>{sch.type === 'online' ? '💻' : '🏢'}</span>
                        <span>{sch.type === 'online' ? 'Kelas Online' : 'Kelas Offline'}</span>
                      </span>
                      <span className="text-[0.68rem] font-semibold group-hover:underline">
                        📅 {sch.date} ({sch.start_time} WIB) 🔍
                      </span>
                    </div>

                    <div className="font-bold truncate text-slate-800 dark:text-white">
                      {sch.title}
                    </div>

                    <div className="text-[0.68rem] opacity-80 flex items-center justify-between">
                      <span>Sensei: {sch.instructor}</span>
                      <span className="font-black px-1.5 py-0.2 rounded bg-white/80 dark:bg-slate-900/60">
                        ✓ Terdaftar
                      </span>
                    </div>
                  </div>
                )
              }
            })}
          </div>
        )}
      </div>

      {/* Detail Pop-up Modal View */}
      {selectedScheduleItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 animate-scale-up">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-400">
                  {selectedScheduleItem.type === 'mission' ? '🎯 Detail Misi Mandiri' : '💻 🏢 Detail Kelas Live'}
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white leading-snug mt-0.5">
                  {selectedScheduleItem.type === 'mission'
                    ? `Misi Harian (${selectedScheduleItem.date})`
                    : selectedScheduleItem.schedule.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedScheduleItem(null)}
                className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 font-bold border-none cursor-pointer flex items-center justify-center text-sm transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            {selectedScheduleItem.type === 'mission' ? (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-900 flex flex-col gap-1.5">
                  <div className="font-extrabold text-amber-900 dark:text-amber-200 text-sm flex items-center gap-1.5">
                    <span>📅 Tanggal Pelaksanaan:</span>
                    <span>{selectedScheduleItem.date}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    Rencana belajar mandiri harian yang telah kamu susun untuk menguji pemahaman dan menjaga streak belajarmu.
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="font-extrabold text-slate-800 dark:text-white">🎥 Video Pembelajaran:</div>
                  {selectedScheduleItem.mission.selectedVideos.length > 0 ? (
                    selectedScheduleItem.mission.selectedVideos.map((v: any, idx: number) => (
                      <div key={v.id || idx} className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 dark:text-white truncate">
                            Jilid {v.jilid} · Bab {v.bab} (Part {v.videoNum})
                          </div>
                          <div className="text-[0.68rem] text-slate-400 truncate">{v.title}</div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedScheduleItem(null)
                            navigate(`/my-courses?jilid=${v.jilid}&bab=${v.bab}&item=${v.videoNum}`)
                          }}
                          className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg text-[0.68rem] border-none cursor-pointer shrink-0 transition-colors shadow-xs"
                        >
                          ▶ Tonton
                        </button>
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-400">Tidak ada video khusus.</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[0.72rem]">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 font-bold block mb-0.5">🔄 Target Replays:</span>
                    <span className="text-slate-800 dark:text-white font-extrabold text-xs">{selectedScheduleItem.mission.targetReplayCount}x Per Video</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 font-bold block mb-0.5">📝 Target Evaluasi:</span>
                    <span className="text-slate-800 dark:text-white font-extrabold text-xs">{selectedScheduleItem.mission.targetQuizCount} Kuis & {selectedScheduleItem.mission.targetKotobaCount} Kotoba</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className={`p-3.5 rounded-2xl border flex flex-col gap-2 ${
                  selectedScheduleItem.schedule.type === 'online'
                    ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-100'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                }`}>
                  <div className="flex items-center justify-between font-black text-sm">
                    <span>{selectedScheduleItem.schedule.type === 'online' ? '💻 Kelas Online (Live Zoom)' : '🏢 Kelas Offline (Tatap Muka)'}</span>
                    <span className="text-[0.65rem] bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md shadow-2xs font-extrabold">✓ Terdaftar</span>
                  </div>
                  <div className="font-extrabold text-sm">
                    📅 {selectedScheduleItem.schedule.date} ({selectedScheduleItem.schedule.start_time} - {selectedScheduleItem.schedule.end_time} WIB)
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="font-extrabold text-slate-800 dark:text-white">👨‍🏫 Pengajar (Sensei):</div>
                  <div className="font-bold text-slate-700 dark:text-slate-200 text-sm">{selectedScheduleItem.schedule.instructor}</div>
                  {selectedScheduleItem.schedule.type === 'online' && (
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block mb-1 font-semibold">🔗 Link Ruangan Zoom:</span>
                      <span className="text-sky-600 dark:text-sky-400 font-mono font-bold select-all bg-sky-50 dark:bg-sky-950/60 px-2.5 py-1 rounded-lg inline-block">
                        https://zoom.us/j/kaiwadojo-live-session
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedScheduleItem(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border-none cursor-pointer transition-colors"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Main Dashboard ────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { t } = useLanguage()
  const [stats, setStats] = useState({
    enrolledCoursesCount: 0,
    completedCoursesCount: 0,
    streakDays: 0,
  })
  const [streakHistory, setStreakHistory] = useState<boolean[]>([false, false, false, false, false, false, false])

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
  const [videoProgressMap, setVideoProgressMap] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    async function loadDashboardData() {
      const effectiveUserId = profile?.id || user?.id || 'active_user'

      // Daily Mission: Fetch from DB first (or local fallback)
      const todayDate = getTodayDateString()
      const mission = (await fetchDailyMission(effectiveUserId, todayDate)) || getDailyMission(effectiveUserId, todayDate)
      setDailyMission(mission)
      if (mission) {
        const prog = await calculateMissionProgress(effectiveUserId, mission)
        setMissionProgress(prog)

        if (mission.selectedVideos.length > 0) {
          let progData: any[] = []
          if (user?.id || profile?.id) {
            const { data } = await supabase
              .from('lesson_progress')
              .select('lesson_id, is_completed, replay_count')
              .eq('student_id', effectiveUserId)
            progData = data || []
          }

          // Merge local progress map
          const localProgKey = `kaiwa_lesson_progress_${effectiveUserId}`
          const globalProgKey = `kaiwa_lesson_progress_active_global`
          const savedProgRaw = localStorage.getItem(localProgKey) || localStorage.getItem(globalProgKey)
          if (savedProgRaw) {
            try {
              const parsedArr: [string, { is_completed: boolean; replay_count: number }][] = JSON.parse(savedProgRaw)
              const progMap = new Map<string, { is_completed: boolean; replay_count: number }>()
              progData.forEach(p => progMap.set(p.lesson_id, { is_completed: p.is_completed, replay_count: p.replay_count || 0 }))
              parsedArr.forEach(([lId, val]) => {
                const existing = progMap.get(lId)
                progMap.set(lId, {
                  is_completed: val.is_completed || existing?.is_completed || false,
                  replay_count: Math.max(val.replay_count || 0, existing?.replay_count || 0),
                })
              })
              progData = Array.from(progMap.entries()).map(([lId, val]) => ({
                lesson_id: lId,
                is_completed: val.is_completed,
                replay_count: val.replay_count,
              }))
            } catch {}
          }

          const map = new Map<string, number>()
          mission.selectedVideos.forEach(v => {
            const patterns = [
              v.id.toLowerCase(),
              `bab_${v.bab}_video_${v.videoNum}`.toLowerCase(),
              `bab_${v.bab}_item_${v.videoNum}`.toLowerCase(),
              `lesson_bab_${v.bab}_${v.videoNum}`.toLowerCase(),
            ]
            let count = 0
            if (progData) {
              progData.forEach((p: any) => {
                const idLower = (p.lesson_id || '').toLowerCase()
                if (patterns.some(pat => idLower.includes(pat))) {
                  count += p.replay_count && p.replay_count > 0 ? p.replay_count : (p.is_completed ? 1 : 0)
                }
              })
            }
            map.set(v.id, count)
          })
          setVideoProgressMap(map)
        }
      }

      // Calculate Minna no Nihongo Jilid 1 & 2 Progress
      let userLessonProgress: any[] = []
      if (user?.id || profile?.id) {
        const { data } = await supabase
          .from('lesson_progress')
          .select('lesson_id, is_completed')
          .eq('student_id', effectiveUserId)
          .eq('is_completed', true)
        userLessonProgress = data || []
      }

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
      let enrollData: any[] = []
      let streaksData: any[] = []

      if (user?.id || profile?.id) {
        const [eRes, sRes] = await Promise.all([
          supabase
            .from('enrollments')
            .select(`
              id, progress_pct, course_id,
              course:courses!enrollments_course_id_fkey(id, title, category, thumbnail_url, total_lessons)
            `)
            .eq('student_id', effectiveUserId),
          supabase
            .from('learning_streaks')
            .select('date')
            .eq('student_id', effectiveUserId),
        ])
        enrollData = eRes.data || []
        streaksData = sRes.data || []
      }

      const enrolled = enrollData
      const completed = enrolled.filter((e: any) => Number(e.progress_pct) === 100)

      const streakDates = new Set(streaksData.map((s: any) => s.date))
      const liveStreakCount = calculateStreakFromDates(streakDates)

      const today = new Date()
      const history = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today)
        d.setDate(today.getDate() - (6 - i))
        const dateStr = d.toISOString().split('T')[0]
        return streakDates.has(dateStr)
      })

      setStats(prev => ({
        ...prev,
        enrolledCoursesCount: enrolled.length,
        completedCoursesCount: completed.length,
        streakDays: liveStreakCount,
      }))

      setStreakHistory(history)
    }

    loadDashboardData()
  }, [user, profile])

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-clip animate-page-slide">

      {/* Hero Header */}
      <header
        className="relative overflow-hidden rounded-2xl lg:rounded-[28px] px-6 py-8 sm:px-8 sm:py-10 lg:px-11 lg:py-12 mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shadow-lg animate-fade-in-up bg-cover bg-center"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(185,28,28,0.92), rgba(127,29,29,0.85)), url('/japan-background(2).jpg')",
        }}
      >
        <div className="absolute -top-14 -right-14 size-64 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute -bottom-16 right-20 size-48 bg-white/[0.04] rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 w-full">
          <div className="flex items-center gap-4">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="size-16 sm:size-20 rounded-2xl border-2 border-white/30 object-cover shadow-md"
              />
            ) : (
              <div className="size-16 sm:size-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center font-black text-white text-2xl sm:text-3xl shadow-md font-serif">
                {profile?.full_name?.[0] || '学'}
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="bg-white/20 backdrop-blur-md text-white text-[0.68rem] font-bold px-2.5 py-0.5 rounded-full border border-white/30">
                  🌸 {t('dash_welcome_student', 'Pelajar KaiwaDoJo')}
                </span>
                <span className="bg-amber-400/20 backdrop-blur-md text-amber-200 text-[0.68rem] font-bold px-2.5 py-0.5 rounded-full border border-amber-400/30">
                  {t('dash_jlpt_n5_target', 'Target JLPT N5')}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white leading-tight">
                {t('dash_konnichiwa', 'Konnichiwa')}, {profile?.full_name || 'Pelajar'}! 👋
              </h1>
              <p className="text-xs sm:text-sm text-white/80 font-medium mt-1">
                {t('dash_tagline', 'Mari lanjutkan perjalanan bahasa Jepangmu hari ini dengan percaya diri.')}
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/my-courses')}
            className="self-start md:self-center px-5 py-3 rounded-2xl bg-white text-slate-900 font-extrabold hover:bg-slate-100 text-xs sm:text-sm border-none cursor-pointer shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <span>▶ {t('dash_continue_learning', 'Lanjut Belajar')}</span>
          </button>
        </div>
      </header>

      {/* 🎯 Daily Mission Dashboard Widget */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm mb-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 shadow-xs text-xl font-bold">
              🎯
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
                  ? `Target: ${dailyMission.selectedVideos.length > 0 ? dailyMission.selectedVideos.map(v => `Bab ${v.bab} Part ${v.videoNum}`).join(', ') : 'Tanpa Video'} (${missionProgress?.targetReplays}x Replays) ${dailyMission.targetQuizCount > 0 ? `• ${dailyMission.targetQuizCount} Kuis` : ''} ${dailyMission.targetKotobaCount > 0 ? `• ${dailyMission.targetKotobaCount} Kotoba` : ''}`
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Render EACH selected video as a separate 1-click card */}
            {dailyMission.selectedVideos.length > 0 ? (
              dailyMission.selectedVideos.map((v, idx) => {
                const count = videoProgressMap.get(v.id) || 0
                const isVidDone = count >= 3
                return (
                  <button
                    key={v.id || idx}
                    onClick={() => navigate(`/my-courses?jilid=${v.jilid}&bab=${v.bab}&item=${v.videoNum}`)}
                    className={`p-4 rounded-2xl border text-left cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md group flex flex-col justify-between ${
                      isVidDone
                        ? 'bg-emerald-50/90 border-emerald-200 hover:border-emerald-400'
                        : 'bg-slate-50 border-slate-200 hover:border-primary'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-800 mb-1">
                        <span className="truncate pr-1 group-hover:text-primary transition-colors">
                          🎥 Jilid {v.jilid} · Bab {v.bab} (Part {v.videoNum})
                        </span>
                        <span className={isVidDone ? 'text-emerald-700 font-extrabold shrink-0' : 'text-primary font-bold shrink-0'}>
                          {count}/3x
                        </span>
                      </div>
                      <p className="text-[0.68rem] text-slate-400 mb-2 truncate">
                        {v.title}
                      </p>
                    </div>

                    <div>
                      <div className="h-2 bg-slate-200/80 rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (count / 3) * 100)}%` }}
                        />
                      </div>
                      <div className="text-[0.65rem] font-extrabold text-primary group-hover:underline flex items-center justify-between">
                        <span>▶ Tonton Video Ini</span>
                        <span>→</span>
                      </div>
                    </div>
                  </button>
                )
              })
            ) : (
              /* No video plan card */
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 text-slate-400 text-xs flex flex-col justify-center">
                <span className="font-bold">🎥 Rencana Video</span>
                <span className="text-[0.68rem]">Tidak ada video yang direncanakan</span>
              </div>
            )}

            {/* Target Kuis Card */}
            {dailyMission.targetQuizCount > 0 ? (
              <button
                onClick={() => {
                  const targetBab = dailyMission.selectedVideos[0]?.bab || 1
                  const targetJilid = dailyMission.selectedVideos[0]?.jilid || 1
                  navigate(`/my-courses?jilid=${targetJilid}&bab=${targetBab}&item=4`)
                }}
                className={`p-4 rounded-2xl border text-left cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md group flex flex-col justify-between ${
                  missionProgress.quizCompleted
                    ? 'bg-emerald-50/90 border-emerald-200 hover:border-emerald-400'
                    : 'bg-slate-50 border-slate-200 hover:border-indigo-500'
                }`}
              >
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-800 mb-1">
                    <span className="group-hover:text-indigo-600 transition-colors">🎯 Kuis Evaluasi Bab</span>
                    <span className={missionProgress.quizCompleted ? 'text-emerald-700 font-extrabold' : 'text-indigo-600 font-bold'}>
                      {missionProgress.actualQuizzes}/{missionProgress.targetQuizzes}
                    </span>
                  </div>
                  <p className="text-[0.68rem] text-slate-400 mb-2">
                    Target: {missionProgress.targetQuizzes} kuis selesai
                  </p>
                </div>

                <div>
                  <div className="h-2 bg-slate-200/80 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (missionProgress.actualQuizzes / missionProgress.targetQuizzes) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[0.65rem] font-extrabold text-indigo-600 group-hover:underline flex items-center justify-between">
                    <span>🎯 Kerjakan Kuis Evaluasi</span>
                    <span>→</span>
                  </div>
                </div>
              </button>
            ) : (
              /* No quiz plan card */
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-400 text-xs flex flex-col justify-center min-h-[100px]">
                <div>
                  <div className="font-extrabold text-slate-700 dark:text-slate-200 text-xs mb-1">🎯 Kuis Evaluasi Bab</div>
                  <p className="text-[0.68rem] text-slate-400">Tidak ada kuis yang direncanakan</p>
                </div>
              </div>
            )}

            {/* Target Kotoba Card */}
            {dailyMission.targetKotobaCount > 0 ? (
              <button
                onClick={() => navigate('/kotoba')}
                className={`p-4 rounded-2xl border text-left cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md group flex flex-col justify-between ${
                  missionProgress.kotobaCompleted
                    ? 'bg-emerald-50/90 border-emerald-200 hover:border-emerald-400'
                    : 'bg-slate-50 border-slate-200 hover:border-amber-500'
                }`}
              >
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-800 mb-1">
                    <span className="group-hover:text-amber-600 transition-colors">🔤 Setoran Kotoba</span>
                    <span className={missionProgress.kotobaCompleted ? 'text-emerald-700 font-extrabold' : 'text-amber-600 font-bold'}>
                      {missionProgress.actualKotoba}/{missionProgress.targetKotoba}
                    </span>
                  </div>
                  <p className="text-[0.68rem] text-slate-400 mb-2">
                    Target: {missionProgress.targetKotoba} setoran selesai
                  </p>
                </div>

                <div>
                  <div className="h-2 bg-slate-200/80 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (missionProgress.actualKotoba / missionProgress.targetKotoba) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[0.65rem] font-extrabold text-amber-600 group-hover:underline flex items-center justify-between">
                    <span>🔤 Buka Setoran Kotoba</span>
                    <span>→</span>
                  </div>
                </div>
              </button>
            ) : (
              /* No kotoba plan card */
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-400 text-xs flex flex-col justify-center min-h-[100px]">
                <div>
                  <div className="font-extrabold text-slate-700 dark:text-slate-200 text-xs mb-1">🔤 Setoran Kotoba</div>
                  <p className="text-[0.68rem] text-slate-400">Tidak ada kotoba yang direncanakan</p>
                </div>
              </div>
            )}
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

      {/* Student View: Streak & Embedded Schedule Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-5 mb-6 items-stretch">
        {/* Streak Card & Updated Quick Shortcuts */}
        <div className="flex flex-col gap-5">
          <StreakCard streakDays={stats.streakDays} history={streakHistory} />

          <div className="grid grid-cols-2 gap-3">
            {/* Shortcut 1: Jurnal Kosakata (Kotoba) */}
            <button
              onClick={() => navigate('/kotoba')}
              className="bg-amber-500 text-white rounded-2xl p-4 sm:p-5 flex items-center gap-3 shadow-md cursor-pointer border-none transition-all hover:-translate-y-1 hover:shadow-xl text-left group"
            >
              <span className="size-10 sm:size-11 rounded-2xl bg-amber-600/30 border border-amber-300/40 text-amber-100 flex items-center justify-center font-black text-xl shrink-0 font-serif shadow-xs">
                語
              </span>
              <div className="min-w-0">
                <div className="text-sm sm:text-base font-extrabold leading-tight">Jurnal Kosakata</div>
                <div className="text-white/80 text-xs mt-0.5">Catatan Kotoba</div>
              </div>
              <span className="ml-auto text-white/70 text-base shrink-0 group-hover:translate-x-1 transition-transform">→</span>
            </button>

            {/* Shortcut 2: Reservasi Kelas */}
            <button
              onClick={() => navigate('/reservasi-kelas')}
              className="bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 rounded-2xl p-4 sm:p-5 flex items-center gap-3 shadow-sm border border-slate-200 dark:border-slate-800 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md hover:border-sky-500 text-left group"
            >
              <span className="size-10 sm:size-11 rounded-2xl bg-sky-500/10 dark:bg-sky-400/20 border border-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center text-xl shrink-0 shadow-xs">
                💻
              </span>
              <div className="min-w-0">
                <div className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-white leading-tight">Reservasi Kelas</div>
                <div className="text-slate-400 text-xs mt-0.5">Live & Offline</div>
              </div>
              <span className="ml-auto text-slate-300 text-base shrink-0 group-hover:translate-x-1 transition-transform">→</span>
            </button>
          </div>
        </div>

        {/* Embedded Schedule View Card (Replaces Recent Watch) */}
        <div className="h-full">
          <EmbeddedUserScheduleCard userId={user?.id || ''} />
        </div>
      </div>

      {/* Progress Preview for Minna no Nihongo Jilid 1 & 2 */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white">📖 {t('dash_book_progress_title', 'Progress Belajar Buku')}</h2>
            <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">{t('dash_book_progress_sub', 'Minna no Nihongo Jilid 1 & 2 (Bab 1 - 50)')}</p>
          </div>
          <button
            onClick={() => navigate('/my-courses')}
            className="text-primary dark:text-red-400 text-xs sm:text-sm font-bold bg-transparent border-none cursor-pointer hover:underline"
          >
            {t('dash_open_course_btn', 'Buka Kursus →')}
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
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">Minna no Nihongo {t('dash_jilid_1_title', 'Jilid 1 (Dasar I)')}</h3>
                  <span className="text-[0.75rem] font-medium text-slate-500 dark:text-slate-300">{t('dash_jilid_1_desc', 'Bab 1 s/d Bab 25 • 125 Video Materi')}</span>
                </div>
              </div>
              <span className="text-sm font-black text-primary dark:text-red-400 bg-primary/10 dark:bg-primary/20 px-2.5 py-1 rounded-xl">
                {bookProgress.jilid1Pct}%
              </span>
            </div>

            <div>
              <div className="flex justify-between text-[0.7rem] text-slate-500 dark:text-slate-300 font-semibold mb-1">
                <span>Pencapaian: {bookProgress.jilid1DoneItems}/125 {t('completed', 'Selesai')}</span>
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
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">Minna no Nihongo {t('dash_jilid_2_title', 'Jilid 2 (Dasar II)')}</h3>
                  <span className="text-[0.75rem] font-medium text-slate-500 dark:text-slate-300">{t('dash_jilid_2_desc', 'Bab 26 s/d Bab 50 • 125 Video Materi')}</span>
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
