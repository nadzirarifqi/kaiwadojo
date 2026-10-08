import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../contexts/LanguageContext'
import {
  type DailyMissionData,
  type MissionProgress,
  getDailyMission,
  saveDailyMission,
  calculateMissionProgress,
  fetchDailyMission,
  fetchAllUserMissions,
  isNoPlanMission,
  getTodayDateString,
  DAILY_MISSION_UPDATE_EVENT,
  subscribeToDailyMissionRealtime,
} from '../lib/dailyMission'

import DailyMissionBuilderModal from '../components/DailyMissionBuilderModal'
import { fetchGroups, type KaiwaGroup, GROUP_UPDATE_EVENT } from '../lib/groupService'
import {
  type ClassSchedule,
  type ClassReservation,
  fetchSchedules,
  fetchReservations,
  bookClass,
  cancelClassBooking,
  calculateDateScheduleStatus,
  isScheduleActiveOnDate,
  isScheduleAccessibleForUser,
  formatDateRangeIndonesian,
  formatTimeShort,
  sortSchedules,
  RESERVATION_UPDATE_EVENT,
  SCHEDULE_UPDATE_EVENT,
  subscribeToScheduleRealtime,
  getWeekRangeId,
  getMonthRangeId,
  matchScheduleId,
} from '../lib/scheduleService'




/* ── Date & Month Helpers (Localized) ──────────────── */
export function getLocalizedMonthName(monthIdx: number, lang: string = 'id'): string {
  const date = new Date(2026, monthIdx, 1)
  const locale = lang === 'ja' ? 'ja-JP' : lang === 'en' ? 'en-US' : 'id-ID'
  return date.toLocaleString(locale, { month: 'long' })
}

export function getLocalizedDayNames(lang: string = 'id'): string[] {
  if (lang === 'ja') return ['日', '月', '火', '水', '木', '金', '土']
  if (lang === 'en') return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
}

export function formatDateIndonesian(dateStr: string, lang: string = 'id'): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  const dateObj = new Date(y, m - 1, d)
  const locale = lang === 'ja' ? 'ja-JP' : lang === 'en' ? 'en-US' : 'id-ID'
  return dateObj.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
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
  profile,
  groups,
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
  profile?: any
  groups?: KaiwaGroup[]
  onClose: () => void
  onRefresh: () => Promise<void>
  onOpenMissionBuilder: () => void
}) {
  const { language } = useLanguage()
  const daySchedules = sortSchedules(schedules.filter(s => isScheduleActiveOnDate(s, dateStr)))
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  function showToast(text: string, type: 'success' | 'error' = 'success') {
    setToast({ text, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleBook(sch: ClassSchedule) {
    setLoadingId(sch.id)
    const res = await bookClass(sch, userId, userName, userEmail, profile, groups)
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
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[999] overflow-y-auto animate-fade-in">
      <div className="flex min-h-full items-start justify-center p-3 sm:p-6 pt-8 sm:pt-12 md:pt-14 lg:pt-16 pb-12">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[90dvh] border border-slate-200 dark:border-slate-800">
        
        {/* Toast inside modal */}
        {toast && (
          <div className={`p-3 text-xs font-bold text-center text-white ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
            {toast.text}
          </div>
        )}

        {/* Modal Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 bg-gradient-to-r from-sky-600 to-primary text-white flex items-center justify-between shrink-0">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-white/80">Jadwal Kelas & Reservasi</span>
            <h3 className="text-lg font-black text-white flex items-center gap-2 mt-0.5">
              <svg className="size-4.5 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{formatDateIndonesian(dateStr)}</span>
            </h3>
          </div>
          <button
            onClick={onClose}
            className="size-8 sm:size-9 rounded-full bg-white/20 hover:bg-white/30 text-white border-none cursor-pointer flex items-center justify-center transition-colors"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Sesi Kelas Live Tersedia ({daySchedules.length})
            </span>
            <button
              onClick={() => {
                onClose()
                onOpenMissionBuilder()
              }}
              className="text-xs font-extrabold text-primary dark:text-red-400 hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1"
            >
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Susun Target Misi Mandiri</span>
            </button>
          </div>

          {daySchedules.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center gap-2">
              <div className="size-12 rounded-2xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Tidak ada sesi kelas live untuk tanggal ini.</p>
              <p className="text-[0.75rem] text-slate-400">Anda dapat menyusun target belajar mandiri atau memilih tanggal lain yang memiliki strip di kalender.</p>
              <button
                onClick={() => {
                  onClose()
                  onOpenMissionBuilder()
                }}
                className="mt-2 px-4 py-2 bg-primary text-white text-xs font-extrabold rounded-xl border-none cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>Susun Misi Belajar Mandiri</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {daySchedules.map(sch => {
                const enrolledCount = reservations.filter(r => matchScheduleId(sch.id, r.schedule_id)).length
                const userRes = reservations.find(r => matchScheduleId(sch.id, r.schedule_id) && r.user_id === userId)
                const isFull = enrolledCount >= sch.max_quota

                // Check conflict
                let isLocked = false
                let lockReason = ''

                if (!userRes && !isFull) {
                  if (sch.type === 'online') {
                    const hasWeeklyOnline = reservations.some(r => {
                      if (r.user_id !== userId) return false
                      const targetSch = schedules.find(s => matchScheduleId(s.id, r.schedule_id))
                      return targetSch && targetSch.type === 'online' && targetSch.week_range_id === sch.week_range_id
                    })
                    if (hasWeeklyOnline) {
                      isLocked = true
                      lockReason = 'Sudah Reservasi Minggu Ini'
                    }
                  } else {
                    const hasMonthlyOffline = reservations.some(r => {
                      if (r.user_id !== userId) return false
                      const targetSch = schedules.find(s => matchScheduleId(s.id, r.schedule_id))
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
                      <span className={`px-2.5 py-0.5 rounded-full text-[0.68rem] font-black uppercase flex items-center gap-1 ${
                        userRes
                          ? sch.type === 'online'
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'bg-emerald-600 text-white shadow-xs'
                          : sch.type === 'online'
                            ? 'bg-transparent border border-sky-400 text-sky-600 dark:text-sky-300 font-extrabold'
                            : 'bg-transparent border border-emerald-400 text-emerald-600 dark:text-emerald-300 font-extrabold'
                      }`}>
                        {sch.type === 'online' ? (
                          <>
                            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span>ONLINE (G-Meet)</span>
                          </>
                        ) : (
                          <>
                            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <span>OFFLINE (Dojo)</span>
                          </>
                        )}
                      </span>

                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span>{enrolledCount}/{sch.max_quota} Siswa</span>
                      </span>
                    </div>

                    <h4 className="text-sm font-extrabold text-slate-800 dark:text-white leading-snug">
                      {sch.title}
                    </h4>
                    <p className="text-xs font-bold text-primary dark:text-red-400">
                      {sch.subtitle_chapter}
                    </p>

                    {(() => {
                      const sDateStr = sch.start_date || sch.date
                      const eDateStr = sch.end_date || sDateStr
                      const isOfflineMultiDay = sch.type === 'offline' || Boolean(sch.end_date && sch.end_date !== sDateStr)
                      const { formattedRange, badgeLabel } = formatDateRangeIndonesian(sDateStr, eDateStr, sch.start_time, sch.end_time, language)

                      return (
                        <div className="text-[0.75rem] text-slate-600 dark:text-slate-300 space-y-1.5 font-medium pt-1">
                          {isOfflineMultiDay ? (
                            <div className="bg-emerald-50/80 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200/60 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
                              <span className="size-5 rounded-lg bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 21l9-18 9 18H3z" />
                                </svg>
                              </span>
                              <div className="text-[0.72rem] leading-snug">
                                <div className="font-black text-emerald-700 dark:text-emerald-400 uppercase text-[0.65rem] tracking-wider mb-0.5">
                                  Jadwal 3 Hari 2 Malam ({badgeLabel}):
                                </div>
                                <span className="font-extrabold">{formattedRange}</span>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-1.5">
                                <svg className="size-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>Tanggal: <strong className="font-extrabold">{formatDateIndonesian(sDateStr, language)}</strong></span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <svg className="size-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>Jam Sesi: <strong>{formatTimeShort(sch.start_time)} - {formatTimeShort(sch.end_time)} WIB</strong></span>
                              </div>
                            </>
                          )}

                          <div className="flex items-center gap-1.5">
                            <svg className="size-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span>Instruktur: <strong>{sch.instructor_name}</strong></span>
                          </div>
                          {sch.type === 'online' ? (
                            <div className="text-sky-600 dark:text-sky-400 font-bold truncate flex items-center gap-1.5">
                              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                              <span>Google Meet Sesi Live</span>
                            </div>
                          ) : (
                            <div className="text-emerald-600 dark:text-emerald-400 font-bold truncate flex items-center gap-1.5">
                              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span>{sch.location || 'Kaiwa Dojo Center'}</span>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      {userRes ? (
                        <div className="flex items-center gap-2">
                          <span className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 text-white font-extrabold text-xs text-center flex items-center justify-center gap-1.5 shadow-sm">
                            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Terdaftar</span>
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
                          Kuota Penuh (10/10)
                        </button>
                      ) : isLocked ? (
                        <button disabled className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold text-xs border-none cursor-not-allowed flex items-center justify-center gap-1.5">
                          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          <span>{lockReason}</span>
                        </button>
                      ) : (
                        <button
                          disabled={loadingId === sch.id}
                          onClick={() => handleBook(sch)}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-primary hover:from-sky-700 hover:to-primary-dark text-white font-extrabold text-xs border-none cursor-pointer transition-all shadow-md flex items-center justify-center gap-1.5"
                        >
                          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          <span>{loadingId === sch.id ? 'Memproses...' : 'Reservasi Kelas Tanggal Ini'}</span>
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
    </div>
  )
}

function formatDayNameShort(dateStr: string, lang: string = 'id'): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return getLocalizedDayNames(lang)[date.getDay()]
}

export default function LearningPlanPage() {

  const { user, profile } = useAuth()
  const { language, t } = useLanguage()

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

  // User Missions Map
  const [userMissions, setUserMissions] = useState<Map<string, DailyMissionData>>(new Map())

  // Class Schedules & Reservations State for Calendar Visual Indicators
  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [reservations, setReservations] = useState<ClassReservation[]>([])
  const [groups, setGroups] = useState<KaiwaGroup[]>([])

  async function reloadSchedules() {
    const [sData, rData, gData] = await Promise.all([fetchSchedules(), fetchReservations(), fetchGroups()])
    setSchedules(sData)
    setReservations(rData)
    setGroups(gData)
  }

  useEffect(() => {
    reloadSchedules()

    // 1. Instant local window event sync (for same browser / role switcher / multi-tabs)
    const handleSync = () => reloadSchedules()
    window.addEventListener(RESERVATION_UPDATE_EVENT, handleSync)
    window.addEventListener(SCHEDULE_UPDATE_EVENT, handleSync)
    window.addEventListener(GROUP_UPDATE_EVENT, handleSync)
    window.addEventListener('storage', handleSync)

    // 2. Supabase Realtime channel for cross-device sync
    const unsubscribeScheduleRealtime = subscribeToScheduleRealtime(handleSync)

    return () => {
      window.removeEventListener(RESERVATION_UPDATE_EVENT, handleSync)
      window.removeEventListener(SCHEDULE_UPDATE_EVENT, handleSync)
      window.removeEventListener(GROUP_UPDATE_EVENT, handleSync)
      window.removeEventListener('storage', handleSync)
      unsubscribeScheduleRealtime()
    }
  }, [])

  const accessibleSchedules: ClassSchedule[] = useMemo(() => {
    return schedules.filter(s => isScheduleAccessibleForUser(s, profile, groups))
  }, [schedules, profile, groups])

  // Automatically scroll to top whenever mission modal or class modal opens
  useEffect(() => {
    if (showMissionModal || showClassModal) {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [showMissionModal, showClassModal])

  const activeUserId = user?.id || profile?.id || null

  useEffect(() => {
    if (!activeUserId) return
    loadData()

    const handleMissionSync = () => {
      loadData()
    }
    window.addEventListener('kaiwa_mission_progress_updated', handleMissionSync)
    window.addEventListener(DAILY_MISSION_UPDATE_EVENT, handleMissionSync)
    window.addEventListener('storage', handleMissionSync)
    const unsubscribeMissionRealtime = subscribeToDailyMissionRealtime(handleMissionSync)

    return () => {
      window.removeEventListener('kaiwa_mission_progress_updated', handleMissionSync)
      window.removeEventListener(DAILY_MISSION_UPDATE_EVENT, handleMissionSync)
      window.removeEventListener('storage', handleMissionSync)
      unsubscribeMissionRealtime()
    }
  }, [user?.id, profile?.id, selectedDateStr, currentMonthDate])

  async function loadData() {
    if (!activeUserId) return
    // 1. Batch fetch user's streaks, lesson progress, and kotoba submissions in parallel
    let streaksData: any[] = []
    let pData: any[] = []
    let kData: any[] = []

    const [sRes, pRes, kRes] = await Promise.all([
      supabase.from('learning_streaks').select('date').eq('student_id', activeUserId),
      supabase.from('lesson_progress').select('lesson_id, is_completed, replay_count, last_watched_at').eq('student_id', activeUserId),
      supabase.from('user_kotoba_submissions').select('id, created_at').eq('user_id', activeUserId),
    ])
    streaksData = sRes.data || []
    pData = pRes.data || []
    kData = kRes.data || []

    const streakDates = new Set(streaksData.map((s: any) => s.date))
    setStreakSet(streakDates)

    const preFetched = { progressData: pData, kotobaSubmissions: kData }

    // 2. Fetch all missions from Supabase DB + LocalStorage
    const allMissionsMap = await fetchAllUserMissions(activeUserId)
    setUserMissions(allMissionsMap)

    // 3. Compute past missions progress for the displayed month in parallel
    const year = currentMonthDate.getFullYear()
    const month = currentMonthDate.getMonth()
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate()
    const completedSet = new Set<string>()

    const dayPromises = Array.from({ length: daysInCurrentMonth }, async (_, idx) => {
      const d = idx + 1
      const formattedMonth = String(month + 1).padStart(2, '0')
      const formattedDay   = String(d).padStart(2, '0')
      const dStr = `${year}-${formattedMonth}-${formattedDay}`

      const m = allMissionsMap.get(dStr)
      // If no mission exists for this date, it cannot be completed/passed
      if (!m) {
        return null
      }

      if (isNoPlanMission(m)) {
        return dStr
      }

      if (streakDates.has(dStr)) {
        return dStr
      }

      const prog = await calculateMissionProgress(activeUserId, m, preFetched)
      if (prog.isFullyCompleted) {
        return dStr
      }
      return null
    })

    const results = await Promise.all(dayPromises)
    results.forEach(dStr => {
      if (dStr) completedSet.add(dStr)
    })
    setPastCompletedSet(completedSet)

    // 4. Load mission for selected date
    let mission = allMissionsMap.get(selectedDateStr) || getDailyMission(activeUserId, selectedDateStr)
    if (!mission && (user?.id || profile?.id)) {
      mission = await fetchDailyMission(activeUserId, selectedDateStr)
    }
    setSelectedMission(mission)

    if (mission) {
      const prog = await calculateMissionProgress(activeUserId, mission, preFetched)
      setMissionProgress(prog)
    } else {
      setMissionProgress(null)
    }
  }

  async function handleSaveMission(data: Omit<DailyMissionData, 'date'>, dateStr: string) {
    const activeUserId = profile?.id || user?.id
    if (!activeUserId) {
      throw new Error('Sesi pengguna tidak terdeteksi. Silakan muat ulang halaman atau login kembali.')
    }
    const saved = await saveDailyMission(activeUserId, data, dateStr)
    setSelectedDateStr(dateStr)
    setSelectedMission(saved)
    setUserMissions(prev => {
      const next = new Map(prev)
      next.set(dateStr, saved)
      return next
    })
    const prog = await calculateMissionProgress(activeUserId, saved)
    setMissionProgress(prog)
    setShowMissionModal(false)
    await loadData()
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
        const activeUserId = profile?.id || user?.id || ''
        const status = calculateDateScheduleStatus(item.dateStr, activeUserId, accessibleSchedules, reservations)
        const mission = userMissions.get(item.dateStr) || getDailyMission(activeUserId, item.dateStr)
        return status.isBooked || mission !== null
      })
    : allMonthDays

  const isSelectedDatePast = selectedDateStr < todayStr

  return (
    <main className="flex-1 p-3 sm:p-6 lg:p-8 min-w-0 overflow-x-clip animate-page-slide">
      {/* Comprehensive Quick Feature & Section Guide Banner */}
      <div className="mb-5 bg-gradient-to-r from-sky-500/10 via-emerald-500/10 to-amber-500/10 dark:from-sky-950/40 dark:via-emerald-950/40 dark:to-amber-950/40 p-4 sm:p-5 rounded-3xl border border-sky-200/60 dark:border-sky-800/60 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-start gap-3.5 flex-1">
            <div className="size-10 sm:size-11 rounded-2xl bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 flex items-center justify-center shrink-0 shadow-xs text-amber-500">
              <svg className="size-5 sm:size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-white">
                {t('lp_banner_guide_title', 'Panduan Praktis Rencana Belajar & Reservasi Kelas Live')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                {t('lp_banner_guide_desc', 'Gunakan mode Kalender Grid untuk melihat ringkasan status bulanan, atau mode Agenda Schedule untuk menyusuri linimasa harian.')}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setSelectedDateStr(todayStr)
              setShowMissionModal(true)
            }}
            className="w-full sm:w-auto px-3.5 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white text-[11px] sm:text-xs font-bold rounded-xl border-none cursor-pointer transition-all shadow-xs shrink-0 flex items-center justify-center gap-1.5 group min-h-[30px] sm:min-h-[34px]"
          >
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>{t('lp_btn_create', 'Susun Rencana Hari Ini')}</span>
          </button>
        </div>

        {/* 3 Badges placed underneath the description */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-sky-200/50 dark:border-sky-800/50">
          <span className="text-[10px] sm:text-[11px] font-bold bg-rose-600 text-white px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1.5 whitespace-nowrap">
            <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <circle cx="12" cy="12" r="8" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>{t('lp_tag_daily_mission', 'Rencana Harian (Wajib Setiap Hari)')}</span>
          </span>
          <span className="text-[10px] sm:text-[11px] font-bold bg-sky-600 text-white px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1.5 whitespace-nowrap">
            <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>{t('lp_tag_online_class', 'Kelas Online (Batas 1 Sesi/Minggu)')}</span>
          </span>
          <span className="text-[10px] sm:text-[11px] font-bold bg-emerald-600 text-white px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1.5 whitespace-nowrap">
            <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span>{t('lp_tag_offline_class', 'Kelas Offline (Batas 1 Sesi/Bulan)')}</span>
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
              <span className="size-8 sm:size-9 rounded-xl bg-sky-500/10 text-sky-600 dark:bg-sky-400/20 dark:text-sky-300 border border-sky-500/20 flex items-center justify-center shrink-0 shadow-xs">
                <svg className="size-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </span>
              <h2 className="text-base sm:text-xl font-extrabold text-slate-800 dark:text-white">
                {getLocalizedMonthName(month, language)} {year}
              </h2>
            </div>

            <div className="flex flex-wrap items-center justify-between md:justify-end gap-2 w-full md:w-auto">
              {/* Segmented View Mode Toggle: Kalender vs Agenda Schedule */}
              <div className="flex items-center p-0.5 sm:p-1 bg-slate-100 dark:bg-slate-800 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`px-2 sm:px-2.5 py-1 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-extrabold transition-all cursor-pointer border-none flex items-center gap-1 sm:gap-1.5 ${
                    viewMode === 'calendar'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  <svg className="size-3 sm:size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{t('lp_calendar_view', 'Kalender')}</span>
                </button>
                <button
                  onClick={() => setViewMode('schedule')}
                  className={`px-2 sm:px-2.5 py-1 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-extrabold transition-all cursor-pointer border-none flex items-center gap-1 sm:gap-1.5 ${
                    viewMode === 'schedule'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  <svg className="size-3 sm:size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>{t('lp_schedule_view', 'Agenda Schedule')}</span>
                </button>
              </div>

              <div className="flex items-center gap-1 sm:gap-1.5">
                <button
                  onClick={handleTodayClick}
                  className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] sm:text-xs font-bold rounded-lg sm:rounded-xl border-none cursor-pointer transition-all"
                >
                  {t('lp_today_btn', 'Hari Ini')}
                </button>
                <button
                  onClick={() => changeMonth(-1)}
                  className="size-7 sm:size-8 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold border-none cursor-pointer flex items-center justify-center transition-colors"
                  aria-label="Bulan sebelumnya"
                >
                  <svg className="size-3.5 sm:size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => changeMonth(1)}
                  className="size-7 sm:size-8 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold border-none cursor-pointer flex items-center justify-center transition-colors"
                  aria-label="Bulan berikutnya"
                >
                  <svg className="size-3.5 sm:size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
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
                  <svg className="size-4 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>{t('lp_agenda_header', 'Agenda Jadwal Pembelajaran & Kelas Live')}</span>
                </span>
                <button
                  onClick={() => setShowOnlyActivities(prev => !prev)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border-none flex items-center gap-1.5 shrink-0 ${
                    showOnlyActivities
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>{showOnlyActivities ? t('lp_only_activities', 'Hanya Hari Beragenda') : t('lp_show_all_dates', 'Tampilkan Semua Tanggal')}</span>
                </button>
              </div>

              <div className="flex flex-col gap-3 max-h-[720px] overflow-y-auto p-1 pr-2">
                {daysToRender.map(item => {
                  const { dayNum, dateStr } = item
                  const isToday = dateStr === todayStr
                  const isPast = dateStr < todayStr
                  const isSelected = dateStr === selectedDateStr
                  const isExpanded = expandedDates.has(dateStr)

                  const activeUserId = profile?.id || user?.id || ''
                  const dateMission = userMissions.get(dateStr) || getDailyMission(activeUserId, dateStr)
                  const hasPlan = dateMission !== null
                  const isNoPlan = dateMission !== null && isNoPlanMission(dateMission)
                  const isPassed = hasPlan && (streakSet.has(dateStr) || pastCompletedSet.has(dateStr))

                  const accountCreatedDateStr = (profile?.created_at || user?.created_at || new Date().toISOString()).split('T')[0]
                  const isPastEligibleForStamp = isPast && (isPassed || dateStr >= accountCreatedDateStr)

                  const dateStatus = calculateDateScheduleStatus(dateStr, activeUserId, accessibleSchedules, reservations)
                  const allDaySchedules = dateStatus.schedules || []
                  const userReservedSchedules = allDaySchedules.filter(sch =>
                    reservations.some(r => matchScheduleId(sch.id, r.schedule_id) && r.user_id === activeUserId)
                  )
                  const daySchedules = showOnlyActivities ? userReservedSchedules : allDaySchedules
                  const hasActivity = daySchedules.length > 0 || dateMission !== null
                  const isDateLocked = dateStatus.hasSchedule && !dateStatus.canEnroll && !dateStatus.isBooked

                  let stampSrc = '/kosong.png'
                  let stampAlt = 'Belum Buat Rencana (Cap Abu-abu)'
                  let stampLabel = 'Belum Buat Rencana'

                  if (!hasPlan) {
                    stampSrc = '/kosong.png'
                    stampAlt = 'Belum Buat Rencana (Cap Abu-abu)'
                    stampLabel = 'Belum Buat Rencana'
                  } else if (isNoPlan) {
                    stampSrc = '/tidakada.png'
                    stampAlt = 'Tidak Ada Rencana (Cap Biru)'
                    stampLabel = 'Tidak Ada Rencana'
                  } else if (isPassed) {
                    stampSrc = '/lulus.png'
                    stampAlt = 'Lulus 100% (Cap Hijau)'
                    stampLabel = 'Lulus 100%'
                  } else {
                    stampSrc = '/gagal.png'
                    stampAlt = 'Belum Tuntas (Cap Merah)'
                    stampLabel = 'Belum Tuntas'
                  }

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
                                <span className="px-2 py-0.2 rounded-md bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-bold border border-sky-200 dark:border-sky-800 flex items-center gap-1">
                                  <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                  <span>{daySchedules.length} Kelas Live</span>
                                </span>
                              )}
                              {dateMission && (
                                <span className={`px-2 py-0.2 rounded-md font-semibold border flex items-center gap-1 ${
                                  isNoPlan
                                    ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                                    : 'bg-primary/5 dark:bg-primary/20 text-primary dark:text-red-300 border-primary/20'
                                }`}>
                                  {isNoPlan ? (
                                    <span>Tidak Ada Rencana (Cap Biru)</span>
                                  ) : dateMission.selectedVideos.length > 0 ? (
                                    <>
                                      <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <circle cx="12" cy="12" r="8" />
                                        <circle cx="12" cy="12" r="3" />
                                      </svg>
                                      <span>{dateMission.selectedVideos.length} Video Misi</span>
                                    </>
                                  ) : (dateMission.targetQuizCount || 0) > 0 ? (
                                    <>
                                      <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <circle cx="12" cy="12" r="8" />
                                        <circle cx="12" cy="12" r="3" />
                                      </svg>
                                      <span>{dateMission.targetQuizCount} Kuis Misi</span>
                                    </>
                                  ) : (dateMission.targetKotobaCount || 0) > 0 ? (
                                    <span>{dateMission.targetKotobaCount} Kotoba Misi</span>
                                  ) : (
                                    <span>Misi Mandiri</span>
                                  )}
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
                          {/* Minimalist Hanko Stamp Badge for Past Dates (Hanya tanggal setelah user buat akun) */}
                          {isPastEligibleForStamp && (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70">
                              <img
                                src={stampSrc}
                                alt={stampAlt}
                                title={stampAlt}
                                className="size-6 object-contain shrink-0 rotate-[-6deg]"
                              />
                              <span className="text-[0.68rem] font-semibold text-slate-600 dark:text-slate-300 hidden xs:inline">
                                {stampLabel}
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
                            <svg className={`size-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Minimalist Expanded Accordion Content */}
                      {isExpanded && (
                        <div className="p-3.5 sm:p-4 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-col gap-3 bg-slate-50/40 dark:bg-slate-950/30 rounded-b-2xl animate-fade-in">
                          {/* Sleek Quick Action Bar — hide edit misi for past dates */}
                          <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs">
                            <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                              {isPast ? (
                                <>
                                  <svg className="size-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                  <span>Arsip Tanggal Ini:</span>
                                </>
                              ) : (
                                <>
                                  <svg className="size-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                  <span>Aksi Tanggal Ini:</span>
                                </>
                              )}
                            </span>
                            <div className="flex items-center gap-2">
                              {isPast ? (
                                <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                                  <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                  <span>Tanggal Telah Berlalu</span>
                                </span>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedDateStr(dateStr)
                                    setShowMissionModal(true)
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs font-bold border-none cursor-pointer transition-all flex items-center gap-1.5 shadow-2xs"
                                >
                                  <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <circle cx="12" cy="12" r="8" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                  <span>Misi Mandiri</span>
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedDateStr(dateStr)
                                  setShowClassModal(true)
                                }}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white text-xs font-bold border-none cursor-pointer transition-all flex items-center gap-1.5 shadow-2xs"
                              >
                                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                <span>Kelas Live</span>
                              </button>
                            </div>
                          </div>

                          {/* Live Class Sessions */}
                          {daySchedules.length > 0 && (
                            <div className="flex flex-col gap-2">
                              <span className="text-[0.72rem] font-bold text-slate-500 uppercase tracking-wider">Kelas Live ({daySchedules.length}):</span>
                              {daySchedules.map(sch => {
                                const isUserEnrolled = reservations.some(r => matchScheduleId(sch.id, r.schedule_id) && r.user_id === activeUserId)
                                const enrolledCount = reservations.filter(r => matchScheduleId(sch.id, r.schedule_id)).length
                                const isFull = enrolledCount >= sch.max_quota
                                const isLockedByWeekRule = !isUserEnrolled && isDateLocked && dateStatus.lockReason === 'week_locked'

                                return (
                                  <div
                                    key={sch.id}
                                    className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                                  >
                                    <div className="flex items-start gap-2.5 min-w-0">
                                      <span className="size-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                                        {sch.type === 'online' ? (
                                          <svg className="size-4 text-sky-600 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                          </svg>
                                        ) : (
                                          <svg className="size-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                          </svg>
                                        )}
                                      </span>
                                      <div className="flex flex-col min-w-0 gap-0.5">
                                        <div className="font-extrabold text-slate-800 dark:text-slate-100 flex flex-wrap items-center gap-1.5">
                                          <span>{sch.title}</span>
                                          <span className="text-[0.68rem] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.2 rounded flex items-center gap-1">
                                            <svg className="size-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span>{sch.start_time} WIB</span>
                                          </span>
                                        </div>
                                        {sch.subtitle_chapter && (
                                          <p className="text-[0.7rem] font-semibold text-primary dark:text-red-400">
                                            {sch.subtitle_chapter}
                                          </p>
                                        )}
                                        <div className="text-[0.68rem] text-slate-500 flex flex-wrap items-center gap-2">
                                          <span>Instruktur: {sch.instructor_name}</span>
                                          <span>•</span>
                                          <span>{enrolledCount}/{sch.max_quota} Siswa</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                                      {isUserEnrolled ? (
                                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-600 text-white flex items-center gap-1">
                                          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                          </svg>
                                          <span>Terdaftar</span>
                                        </span>
                                      ) : isLockedByWeekRule ? (
                                        <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 flex items-center gap-1">
                                          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                          </svg>
                                          <span>Terkunci</span>
                                        </span>
                                      ) : isFull ? (
                                        <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-500 text-white">
                                          Penuh
                                        </span>
                                      ) : (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setSelectedDateStr(dateStr)
                                            setShowClassModal(true)
                                          }}
                                          className="px-3 py-1 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white border-none cursor-pointer flex items-center gap-1"
                                        >
                                          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                          </svg>
                                          <span>Reservasi</span>
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
                            <div className={`p-3 rounded-xl border flex flex-col gap-2 text-xs ${
                              isPast
                                ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                                : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
                            }`}>
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                  {isPast ? (
                                    <svg className="size-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                  ) : (
                                    <svg className="size-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <circle cx="12" cy="12" r="8" />
                                      <circle cx="12" cy="12" r="3" />
                                    </svg>
                                  )}
                                  <span>
                                    {isPast ? 'Arsip Misi Mandiri' : 'Target Misi Mandiri'} ({dateMission.selectedVideos.length} Video)
                                  </span>
                                </span>
                                <span className="text-[0.68rem] font-bold text-slate-500">
                                  {dateMission.targetReplayCount} Replays
                                </span>
                              </div>
                              {isPast && (
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                                  <svg className="size-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                  <span className="text-[0.65rem] font-bold text-slate-500 dark:text-slate-400">Mode Lihat Arsip — Tidak dapat diedit</span>
                                </div>
                              )}
                              {dateMission.selectedVideos.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                                  {dateMission.selectedVideos.map(vid => (
                                    <span key={vid.id} className={`text-[0.7rem] font-medium px-2 py-0.5 rounded-md flex items-center gap-1 ${
                                      isPast
                                        ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                    }`}>
                                      <svg className="size-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                      </svg>
                                      <span>{vid.title}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                              {(dateMission.targetQuizCount || 0) > 0 || (dateMission.targetKotobaCount || 0) > 0 ? (
                                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-[0.68rem] font-semibold text-slate-500 dark:text-slate-400">
                                  {(dateMission.targetQuizCount || 0) > 0 && (
                                    <span className="flex items-center gap-1">
                                      <svg className="size-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <circle cx="12" cy="12" r="8" />
                                        <circle cx="12" cy="12" r="3" />
                                      </svg>
                                      <span>{dateMission.targetQuizCount} Kuis Target</span>
                                    </span>
                                  )}
                                  {(dateMission.targetKotobaCount || 0) > 0 && (
                                    <span>{dateMission.targetKotobaCount} Kotoba Target</span>
                                  )}
                                </div>
                              ) : null}
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
                {getLocalizedDayNames(language).map(d => (
                  <div key={d}>
                    <span>{d}</span>
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

                  const activeUserId = profile?.id || user?.id || ''
                  const dateMission = userMissions.get(dateStr) || getDailyMission(activeUserId, dateStr)
                  const hasPlan = dateMission !== null
                  const isNoPlan = dateMission !== null && isNoPlanMission(dateMission)
                  const isPassed = hasPlan && (streakSet.has(dateStr) || pastCompletedSet.has(dateStr))
                  const hasStreak = hasPlan && (streakSet.has(dateStr) || isPassed)

                  const accountCreatedDateStr = (profile?.created_at || user?.created_at || new Date().toISOString()).split('T')[0]
                  const isPastEligibleForStamp = isPast && (isPassed || dateStr >= accountCreatedDateStr)
                  
                  const dateStatus = calculateDateScheduleStatus(dateStr, activeUserId, accessibleSchedules, reservations)

                  let stampSrc = '/kosong.png'
                  let stampAlt = 'Belum Buat Rencana (Cap Abu-abu)'

                  if (!hasPlan) {
                    stampSrc = '/kosong.png'
                    stampAlt = 'Belum Buat Rencana (Cap Abu-abu)'
                  } else if (isNoPlan) {
                    stampSrc = '/tidakada.png'
                    stampAlt = 'Tidak Ada Rencana (Cap Biru)'
                  } else if (isPassed) {
                    stampSrc = '/lulus.png'
                    stampAlt = 'Lulus 100% (Cap Hijau)'
                  } else {
                    stampSrc = '/gagal.png'
                    stampAlt = 'Belum Tuntas (Cap Merah)'
                  }

                  let cellBgStyle = ''

                  if (dateStatus.isOnlineBooked && dateStatus.isOfflineBooked) {
                    cellBgStyle = 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-950 dark:text-indigo-100 shadow-xs'
                  } else if (dateStatus.isOnlineBooked) {
                    cellBgStyle = 'bg-sky-50/90 dark:bg-sky-950/40 border-sky-300 dark:border-sky-700 text-sky-950 dark:text-sky-100 shadow-xs'
                  } else if (dateStatus.isOfflineBooked) {
                    cellBgStyle = 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100 shadow-xs'
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
                      className={`min-h-[5.5rem] xs:min-h-[6.5rem] sm:min-h-[8.5rem] p-1.5 xs:p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex flex-col justify-between select-none relative group overflow-hidden ${cellBgStyle}`}
                    >
                      {/* Past Hanko Stamp Overlay for Daily Mission (HANYA tanggal setelah user buat akun) */}
                      {isPastEligibleForStamp && (
                        <img
                          src={stampSrc}
                          alt={stampAlt}
                          className="absolute top-1 right-1 size-5 xs:size-6 sm:size-8 object-contain pointer-events-none opacity-90 rotate-[-12deg] z-10 transition-transform group-hover:scale-110 drop-shadow-xs"
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

                      {/* Live Class Schedule Items (Google Calendar Style: Transparent with thin border for available, solid for booked) */}
                      <div className="flex flex-col gap-1 relative z-20">
                        {dateStatus.schedules.map(sch => {
                          const isEnrolled = reservations.some(r => matchScheduleId(sch.id, r.schedule_id) && r.user_id === activeUserId)
                          const enrolledCount = reservations.filter(r => matchScheduleId(sch.id, r.schedule_id)).length
                          const isFull = enrolledCount >= sch.max_quota

                          return (
                            <div
                              key={sch.id}
                              className={`text-[0.62rem] sm:text-[0.68rem] px-1.5 py-0.5 rounded-md flex items-center justify-between gap-1 whitespace-nowrap truncate transition-all ${
                                isEnrolled
                                  ? sch.type === 'online'
                                    ? 'bg-sky-600 text-white font-black shadow-xs'
                                    : 'bg-emerald-600 text-white font-black shadow-xs'
                                  : isFull
                                    ? 'bg-transparent text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700 font-normal'
                                    : sch.type === 'online'
                                      ? 'bg-transparent text-sky-600 dark:text-sky-300 border border-sky-400/90 dark:border-sky-700 font-bold hover:bg-sky-50/40'
                                      : 'bg-transparent text-emerald-600 dark:text-emerald-300 border border-emerald-400/90 dark:border-emerald-700 font-bold hover:bg-emerald-50/40'
                              }`}
                            >
                              <div className="flex items-center gap-1 min-w-0 truncate">
                                {sch.type === 'online' ? (
                                  <svg className="size-2.5 sm:size-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                ) : (
                                  <svg className="size-2.5 sm:size-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                )}
                                <span className="font-black">{sch.start_time}</span>
                                <span className="hidden sm:inline font-bold truncate">{sch.title}</span>
                              </div>
                              {isEnrolled ? (
                                <span className="text-[0.55rem] bg-white/30 text-white px-1 py-0.2 rounded font-black shrink-0 flex items-center justify-center">
                                  <svg className="size-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                </span>
                              ) : isFull ? (
                                <span className="text-[0.55rem] text-slate-400 font-normal shrink-0">Penuh</span>
                              ) : null}
                            </div>
                          )
                        })}

                        {hasStreak && (
                          <span className="text-[0.58rem] sm:text-[0.68rem] font-extrabold bg-rose-100/90 dark:bg-rose-950/90 text-rose-800 dark:text-rose-300 px-1 sm:px-1.5 py-0.5 rounded flex items-center justify-center sm:justify-start gap-1 backdrop-blur-xs whitespace-nowrap truncate">
                            <svg className="size-2.5 sm:size-3 text-rose-500 fill-rose-500 shrink-0" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                            <span className="hidden sm:inline">Streak</span>
                          </span>
                        )}
                        {dateMission && (
                          <span className={`text-[0.58rem] sm:text-[0.68rem] font-extrabold px-1 sm:px-1.5 py-0.5 rounded backdrop-blur-xs whitespace-nowrap truncate flex items-center gap-1 ${
                            isPast
                              ? 'bg-slate-200/80 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 border border-slate-300/60 dark:border-slate-600/60'
                              : isNoPlan
                                ? 'bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-300/60'
                                : 'bg-primary/15 dark:bg-primary/30 text-primary dark:text-red-300'
                          }`}>
                            {isPast && (
                              <svg className="size-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                            )}
                            <span className="truncate">
                              {isNoPlan
                                ? 'Tidak Ada Rencana'
                                : dateMission.selectedVideos.length > 0
                                  ? dateMission.selectedVideos.map(v => `Bab ${v.bab} P${v.videoNum}`).join(', ')
                                  : (dateMission.targetQuizCount || 0) > 0
                                    ? `${dateMission.targetQuizCount} Kuis`
                                    : (dateMission.targetKotobaCount || 0) > 0
                                      ? `${dateMission.targetKotobaCount} Kotoba`
                                      : 'Misi Mandiri'}
                            </span>
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
                <svg className="size-3.5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                <span>Jadwal Reservasi Kelas Live (Online vs Offline):</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Online Row */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-bold text-sky-600 dark:text-sky-400 text-[0.68rem] sm:text-[0.72rem] shrink-0">Online:</span>
                  <div className="flex items-center gap-1 bg-sky-50/80 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 border border-sky-300/80 dark:border-sky-800/60 px-2 py-0.5 rounded-lg text-[0.65rem] sm:text-[0.68rem] font-bold">
                    <span>Tersedia (Bening)</span>
                  </div>
                  <div className="flex items-center gap-1 bg-sky-600 text-white px-2 py-0.5 rounded-lg text-[0.65rem] sm:text-[0.68rem] font-bold shadow-2xs">
                    <svg className="size-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    <span>Diikuti (Solid)</span>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-400 px-2 py-0.5 rounded-lg border border-slate-200 text-[0.65rem] sm:text-[0.68rem]">
                    <span>Penuh</span>
                  </div>
                </div>

                {/* Offline Row */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[0.68rem] sm:text-[0.72rem] shrink-0">Offline:</span>
                  <div className="flex items-center gap-1 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800/60 px-2 py-0.5 rounded-lg text-[0.65rem] sm:text-[0.68rem] font-bold">
                    <span>Tersedia (Bening)</span>
                  </div>
                  <div className="flex items-center gap-1 bg-emerald-600 text-white px-2 py-0.5 rounded-lg text-[0.65rem] sm:text-[0.68rem] font-bold shadow-2xs">
                    <svg className="size-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    <span>Diikuti (Solid)</span>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-400 px-2 py-0.5 rounded-lg border border-slate-200 text-[0.65rem] sm:text-[0.68rem]">
                    <span>Penuh</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Category 2: Cap Status Misi Belajar Mandiri */}
            <div className="flex flex-col gap-2.5 bg-slate-50/70 dark:bg-slate-950/40 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-800">
              <span className="font-black text-slate-700 dark:text-slate-200 text-[0.72rem] sm:text-xs flex items-center gap-1.5">
                <svg className="size-3.5 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
                <span>Cap Status Misi Mandiri (Tanggal Berlalu):</span>
              </span>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[0.65rem] sm:text-xs">
                <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-lg sm:rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <img src="/lulus.png" alt="Lulus 100%" className="size-4 sm:size-5 object-contain" />
                  <span className="text-emerald-700 dark:text-emerald-300 font-extrabold">{t('lp_stamp_passed', '100% Selesai')}</span>
                </div>

                <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/50 px-2.5 py-1 rounded-lg sm:rounded-xl border border-red-200 dark:border-red-800">
                  <img src="/gagal.png" alt="Belum Tuntas" className="size-4 sm:size-5 object-contain" />
                  <span className="text-red-700 dark:text-red-300 font-extrabold">{t('lp_stamp_incomplete', 'Belum Tuntas (<100%)')}</span>
                </div>

                <div className="flex items-center gap-1.5 bg-sky-50 dark:bg-sky-950/50 px-2.5 py-1 rounded-lg sm:rounded-xl border border-sky-200 dark:border-sky-800">
                  <img src="/tidakada.png" alt="Tidak Ada Rencana" className="size-4 sm:size-5 object-contain" />
                  <span className="text-sky-700 dark:text-sky-300 font-extrabold">{t('lp_stamp_noplan', 'Tidak Ada Rencana')}</span>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-700">
                  <img src="/kosong.png" alt="Belum Buat Rencana" className="size-4 sm:size-5 object-contain" />
                  <span className="text-slate-600 dark:text-slate-300 font-extrabold">{t('lp_stamp_uncreated', 'Belum Buat Rencana')}</span>
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
                  {isSelectedDatePast ? t('lp_archive_mode', 'Arsip Rencana Belajar') : t('lp_target_missions', 'Target & Misi')}
                </span>
                <h3 className="text-base sm:text-lg font-extrabold mt-1 text-white leading-snug">
                  {formatDateIndonesian(selectedDateStr, language)}
                </h3>
              </div>
              {selectedDateStr === todayStr && (
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-500/30 shrink-0">
                  {t('lp_today_btn', 'Hari Ini')}
                </span>
              )}
            </div>

            {/* Quick Button to open Class Enroll Modal */}
            <button
              onClick={() => setShowClassModal(true)}
              className="w-full py-2.5 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white font-extrabold rounded-2xl border border-white/10 cursor-pointer text-xs shadow-md transition-all flex items-center justify-center gap-2"
            >
              <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              <span>Sesi Kelas Live Tanggal Ini</span>
            </button>

            {/* Live Class Sessions Card in Right Panel */}
            {accessibleSchedules.filter(s => isScheduleActiveOnDate(s, selectedDateStr)).length > 0 && (
              <div className="p-4 rounded-2xl bg-sky-950/70 border border-sky-400/30 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-sky-300 flex items-center gap-1.5">
                    <svg className="size-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    <span>Sesi Kelas Live ({accessibleSchedules.filter(s => isScheduleActiveOnDate(s, selectedDateStr)).length} Sesi)</span>
                  </span>
                  <button
                    onClick={() => setShowClassModal(true)}
                    className="text-[0.7rem] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1 bg-transparent border-none cursor-pointer"
                  >
                    <span>Buka Modal</span>
                    <svg className="size-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </button>
                </div>

                <div className="space-y-2">
                  {accessibleSchedules.filter(s => isScheduleActiveOnDate(s, selectedDateStr)).map(sch => {
                    const activeUserId = profile?.id || user?.id || ''
                    const userRes = reservations.find(r => matchScheduleId(sch.id, r.schedule_id) && r.user_id === activeUserId)
                    const enrolledCount = reservations.filter(r => matchScheduleId(sch.id, r.schedule_id)).length
                    const isFull = enrolledCount >= sch.max_quota

                    let isLocked = false
                    let lockReason = ''

                    if (!userRes && !isFull) {
                      if (sch.type === 'online') {
                        const schWeekId = sch.week_range_id || getWeekRangeId(sch.date)
                        const hasWeeklyOnline = reservations.some(r => {
                          if (r.user_id !== activeUserId) return false
                          const targetSch = schedules.find(s => matchScheduleId(s.id, r.schedule_id))
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
                          const targetSch = schedules.find(s => matchScheduleId(s.id, r.schedule_id))
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
                          <span className="font-extrabold text-sky-300 flex items-center gap-1">
                            {sch.type === 'offline' ? (
                              <>
                                <svg className="size-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                <span>3D2N Offline</span>
                              </>
                            ) : (
                              <>
                                <svg className="size-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                <span>{formatTimeShort(sch.start_time)} - {formatTimeShort(sch.end_time)} WIB</span>
                              </>
                            )}
                          </span>
                          <span className="text-white/70 font-semibold">{enrolledCount}/{sch.max_quota} Siswa</span>
                        </div>
                        <div className="font-extrabold text-white text-[0.82rem] leading-snug">{sch.title}</div>
                        {sch.type === 'offline' && (
                          <div className="text-[0.68rem] text-emerald-300 font-medium flex items-center gap-1">
                            <svg className="size-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            <span>{formatDateRangeIndonesian(sch.start_date || sch.date, sch.end_date, sch.start_time, sch.end_time, language).formattedRange}</span>
                          </div>
                        )}
                        <div className="text-[0.72rem] text-white/80 flex items-center gap-1">
                          <svg className="size-3 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          <span>Instruktur: {sch.instructor_name}</span>
                        </div>
                        
                        <div className="mt-1 pt-1.5 border-t border-white/10 flex items-center justify-between">
                          <span className="text-[0.68rem] font-bold text-sky-200 flex items-center gap-1">
                            {sch.type === 'online' ? (
                              <>
                                <svg className="size-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                <span>Google Meet</span>
                              </>
                            ) : (
                              <>
                                <svg className="size-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                <span>Offline Dojo</span>
                              </>
                            )}
                          </span>
                          {userRes ? (
                            <span className="text-[0.68rem] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <svg className="size-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              <span>Terdaftar</span>
                            </span>
                          ) : isFull ? (
                            <span className="text-[0.68rem] font-bold text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md">
                              Kuota Penuh
                            </span>
                          ) : isLocked ? (
                            <span className="text-[0.68rem] font-bold text-sky-300 bg-sky-950/80 px-2 py-0.5 rounded-md border border-sky-400/30 flex items-center gap-1">
                              <svg className="size-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                              <span>{lockReason}</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => setShowClassModal(true)}
                              className="text-[0.68rem] font-extrabold text-white bg-sky-600 hover:bg-sky-500 px-2.5 py-1 rounded-lg border-none cursor-pointer shadow-xs flex items-center gap-1"
                            >
                              <svg className="size-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                              <span>Reservasi Sesi Ini</span>
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
                {isNoPlanMission(selectedMission) ? (
                  <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-400/30 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <img src="/tidakada.png" alt="Tidak Ada Rencana" className="size-8 object-contain shrink-0 rotate-[-6deg]" />
                      <div>
                        <div className="text-xs font-black text-sky-300">Cap Biru (Tidak Ada Rencana)</div>
                        <div className="text-[0.68rem] text-slate-300">Hari istirahat terencana (Video, Kuis, & Kotoba 0)</div>
                      </div>
                    </div>
                    <span className="text-[0.65rem] font-extrabold px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-200 border border-sky-400/30">
                      Cap Biru
                    </span>
                  </div>
                ) : (
                  <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                    missionProgress.isFullyCompleted
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-rose-500/10 border-rose-500/30'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <img
                        src={missionProgress.isFullyCompleted ? '/lulus.png' : '/gagal.png'}
                        alt={missionProgress.isFullyCompleted ? 'Lulus 100%' : 'Belum Tuntas'}
                        className="size-8 object-contain shrink-0 rotate-[-6deg]"
                      />
                      <div>
                        <div className="text-xs font-black text-white">
                          {missionProgress.isFullyCompleted ? 'Cap Hijau: 100% Selesai' : `Cap Merah: Belum Tuntas (${missionProgress.overallPct}%)`}
                        </div>
                        <div className="text-[0.68rem] text-slate-300">
                          {missionProgress.isFullyCompleted ? 'Semua target misi telah tercapai 100%' : 'Target misi belum tuntas tercapai (<100%)'}
                        </div>
                      </div>
                    </div>
                    <span className={`font-black px-2.5 py-0.5 rounded-full text-[0.7rem] ${
                      missionProgress.isFullyCompleted
                        ? 'bg-emerald-500 text-white'
                        : 'bg-rose-500 text-white'
                    }`}>
                      {missionProgress.isFullyCompleted ? '100% Lulus' : `${missionProgress.overallPct}%`}
                    </span>
                  </div>
                )}

                {/* Video Target Details */}
                <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 flex flex-col gap-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5">
                      <svg className="size-3.5 text-sky-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      <span>Target Video ({selectedMission.selectedVideos.length} Video)</span>
                    </span>
                    <span className="text-emerald-300">{missionProgress.actualReplays}/{missionProgress.targetReplays}x</span>
                  </div>
                  <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${selectedMission.targetReplayCount > 0 ? Math.min(100, (missionProgress.actualReplays / selectedMission.targetReplayCount) * 100) : 100}%` }} />
                  </div>
                  <div className="flex flex-col gap-1 mt-1">
                    {selectedMission.selectedVideos.map((v, i) => (
                      <div key={i} className="text-[0.7rem] text-slate-300 flex items-center gap-1.5">
                        <span className="size-1 rounded-full bg-slate-400 shrink-0" />
                        <span className="truncate">{v.title}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quiz & Kotoba Target Details */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-2xl bg-white/10 border border-white/15">
                    <span className="text-slate-300 text-[0.68rem] flex items-center gap-1 mb-1">
                      <svg className="size-3 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>
                      <span>Target Kuis</span>
                    </span>
                    {missionProgress.targetQuizzes > 0 ? (
                      <span className="font-extrabold text-indigo-300 text-sm">{missionProgress.actualQuizzes}/{missionProgress.targetQuizzes}</span>
                    ) : (
                      <span className="font-bold text-slate-400 text-[0.7rem] block">Tidak ada kuis</span>
                    )}
                  </div>
                  <div className="p-3 rounded-2xl bg-white/10 border border-white/15">
                    <span className="text-slate-300 text-[0.68rem] flex items-center gap-1 mb-1">
                      <svg className="size-3 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.328.477-4.5 1.253" /></svg>
                      <span>Target Kotoba</span>
                    </span>
                    {missionProgress.targetKotoba > 0 ? (
                      <span className="font-extrabold text-amber-300 text-sm">{missionProgress.actualKotoba}/{missionProgress.targetKotoba}</span>
                    ) : (
                      <span className="font-bold text-slate-400 text-[0.7rem] block">Tidak ada kotoba</span>
                    )}
                  </div>
                </div>

                {/* If past date, show read-only note instead of edit button */}
                {isSelectedDatePast ? (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center text-xs text-slate-400 font-medium flex items-center justify-center gap-1.5">
                    <svg className="size-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    <span>{t('lp_past_date_locked', 'Tanggal telah berlalu (Mode Lihat Arsip)')}</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowMissionModal(true)}
                    className="w-full py-3 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white font-extrabold rounded-2xl border-none cursor-pointer text-xs shadow-md transition-all mt-1 flex items-center justify-center gap-2"
                  >
                    <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    <span>{t('lp_edit_mission_btn', 'Edit Misi Tanggal Ini')}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="p-6 bg-white/5 rounded-2xl border border-white/10 text-center flex flex-col items-center gap-3">
                {isSelectedDatePast ? (
                  <div className="flex flex-col items-center gap-2.5">
                    <img src="/kosong.png" alt="Belum Buat Rencana (Cap Abu-abu)" className="size-12 object-contain opacity-90 rotate-[-6deg]" />
                    <span className="text-xs font-black text-slate-300 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700">
                      Cap Abu-abu: Belum Buat Rencana
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed mt-1">
                      Hari ini telah berlalu dan <strong>tidak ada rencana belajar</strong> yang disusun pada <strong>{formatDateIndonesian(selectedDateStr, language)}</strong>.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="size-10 rounded-2xl bg-white/10 flex items-center justify-center text-slate-300">
                      <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Belum ada misi harian yang dibuat untuk <strong>{formatDateIndonesian(selectedDateStr, language)}</strong>.
                    </p>
                    <button
                      onClick={() => setShowMissionModal(true)}
                      className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-extrabold rounded-2xl border-none cursor-pointer transition-all shadow-md flex items-center justify-center gap-1.5"
                    >
                      <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                      <span>{t('lp_btn_create', 'Susun Misi Tanggal Ini')}</span>
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
          schedules={accessibleSchedules}
          reservations={reservations}
          userId={profile?.id || user?.id || ''}
          userName={profile?.full_name || user?.user_metadata?.full_name || 'Pengguna'}
          userEmail={profile?.email || user?.email || ''}
          profile={profile}
          groups={groups}
          onClose={() => setShowClassModal(false)}
          onRefresh={reloadSchedules}
          onOpenMissionBuilder={() => setShowMissionModal(true)}
        />
      )}


      {/* Daily Mission Builder Modal */}
      {showMissionModal && (
        <DailyMissionBuilderModal
          targetDate={selectedDateStr}
          currentMission={userMissions.get(selectedDateStr) || (activeUserId ? getDailyMission(activeUserId, selectedDateStr) : null) || selectedMission}
          onSave={handleSaveMission}
          onClose={() => setShowMissionModal(false)}
        />
      )}
    </main>
  )
}

