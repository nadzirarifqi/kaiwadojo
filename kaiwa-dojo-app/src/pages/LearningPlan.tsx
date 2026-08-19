import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import {
  type DailyMissionData,
  type SelectedVideoItem,
  type MissionProgress,
  getDailyMission,
  saveDailyMission,
  calculateMissionProgress,
  getTodayDateString
} from '../lib/dailyMission'

import AdaptiveIcon from '../components/AdaptiveIcon'
import {
  type ClassSchedule,
  type ClassReservation,
  fetchSchedules,
  fetchReservations,
  bookClass,
  cancelClassBooking,
  calculateDateScheduleStatus,
  getWeekRangeId,
  getMonthRangeId,
} from '../lib/scheduleService'




/* ── Date & Month Helpers in Indonesian ──────────────── */
const FULL_DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]
const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

export function formatDateIndonesian(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const dateObj = new Date(y, m - 1, d)
  const dayName = FULL_DAY_NAMES[dateObj.getDay()]
  const dayNum = String(d).padStart(2, '0')
  const monthName = MONTH_NAMES[m - 1]
  return `${dayName}, ${dayNum} ${monthName} ${y}`
}

/* ── Daily Mission Builder Modal ────────────────────── */
function DailyMissionBuilderModal({
  targetDate,
  currentMission,
  onSave,
  onClose,
}: {
  targetDate: string
  currentMission: DailyMissionData | null
  onSave: (data: Omit<DailyMissionData, 'date'>, dateStr: string) => void
  onClose: () => void
}) {
  const [missionDate, setMissionDate]     = useState<string>(targetDate)
  const [selectedJilid, setSelectedJilid] = useState<1 | 2>(1)
  const [selectedBab, setSelectedBab]     = useState<number>(1)
  
  const [selectedVideos, setSelectedVideos] = useState<SelectedVideoItem[]>(
    currentMission?.selectedVideos || []
  )
  const [targetQuiz, setTargetQuiz]       = useState<number>(currentMission?.targetQuizCount || 1)
  const [targetKotoba, setTargetKotoba]   = useState<number>(currentMission?.targetKotobaCount || 1)

  const startBab = selectedJilid === 1 ? 1 : 26

  function toggleVideoSelection(vItem: SelectedVideoItem) {
    setSelectedVideos(prev => {
      const exists = prev.some(v => v.id === vItem.id)
      if (exists) return prev.filter(v => v.id !== vItem.id)
      return [...prev, vItem]
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selectedVideos.length === 0) {
      alert('Pilihlah minimal 1 video spesifik yang ingin kamu tonton!')
      return
    }
    onSave({
      selectedVideos,
      targetReplayCount: selectedVideos.length * 3,
      targetQuizCount: targetQuiz,
      targetKotobaCount: targetKotoba,
    }, missionDate)
  }

  const currentBabVideos: SelectedVideoItem[] = [1, 2, 3].map(vNum => ({
    id: `bab_${selectedBab}_video_${vNum}`,
    title: `Bab ${selectedBab}: Video ${vNum}`,
    jilid: selectedJilid,
    bab: selectedBab,
    videoNum: vNum,
  }))

  const totalReplayTarget = selectedVideos.length * 3

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-primary to-primary-light text-white flex items-center justify-between shrink-0">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-white/80">Susun Misi Harian</span>
            <h3 className="text-lg font-extrabold">🎯 {formatDateIndonesian(missionDate)}</h3>
          </div>
          <button onClick={onClose} className="size-9 rounded-full bg-white/20 text-white hover:bg-white/30 border-none cursor-pointer text-xl flex items-center justify-center">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 overflow-y-auto">

          {/* Target Date Selector inside Modal */}
          <div className="bg-slate-50 dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <span className="text-[0.65rem] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-400 block">Target Tanggal Misi</span>
              <span className="text-sm font-black text-slate-800 dark:text-white">{formatDateIndonesian(missionDate)}</span>
            </div>
            <input
              type="date"
              value={missionDate}
              min={getTodayDateString()}
              onChange={e => setMissionDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-white dark:bg-slate-900 dark:text-white outline-none focus:border-primary cursor-pointer"
            />
          </div>

          {/* Step 1: Pilih Video Spesifik */}
          <div>
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 block mb-2">
              1. Pilih Video yang Ingin Ditonton *
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              💡 <strong>Aturan Pengulangan:</strong> Setiap 1 video yang dicentang = <strong>3 kali target pengulangan</strong> (misal 2 video = 6 kali pengulangan total).
            </p>

            {/* Jilid & Bab Selector */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 block mb-1">Pilih Jilid Buku</label>
                <select
                  value={selectedJilid}
                  onChange={e => {
                    const j = Number(e.target.value) as 1 | 2
                    setSelectedJilid(j)
                    setSelectedBab(j === 1 ? 1 : 26)
                  }}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                >
                  <option value={1}>📘 Jilid 1 (Bab 1 - 25)</option>
                  <option value={2}>📗 Jilid 2 (Bab 26 - 50)</option>
                </select>
              </div>

              <div>
                <label className="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 block mb-1">Pilih Bab</label>
                <select
                  value={selectedBab}
                  onChange={e => setSelectedBab(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                >
                  {Array.from({ length: 25 }, (_, i) => startBab + i).map(b => (
                    <option key={b} value={b}>Bab {b}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Checkbox List for 3 Videos in Selected Bab */}
            <div className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-[0.7rem] font-bold text-slate-400 uppercase">Daftar Video Bab {selectedBab}:</span>
              {currentBabVideos.map(vItem => {
                const isChecked = selectedVideos.some(v => v.id === vItem.id)
                return (
                  <label
                    key={vItem.id}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-primary/10 dark:bg-primary/20 border-primary text-primary dark:text-red-400 font-bold shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 text-xs">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleVideoSelection(vItem)}
                        className="size-4 accent-primary cursor-pointer"
                      />
                      <span>🎥 {vItem.title}</span>
                    </div>
                    <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      +3 Replays Target
                    </span>
                  </label>
                )
              })}
            </div>

            {/* Selected Summary Badge */}
            {selectedVideos.length > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300">
                <span>📹 {selectedVideos.length} Video Dipilih</span>
                <span className="bg-amber-500 text-white px-2.5 py-1 rounded-lg">
                  Target = {totalReplayTarget}x Total Pengulangan Video
                </span>
              </div>
            )}
          </div>

          {/* Step 2 & 3: Target Kuis & Kotoba */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 block mb-1.5">
                2. Target Kuis
              </label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setTargetQuiz(q => Math.max(0, q - 1))} className="size-9 rounded-xl bg-slate-100 dark:bg-slate-800 font-black text-slate-600 dark:text-slate-300 border-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700">−</button>
                <span className="flex-1 text-center text-lg font-black text-indigo-600 dark:text-indigo-400">{targetQuiz} Kuis</span>
                <button type="button" onClick={() => setTargetQuiz(q => Math.min(10, q + 1))} className="size-9 rounded-xl bg-slate-100 dark:bg-slate-800 font-black text-slate-600 dark:text-slate-300 border-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700">+</button>
              </div>
            </div>

            <div>
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 block mb-1.5">
                3. Target Setoran Kotoba
              </label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setTargetKotoba(k => Math.max(0, k - 1))} className="size-9 rounded-xl bg-slate-100 dark:bg-slate-800 font-black text-slate-600 dark:text-slate-300 border-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700">−</button>
                <span className="flex-1 text-center text-lg font-black text-amber-600 dark:text-amber-400">{targetKotoba} Setoran</span>
                <button type="button" onClick={() => setTargetKotoba(k => Math.min(10, k + 1))} className="size-9 rounded-xl bg-slate-100 dark:bg-slate-800 font-black text-slate-600 dark:text-slate-300 border-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700">+</button>
              </div>
            </div>
          </div>

          {/* Submit CTA */}
          <button
            type="submit"
            className="w-full py-3.5 bg-gradient-to-r from-primary to-primary-light text-white font-extrabold rounded-2xl border-none cursor-pointer text-sm shadow-md transition-all hover:-translate-y-0.5 mt-2"
          >
            🚀 Simpan Misi Tanggal Ini
          </button>
        </form>
      </div>
    </div>
  )
}

/* ── Main LearningPlan Page ─────────────────────── */
/* ── Date Class Enroll Modal ────────────────────── */
function DateClassEnrollModal({
  dateStr,
  schedules,
  reservations,
  userId,
  userName,
  userEmail,
  onClose,
  onRefresh,
  onOpenMissionBuilder,
}: {
  dateStr: string
  schedules: ClassSchedule[]
  reservations: ClassReservation[]
  userId: string
  userName: string
  userEmail: string
  onClose: () => void
  onRefresh: () => Promise<void>
  onOpenMissionBuilder: () => void
}) {
  const daySchedules = schedules.filter(s => s.date === dateStr)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  function showToast(text: string, type: 'success' | 'error' = 'success') {
    setToast({ text, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleBook(sch: ClassSchedule) {
    setLoadingId(sch.id)
    const res = await bookClass(sch, userId, userName, userEmail)
    setLoadingId(null)
    if (res.success) {
      showToast(`Berhasil mendaftar di kelas "${sch.title}"!`)
      await onRefresh()
    } else {
      showToast(res.message, 'error')
    }
  }

  async function handleCancel(resId: string) {
    setLoadingId(resId)
    const ok = await cancelClassBooking(resId)
    setLoadingId(null)
    if (ok) {
      showToast('Reservasi kelas berhasil dibatalkan.')
      await onRefresh()
    } else {
      showToast('Gagal membatalkan reservasi.', 'error')
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800">
        
        {/* Toast inside modal */}
        {toast && (
          <div className={`p-3 text-xs font-bold text-center text-white ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
            {toast.text}
          </div>
        )}

        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-sky-600 to-primary text-white flex items-center justify-between shrink-0">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-white/80">Jadwal Kelas & Reservasi</span>
            <h3 className="text-lg font-black text-white">📅 {formatDateIndonesian(dateStr)}</h3>
          </div>
          <button onClick={onClose} className="size-9 rounded-full bg-white/20 text-white hover:bg-white/30 border-none cursor-pointer text-xl flex items-center justify-center">×</button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Sesi Kelas Live Tersedia ({daySchedules.length})
            </span>
            <button
              onClick={() => {
                onClose()
                onOpenMissionBuilder()
              }}
              className="text-xs font-extrabold text-primary dark:text-red-400 hover:underline bg-transparent border-none cursor-pointer"
            >
              + Susun Target Misi Mandiri
            </button>
          </div>

          {daySchedules.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center gap-2">
              <span className="text-3xl">🗓️</span>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Tidak ada sesi kelas live untuk tanggal ini.</p>
              <p className="text-[0.75rem] text-slate-400">Anda dapat menyusun target belajar mandiri atau memilih tanggal lain yang memiliki strip biru di kalender.</p>
              <button
                onClick={() => {
                  onClose()
                  onOpenMissionBuilder()
                }}
                className="mt-2 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl border-none cursor-pointer"
              >
                + Susun Misi Belajar Mandiri
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {daySchedules.map(sch => {
                const enrolledCount = reservations.filter(r => r.schedule_id === sch.id).length
                const userRes = reservations.find(r => r.schedule_id === sch.id && r.user_id === userId)
                const isFull = enrolledCount >= sch.max_quota

                // Check conflict
                let isLocked = false
                let lockReason = ''

                if (!userRes && !isFull) {
                  if (sch.type === 'online') {
                    const hasWeeklyOnline = reservations.some(r => {
                      if (r.user_id !== userId) return false
                      const targetSch = schedules.find(s => s.id === r.schedule_id)
                      return targetSch && targetSch.type === 'online' && targetSch.week_range_id === sch.week_range_id
                    })
                    if (hasWeeklyOnline) {
                      isLocked = true
                      lockReason = 'Sudah Reservasi Minggu Ini'
                    }
                  } else {
                    const hasMonthlyOffline = reservations.some(r => {
                      if (r.user_id !== userId) return false
                      const targetSch = schedules.find(s => s.id === r.schedule_id)
                      return targetSch && targetSch.type === 'offline' && targetSch.month_range_id === sch.month_range_id
                    })
                    if (hasMonthlyOffline) {
                      isLocked = true
                      lockReason = 'Sudah Reservasi Bulan Ini'
                    }
                  }
                }

                return (
                  <div
                    key={sch.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col gap-2 ${
                      userRes
                        ? 'bg-sky-50/60 dark:bg-sky-950/40 border-sky-300 dark:border-sky-700'
                        : isLocked || isFull
                          ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[0.68rem] font-black uppercase ${
                        sch.type === 'online'
                          ? 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300'
                          : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      }`}>
                        {sch.type === 'online' ? '💻 ONLINE (G-Meet)' : '🏢 OFFLINE (Dojo)'}
                      </span>

                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        👥 {enrolledCount}/{sch.max_quota} Orang
                      </span>
                    </div>

                    <h4 className="text-sm font-extrabold text-slate-800 dark:text-white leading-snug">
                      {sch.title}
                    </h4>
                    <p className="text-xs font-bold text-primary dark:text-red-400">
                      {sch.subtitle_chapter}
                    </p>

                    <div className="text-[0.75rem] text-slate-600 dark:text-slate-300 space-y-1 font-medium pt-1">
                      <div>⏰ {sch.start_time} - {sch.end_time} WIB</div>
                      <div>👨‍🏫 Instruktur: <strong>{sch.instructor_name}</strong></div>
                      {sch.type === 'online' ? (
                        <div className="text-sky-600 dark:text-sky-400 font-bold truncate">🔗 Google Meet Sesi Live</div>
                      ) : (
                        <div className="text-emerald-600 dark:text-emerald-400 font-bold truncate">📍 {sch.location || 'Lokasi Dojo'}</div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      {userRes ? (
                        <div className="flex items-center gap-2">
                          <span className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 text-white font-extrabold text-xs text-center">
                            ✅ Terdaftar
                          </span>
                          <button
                            disabled={loadingId === userRes.id}
                            onClick={() => handleCancel(userRes.id)}
                            className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 font-bold text-xs border-none cursor-pointer"
                          >
                            {loadingId === userRes.id ? '...' : 'Batalkan'}
                          </button>
                        </div>
                      ) : isFull ? (
                        <button disabled className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold text-xs border-none cursor-not-allowed">
                          🚫 Kuota Penuh (10/10)
                        </button>
                      ) : isLocked ? (
                        <button disabled className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold text-xs border-none cursor-not-allowed">
                          🔒 {lockReason}
                        </button>
                      ) : (
                        <button
                          disabled={loadingId === sch.id}
                          onClick={() => handleBook(sch)}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-primary hover:from-sky-700 hover:to-primary-dark text-white font-extrabold text-xs border-none cursor-pointer transition-all shadow-md"
                        >
                          {loadingId === sch.id ? 'Memproses...' : '+ Reservasi Kelas Tanggal Ini'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatDayNameShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
  return dayNames[date.getDay()]
}

export default function LearningPlanPage() {

  const { user, profile } = useAuth()

  // Calendar State
  const todayStr = getTodayDateString()
  const [viewMode, setViewMode]                 = useState<'calendar' | 'schedule'>('calendar')
  const [showOnlyActivities, setShowOnlyActivities] = useState(true)
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date())
  const [selectedDateStr, setSelectedDateStr]   = useState<string>(todayStr)

  // Accordion State for Schedule View
  const [expandedDates, setExpandedDates]       = useState<Set<string>>(new Set([todayStr]))

  const toggleDateExpand = (dateStr: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev)
      if (next.has(dateStr)) next.delete(dateStr)
      else next.add(dateStr)
      return next
    })
  }






  // Daily Mission State
  const [selectedMission, setSelectedMission]   = useState<DailyMissionData | null>(null)
  const [missionProgress, setMissionProgress] = useState<MissionProgress | null>(null)
  const [showMissionModal, setShowMissionModal] = useState(false)
  const [showClassModal, setShowClassModal]     = useState(false)

  // Streak & Past Completion sets
  const [streakSet, setStreakSet] = useState<Set<string>>(new Set())
  const [pastCompletedSet, setPastCompletedSet] = useState<Set<string>>(new Set())

  // Class Schedules & Reservations State for Calendar Visual Indicators
  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [reservations, setReservations] = useState<ClassReservation[]>([])

  async function reloadSchedules() {
    const [sData, rData] = await Promise.all([fetchSchedules(), fetchReservations()])
    setSchedules(sData)
    setReservations(rData)
  }

  useEffect(() => {
    reloadSchedules()
  }, [selectedDateStr, currentMonthDate])


  useEffect(() => {
    if (!user) return
    loadData()
  }, [user, selectedDateStr, currentMonthDate])


  async function loadData() {
    if (!user) return

    // 1. Fetch user's streaks from Supabase
    const { data: streaksData } = await supabase
      .from('learning_streaks')
      .select('date')
      .eq('student_id', user.id)

    const streakDates = new Set((streaksData || []).map((s: any) => s.date))
    setStreakSet(streakDates)

    // 2. Compute past missions progress for the displayed month
    const year = currentMonthDate.getFullYear()
    const month = currentMonthDate.getMonth()
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate()
    const completedSet = new Set<string>()

    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dObj = new Date(year, month, d)
      const dStr = dObj.toISOString().split('T')[0]
      if (dStr < todayStr) {
        if (streakDates.has(dStr)) {
          completedSet.add(dStr)
        } else {
          const m = getDailyMission(user.id, dStr)
          if (m) {
            const prog = await calculateMissionProgress(user.id, m)
            if (prog.isFullyCompleted) {
              completedSet.add(dStr)
            }
          }
        }
      }
    }
    setPastCompletedSet(completedSet)

    // 3. Load mission for selected date
    const mission = getDailyMission(user.id, selectedDateStr)
    setSelectedMission(mission)

    if (mission) {
      const prog = await calculateMissionProgress(user.id, mission)
      setMissionProgress(prog)
    } else {
      setMissionProgress(null)
    }
  }

  async function handleSaveMission(data: Omit<DailyMissionData, 'date'>, dateStr: string) {
    if (!user) return
    const saved = saveDailyMission(user.id, data, dateStr)
    setSelectedDateStr(dateStr)
    setSelectedMission(saved)
    const prog = await calculateMissionProgress(user.id, saved)
    setMissionProgress(prog)
    setShowMissionModal(false)
    loadData()
  }

  /* ── Calendar Grid Calculations ──────────────────── */
  const year  = currentMonthDate.getFullYear()
  const month = currentMonthDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth     = new Date(year, month + 1, 0).getDate()

  function changeMonth(delta: number) {
    setCurrentMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }

  function handleTodayClick() {
    setSelectedDateStr(todayStr)
    setCurrentMonthDate(new Date())
  }

  // Days list to render for current month (with optional filter for Schedule View)
  const allMonthDays = Array.from({ length: daysInMonth }).map((_, i) => {
    const dayNum = i + 1
    const formattedMonth = String(month + 1).padStart(2, '0')
    const formattedDay   = String(dayNum).padStart(2, '0')
    return {
      dayNum,
      dateStr: `${year}-${formattedMonth}-${formattedDay}`,
    }
  })

  const daysToRender = (viewMode === 'schedule' && showOnlyActivities)
    ? allMonthDays.filter(item => {
        const activeUserId = profile?.id || user?.id || 'user-demo-active'
        const status = calculateDateScheduleStatus(item.dateStr, activeUserId, schedules, reservations)
        const mission = user ? getDailyMission(user.id, item.dateStr) : null
        return status.hasSchedule || mission !== null
      })
    : allMonthDays

  const isSelectedDatePast = selectedDateStr < todayStr

  return (
    <main className="flex-1 p-3 sm:p-6 lg:p-8 min-w-0 overflow-x-clip animate-fade-in">
      {/* Header */}

      <div className="mb-4 sm:mb-6 animate-fade-in-up flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight mb-1 flex items-center gap-2">
            <AdaptiveIcon src="/calendar.png" alt="Kalender" className="size-7 sm:size-8 object-contain shrink-0" />
            <span>Rencana Belajar & Kalender Misi</span>
          </h1>
          <p className="text-xs sm:text-base text-slate-500 dark:text-slate-400">
            Klik pada tanggal di kalender untuk menyusun misi harian atau melihat arsip pembelajaran
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedDateStr(todayStr)
            setShowMissionModal(true)
          }}
          className="w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white text-xs sm:text-sm font-extrabold rounded-2xl border-none cursor-pointer transition-all shadow-md shrink-0 flex items-center justify-center gap-2"
        >
          <AdaptiveIcon src="/target.png" alt="Target Misi" className="size-4.5 object-contain shrink-0" />
          <span>+ Susun Misi Hari Ini</span>
        </button>
      </div>

      {/* Comprehensive Quick Feature & Section Guide Banner */}
      <div className="mb-5 bg-gradient-to-r from-sky-500/10 via-emerald-500/10 to-amber-500/10 dark:from-sky-950/40 dark:via-emerald-950/40 dark:to-amber-950/40 p-4 sm:p-5 rounded-3xl border border-sky-200/60 dark:border-sky-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 flex-1">
          <div className="size-10 sm:size-12 rounded-2xl bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-xl shrink-0 shadow-xs">
            💡
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-white">
              Panduan Praktis Rencana Belajar & Reservasi Kelas Live
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
              Gunakan mode <strong>📅 Kalender Grid</strong> untuk melihat ringkasan status bulanan, atau mode <strong>📋 Agenda Schedule</strong> untuk menyusuri linimasa harian lengkap dengan link Zoom, lokasi dojo, materi bab, dan sisa kuota. Klik tanggal mana pun untuk menyusun target video harian.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto">
          <span className="text-xs font-black bg-sky-600 text-white px-3.5 py-2 rounded-xl shadow-2xs flex items-center justify-center sm:justify-start gap-1.5 whitespace-nowrap">
            💻 Kelas Online (Batas 1 Sesi/Minggu)
          </span>
          <span className="text-xs font-black bg-emerald-600 text-white px-3.5 py-2 rounded-xl shadow-2xs flex items-center justify-center sm:justify-start gap-1.5 whitespace-nowrap">
            🏢 Kelas Offline (Batas 1 Sesi/Bulan)
          </span>
        </div>
      </div>

      {/* Main Grid: Left Big Calendar | Right Date Mission Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_340px] 2xl:grid-cols-[1fr_360px] gap-4 sm:gap-6 items-start">

        {/* Left Column: Big Interactive Calendar */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-3 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4 sm:gap-5 min-w-0">
          {/* Calendar Header / Month Nav & View Mode Switcher */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AdaptiveIcon src="/calendar.png" alt="Kalender" className="size-5 sm:size-6 object-contain shrink-0" />
              <h2 className="text-base sm:text-xl font-extrabold text-slate-800 dark:text-white">
                {MONTH_NAMES[month]} {year}
              </h2>
            </div>

            <div className="flex flex-wrap items-center justify-between md:justify-end gap-2 w-full md:w-auto">
              {/* Segmented View Mode Toggle: Kalender vs Agenda Schedule */}
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer border-none flex items-center gap-1 ${
                    viewMode === 'calendar'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  <span>📅</span>
                  <span>Kalender</span>
                </button>
                <button
                  onClick={() => setViewMode('schedule')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer border-none flex items-center gap-1 ${
                    viewMode === 'schedule'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  <span>📋</span>
                  <span>Agenda Schedule</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleTodayClick}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border-none cursor-pointer transition-all"
                >
                  Hari Ini
                </button>
                <button
                  onClick={() => changeMonth(-1)}
                  className="size-8 sm:size-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold border-none cursor-pointer flex items-center justify-center text-xs sm:text-sm"
                >
                  ◄
                </button>
                <button
                  onClick={() => changeMonth(1)}
                  className="size-8 sm:size-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold border-none cursor-pointer flex items-center justify-center text-xs sm:text-sm"
                >
                  ►
                </button>
              </div>
            </div>
          </div>

          {/* Conditional View Rendering: Schedule Feed vs Calendar Grid */}
          {viewMode === 'schedule' ? (
            /* Google Calendar Style Agenda Schedule View (Vertical Scroll Timeline Feed) */
            <div className="flex flex-col gap-3">
              {/* Filter Sub-Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 dark:bg-slate-950 p-2.5 sm:p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span>📋</span>
                  <span>Agenda Jadwal Pembelajaran & Kelas Live</span>
                </span>
                <button
                  onClick={() => setShowOnlyActivities(prev => !prev)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border-none flex items-center gap-1.5 shrink-0 ${
                    showOnlyActivities
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>⚡</span>
                  <span>{showOnlyActivities ? 'Hanya Hari Beragenda' : 'Tampilkan Semua Tanggal'}</span>
                </button>
              </div>

              <div className="flex flex-col gap-3 max-h-[720px] overflow-y-auto p-1 pr-2">
                {daysToRender.map(item => {
                  const { dayNum, dateStr } = item
                  const isToday = dateStr === todayStr
                  const isPast = dateStr < todayStr
                  const isSelected = dateStr === selectedDateStr
                  const isPassed = streakSet.has(dateStr) || pastCompletedSet.has(dateStr)
                  const isExpanded = expandedDates.has(dateStr)

                  const dateMission = user ? getDailyMission(user.id, dateStr) : null
                  const hasPlan = dateMission !== null

                  const activeUserId = profile?.id || user?.id || 'user-demo-active'
                  const dateStatus = calculateDateScheduleStatus(dateStr, activeUserId, schedules, reservations)
                  const daySchedules = dateStatus.schedules || []
                  const hasActivity = daySchedules.length > 0 || dateMission !== null
                  const isDateLocked = dateStatus.hasSchedule && !dateStatus.canEnroll && !dateStatus.isBooked

                  const stampSrc = isPassed
                    ? '/lulus.png'
                    : hasPlan
                      ? '/gagal.png'
                      : '/kosong.png'

                  const stampAlt = isPassed
                    ? 'Lulus (100%)'
                    : hasPlan
                      ? 'Gagal (Tidak Selesai)'
                      : 'Kosong (Tidak Ada Rencana)'

                  let cardBorderAccent = 'border-l-4 border-l-transparent'

                  if (dateStatus.isOnlineBooked && dateStatus.isOfflineBooked) {
                    cardBorderAccent = 'border-l-4 border-l-indigo-500'
                  } else if (dateStatus.isOnlineBooked) {
                    cardBorderAccent = 'border-l-4 border-l-sky-500'
                  } else if (dateStatus.isOfflineBooked) {
                    cardBorderAccent = 'border-l-4 border-l-emerald-500'
                  } else if (isDateLocked) {
                    cardBorderAccent = 'border-l-4 border-l-amber-500'
                  } else if (isToday) {
                    cardBorderAccent = 'border-l-4 border-l-amber-400'
                  }

                  return (
                    <div
                      key={dateStr}
                      className={`rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all flex flex-col relative shadow-2xs hover:shadow-xs ${cardBorderAccent}`}
                    >
                      {/* Minimalist Accordion Header Row */}
                      <div
                        onClick={() => {
                          setSelectedDateStr(dateStr)
                          toggleDateExpand(dateStr)
                        }}
                        className="p-3.5 sm:p-4 cursor-pointer flex items-center justify-between gap-3 select-none hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors rounded-2xl"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Compact Date Pill */}
                          <div className={`size-10 sm:size-11 rounded-xl flex flex-col items-center justify-center font-bold shrink-0 ${
                            isToday ? 'bg-amber-500 text-white shadow-2xs' : isSelected ? 'bg-primary text-white shadow-2xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                          }`}>
                            <span className="text-[0.6rem] leading-none uppercase tracking-wider">{formatDayNameShort(dateStr)}</span>
                            <span className="text-base font-extrabold leading-tight mt-0.5">{dayNum}</span>
                          </div>

                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-white">
                                {formatDateIndonesian(dateStr)}
                              </h4>
                              {isToday && (
                                <span className="text-[0.68rem] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 px-2 py-0.2 rounded-full border border-amber-300/60">
                                  Hari Ini
                                </span>
                              )}
                            </div>

                            {/* Minimalist Summary Badges */}
                            <div className="text-[0.72rem] text-slate-500 dark:text-slate-400 font-medium mt-0.5 flex flex-wrap items-center gap-1.5">
                              {daySchedules.length > 0 && (
                                <span className="px-2 py-0.2 rounded-md bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-bold border border-sky-200 dark:border-sky-800">
                                  💻 {daySchedules.length} Kelas Live
                                </span>
                              )}
                              {dateMission && (
                                <span className="px-2 py-0.2 rounded-md bg-primary/5 dark:bg-primary/20 text-primary dark:text-red-300 font-semibold border border-primary/20">
                                  🎯 {dateMission.selectedVideos.length} Video Misi
                                </span>
                              )}
                              {!daySchedules.length && !dateMission && (
                                <span className="text-slate-400 italic">Belum ada agenda</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Minimalist Right Action Group */}
                        <div className="flex items-center gap-2.5 shrink-0">
                          {/* Minimalist Hanko Stamp Badge for Past Dates */}
                          {isPast && (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70">
                              <img
                                src={stampSrc}
                                alt={stampAlt}
                                className="size-6 object-contain shrink-0 rotate-[-6deg]"
                              />
                              <span className="text-[0.68rem] font-semibold text-slate-600 dark:text-slate-300 hidden xs:inline">
                                {isPassed ? 'Lulus 100%' : hasPlan ? 'Belum Tuntas' : 'Tanpa Rencana'}
                              </span>
                            </div>
                          )}

                          <button
                            type="button"
                            className={`size-8 rounded-xl flex items-center justify-center text-xs font-bold transition-colors cursor-pointer border-none ${
                              isExpanded
                                ? 'bg-primary text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            <span>{isExpanded ? '▲' : '▼'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Minimalist Expanded Accordion Content */}
                      {isExpanded && (
                        <div className="p-3.5 sm:p-4 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-col gap-3 bg-slate-50/40 dark:bg-slate-950/30 rounded-b-2xl animate-fade-in">
                          {/* Sleek Quick Action Bar */}
                          <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs">
                            <span className="font-semibold text-slate-600 dark:text-slate-400">⚡ Aksi Tanggal Ini:</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedDateStr(dateStr)
                                  setShowMissionModal(true)
                                }}
                                className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs font-bold border-none cursor-pointer transition-all flex items-center gap-1 shadow-2xs"
                              >
                                🎯 + Misi Mandiri
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedDateStr(dateStr)
                                  setShowClassModal(true)
                                }}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white text-xs font-bold border-none cursor-pointer transition-all flex items-center gap-1 shadow-2xs"
                              >
                                💻 + Kelas Live
                              </button>
                            </div>
                          </div>

                          {/* Live Class Sessions */}
                          {daySchedules.length > 0 && (
                            <div className="flex flex-col gap-2">
                              <span className="text-[0.72rem] font-bold text-slate-500 uppercase tracking-wider">Kelas Live ({daySchedules.length}):</span>
                              {daySchedules.map(sch => {
                                const isUserEnrolled = reservations.some(r => r.schedule_id === sch.id && r.user_id === activeUserId)
                                const enrolledCount = reservations.filter(r => r.schedule_id === sch.id).length
                                const isFull = enrolledCount >= sch.max_quota
                                const isLockedByWeekRule = !isUserEnrolled && isDateLocked && dateStatus.lockReason === 'week_locked'

                                return (
                                  <div
                                    key={sch.id}
                                    className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                                  >
                                    <div className="flex items-start gap-2.5 min-w-0">
                                      <span className="text-xl shrink-0 mt-0.5">{sch.type === 'online' ? '💻' : '🏢'}</span>
                                      <div className="flex flex-col min-w-0 gap-0.5">
                                        <div className="font-extrabold text-slate-800 dark:text-slate-100 flex flex-wrap items-center gap-1.5">
                                          <span>{sch.title}</span>
                                          <span className="text-[0.68rem] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.2 rounded">
                                            ⏰ {sch.start_time} WIB
                                          </span>
                                        </div>
                                        {sch.subtitle_chapter && (
                                          <p className="text-[0.7rem] font-semibold text-primary dark:text-red-400">
                                            📖 {sch.subtitle_chapter}
                                          </p>
                                        )}
                                        <div className="text-[0.68rem] text-slate-500 flex flex-wrap items-center gap-2">
                                          <span>👨‍🏫 {sch.instructor_name}</span>
                                          <span>•</span>
                                          <span>👥 {enrolledCount}/{sch.max_quota} Siswa</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                                      {isUserEnrolled ? (
                                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-600 text-white">
                                          ✓ Terdaftar
                                        </span>
                                      ) : isLockedByWeekRule ? (
                                        <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200">
                                          🔒 Terkunci
                                        </span>
                                      ) : isFull ? (
                                        <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-500 text-white">
                                          🟠 Penuh
                                        </span>
                                      ) : (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setSelectedDateStr(dateStr)
                                            setShowClassModal(true)
                                          }}
                                          className="px-3 py-1 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white border-none cursor-pointer"
                                        >
                                          + Reservasi
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {/* Target Misi Belajar Mandiri List */}
                          {dateMission && (
                            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col gap-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                  <span>🎯</span>
                                  <span>Target Misi Mandiri ({dateMission.selectedVideos.length} Video)</span>
                                </span>
                                <span className="text-[0.68rem] font-bold text-slate-500">
                                  {dateMission.targetReplayCount} Replays
                                </span>
                              </div>
                              {dateMission.selectedVideos.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                                  {dateMission.selectedVideos.map(vid => (
                                    <span key={vid.id} className="text-[0.7rem] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md">
                                      🎥 {vid.title}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {!hasActivity && (
                            <div className="py-2.5 px-3.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center justify-between">
                              <span>Belum ada agenda pada tanggal ini.</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedDateStr(dateStr)
                                  setShowMissionModal(true)
                                }}
                                className="text-primary font-bold hover:underline cursor-pointer bg-transparent border-none"
                              >
                                + Susun Now ↗
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* Traditional 7-Column Calendar Grid */
            <>
              {/* Days of Week Header */}
              <div className="grid grid-cols-7 text-center font-extrabold text-[0.62rem] sm:text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
                {DAY_NAMES.map(d => (
                  <div key={d}>
                    <span className="sm:hidden">{d.slice(0, 3)}</span>
                    <span className="hidden sm:inline">{d}</span>
                  </div>
                ))}
              </div>

              {/* Calendar Grid Cells */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {/* Empty slots for days before 1st of month */}
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[4.2rem] xs:min-h-[5rem] sm:min-h-[6.5rem] bg-slate-50/50 dark:bg-slate-900/40 rounded-xl sm:rounded-2xl border border-slate-100/50 dark:border-slate-800/40 opacity-40 pointer-events-none" />
                ))}

                {/* Days list */}
                {daysToRender.map(item => {
                  const { dayNum, dateStr } = item
                  const isToday = dateStr === todayStr

                  const isPast = dateStr < todayStr
                  const isSelected = dateStr === selectedDateStr
                  const hasStreak = streakSet.has(dateStr)
                  const isPassed = streakSet.has(dateStr) || pastCompletedSet.has(dateStr)
                  
                  const dateMission = user ? getDailyMission(user.id, dateStr) : null
                  const hasPlan = dateMission !== null

                  const activeUserId = profile?.id || user?.id || 'user-demo-active'
                  const dateStatus = calculateDateScheduleStatus(dateStr, activeUserId, schedules, reservations)

                  const stampSrc = isPassed
                    ? '/lulus.png'
                    : hasPlan
                      ? '/gagal.png'
                      : '/kosong.png'

                  const stampAlt = isPassed
                    ? 'Lulus (100%)'
                    : hasPlan
                      ? 'Gagal (Tidak Selesai)'
                      : 'Kosong (Tidak Ada Rencana)'

                  let cellBgStyle = ''
                  let topStripStyle = ''

                  if (dateStatus.isOnlineBooked && dateStatus.isOfflineBooked) {
                    cellBgStyle = 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-950 dark:text-indigo-100 shadow-xs'
                    topStripStyle = 'border-t-4 border-t-indigo-500'
                  } else if (dateStatus.isOnlineBooked) {
                    cellBgStyle = 'bg-sky-50/90 dark:bg-sky-950/40 border-sky-300 dark:border-sky-700 text-sky-950 dark:text-sky-100 shadow-xs'
                    topStripStyle = 'border-t-4 border-t-sky-500'
                  } else if (dateStatus.isOfflineBooked) {
                    cellBgStyle = 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100 shadow-xs'
                    topStripStyle = 'border-t-4 border-t-emerald-500'
                  } else if (dateStatus.hasOnline && dateStatus.hasOffline) {
                    cellBgStyle = 'bg-indigo-50/20 border-indigo-300 dark:border-indigo-700/60'
                    topStripStyle = 'border-t-4 border-t-indigo-500'
                  } else if (dateStatus.hasOnline) {
                    cellBgStyle = dateStatus.onlineCanEnroll ? 'bg-sky-50/20 border-sky-300 dark:border-sky-700/60' : 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50'
                    topStripStyle = dateStatus.onlineCanEnroll ? 'border-t-4 border-t-sky-500' : 'border-t-4 border-t-amber-500'
                  } else if (dateStatus.hasOffline) {
                    cellBgStyle = dateStatus.offlineCanEnroll ? 'bg-emerald-50/20 border-emerald-300 dark:border-emerald-700/60' : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/50'
                    topStripStyle = dateStatus.offlineCanEnroll ? 'border-t-4 border-t-emerald-500' : 'border-t-4 border-t-rose-500'
                  } else if (isSelected) {
                    cellBgStyle = 'bg-primary/10 dark:bg-primary/20 border-primary ring-2 ring-primary/20 shadow-md scale-[1.02] z-10'
                  } else if (isToday) {
                    cellBgStyle = 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 shadow-xs'
                  } else {
                    cellBgStyle = 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }

                  return (
                    <div
                      key={dateStr}
                      onClick={() => {
                        setSelectedDateStr(dateStr)
                        if (dateStatus.hasSchedule) {
                          setShowClassModal(true)
                        } else if (dateStr >= todayStr) {
                          setShowMissionModal(true)
                        }
                      }}
                      className={`min-h-[5.5rem] xs:min-h-[6.5rem] sm:min-h-[8.5rem] p-1.5 xs:p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex flex-col justify-between select-none relative group overflow-hidden ${cellBgStyle} ${topStripStyle}`}
                    >
                      {/* Past Hanko Stamp Overlay */}
                      {isPast && (
                        <img
                          src={stampSrc}
                          alt={stampAlt}
                          className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 size-5 xs:size-6 sm:size-8 object-contain pointer-events-none opacity-30 dark:opacity-25 rotate-[-12deg] z-0 transition-transform group-hover:scale-110"
                        />
                      )}

                      <div className="flex items-center justify-between relative z-20">
                        <span className={`text-[0.75rem] xs:text-xs sm:text-base font-black ${
                          isSelected ? 'text-primary dark:text-red-400' : isToday ? 'text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200'
                        }`}>
                          {dayNum}
                        </span>
                        {isToday && (
                          <span className="text-[0.5rem] sm:text-[0.6rem] font-bold uppercase bg-amber-500 text-white px-1 sm:px-1.5 py-0.2 rounded shadow-xs">
                            <span className="hidden sm:inline">Hari Ini</span>
                            <span className="sm:hidden">•</span>
                          </span>
                        )}
                      </div>

                      {/* Live Class Schedule Items (Clean 1-Line Badges in Grid Calendar View) */}
                      <div className="flex flex-col gap-1 relative z-20">
                        {dateStatus.schedules.map(sch => {
                          const isEnrolled = reservations.some(r => r.schedule_id === sch.id && r.user_id === activeUserId)
                          const enrolledCount = reservations.filter(r => r.schedule_id === sch.id).length
                          const isFull = enrolledCount >= sch.max_quota

                          return (
                            <div
                              key={sch.id}
                              className={`text-[0.62rem] sm:text-[0.68rem] font-bold px-1.5 py-0.5 rounded-md flex items-center justify-between gap-1 shadow-2xs whitespace-nowrap truncate ${
                                isEnrolled
                                  ? sch.type === 'online'
                                    ? 'bg-sky-600 text-white font-black'
                                    : 'bg-emerald-600 text-white font-black'
                                  : isFull
                                    ? 'bg-rose-500 text-white font-bold'
                                    : sch.type === 'online'
                                      ? 'bg-sky-500 text-white font-extrabold'
                                      : 'bg-emerald-500 text-white font-extrabold'
                              }`}
                            >
                              <div className="flex items-center gap-1 min-w-0 truncate">
                                <span>{sch.type === 'online' ? '💻' : '🏢'}</span>
                                <span className="font-black">{sch.start_time}</span>
                                <span className="hidden sm:inline font-bold truncate">{sch.title}</span>
                              </div>
                              {isEnrolled ? (
                                <span className="text-[0.55rem] bg-white/30 text-white px-1 py-0.2 rounded font-black shrink-0">✓</span>
                              ) : isFull ? (
                                <span className="text-[0.55rem] bg-white/30 text-white px-1 py-0.2 rounded font-black shrink-0">Penuh</span>
                              ) : null}
                            </div>
                          )
                        })}

                        {hasStreak && (
                          <span className="text-[0.58rem] sm:text-[0.68rem] font-extrabold bg-emerald-100/90 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 px-1 sm:px-1.5 py-0.5 rounded flex items-center justify-center sm:justify-start gap-1 backdrop-blur-xs whitespace-nowrap truncate">
                            <span>🔥</span>
                            <span className="hidden sm:inline">Streak</span>
                          </span>
                        )}
                        {!isPast && dateMission && (
                          <span className="text-[0.58rem] sm:text-[0.68rem] font-extrabold bg-primary/15 dark:bg-primary/30 text-primary dark:text-red-300 px-1 sm:px-1.5 py-0.5 rounded backdrop-blur-xs whitespace-nowrap truncate text-center sm:text-left">
                            🎯 {dateMission.selectedVideos.length} <span className="hidden sm:inline">Video Misi</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}



          {/* Hanko Stamp & Class Schedule Legend */}
          <div className="pt-3 sm:pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2.5 sm:gap-3 text-xs">
            {/* Category 1: Reservasi Kelas Live (Warna Biru = Online, Hijau = Offline) */}
            <div className="flex flex-col gap-2 bg-slate-50/70 dark:bg-slate-950/40 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-800">
              <span className="font-black text-slate-700 dark:text-slate-200 text-[0.72rem] sm:text-xs flex items-center gap-1.5">
                <span>💻 🏢</span>
                <span>Jadwal Reservasi Kelas Live (Online vs Offline):</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Online Row */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-bold text-sky-600 dark:text-sky-400 text-[0.68rem] sm:text-[0.72rem] shrink-0">💻 Online:</span>
                  <div className="flex items-center gap-1 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded-lg border border-sky-200 dark:border-sky-800 text-[0.65rem] sm:text-[0.68rem]">
                    <span className="w-2.5 h-1 rounded-full bg-sky-500"></span>
                    <span className="text-sky-700 dark:text-sky-300 font-extrabold">Tersedia</span>
                  </div>
                  <div className="flex items-center gap-1 bg-sky-600 text-white px-2 py-0.5 rounded-lg text-[0.65rem] sm:text-[0.68rem]">
                    <span className="font-bold">✓ Online</span>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-500 text-white px-2 py-0.5 rounded-lg text-[0.65rem] sm:text-[0.68rem]">
                    <span className="font-bold">Penuh</span>
                  </div>
                </div>

                {/* Offline Row */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[0.68rem] sm:text-[0.72rem] shrink-0">🏢 Offline:</span>
                  <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-[0.65rem] sm:text-[0.68rem]">
                    <span className="w-2.5 h-1 rounded-full bg-emerald-500"></span>
                    <span className="text-emerald-700 dark:text-emerald-300 font-extrabold">Tersedia</span>
                  </div>
                  <div className="flex items-center gap-1 bg-emerald-600 text-white px-2 py-0.5 rounded-lg text-[0.65rem] sm:text-[0.68rem]">
                    <span className="font-bold">✓ Offline</span>
                  </div>
                  <div className="flex items-center gap-1 bg-rose-500 text-white px-2 py-0.5 rounded-lg text-[0.65rem] sm:text-[0.68rem]">
                    <span className="font-bold">Penuh</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Category 2: Cap Status Misi Belajar Mandiri */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 bg-slate-50/70 dark:bg-slate-950/40 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-800">
              <span className="font-black text-slate-700 dark:text-slate-200 shrink-0 text-[0.72rem] sm:text-xs flex items-center gap-1.5">
                <span>🎯</span>
                <span>Cap Status Misi Mandiri (Tanggal Berlalu):</span>
              </span>

              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 text-[0.65rem] sm:text-xs">
                <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/50 px-2 sm:px-2.5 py-1 rounded-lg sm:rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <img src="/lulus.png" alt="Cap Hijau" className="size-4 sm:size-5 object-contain" />
                  <span className="text-emerald-700 dark:text-emerald-300 font-extrabold">Cap Hijau: 100%</span>
                </div>

                <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/50 px-2 sm:px-2.5 py-1 rounded-lg sm:rounded-xl border border-red-200 dark:border-red-800">
                  <img src="/gagal.png" alt="Cap Merah" className="size-4 sm:size-5 object-contain" />
                  <span className="text-red-700 dark:text-red-300 font-extrabold">Cap Merah: &lt; 100%</span>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 sm:px-2.5 py-1 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-700">
                  <img src="/kosong.png" alt="Cap Abu-abu" className="size-4 sm:size-5 object-contain" />
                  <span className="text-slate-600 dark:text-slate-300 font-extrabold">Cap Abu-abu: Tanpa Rencana</span>
                </div>
              </div>
            </div>
          </div>

        </div>




        {/* Right Column: Selected Date Mission Panel (Sticky on scroll to follow user down page) */}
        <div className="flex flex-col gap-5 sticky top-20 self-start z-20 transition-all">


          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col gap-4 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-[0.65rem] font-black uppercase tracking-wider text-amber-400 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                  {isSelectedDatePast ? 'Arsip Rencana Belajar' : 'Target & Misi'}
                </span>
                <h3 className="text-base sm:text-lg font-extrabold mt-1 text-white leading-snug">
                  {formatDateIndonesian(selectedDateStr)}
                </h3>
              </div>
              {selectedDateStr === todayStr && (
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-500/30 shrink-0">
                  Hari Ini
                </span>
              )}
            </div>

            {/* Quick Button to open Class Enroll Modal */}
            <button
              onClick={() => setShowClassModal(true)}
              className="w-full py-2.5 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white font-extrabold rounded-2xl border border-white/10 cursor-pointer text-xs shadow-md transition-all flex items-center justify-center gap-2"
            >
              <span>💻 Sesi Kelas Live Tanggal Ini</span>
            </button>

            {/* Live Class Sessions Card in Right Panel */}
            {schedules.filter(s => s.date === selectedDateStr).length > 0 && (
              <div className="p-4 rounded-2xl bg-sky-950/70 border border-sky-400/30 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-sky-300">
                    💻 Sesi Kelas Live ({schedules.filter(s => s.date === selectedDateStr).length} Sesi Jam)
                  </span>
                  <button
                    onClick={() => setShowClassModal(true)}
                    className="text-[0.7rem] font-bold text-sky-400 hover:underline bg-transparent border-none cursor-pointer"
                  >
                    Buka Modal ↗
                  </button>
                </div>

                <div className="space-y-2">
                  {schedules.filter(s => s.date === selectedDateStr).map(sch => {
                    const activeUserId = profile?.id || user?.id || 'user-demo-active'
                    const userRes = reservations.find(r => r.schedule_id === sch.id && r.user_id === activeUserId)
                    const enrolledCount = reservations.filter(r => r.schedule_id === sch.id).length
                    const isFull = enrolledCount >= sch.max_quota

                    let isLocked = false
                    let lockReason = ''

                    if (!userRes && !isFull) {
                      if (sch.type === 'online') {
                        const schWeekId = sch.week_range_id || getWeekRangeId(sch.date)
                        const hasWeeklyOnline = reservations.some(r => {
                          if (r.user_id !== activeUserId) return false
                          const targetSch = schedules.find(s => s.id === r.schedule_id)
                          if (!targetSch || targetSch.type !== 'online') return false
                          const targetWeekId = targetSch.week_range_id || getWeekRangeId(targetSch.date)
                          return targetWeekId === schWeekId
                        })
                        if (hasWeeklyOnline) {
                          isLocked = true
                          lockReason = 'Sudah Reservasi Minggu Ini'
                        }
                      } else {
                        const schMonthId = sch.month_range_id || getMonthRangeId(sch.date)
                        const hasMonthlyOffline = reservations.some(r => {
                          if (r.user_id !== activeUserId) return false
                          const targetSch = schedules.find(s => s.id === r.schedule_id)
                          if (!targetSch || targetSch.type !== 'offline') return false
                          const targetMonthId = targetSch.month_range_id || getMonthRangeId(targetSch.date)
                          return targetMonthId === schMonthId
                        })
                        if (hasMonthlyOffline) {
                          isLocked = true
                          lockReason = 'Sudah Reservasi Bulan Ini'
                        }
                      }
                    }

                    return (
                      <div key={sch.id} className="p-3 rounded-xl bg-white/10 border border-white/10 text-xs flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[0.72rem]">
                          <span className="font-extrabold text-sky-300">⏰ {sch.start_time} - {sch.end_time} WIB</span>
                          <span className="text-white/70 font-semibold">{enrolledCount}/{sch.max_quota} Siswa</span>
                        </div>
                        <div className="font-extrabold text-white text-[0.82rem] leading-snug">{sch.title}</div>
                        <div className="text-[0.72rem] text-white/80">👨‍🏫 Instruktur: {sch.instructor_name}</div>
                        
                        <div className="mt-1 pt-1.5 border-t border-white/10 flex items-center justify-between">
                          <span className="text-[0.68rem] font-bold text-sky-200">
                            {sch.type === 'online' ? '💻 Google Meet' : '🏢 Offline Dojo'}
                          </span>
                          {userRes ? (
                            <span className="text-[0.68rem] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md">
                              ✅ Terdaftar
                            </span>
                          ) : isFull ? (
                            <span className="text-[0.68rem] font-bold text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md">
                              🚫 Kuota Penuh
                            </span>
                          ) : isLocked ? (
                            <span className="text-[0.68rem] font-bold text-sky-300 bg-sky-950/80 px-2 py-0.5 rounded-md border border-sky-400/30">
                              🔒 {lockReason}
                            </span>
                          ) : (
                            <button
                              onClick={() => setShowClassModal(true)}
                              className="text-[0.68rem] font-extrabold text-white bg-sky-600 hover:bg-sky-500 px-2.5 py-1 rounded-lg border-none cursor-pointer shadow-xs"
                            >
                              + Reservasi Sesi Ini
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}

                </div>
              </div>
            )}



            {selectedMission && missionProgress ? (
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-medium">Status Misi:</span>
                  <span className={`font-black px-2.5 py-0.5 rounded-full text-[0.7rem] ${
                    missionProgress.isFullyCompleted
                      ? 'bg-emerald-500 text-white'
                      : 'bg-amber-500 text-white'
                  }`}>
                    {missionProgress.isFullyCompleted ? '🎉 100% Selesai' : `${missionProgress.overallPct}% Selesai`}
                  </span>
                </div>

                {/* Video Target Details */}
                <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 flex flex-col gap-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span>🎥 Target Video ({selectedMission.selectedVideos.length} Video)</span>
                    <span className="text-emerald-300">{missionProgress.actualReplays}/{missionProgress.targetReplays}x</span>
                  </div>
                  <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${Math.min(100, (missionProgress.actualReplays / selectedMission.targetReplayCount) * 100)}%` }} />
                  </div>
                  <div className="flex flex-col gap-1 mt-1">
                    {selectedMission.selectedVideos.map((v, i) => (
                      <div key={i} className="text-[0.7rem] text-slate-300 flex items-center gap-1.5">
                        <span>•</span>
                        <span className="truncate">{v.title}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quiz & Kotoba Target Details */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-2xl bg-white/10 border border-white/15">
                    <span className="text-slate-300 text-[0.68rem] block mb-1">🎯 Target Kuis</span>
                    <span className="font-extrabold text-indigo-300 text-sm">{missionProgress.actualQuizzes}/{missionProgress.targetQuizzes}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/10 border border-white/15">
                    <span className="text-slate-300 text-[0.68rem] block mb-1">🔤 Target Kotoba</span>
                    <span className="font-extrabold text-amber-300 text-sm">{missionProgress.actualKotoba}/{missionProgress.targetKotoba}</span>
                  </div>
                </div>

                {/* If past date, show read-only note instead of edit button */}
                {isSelectedDatePast ? (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center text-xs text-slate-400 font-medium">
                    🔒 Tanggal telah berlalu (Mode Lihat Arsip)
                  </div>
                ) : (
                  <button
                    onClick={() => setShowMissionModal(true)}
                    className="w-full py-3 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white font-extrabold rounded-2xl border-none cursor-pointer text-xs shadow-md transition-all mt-1"
                  >
                    ⚙️ Edit Misi Tanggal Ini
                  </button>
                )}
              </div>
            ) : (
              <div className="p-6 bg-white/5 rounded-2xl border border-white/10 text-center flex flex-col items-center gap-3">
                <span className="text-4xl">📝</span>
                {isSelectedDatePast ? (
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Hari ini telah berlalu dan <strong>tidak ada rencana belajar</strong> yang disusun pada <strong>{formatDateIndonesian(selectedDateStr)}</strong>.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Belum ada misi harian yang dibuat untuk <strong>{formatDateIndonesian(selectedDateStr)}</strong>.
                    </p>
                    <button
                      onClick={() => setShowMissionModal(true)}
                      className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-extrabold rounded-2xl border-none cursor-pointer transition-all shadow-md"
                    >
                      + Susun Misi Tanggal Ini
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Class Enroll Modal */}
      {showClassModal && (
        <DateClassEnrollModal
          dateStr={selectedDateStr}
          schedules={schedules}
          reservations={reservations}
          userId={profile?.id || user?.id || 'user-demo-active'}
          userName={profile?.full_name || user?.user_metadata?.full_name || 'Budi Santoso'}
          userEmail={profile?.email || user?.email || 'budi@kaiwadojo.com'}
          onClose={() => setShowClassModal(false)}
          onRefresh={reloadSchedules}
          onOpenMissionBuilder={() => setShowMissionModal(true)}
        />
      )}


      {/* Daily Mission Builder Modal */}
      {showMissionModal && (
        <DailyMissionBuilderModal
          targetDate={selectedDateStr}
          currentMission={selectedMission}
          onSave={handleSaveMission}
          onClose={() => setShowMissionModal(false)}
        />
      )}
    </main>
  )
}

