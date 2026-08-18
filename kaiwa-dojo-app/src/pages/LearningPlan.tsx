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
export default function LearningPlanPage() {
  const { user } = useAuth()

  // Calendar State
  const todayStr = getTodayDateString()
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date())
  const [selectedDateStr, setSelectedDateStr]   = useState<string>(todayStr)

  // Daily Mission State
  const [selectedMission, setSelectedMission]   = useState<DailyMissionData | null>(null)
  const [missionProgress, setMissionProgress] = useState<MissionProgress | null>(null)
  const [showMissionModal, setShowMissionModal] = useState(false)

  // Streak & Past Completion sets
  const [streakSet, setStreakSet] = useState<Set<string>>(new Set())
  const [pastCompletedSet, setPastCompletedSet] = useState<Set<string>>(new Set())

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

  const isSelectedDatePast = selectedDateStr < todayStr

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-hidden animate-fade-in">

      {/* Header */}
      <div className="mb-6 animate-fade-in-up flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight mb-1.5 flex items-center gap-2">
            <AdaptiveIcon src="/calendar.png" alt="Kalender" className="size-8 object-contain shrink-0" />
            <span>Rencana Belajar & Kalender Misi</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400">
            Klik pada tanggal di kalender untuk menyusun misi harian atau melihat arsip pembelajaran
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedDateStr(todayStr)
            setShowMissionModal(true)
          }}
          className="px-5 py-3 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white text-xs sm:text-sm font-extrabold rounded-2xl border-none cursor-pointer transition-all shadow-md shrink-0 hover:-translate-y-0.5 flex items-center gap-2"
        >
          <AdaptiveIcon src="/target.png" alt="Target Misi" className="size-4.5 object-contain shrink-0" />
          <span>+ Susun Misi Hari Ini</span>
        </button>
      </div>

      {/* Main Grid: Left Big Calendar | Right Date Mission Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">

        {/* Left Column: Big Interactive Calendar */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-6">
          {/* Calendar Header / Month Nav */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AdaptiveIcon src="/calendar.png" alt="Kalender" className="size-6 object-contain shrink-0" />
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-800 dark:text-white">
                {MONTH_NAMES[month]} {year}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedDateStr(todayStr)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border-none cursor-pointer transition-all"
              >
                Hari Ini
              </button>
              <button
                onClick={() => changeMonth(-1)}
                className="size-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold border-none cursor-pointer flex items-center justify-center text-sm"
              >
                ◄
              </button>
              <button
                onClick={() => changeMonth(1)}
                className="size-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold border-none cursor-pointer flex items-center justify-center text-sm"
              >
                ►
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 text-center font-extrabold text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3">
            {DAY_NAMES.map(d => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {/* Calendar Grid Cells */}
          <div className="grid grid-cols-7 gap-2">
            {/* Empty slots for days before 1st of month */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="h-20 sm:h-24 bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl border border-slate-100/50 dark:border-slate-800/40 opacity-40 pointer-events-none" />
            ))}

            {/* Days of the month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1
              const dateObj = new Date(year, month, dayNum)
              const dateStr = dateObj.toISOString().split('T')[0]

              const isToday = dateStr === todayStr
              const isPast = dateStr < todayStr
              const isSelected = dateStr === selectedDateStr
              const hasStreak = streakSet.has(dateStr)
              const isPassed = streakSet.has(dateStr) || pastCompletedSet.has(dateStr)
              
              // Check if mission exists for this date in localStorage
              const dateMission = user ? getDailyMission(user.id, dateStr) : null
              const hasPlan = dateMission !== null

              // Hanko Stamp Determination:
              // 1. isPassed (100% complete) => /lulus.png (Cap Hijau)
              // 2. hasPlan & !isPassed      => /gagal.png (Cap Merah)
              // 3. !hasPlan & !isPassed     => /kosong.png (Cap Abu-abu)
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

              return (
                <div
                  key={dayNum}
                  onClick={() => {
                    setSelectedDateStr(dateStr)
                    if (dateStr >= todayStr) {
                      setShowMissionModal(true)
                    }
                  }}
                  className={`h-20 sm:h-24 p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between select-none relative group overflow-hidden ${
                    isSelected
                      ? 'bg-primary/10 dark:bg-primary/20 border-primary ring-2 ring-primary/20 shadow-md scale-[1.02] z-10'
                      : isToday
                        ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {/* Past Hanko Stamp Overlay */}
                  {isPast && (
                    <img
                      src={stampSrc}
                      alt={stampAlt}
                      className="absolute inset-0 m-auto size-14 sm:size-16 object-contain pointer-events-none opacity-90 drop-shadow-md rotate-[-12deg] z-20 transition-transform group-hover:scale-110"
                    />
                  )}

                  <div className="flex items-center justify-between relative z-10">
                    <span className={`text-xs sm:text-sm font-black ${
                      isSelected ? 'text-primary dark:text-red-400' : isToday ? 'text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200'
                    }`}>
                      {dayNum}
                    </span>
                    {isToday && (
                      <span className="text-[0.6rem] font-bold uppercase bg-amber-500 text-white px-1.5 py-0.2 rounded-md shadow-xs">
                        Hari Ini
                      </span>
                    )}
                  </div>

                  {/* Status Badges */}
                  <div className="flex flex-col gap-1 relative z-10">
                    {hasStreak && (
                      <span className="text-[0.62rem] font-extrabold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                        🔥 Streak
                      </span>
                    )}
                    {!isPast && dateMission && (
                      <span className="text-[0.62rem] font-extrabold bg-primary/15 dark:bg-primary/30 text-primary dark:text-red-300 px-1.5 py-0.5 rounded-md truncate">
                        🎯 {dateMission.selectedVideos.length} Video
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Hanko Stamp Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <img src="/lulus.png" alt="Lulus" className="size-5 object-contain" />
              <span>Cap Lulus: Misi 100% Selesai</span>
            </div>
            <div className="flex items-center gap-2">
              <img src="/gagal.png" alt="Gagal" className="size-5 object-contain" />
              <span>Cap Gagal: Misi Tidak Selesai</span>
            </div>
            <div className="flex items-center gap-2">
              <img src="/kosong.png" alt="Kosong" className="size-5 object-contain" />
              <span>Cap Kosong: Belum Ada Misi</span>
            </div>
          </div>
        </div>

        {/* Right Column: Selected Date Mission Panel */}
        <div className="flex flex-col gap-5">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-6 shadow-xl flex flex-col gap-4 relative overflow-hidden">
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
