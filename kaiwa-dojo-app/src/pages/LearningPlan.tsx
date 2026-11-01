import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'
import {
  type DailyMissionData,
  type MissionProgress,
  getDailyMission,
  saveDailyMission,
  calculateMissionProgress,
  fetchAllUserMissions,
  isNoPlanMission,
  getTodayDateString,
  DAILY_MISSION_UPDATE_EVENT,
  subscribeToDailyMissionRealtime,
} from '../lib/dailyMission'

import DailyMissionBuilderModal from '../components/DailyMissionBuilderModal'
import { getSubscriptionAccess } from '../lib/subscriptionAccess'
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
  isSchedulePast,
  formatDateRangeIndonesian,
  formatTimeShort,
  sortSchedules,
  getScheduleLockStatus,
  RESERVATION_UPDATE_EVENT,
  SCHEDULE_UPDATE_EVENT,
  subscribeToScheduleRealtime,
  matchScheduleId,
} from '../lib/scheduleService'

/* ── Date & Month Helpers (Localized) ──────────────── */
function toLocale(lang: string) {
  return lang === 'ja' ? 'ja-JP' : lang === 'en' ? 'en-US' : 'id-ID'
}

function getLocalizedMonthName(monthIdx: number, lang: string = 'id'): string {
  return new Date(2026, monthIdx, 1).toLocaleString(toLocale(lang), { month: 'long' })
}

function getLocalizedDayNames(lang: string = 'id'): string[] {
  if (lang === 'ja') return ['日', '月', '火', '水', '木', '金', '土']
  if (lang === 'en') return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
}

function parseLocalDate(dateStr: string): Date | null {
  const [y, m, d] = (dateStr || '').slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function formatDateIndonesian(dateStr: string, lang: string = 'id'): string {
  const dt = parseLocalDate(dateStr)
  if (!dt) return dateStr
  return dt.toLocaleDateString(toLocale(lang), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function formatShortDate(dateStr: string, lang: string = 'id'): string {
  const dt = parseLocalDate(dateStr)
  if (!dt) return dateStr
  return dt.toLocaleDateString(toLocale(lang), { weekday: 'short', day: 'numeric', month: 'short' })
}

function toDateStr(y: number, monthIdx: number, d: number) {
  return `${y}-${String(monthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function missionSummary(m: DailyMissionData): string {
  if (isNoPlanMission(m)) return 'Hari istirahat'
  const parts: string[] = []
  if (m.selectedVideos.length > 0) parts.push(`${m.selectedVideos.length} video`)
  if ((m.targetQuizCount || 0) > 0) parts.push(`${m.targetQuizCount} kuis`)
  if ((m.targetKotobaCount || 0) > 0) parts.push(`${m.targetKotobaCount} kotoba`)
  return parts.join(' · ') || 'Rencana mandiri'
}

/* ── Icons ─────────────────────────────────────────── */
type IconProps = { className?: string }
const IconVideo = ({ className = 'size-4' }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
)
const IconBuilding = ({ className = 'size-4' }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
)
const IconCalendar = ({ className = 'size-4' }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
)
const IconList = ({ className = 'size-4' }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" /></svg>
)
const IconClock = ({ className = 'size-4' }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
)
const IconUser = ({ className = 'size-4' }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
)
const IconLock = ({ className = 'size-4' }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
)
const IconCheck = ({ className = 'size-4' }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
)
const IconClose = ({ className = 'size-4' }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
)
const IconChevron = ({ className = 'size-4', dir = 'right' }: IconProps & { dir?: 'left' | 'right' | 'down' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d={dir === 'left' ? 'M15 19l-7-7 7-7' : dir === 'down' ? 'M19 9l-7 7-7-7' : 'M9 5l7 7-7 7'} />
  </svg>
)
const IconPlus = ({ className = 'size-4' }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
)
const IconEdit = ({ className = 'size-4' }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
)
const IconPlay = ({ className = 'size-4' }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polygon points="6 4 20 12 6 20 6 4" /></svg>
)

/* ── Class Reservation Sheet (per tanggal) ─────────── */
function DateClassSheet({
  dateStr,
  daySchedules,
  allSchedules,
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
  daySchedules: ClassSchedule[]
  allSchedules: ClassSchedule[]
  reservations: ClassReservation[]
  userId: string
  userName: string
  userEmail: string
  profile?: any
  groups: KaiwaGroup[]
  onClose: () => void
  onRefresh: () => Promise<void>
  onOpenMissionBuilder: () => void
}) {
  const { language } = useLanguage()
  const { toast } = useToast()
  const [confirmFor, setConfirmFor] = useState<{ id: string; kind: 'book' | 'cancel' } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const isPastDate = dateStr < getTodayDateString()

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busyId) onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [busyId, onClose])

  async function handleBook(sch: ClassSchedule) {
    setBusyId(sch.id)
    const res = await bookClass(sch, userId, userName, userEmail, profile, groups)
    if (res.success) {
      toast.success(res.message || `Berhasil reservasi kelas "${sch.title}"!`, 'Reservasi Berhasil')
      await onRefresh()
    } else {
      toast.error(res.message, 'Gagal Reservasi')
    }
    setBusyId(null)
    setConfirmFor(null)
  }

  async function handleCancel(resId: string) {
    setBusyId(resId)
    const ok = await cancelClassBooking(resId)
    if (ok) {
      toast.info('Reservasi kelas berhasil dibatalkan.', 'Reservasi Dibatalkan')
      await onRefresh()
    } else {
      toast.error('Gagal membatalkan reservasi.', 'Gagal')
    }
    setBusyId(null)
    setConfirmFor(null)
  }

  return (
    <div
      className="modal-overlay fixed inset-0 z-[999] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-fade-in"
      onClick={() => { if (!busyId) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="class-sheet-title"
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92dvh] overflow-hidden animate-fade-in-up"
      >
        <div className="shrink-0 px-5 pt-3 sm:pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="sm:hidden mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-sky-600 dark:text-sky-400">Kelas Live</p>
              <h3 id="class-sheet-title" className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                {formatDateIndonesian(dateStr, language)}
              </h3>
            </div>
            <button
              onClick={onClose}
              disabled={Boolean(busyId)}
              aria-label="Tutup"
              className="size-10 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 border-none cursor-pointer flex items-center justify-center transition-colors disabled:opacity-50"
            >
              <IconClose />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-5 flex flex-col gap-3 overscroll-contain">
          {daySchedules.length === 0 ? (
            <div className="py-8 text-center flex flex-col items-center gap-3">
              <div className="size-14 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <IconVideo className="size-7" />
              </div>
              <div>
                <p className="text-base font-bold text-slate-800 dark:text-white">Tidak ada kelas live</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Pilih tanggal lain yang bertanda titik biru/hijau di kalender.</p>
              </div>
              {!isPastDate && (
                <button
                  onClick={() => { onClose(); onOpenMissionBuilder() }}
                  className="mt-1 h-11 px-5 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-bold border-none cursor-pointer transition-colors"
                >
                  Susun Rencana Belajar
                </button>
              )}
            </div>
          ) : (
            daySchedules.map(sch => {
              const enrolled = reservations.filter(r => matchScheduleId(sch.id, r.schedule_id)).length
              const userRes = reservations.find(r => matchScheduleId(sch.id, r.schedule_id) && r.user_id === userId)
              const lock = getScheduleLockStatus(sch, { userId, schedules: allSchedules, reservations, profile, groups })
              const isOnline = sch.type === 'online'
              const start = (sch.start_date || sch.date).slice(0, 10)
              const end = (sch.end_date || start).slice(0, 10)
              const isMultiDay = end !== start
              const { badgeLabel } = formatDateRangeIndonesian(start, end, sch.start_time, sch.end_time, language)
              const remaining = Math.max(0, sch.max_quota - enrolled)
              const quotaPct = Math.min(100, Math.round((enrolled / Math.max(1, sch.max_quota)) * 100))
              const isConfirming = confirmFor?.id === (userRes ? userRes.id : sch.id)
              const isBusy = busyId === sch.id || (userRes && busyId === userRes.id)
              const schPast = isSchedulePast(sch)

              return (
                <article
                  key={sch.id}
                  className={`rounded-2xl border p-4 flex flex-col gap-3 ${
                    userRes ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      isOnline ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                    }`}>
                      {isOnline ? <IconVideo className="size-3.5" /> : <IconBuilding className="size-3.5" />}
                      {isOnline ? 'Online · Google Meet' : `Offline · ${badgeLabel}`}
                    </span>
                    {userRes && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-white">
                        <IconCheck className="size-3" /> Terdaftar
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-[15px] font-bold text-slate-900 dark:text-white leading-snug">{sch.title}</h4>
                    {sch.subtitle_chapter && <p className="text-[13px] font-semibold text-primary dark:text-red-400">{sch.subtitle_chapter}</p>}
                  </div>

                  <ul className="space-y-1.5 text-[13px] text-slate-600 dark:text-slate-300">
                    {isMultiDay && (
                      <li className="flex items-start gap-2"><IconCalendar className="size-4 mt-0.5 shrink-0 text-slate-400" />{formatShortDate(start, language)} – {formatShortDate(end, language)}</li>
                    )}
                    <li className="flex items-start gap-2"><IconClock className="size-4 mt-0.5 shrink-0 text-slate-400" /><span className="font-semibold text-slate-800 dark:text-slate-100">{formatTimeShort(sch.start_time)} – {formatTimeShort(sch.end_time)} WIB</span></li>
                    <li className="flex items-start gap-2"><IconUser className="size-4 mt-0.5 shrink-0 text-slate-400" />{sch.instructor_name || '-'}</li>
                  </ul>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-500 dark:text-slate-400">{enrolled}/{sch.max_quota} terisi</span>
                      <span className={`font-bold ${remaining === 0 ? 'text-red-600 dark:text-red-400' : remaining <= 2 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}`}>
                        {remaining === 0 ? 'Penuh' : `Sisa ${remaining} kursi`}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className={`h-full rounded-full ${remaining === 0 ? 'bg-red-500' : isOnline ? 'bg-sky-500' : 'bg-emerald-500'}`} style={{ width: `${quotaPct}%` }} />
                    </div>
                  </div>

                  {/* Actions — konfirmasi inline, tanpa dialog browser */}
                  {isConfirming ? (
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 flex flex-col gap-2.5 animate-fade-in">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {confirmFor?.kind === 'book' ? 'Reservasi kelas ini?' : 'Batalkan reservasi ini? Kursimu akan dilepas.'}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setConfirmFor(null)}
                          disabled={Boolean(isBusy)}
                          className="h-11 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold cursor-pointer disabled:opacity-50"
                        >
                          Kembali
                        </button>
                        <button
                          onClick={() => confirmFor?.kind === 'book' ? handleBook(sch) : userRes && handleCancel(userRes.id)}
                          disabled={Boolean(isBusy)}
                          className={`h-11 rounded-xl text-white text-sm font-bold border-none cursor-pointer disabled:opacity-70 flex items-center justify-center gap-2 ${
                            confirmFor?.kind === 'book' ? 'bg-primary hover:bg-primary-dark' : 'bg-red-600 hover:bg-red-700'
                          }`}
                        >
                          {isBusy && <span className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                          {isBusy ? 'Memproses...' : confirmFor?.kind === 'book' ? 'Ya, Reservasi' : 'Ya, Batalkan'}
                        </button>
                      </div>
                    </div>
                  ) : userRes ? (
                    <div className="flex gap-2">
                      {isOnline && sch.meet_url && !schPast && (
                        <a
                          href={sch.meet_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 h-11 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold no-underline flex items-center justify-center gap-2 transition-colors"
                        >
                          <IconVideo /> Gabung Meet
                        </a>
                      )}
                      {!schPast && (
                        <button
                          onClick={() => setConfirmFor({ id: userRes.id, kind: 'cancel' })}
                          className={`${isOnline && sch.meet_url ? '' : 'flex-1'} h-11 px-4 rounded-xl bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/40 text-sm font-bold cursor-pointer transition-colors`}
                        >
                          Batalkan
                        </button>
                      )}
                    </div>
                  ) : lock.isLocked ? (
                    <div className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm font-semibold flex items-center justify-center gap-2">
                      <IconLock /> {lock.reason}
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmFor({ id: sch.id, kind: 'book' })}
                      className="h-11 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-bold border-none cursor-pointer shadow-sm shadow-primary/20 transition-colors"
                    >
                      Reservasi Kelas
                    </button>
                  )}
                </article>
              )
            })
          )}

          <Link
            to="/reservasi-kelas"
            className="self-center mt-1 text-sm font-semibold text-sky-600 dark:text-sky-400 hover:underline no-underline px-2 py-2"
          >
            Lihat semua jadwal di Reservasi Kelas →
          </Link>
        </div>
      </div>
    </div>
  )
}

/* ── Progress row untuk target misi ────────────────── */
function TargetRow({
  icon,
  label,
  actual,
  target,
  barClass,
}: {
  icon: React.ReactNode
  label: string
  actual: number
  target: number
  barClass: string
}) {
  const done = target > 0 && actual >= target
  const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
          {icon}
          {label}
        </span>
        <span className={`font-bold tabular-nums ${done ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
          {Math.min(actual, target)}/{target}
          {done && <IconCheck className="inline size-3.5 ml-1 -mt-0.5" />}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-emerald-500' : barClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/* ── Main LearningPlan Page ─────────────────────── */
export default function LearningPlanPage() {
  const { user, profile } = useAuth()
  const { language, t } = useLanguage()
  const { toast } = useToast()

  const todayStr = getTodayDateString()
  const activeUserId = profile?.id || user?.id || null
  const accountCreatedDateStr = (profile?.created_at || user?.created_at || new Date().toISOString()).split('T')[0]

  // View state
  const [viewMode, setViewMode] = useState<'calendar' | 'agenda'>('calendar')
  const [agendaOnlyMine, setAgendaOnlyMine] = useState(true)
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => new Date())
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr)

  // Modals
  const [showMissionModal, setShowMissionModal] = useState(false)
  const [missionModalDate, setMissionModalDate] = useState<string>(todayStr)
  // Snapshot misi saat modal dibuka — referensi stabil agar form tidak ter-reset saat halaman re-render
  const [missionModalMission, setMissionModalMission] = useState<DailyMissionData | null>(null)
  const [showClassSheet, setShowClassSheet] = useState(false)

  // Mission data
  const [userMissions, setUserMissions] = useState<Map<string, DailyMissionData>>(new Map())
  const [streakSet, setStreakSet] = useState<Set<string>>(new Set())
  const [pastCompletedSet, setPastCompletedSet] = useState<Set<string>>(new Set())
  const [selectedProgress, setSelectedProgress] = useState<MissionProgress | null>(null)
  const [todayProgress, setTodayProgress] = useState<MissionProgress | null>(null)
  const [dataVersion, setDataVersion] = useState(0)
  const preFetchedRef = useRef<{ progressData: any[]; kotobaSubmissions: any[] } | null>(null)

  // Class data
  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [reservations, setReservations] = useState<ClassReservation[]>([])
  const [groups, setGroups] = useState<KaiwaGroup[]>([])

  const year = currentMonthDate.getFullYear()
  const month = currentMonthDate.getMonth()

  async function reloadSchedules() {
    const [sData, rData, gData] = await Promise.all([fetchSchedules(), fetchReservations(), fetchGroups()])
    setSchedules(sData)
    setReservations(rData)
    setGroups(gData)
  }

  useEffect(() => {
    reloadSchedules()
    const handleSync = () => reloadSchedules()
    window.addEventListener(RESERVATION_UPDATE_EVENT, handleSync)
    window.addEventListener(SCHEDULE_UPDATE_EVENT, handleSync)
    window.addEventListener(GROUP_UPDATE_EVENT, handleSync)
    window.addEventListener('storage', handleSync)
    const unsubscribeScheduleRealtime = subscribeToScheduleRealtime(handleSync)
    return () => {
      window.removeEventListener(RESERVATION_UPDATE_EVENT, handleSync)
      window.removeEventListener(SCHEDULE_UPDATE_EVENT, handleSync)
      window.removeEventListener(GROUP_UPDATE_EVENT, handleSync)
      window.removeEventListener('storage', handleSync)
      unsubscribeScheduleRealtime()
    }
  }, [])

  // Pelajar belum berlangganan: jadwal & reservasi kelas tidak ditampilkan sama sekali
  const isSubscriptionLocked = getSubscriptionAccess(profile).isLocked
  const accessibleSchedules: ClassSchedule[] = useMemo(
    () => isSubscriptionLocked ? [] : schedules.filter(s => isScheduleAccessibleForUser(s, profile, groups)),
    [schedules, profile, groups, isSubscriptionLocked]
  )

  /**
   * Data berat (streak, progres, kotoba, semua misi, status lulus sebulan) hanya dimuat
   * saat bulan/user berubah atau ada sinkronisasi — BUKAN setiap kali tanggal diklik.
   */
  async function loadMonthData() {
    if (!activeUserId) return
    const [sRes, pRes, kRes] = await Promise.all([
      supabase.from('learning_streaks').select('date').eq('student_id', activeUserId),
      supabase.from('lesson_progress').select('lesson_id, is_completed, replay_count, last_watched_at').eq('student_id', activeUserId),
      supabase.from('user_kotoba_submissions').select('id, created_at').eq('user_id', activeUserId),
    ])
    const streakDates = new Set<string>((sRes.data || []).map((s: any) => s.date))
    const preFetched = { progressData: pRes.data || [], kotobaSubmissions: kRes.data || [] }
    preFetchedRef.current = preFetched

    const allMissionsMap = await fetchAllUserMissions(activeUserId)

    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const results = await Promise.all(
      Array.from({ length: daysInMonth }, async (_, idx) => {
        const dStr = toDateStr(year, month, idx + 1)
        const m = allMissionsMap.get(dStr)
        if (!m) return null
        if (isNoPlanMission(m) || streakDates.has(dStr)) return dStr
        const prog = await calculateMissionProgress(activeUserId, m, preFetched)
        return prog.isFullyCompleted ? dStr : null
      })
    )

    const todayMission = allMissionsMap.get(todayStr) || getDailyMission(activeUserId, todayStr)
    const todayProg = todayMission ? await calculateMissionProgress(activeUserId, todayMission, preFetched) : null

    setStreakSet(streakDates)
    setUserMissions(allMissionsMap)
    setPastCompletedSet(new Set(results.filter((d): d is string => Boolean(d))))
    setTodayProgress(todayProg)
    setDataVersion(v => v + 1)
  }

  useEffect(() => {
    if (!activeUserId) return
    loadMonthData()

    let syncTimer: ReturnType<typeof setTimeout> | null = null
    const handleMissionSync = () => {
      if (syncTimer) clearTimeout(syncTimer)
      syncTimer = setTimeout(() => loadMonthData(), 350)
    }
    window.addEventListener('kaiwa_mission_progress_updated', handleMissionSync)
    window.addEventListener(DAILY_MISSION_UPDATE_EVENT, handleMissionSync)
    window.addEventListener('storage', handleMissionSync)
    const unsubscribeMissionRealtime = subscribeToDailyMissionRealtime(handleMissionSync)

    return () => {
      if (syncTimer) clearTimeout(syncTimer)
      window.removeEventListener('kaiwa_mission_progress_updated', handleMissionSync)
      window.removeEventListener(DAILY_MISSION_UPDATE_EVENT, handleMissionSync)
      window.removeEventListener('storage', handleMissionSync)
      unsubscribeMissionRealtime()
    }
  }, [activeUserId, year, month])

  function getMissionFor(dateStr: string): DailyMissionData | null {
    // getDailyMission('') dianggap "hari ini" — tanggal kosong harus menghasilkan null
    if (!dateStr) return null
    return userMissions.get(dateStr) || (activeUserId ? getDailyMission(activeUserId, dateStr) : null)
  }

  // Progres tanggal terpilih — ringan, memakai data yang sudah di-prefetch
  const selectedMission = getMissionFor(selectedDateStr)
  const progressReqRef = useRef(0)
  useEffect(() => {
    if (!activeUserId || !selectedMission) {
      setSelectedProgress(null)
      return
    }
    const reqId = ++progressReqRef.current
    calculateMissionProgress(activeUserId, selectedMission, preFetchedRef.current || undefined).then(prog => {
      if (reqId === progressReqRef.current) setSelectedProgress(prog)
    })
  }, [selectedDateStr, dataVersion, activeUserId])

  async function handleSaveMission(data: Omit<DailyMissionData, 'date'>, dateStr: string) {
    if (!activeUserId) {
      toast.error('Sesi pengguna tidak terdeteksi. Silakan login kembali.', 'Gagal')
      throw new Error('Sesi pengguna tidak terdeteksi. Silakan muat ulang halaman atau login kembali.')
    }
    try {
      const saved = await saveDailyMission(activeUserId, data, dateStr)
      setUserMissions(prev => new Map(prev).set(dateStr, saved))
      setSelectedDateStr(dateStr)
      const dt = parseLocalDate(dateStr)
      if (dt && (dt.getFullYear() !== year || dt.getMonth() !== month)) {
        setCurrentMonthDate(new Date(dt.getFullYear(), dt.getMonth(), 1))
      }
      setShowMissionModal(false)
      loadMonthData()

      const isRest = data.selectedVideos.length === 0 && data.targetKotobaCount === 0 && data.targetQuizCount === 0
      if (isRest) {
        toast.info('Hari istirahat terencana berhasil diatur untuk tanggal ini! 🛌', 'Rencana Belajar')
      } else {
        toast.success('Rencana belajar harian berhasil disimpan! Target belajarmu telah aktif. 🎯', 'Rencana Belajar')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyimpan rencana belajar. Silakan coba lagi.', 'Gagal Menyimpan')
      throw err
    }
  }

  function openMissionBuilder(dateStr: string) {
    const target = dateStr < todayStr ? todayStr : dateStr
    setMissionModalDate(target)
    setMissionModalMission(getMissionFor(target))
    setShowMissionModal(true)
  }

  function openClassSheet(dateStr: string) {
    setSelectedDateStr(dateStr)
    setShowClassSheet(true)
  }

  /* ── Calendar calculations ───────────────────────── */
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthDays = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => ({ dayNum: i + 1, dateStr: toDateStr(year, month, i + 1) })),
    [year, month, daysInMonth]
  )

  const uid = activeUserId || ''
  const statusByDate = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateDateScheduleStatus>>()
    for (const { dateStr } of monthDays) {
      map.set(dateStr, calculateDateScheduleStatus(dateStr, uid, accessibleSchedules, reservations))
    }
    return map
  }, [monthDays, uid, accessibleSchedules, reservations])

  function changeMonth(delta: number) {
    const next = new Date(year, month + delta, 1)
    setCurrentMonthDate(next)
    const now = new Date()
    setSelectedDateStr(
      next.getFullYear() === now.getFullYear() && next.getMonth() === now.getMonth()
        ? todayStr
        : toDateStr(next.getFullYear(), next.getMonth(), 1)
    )
  }

  function handleTodayClick() {
    setCurrentMonthDate(new Date())
    setSelectedDateStr(todayStr)
  }

  type Stamp = { src: string; label: string; tone: string }
  function getStamp(dateStr: string): Stamp | null {
    if (dateStr >= todayStr) return null
    const m = getMissionFor(dateStr)
    const hasPlan = Boolean(m)
    const isNoPlan = hasPlan && isNoPlanMission(m)
    const isPassed = hasPlan && (streakSet.has(dateStr) || pastCompletedSet.has(dateStr))
    if (!isPassed && dateStr < accountCreatedDateStr) return null
    if (!hasPlan) return { src: '/kosong.png', label: 'Belum buat rencana', tone: 'text-slate-500' }
    if (isNoPlan) return { src: '/tidakada.png', label: 'Hari istirahat', tone: 'text-sky-600 dark:text-sky-400' }
    if (isPassed) return { src: '/lulus.png', label: 'Lulus 100%', tone: 'text-emerald-600 dark:text-emerald-400' }
    return { src: '/gagal.png', label: 'Belum tuntas', tone: 'text-red-600 dark:text-red-400' }
  }

  function getDaySchedules(dateStr: string) {
    return sortSchedules(accessibleSchedules.filter(s => isScheduleActiveOnDate(s, dateStr)))
  }
  function isMine(sch: ClassSchedule) {
    return reservations.some(r => matchScheduleId(sch.id, r.schedule_id) && r.user_id === uid)
  }

  // Header stats
  const monthName = getLocalizedMonthName(month, language)
  const passedThisMonth = monthDays.filter(({ dateStr }) => {
    const m = userMissions.get(dateStr)
    return dateStr < todayStr && m && !isNoPlanMission(m) && pastCompletedSet.has(dateStr)
  }).length
  const upcomingClasses = reservations.filter(r => {
    if (r.user_id !== uid) return false
    const sch = schedules.find(s => matchScheduleId(s.id, r.schedule_id))
    return sch && !isSchedulePast(sch)
  }).length
  const todayMission = getMissionFor(todayStr)

  const agendaDays = agendaOnlyMine
    ? monthDays.filter(({ dateStr }) => statusByDate.get(dateStr)?.isBooked || Boolean(getMissionFor(dateStr)))
    : monthDays

  /* ── Day detail (dipakai panel samping & agenda inline) ── */
  function renderDayDetail(dateStr: string) {
    const isPast = dateStr < todayStr
    const isToday = dateStr === todayStr
    const mission = getMissionFor(dateStr)
    const progress = dateStr === selectedDateStr ? selectedProgress : null
    const stamp = getStamp(dateStr)
    const daySchedules = getDaySchedules(dateStr)
    const myClasses = daySchedules.filter(isMine)
    const visibleClasses = isPast ? myClasses : daySchedules

    return (
      <div className="flex flex-col gap-5">
        {/* Header tanggal */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {isToday && <span className="text-[11px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">Hari ini</span>}
              {isPast && <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Sudah lewat</span>}
              {!isToday && !isPast && <span className="text-[11px] font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400">Mendatang</span>}
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{formatDateIndonesian(dateStr, language)}</h3>
          </div>
          {stamp && (
            <img src={stamp.src} alt={stamp.label} title={stamp.label} className="size-14 object-contain -rotate-12 shrink-0 drop-shadow-sm" />
          )}
        </div>

        {/* Rencana belajar */}
        <section className="flex flex-col gap-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Rencana belajar</h4>

          {mission ? (
            isNoPlanMission(mission) ? (
              <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex items-center gap-3">
                <img src="/tidakada.png" alt="" className="size-9 object-contain -rotate-6 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-sky-900 dark:text-sky-200">Hari istirahat terencana</p>
                  <p className="text-[13px] text-sky-800/80 dark:text-sky-300/80">Tanpa target belajar · Cap Biru</p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-3.5">
                {progress ? (
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {progress.isFullyCompleted ? 'Semua target tercapai' : isPast ? 'Belum tuntas' : 'Progres hari ini'}
                        </span>
                        <span className={`font-black tabular-nums ${progress.isFullyCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                          {progress.overallPct}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${progress.isFullyCompleted ? 'bg-emerald-500' : isPast ? 'bg-red-400' : 'bg-primary'}`}
                          style={{ width: `${progress.overallPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
                )}

                <div className="flex flex-col gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  {mission.selectedVideos.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <TargetRow
                        icon={<IconPlay className="size-4 text-sky-500" />}
                        label={`Putar video (${mission.selectedVideos.length})`}
                        actual={progress?.actualReplays ?? 0}
                        target={mission.targetReplayCount}
                        barClass="bg-sky-500"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {mission.selectedVideos.map(v => (
                          <span key={v.id} className="text-xs font-medium px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            Bab {v.bab} · Part {v.videoNum}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(mission.targetQuizCount || 0) > 0 && (
                    <TargetRow
                      icon={<svg className="size-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /></svg>}
                      label="Kuis"
                      actual={progress?.actualQuizzes ?? 0}
                      target={mission.targetQuizCount}
                      barClass="bg-indigo-500"
                    />
                  )}
                  {(mission.targetKotobaCount || 0) > 0 && (
                    <TargetRow
                      icon={<span className="size-4 text-[13px] leading-4 font-black text-amber-500 text-center">語</span>}
                      label="Setor kotoba"
                      actual={progress?.actualKotoba ?? 0}
                      target={mission.targetKotobaCount}
                      barClass="bg-amber-500"
                    />
                  )}
                </div>
              </div>
            )
          ) : (
            <div className="p-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {isPast ? 'Tidak ada rencana tercatat' : 'Belum ada rencana'}
              </p>
              {!isPast && (
                <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">Tentukan target video, kuis, atau kotoba untuk hari ini.</p>
              )}
            </div>
          )}

          {!isPast && (
            <button
              onClick={() => openMissionBuilder(dateStr)}
              className={`h-11 rounded-xl text-sm font-bold cursor-pointer transition-colors flex items-center justify-center gap-2 ${
                mission
                  ? 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  : 'bg-primary hover:bg-primary-dark text-white border-none shadow-sm shadow-primary/20'
              }`}
            >
              {mission ? <IconEdit /> : <IconPlus />}
              {mission ? t('lp_edit_mission_btn', 'Edit Rencana') : t('lp_btn_create', 'Susun Rencana')}
            </button>
          )}
        </section>

        {/* Kelas live */}
        {!isSubscriptionLocked && (
        <section className="flex flex-col gap-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {isPast ? 'Kelas yang diikuti' : 'Kelas live'}
          </h4>

          {visibleClasses.length === 0 ? (
            <p className="text-[13px] text-slate-500 dark:text-slate-400">
              {isPast ? 'Tidak ada kelas yang diikuti.' : 'Tidak ada kelas live di tanggal ini.'}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {visibleClasses.map(sch => {
                const mine = isMine(sch)
                const lock = mine ? null : getScheduleLockStatus(sch, { userId: uid, schedules, reservations, profile, groups })
                const isOnline = sch.type === 'online'
                return (
                  <li key={sch.id} className={`flex items-center gap-3 p-3 rounded-xl border ${
                    mine ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-800'
                  }`}>
                    <span className={`size-9 shrink-0 rounded-xl flex items-center justify-center ${
                      isOnline ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {isOnline ? <IconVideo /> : <IconBuilding />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{sch.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {formatTimeShort(sch.start_time)} WIB · {sch.instructor_name}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[11px] font-bold px-2 py-1 rounded-full ${
                      mine
                        ? 'bg-emerald-500 text-white'
                        : lock?.isLocked
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          : 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                    }`}>
                      {mine ? 'Terdaftar' : lock?.isLocked ? (lock.reason === 'Kuota Penuh' ? 'Penuh' : 'Terkunci') : 'Tersedia'}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}

          {!isPast && daySchedules.length > 0 && (
            <button
              onClick={() => openClassSheet(dateStr)}
              className="h-11 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold border-none cursor-pointer transition-colors flex items-center justify-center gap-2"
            >
              <IconVideo />
              {myClasses.length > 0 ? 'Kelola Reservasi' : 'Reservasi Kelas'}
            </button>
          )}
        </section>
        )}
      </div>
    )
  }

  const navBtn = 'size-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-none cursor-pointer flex items-center justify-center transition-colors'

  return (
    <main className="flex-1 p-3 sm:p-6 lg:p-8 min-w-0 overflow-x-clip animate-page-slide">
      {/* ── HEADER ─────────────────────────────────────── */}
      <header className="relative overflow-hidden bg-gradient-to-br from-sky-600 via-sky-700 to-indigo-700 rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 text-white shadow-md">
        <div className="absolute -top-14 -right-14 size-56 bg-white/10 rounded-full pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-8">
          <div className="min-w-0 max-w-xl">
            <span className="inline-block text-[11px] font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full mb-2">
              Kalender Belajar
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight">{t('lp_page_title', 'Rencana Belajar')}</h1>
            <p className="text-sm text-white/85 mt-1 leading-relaxed">
              Susun target harian, pantau progres, dan atur kelas live dalam satu kalender.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/15 px-2.5 py-1 rounded-full">
                <img src="/lulus.png" alt="" className="size-4 object-contain" /> {passedThisMonth} hari lulus di {monthName}
              </span>
              {!isSubscriptionLocked && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/15 px-2.5 py-1 rounded-full">
                  <IconVideo className="size-3.5" /> {upcomingClasses} kelas mendatang
                </span>
              )}
            </div>
          </div>

          {/* Today card */}
          <div className="w-full lg:w-80 shrink-0 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3.5 sm:p-4">
            <p className="text-xs font-semibold text-white/80">Hari ini · {formatShortDate(todayStr, language)}</p>
            {todayMission ? (
              isNoPlanMission(todayMission) ? (
                <p className="text-base font-bold mt-1">Hari istirahat 🛌</p>
              ) : (
                <>
                  <div className="flex items-baseline justify-between mt-1">
                    <p className="text-sm font-semibold truncate pr-2">{missionSummary(todayMission)}</p>
                    <p className="text-2xl font-black tabular-nums">{todayProgress?.overallPct ?? 0}%</p>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/20 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${todayProgress?.isFullyCompleted ? 'bg-emerald-400' : 'bg-amber-300'}`}
                      style={{ width: `${todayProgress?.overallPct ?? 0}%` }}
                    />
                  </div>
                </>
              )
            ) : (
              <p className="text-sm text-white/90 mt-1">Belum ada rencana untuk hari ini.</p>
            )}
            <button
              onClick={() => {
                handleTodayClick()
                if (!todayMission) openMissionBuilder(todayStr)
              }}
              className="mt-3 w-full h-10 rounded-lg bg-white text-sky-700 hover:bg-sky-50 text-sm font-bold border-none cursor-pointer transition-colors flex items-center justify-center gap-1.5"
            >
              {todayMission ? 'Lihat Detail Hari Ini' : <><IconPlus /> {t('lp_btn_create', 'Susun Rencana Hari Ini')}</>}
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN: calendar + detail panel ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem] gap-4 sm:gap-6 items-start">
        <section className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4 min-w-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button onClick={() => changeMonth(-1)} className={navBtn} aria-label="Bulan sebelumnya"><IconChevron dir="left" /></button>
              <h2 className="min-w-[8.5rem] text-center text-base sm:text-lg font-bold text-slate-900 dark:text-white whitespace-nowrap">
                {monthName} {year}
              </h2>
              <button onClick={() => changeMonth(1)} className={navBtn} aria-label="Bulan berikutnya"><IconChevron /></button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleTodayClick}
                className="h-10 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold cursor-pointer transition-colors"
              >
                {t('lp_today_btn', 'Hari Ini')}
              </button>
              <div role="tablist" className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                {([
                  { key: 'calendar', label: t('lp_calendar_view', 'Kalender'), icon: <IconCalendar /> },
                  { key: 'agenda', label: t('lp_agenda_view', 'Agenda'), icon: <IconList /> },
                ] as const).map(v => (
                  <button
                    key={v.key}
                    role="tab"
                    aria-selected={viewMode === v.key}
                    onClick={() => {
                      setViewMode(v.key)
                      if (!selectedDateStr) setSelectedDateStr(todayStr)
                    }}
                    className={`h-8 px-2.5 sm:px-3 rounded-lg text-sm font-semibold border-none cursor-pointer transition-all flex items-center gap-1.5 ${
                      viewMode === v.key ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-300 shadow-sm' : 'bg-transparent text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {v.icon}
                    <span>{v.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {viewMode === 'calendar' ? (
            <>
              {/* Weekday header */}
              <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">
                {getLocalizedDayNames(language).map(d => <div key={d} className="py-1">{d}</div>)}
              </div>

              {/* Grid */}
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5 -mt-2">
                {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} aria-hidden="true" />)}

                {monthDays.map(({ dayNum, dateStr }) => {
                  const isToday = dateStr === todayStr
                  const isSelected = dateStr === selectedDateStr
                  const isPast = dateStr < todayStr
                  const status = statusByDate.get(dateStr)
                  const mission = getMissionFor(dateStr)
                  const stamp = getStamp(dateStr)
                  const daySchedules = status?.schedules || []
                  const myClasses = daySchedules.filter(isMine)
                  const otherClasses = daySchedules.filter(s => !isMine(s))

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => setSelectedDateStr(dateStr)}
                      aria-pressed={isSelected}
                      aria-label={`${formatDateIndonesian(dateStr, language)}${mission ? ', ada rencana' : ''}${myClasses.length ? `, ${myClasses.length} kelas terdaftar` : ''}`}
                      className={`relative aspect-square sm:aspect-auto sm:min-h-[6.75rem] rounded-xl sm:rounded-2xl border p-1 sm:p-2 flex flex-col items-center sm:items-stretch justify-start text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5 dark:bg-primary/15 ring-2 ring-primary/25'
                          : isToday
                            ? 'border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20 hover:border-amber-400'
                            : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'
                      } ${isPast && !isSelected ? 'opacity-80' : ''}`}
                    >
                      {/* Number row */}
                      <div className="w-full flex items-center justify-center sm:justify-between">
                        <span className={`text-sm sm:text-[15px] font-bold leading-none size-7 sm:size-auto flex items-center justify-center rounded-full ${
                          isToday
                            ? 'bg-amber-500 text-white sm:bg-transparent sm:text-amber-600 dark:sm:text-amber-400'
                            : isSelected
                              ? 'text-primary dark:text-red-400'
                              : 'text-slate-700 dark:text-slate-200'
                        }`}>
                          {dayNum}
                        </span>
                        {stamp && (
                          <img src={stamp.src} alt={stamp.label} title={stamp.label} className="hidden sm:block size-7 object-contain -rotate-12" />
                        )}
                      </div>

                      {/* Mobile indicators */}
                      <div className="sm:hidden mt-auto mb-0.5 flex items-center justify-center gap-0.5 h-3.5">
                        {stamp ? (
                          <img src={stamp.src} alt="" className="size-3.5 object-contain -rotate-12" />
                        ) : (
                          <>
                            {myClasses.some(s => s.type === 'online') && <span className="size-1.5 rounded-full bg-sky-500" />}
                            {myClasses.some(s => s.type === 'offline') && <span className="size-1.5 rounded-full bg-emerald-500" />}
                            {myClasses.length === 0 && otherClasses.length > 0 && <span className="size-1.5 rounded-full ring-1 ring-sky-400" />}
                            {mission && <span className={`size-1.5 rounded-full ${isNoPlanMission(mission) ? 'bg-sky-300' : 'bg-primary'}`} />}
                          </>
                        )}
                      </div>

                      {/* Desktop chips */}
                      <div className="hidden sm:flex flex-col gap-1 mt-1.5 min-w-0">
                        {myClasses.slice(0, 2).map(sch => (
                          <span key={sch.id} className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md truncate text-white ${sch.type === 'online' ? 'bg-sky-600' : 'bg-emerald-600'}`}>
                            {formatTimeShort(sch.start_time)} {sch.title}
                          </span>
                        ))}
                        {myClasses.length === 0 && otherClasses.length > 0 && !isPast && (
                          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md truncate border border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300">
                            {otherClasses.length} kelas tersedia
                          </span>
                        )}
                        {mission && (
                          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md truncate ${
                            isNoPlanMission(mission)
                              ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                              : 'bg-primary/10 dark:bg-primary/20 text-primary dark:text-red-300'
                          }`}>
                            {missionSummary(mission)}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Legend */}
              <details className="group rounded-xl bg-slate-50 dark:bg-slate-800/40 px-3.5 py-2.5">
                <summary className="list-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-2 cursor-pointer select-none min-h-8 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {t('lp_legend_title', 'Keterangan kalender')}
                  <IconChevron dir="down" className="size-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pt-3 pb-1 text-[13px] text-slate-600 dark:text-slate-300">
                  {!isSubscriptionLocked && (
                    <>
                      <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-sky-500" /> Kelas online terdaftar</span>
                      <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-emerald-500" /> Kelas offline terdaftar</span>
                      <span className="flex items-center gap-2"><span className="size-2.5 rounded-full ring-1 ring-sky-400" /> Ada kelas yang bisa direservasi</span>
                    </>
                  )}
                  <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-primary" /> Ada rencana belajar</span>
                  <span className="flex items-center gap-2"><img src="/lulus.png" alt="" className="size-5 object-contain" /> {t('lp_stamp_passed', 'Lulus 100%')}</span>
                  <span className="flex items-center gap-2"><img src="/gagal.png" alt="" className="size-5 object-contain" /> {t('lp_stamp_incomplete', 'Belum tuntas')}</span>
                  <span className="flex items-center gap-2"><img src="/tidakada.png" alt="" className="size-5 object-contain" /> {t('lp_stamp_noplan', 'Hari istirahat')}</span>
                  <span className="flex items-center gap-2"><img src="/kosong.png" alt="" className="size-5 object-contain" /> {t('lp_stamp_uncreated', 'Belum buat rencana')}</span>
                </div>
              </details>
            </>
          ) : (
            /* ── AGENDA ── */
            <div className="flex flex-col gap-3">
              <label className="flex items-center justify-between gap-3 px-1 cursor-pointer select-none">
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  {agendaOnlyMine ? 'Hanya tanggal dengan rencana/kelasku' : 'Semua tanggal bulan ini'}
                </span>
                <span className="relative inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={agendaOnlyMine}
                    onChange={e => setAgendaOnlyMine(e.target.checked)}
                    className="peer sr-only"
                  />
                  <span className="w-11 h-6 rounded-full bg-slate-300 dark:bg-slate-600 peer-checked:bg-sky-600 transition-colors" />
                  <span className="absolute left-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                </span>
              </label>

              {agendaDays.length === 0 ? (
                <div className="py-10 text-center flex flex-col items-center gap-3">
                  <div className="size-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center"><IconCalendar className="size-7" /></div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">Belum ada rencana atau kelas di {monthName}. Pilih tanggal di kalender untuk mulai menyusun.</p>
                  <button
                    onClick={() => openMissionBuilder(selectedDateStr)}
                    className="h-11 px-5 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-bold border-none cursor-pointer"
                  >
                    Susun Rencana
                  </button>
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {agendaDays.map(({ dayNum, dateStr }) => {
                    const isToday = dateStr === todayStr
                    const isSelected = dateStr === selectedDateStr
                    const mission = getMissionFor(dateStr)
                    const stamp = getStamp(dateStr)
                    const daySchedules = statusByDate.get(dateStr)?.schedules || []
                    const myClasses = daySchedules.filter(isMine)
                    const available = dateStr >= todayStr ? daySchedules.length - myClasses.length : 0
                    const dt = parseLocalDate(dateStr)

                    return (
                      <li key={dateStr} className={`rounded-2xl border transition-colors ${
                        isSelected ? 'border-primary/50 bg-primary/[0.03] dark:bg-primary/10' : 'border-slate-200 dark:border-slate-800'
                      }`}>
                        <button
                          type="button"
                          onClick={() => setSelectedDateStr(isSelected ? '' : dateStr)}
                          aria-expanded={isSelected}
                          className="w-full p-3 flex items-center gap-3 text-left bg-transparent border-none cursor-pointer"
                        >
                          <span className={`size-12 shrink-0 rounded-xl flex flex-col items-center justify-center ${
                            isToday ? 'bg-amber-500 text-white' : isSelected ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                          }`}>
                            <span className="text-[10px] font-semibold uppercase leading-none">{dt?.toLocaleDateString(toLocale(language), { weekday: 'short' })}</span>
                            <span className="text-lg font-black leading-tight">{dayNum}</span>
                          </span>
                          <span className="min-w-0 flex-1 flex flex-col gap-1">
                            <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              {formatShortDate(dateStr, language)}
                              {isToday && <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Hari ini</span>}
                            </span>
                            <span className="flex flex-wrap gap-1.5">
                              {myClasses.map(sch => (
                                <span key={sch.id} className={`text-[11px] font-bold px-2 py-0.5 rounded-full text-white ${sch.type === 'online' ? 'bg-sky-600' : 'bg-emerald-600'}`}>
                                  {formatTimeShort(sch.start_time)} {sch.type === 'online' ? 'Online' : 'Offline'}
                                </span>
                              ))}
                              {available > 0 && (
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300">
                                  {available} kelas tersedia
                                </span>
                              )}
                              {mission && (
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                  isNoPlanMission(mission) ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300' : 'bg-primary/10 dark:bg-primary/20 text-primary dark:text-red-300'
                                }`}>
                                  {missionSummary(mission)}
                                </span>
                              )}
                              {!mission && myClasses.length === 0 && available === 0 && (
                                <span className="text-xs text-slate-400">Tidak ada agenda</span>
                              )}
                            </span>
                          </span>
                          {stamp && <img src={stamp.src} alt={stamp.label} title={stamp.label} className="size-9 object-contain -rotate-12 shrink-0" />}
                          <IconChevron dir="down" className={`size-4 shrink-0 text-slate-400 transition-transform ${isSelected ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Detail inline (HP & tablet) — di desktop tampil di panel samping */}
                        {isSelected && (
                          <div className="lg:hidden px-3 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800 animate-fade-in">
                            <div className="pt-3">{renderDayDetail(dateStr)}</div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* ── Detail panel ── */}
        {selectedDateStr && (
          <aside className={`bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm lg:sticky lg:top-20 ${
            viewMode === 'agenda' ? 'hidden lg:block' : ''
          }`}>
            {renderDayDetail(selectedDateStr)}
          </aside>
        )}
      </div>

      {/* Class reservation sheet */}
      {showClassSheet && selectedDateStr && !isSubscriptionLocked && (
        <DateClassSheet
          dateStr={selectedDateStr}
          daySchedules={getDaySchedules(selectedDateStr)}
          allSchedules={schedules}
          reservations={reservations}
          userId={uid}
          userName={profile?.full_name || user?.user_metadata?.full_name || 'Pengguna'}
          userEmail={profile?.email || user?.email || ''}
          profile={profile}
          groups={groups}
          onClose={() => setShowClassSheet(false)}
          onRefresh={reloadSchedules}
          onOpenMissionBuilder={() => openMissionBuilder(selectedDateStr)}
        />
      )}

      {/* Daily mission builder */}
      {showMissionModal && (
        <DailyMissionBuilderModal
          targetDate={missionModalDate}
          currentMission={missionModalMission}
          plannedDates={new Set(userMissions.keys())}
          onSave={handleSaveMission}
          onClose={() => setShowMissionModal(false)}
        />
      )}
    </main>
  )
}
