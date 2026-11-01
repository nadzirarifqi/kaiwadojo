import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'
import { supabase } from '../lib/supabaseClient'
import { fetchGroups, type KaiwaGroup, GROUP_UPDATE_EVENT } from '../lib/groupService'
import { parseTargetGroups } from '../lib/chapterService'
import { getSubscriptionAccess } from '../lib/subscriptionAccess'
import { SubscriptionLockCard } from '../components/SubscriptionLock'
import {
  type ClassSchedule,
  type ClassReservation,
  fetchSchedules,
  fetchReservations,
  bookClass,
  cancelClassBooking,
  getMonthlyOnlineRequirementStatus,
  getWeekLabel,
  formatDateRangeIndonesian,
  formatTimeShort,
  RESERVATION_UPDATE_EVENT,
  matchScheduleId,
  getScheduleLockStatus,
  isScheduleAccessibleForUser,
  isSchedulePast,
} from '../lib/scheduleService'
import { ScheduleCardSkeleton } from '../components/Skeleton'

type TabKey = 'all' | 'online' | 'offline' | 'my-schedules'

// ── Inline icons (stroke = currentColor) ─────────────────────────────
const IconVideo = ({ className = 'size-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
)
const IconBuilding = ({ className = 'size-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
)
const IconCalendar = ({ className = 'size-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
)
const IconClock = ({ className = 'size-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
)
const IconUser = ({ className = 'size-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
)
const IconLock = ({ className = 'size-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
)
const IconCheck = ({ className = 'size-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
)
const IconPin = ({ className = 'size-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
)
const IconBookmark = ({ className = 'size-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
)
const IconClose = ({ className = 'size-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
)

export default function ClassReservationPage() {
  const { profile } = useAuth()
  const { language, t } = useLanguage()
  const { toast: globalToast } = useToast()

  // Use real Supabase Auth UUID — critical for RLS policy (auth.uid() = user_id)
  const userId = profile?.id ?? ''
  const userName = profile?.full_name || profile?.username || 'Pengguna'
  const userEmail = profile?.email || ''
  const locale = language === 'ja' ? 'ja-JP' : language === 'en' ? 'en-US' : 'id-ID'

  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [reservations, setReservations] = useState<ClassReservation[]>([])
  const [groups, setGroups] = useState<KaiwaGroup[]>([])
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [selectedWeekFilter, setSelectedWeekFilter] = useState<string>('all')
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Modal Confirmation states
  const [targetSchedule, setTargetSchedule] = useState<ClassSchedule | null>(null)
  const [confirmModalType, setConfirmModalType] = useState<'book' | 'cancel' | null>(null)
  const [targetReservationId, setTargetReservationId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Requirement status
  const [reqStatus, setReqStatus] = useState<{
    bookedCount: number
    targetCount: number
    isFulfilled: boolean
    currentMonthLabel: string
  }>({
    bookedCount: 0,
    targetCount: 4,
    isFulfilled: false,
    currentMonthLabel: '',
  })

  // silent = sinkronisasi latar belakang (realtime/event) tanpa skeleton agar kartu tidak "loncat" di HP
  async function loadData(silent = false) {
    if (!silent) setLoading(true)
    const [sData, rData, gData] = await Promise.all([
      fetchSchedules(),
      fetchReservations(),
      fetchGroups(),
    ])
    setSchedules(sData)
    setReservations(rData)
    setGroups(gData)

    const status = await getMonthlyOnlineRequirementStatus(userId)
    setReqStatus(status)
    setLoading(false)
  }

  useEffect(() => {
    loadData()

    // 1. Instant local window event sync (multi-tab / role switcher / group changes)
    const handleLocalSync = () => loadData(true)
    window.addEventListener(RESERVATION_UPDATE_EVENT, handleLocalSync)
    window.addEventListener(GROUP_UPDATE_EVENT, handleLocalSync)
    window.addEventListener('storage', handleLocalSync)

    // 2. Supabase Realtime channel for cross-device live quota updates
    const channel = supabase
      .channel('class_reservations_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'class_reservations' },
        () => loadData(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'class_schedules' },
        () => loadData(true)
      )
      .subscribe()

    return () => {
      window.removeEventListener(RESERVATION_UPDATE_EVENT, handleLocalSync)
      window.removeEventListener(GROUP_UPDATE_EVENT, handleLocalSync)
      window.removeEventListener('storage', handleLocalSync)
      supabase.removeChannel(channel)
    }
  }, [userId])

  // Modal: kunci scroll halaman & tutup dengan tombol Escape
  const isModalOpen = Boolean(confirmModalType && targetSchedule)
  useEffect(() => {
    if (!isModalOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [isModalOpen, actionLoading])

  function showToast(text: string, type: 'success' | 'error' = 'success') {
    if (type === 'success') {
      globalToast.success(text, 'Reservasi Kelas')
    } else {
      globalToast.error(text, 'Reservasi Kelas')
    }
  }

  function openBookModal(sch: ClassSchedule) {
    setTargetSchedule(sch)
    setTargetReservationId(null)
    setConfirmModalType('book')
  }

  function openCancelModal(sch: ClassSchedule, reservationId: string) {
    setTargetSchedule(sch)
    setTargetReservationId(reservationId)
    setConfirmModalType('cancel')
  }

  function closeModal() {
    if (actionLoading) return
    setConfirmModalType(null)
    setTargetSchedule(null)
    setTargetReservationId(null)
  }

  // Get enrolled count for a schedule (uses matchScheduleId for UUID/string compatibility)
  function getEnrolledCount(schId: string): number {
    return reservations.filter(r => matchScheduleId(schId, r.schedule_id)).length
  }

  // Check if user is enrolled in a schedule
  function getUserReservation(schId: string): ClassReservation | undefined {
    return reservations.find(r => matchScheduleId(schId, r.schedule_id) && r.user_id === userId)
  }

  // Aturan kunci reservasi (shared dengan halaman Rencana Belajar)
  function checkLockStatus(sch: ClassSchedule): { isLocked: boolean; reason?: string } {
    return getScheduleLockStatus(sch, { userId, schedules, reservations, profile, groups })
  }

  async function handleConfirmAction() {
    if (!targetSchedule || actionLoading) return
    if (!userId) {
      showToast('Silakan login terlebih dahulu untuk melakukan reservasi.', 'error')
      setConfirmModalType(null)
      setTargetSchedule(null)
      return
    }
    setActionLoading(true)

    if (confirmModalType === 'book') {
      const res = await bookClass(targetSchedule, userId, userName, userEmail, profile, groups)
      if (res.success) {
        showToast(res.message || `Berhasil reservasi kelas "${targetSchedule.title}"!`)
        await loadData(true)
      } else {
        showToast(res.message, 'error')
      }
    } else if (confirmModalType === 'cancel' && targetReservationId) {
      const ok = await cancelClassBooking(targetReservationId)
      if (ok) {
        showToast('Reservasi kelas berhasil dibatalkan.')
        await loadData(true)
      } else {
        showToast('Gagal membatalkan reservasi.', 'error')
      }
    }

    setActionLoading(false)
    setConfirmModalType(null)
    setTargetSchedule(null)
    setTargetReservationId(null)
  }

  // ── Date helpers (parse YYYY-MM-DD as local date — hindari pergeseran zona waktu UTC) ──
  function toLocalDate(dateStr: string): Date | null {
    const [y, m, d] = (dateStr || '').slice(0, 10).split('-').map(Number)
    if (!y || !m || !d) return null
    return new Date(y, m - 1, d)
  }

  function formatShortDate(dateStr: string): string {
    const dt = toLocalDate(dateStr)
    if (!dt) return dateStr
    return dt.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  }

  function getScheduleWhen(sch: ClassSchedule) {
    const start = (sch.start_date || sch.date || '').slice(0, 10)
    const end = (sch.end_date || start).slice(0, 10)
    const isMultiDay = Boolean(end && end !== start)
    const { badgeLabel } = formatDateRangeIndonesian(start, end, sch.start_time, sch.end_time, language)
    const dt = toLocalDate(start)
    return {
      start,
      isMultiDay,
      badgeLabel,
      dateLabel: isMultiDay ? `${formatShortDate(start)} – ${formatShortDate(end)}` : formatShortDate(start),
      timeLabel: `${formatTimeShort(sch.start_time)} – ${formatTimeShort(sch.end_time)} WIB`,
      tile: dt
        ? {
            day: dt.getDate(),
            month: dt.toLocaleDateString(locale, { month: 'short' }),
            weekday: dt.toLocaleDateString(locale, { weekday: 'short' }),
          }
        : null,
    }
  }

  // User's group determination (strictly from profile.group_name)
  const resolvedUserGroup = (profile?.group_name || '').trim()
  const isPrivileged = profile?.role === 'admin' || profile?.role === 'pemateri'

  // Filter schedules that the current user has permission/access to see
  // Hides past/expired schedules for regular students to prevent misclicks
  const accessibleSchedules = schedules.filter(sch => {
    if (!isScheduleAccessibleForUser(sch, profile, groups)) return false
    if (!isPrivileged && isSchedulePast(sch)) return false
    return true
  })

  const availableWeeks = Array.from(new Set(accessibleSchedules.map(s => s.week_range_id))).sort()
  const availableMonths = Array.from(new Set(accessibleSchedules.map(s => s.month_range_id))).sort()

  const filteredSchedules = accessibleSchedules.filter(sch => {
    // Type tab
    if (activeTab === 'online' && sch.type !== 'online') return false
    if (activeTab === 'offline' && sch.type !== 'offline') return false

    // Week filter
    if (selectedWeekFilter !== 'all' && sch.week_range_id !== selectedWeekFilter) return false

    // Month filter
    if (selectedMonthFilter !== 'all' && sch.month_range_id !== selectedMonthFilter) return false

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      const matchTitle = sch.title.toLowerCase().includes(term)
      const matchSub = (sch.subtitle_chapter || '').toLowerCase().includes(term)
      const matchInst = (sch.instructor_name || '').toLowerCase().includes(term)
      const matchGrp = sch.target_group
        ? parseTargetGroups(sch.target_group).some(g => g.toLowerCase().includes(term))
        : false
      if (!matchTitle && !matchSub && !matchInst && !matchGrp) return false
    }

    return true
  })

  const hasActiveFilters = Boolean(searchTerm.trim()) || selectedWeekFilter !== 'all' || selectedMonthFilter !== 'all'
  function resetFilters() {
    setSearchTerm('')
    setSelectedWeekFilter('all')
    setSelectedMonthFilter('all')
  }

  // User's booked reservations — kelas mendatang dulu (terdekat di atas), lalu yang sudah lewat
  const myReservationsList = reservations
    .filter(r => r.user_id === userId)
    .map(r => ({
      reservation: r,
      schedule: schedules.find(s => matchScheduleId(s.id, r.schedule_id)),
    }))
    .filter((item): item is { reservation: ClassReservation; schedule: ClassSchedule } => Boolean(item.schedule))
    .map(item => ({ ...item, isPast: isSchedulePast(item.schedule) }))
    .sort((a, b) => {
      if (a.isPast !== b.isPast) return a.isPast ? 1 : -1
      const da = (a.schedule.start_date || a.schedule.date || '') + (a.schedule.start_time || '')
      const db = (b.schedule.start_date || b.schedule.date || '') + (b.schedule.start_time || '')
      return a.isPast ? db.localeCompare(da) : da.localeCompare(db)
    })
  const upcomingCount = myReservationsList.filter(i => !i.isPast).length

  const progressPct = Math.min(100, Math.round((reqStatus.bookedCount / Math.max(1, reqStatus.targetCount)) * 100))

  // Guard: if user not logged in, show login prompt
  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-lg flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="size-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <IconLock className="size-7" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">Login Diperlukan</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Kamu perlu login terlebih dahulu untuk melihat jadwal dan melakukan reservasi kelas.
          </p>
        </div>
      </div>
    )
  }

  // Pelajar belum berlangganan: halaman tetap bisa dibuka, tapi tidak ada jadwal yang ditampilkan
  if (getSubscriptionAccess(profile).isLocked) {
    return (
      <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full min-w-0 flex flex-col gap-4 sm:gap-6 animate-page-slide">
        <header className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary-dark rounded-2xl p-4 sm:p-6 text-white shadow-md">
          <div className="absolute -top-14 -right-14 size-56 bg-white/10 rounded-full pointer-events-none" />
          <div className="relative z-10 max-w-2xl">
            <span className="inline-block text-[11px] font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full mb-2">
              Kelas Live kaiwadojo
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight">
              {t('cr_page_title', 'Reservasi Kelas')}
            </h1>
            <p className="text-sm text-white/85 mt-1 leading-relaxed">
              Ikuti kelas live online & offline bersama pengajar setelah langgananmu aktif.
            </p>
          </div>
        </header>
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex justify-center">
          <SubscriptionLockCard feature="Reservasi kelas" />
        </section>
      </main>
    )
  }

  const tabs: { key: TabKey; short: string; long: string; count: number; icon?: React.ReactNode; active: string }[] = [
    { key: 'all', short: t('cr_tab_all_short', 'Semua'), long: t('cr_tab_all', 'Semua Kelas'), count: accessibleSchedules.length, active: 'bg-white dark:bg-slate-900 text-primary dark:text-red-400 shadow-sm' },
    { key: 'online', short: 'Online', long: t('cr_tab_online', 'Kelas Online (Mingguan)'), count: accessibleSchedules.filter(s => s.type === 'online').length, icon: <IconVideo className="size-4 shrink-0" />, active: 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-300 shadow-sm' },
    { key: 'offline', short: 'Offline', long: t('cr_tab_offline', 'Kelas Offline (Bulanan)'), count: accessibleSchedules.filter(s => s.type === 'offline').length, icon: <IconBuilding className="size-4 shrink-0" />, active: 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-sm' },
    { key: 'my-schedules', short: t('cr_tab_my_short', 'Jadwalku'), long: t('cr_tab_my_booking', 'Jadwal Saya'), count: upcomingCount, icon: <IconBookmark className="size-4 shrink-0" />, active: 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-sm' },
  ]

  const selectClass = 'w-full h-11 px-3 pr-8 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-base sm:text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 truncate cursor-pointer'

  return (
    <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full min-w-0 flex flex-col gap-4 sm:gap-6 animate-page-slide">

      {/* ── HEADER & MONTHLY TARGET ─────────────────────────── */}
      <header className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary-dark rounded-2xl p-4 sm:p-6 text-white shadow-md">
        <div className="absolute -top-14 -right-14 size-56 bg-white/10 rounded-full pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 size-48 bg-white/5 rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-8">
          <div className="min-w-0 max-w-2xl">
            <span className="inline-block text-[11px] font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full mb-2">
              Kelas Live kaiwadojo
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight">
              {t('cr_page_title', 'Reservasi Kelas')}
            </h1>
            <p className="text-sm text-white/85 mt-1 leading-relaxed">
              {t('cr_requirement', 'Wajib Mengambil 4 Kelas Online / Bulan (1 Kelas / Minggu)')}
            </p>

            <details className="group mt-2.5">
              <summary className="list-none [&::-webkit-details-marker]:hidden inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/90 hover:text-white cursor-pointer select-none min-h-[32px]">
                <svg className="size-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                <span>Aturan reservasi</span>
              </summary>
              <ul className="mt-2 space-y-1.5 text-[13px] text-white/85 leading-relaxed">
                <li className="flex gap-2"><span className="mt-2 size-1.5 rounded-full bg-amber-300 shrink-0" />Kelas online maksimal 1 sesi per minggu.</li>
                <li className="flex gap-2"><span className="mt-2 size-1.5 rounded-full bg-amber-300 shrink-0" />Kelas offline maksimal 1 sesi per bulan.</li>
                <li className="flex gap-2"><span className="mt-2 size-1.5 rounded-full bg-amber-300 shrink-0" />Kelas online & offline tidak bisa diambil di hari yang sama.</li>
              </ul>
            </details>
          </div>

          {/* Progress Card */}
          <div className="w-full lg:w-80 shrink-0 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white/80">
                  Target online {reqStatus.currentMonthLabel && `· ${reqStatus.currentMonthLabel}`}
                </p>
                <p className="text-2xl font-black leading-tight">
                  {reqStatus.bookedCount}
                  <span className="text-base font-bold text-white/70"> / {reqStatus.targetCount} kelas</span>
                </p>
              </div>
              <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                reqStatus.isFulfilled ? 'bg-emerald-400 text-slate-950' : 'bg-amber-300 text-slate-950'
              }`}>
                {reqStatus.isFulfilled && <IconCheck className="size-3.5" />}
                {reqStatus.isFulfilled ? 'Terpenuhi' : `Kurang ${Math.max(0, reqStatus.targetCount - reqStatus.bookedCount)}`}
              </span>
            </div>
            <div className="mt-2.5 h-2 rounded-full bg-white/20 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${reqStatus.isFulfilled ? 'bg-emerald-400' : 'bg-amber-300'}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-white/80 truncate">
              {userName}
              {resolvedUserGroup
                ? <span className="font-bold text-amber-300"> · {resolvedUserGroup}</span>
                : <span className="text-white/60"> · Reguler</span>}
            </p>
          </div>
        </div>
      </header>

      {/* ── TABS & FILTERS ──────────────────────────────────── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-3">
        {/* Segmented tabs: 4 kolom di HP (label pendek), label lengkap di layar lebar */}
        <div role="tablist" className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
          {tabs.map(tab => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={`min-h-11 px-1.5 sm:px-3 rounded-lg text-[13px] sm:text-sm font-semibold transition-all border-none cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 ${
                  isActive ? tab.active : 'bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="hidden sm:inline-flex">{tab.icon}</span>
                  <span className="truncate sm:hidden">{tab.short}</span>
                  <span className="truncate hidden sm:inline">{tab.long}</span>
                </span>
                <span className={`text-[11px] sm:text-xs font-bold leading-none px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-slate-100 dark:bg-slate-800' : 'bg-slate-200/70 dark:bg-slate-700/70'
                }`}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {activeTab !== 'my-schedules' && (
          <>
            {/* Search */}
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <svg className="size-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
              </span>
              <input
                type="search"
                enterKeyHint="search"
                placeholder={t('cr_search_placeholder', 'Cari judul bab, materi, atau instruktur...')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full h-11 pl-10 pr-10 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-base sm:text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 [&::-webkit-search-cancel-button]:hidden"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label="Hapus pencarian"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 size-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 border-none bg-transparent cursor-pointer"
                >
                  <IconClose className="size-4" />
                </button>
              )}
            </div>

            {/* Week & Month Filter */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <label className="flex flex-col gap-1 min-w-0">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Minggu</span>
                <select value={selectedWeekFilter} onChange={e => setSelectedWeekFilter(e.target.value)} className={selectClass}>
                  <option value="all">{t('cr_all_weeks', 'Semua Minggu')}</option>
                  {availableWeeks.map(w => (
                    <option key={w} value={w}>{getWeekLabel(w)}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 min-w-0">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Bulan</span>
                <select value={selectedMonthFilter} onChange={e => setSelectedMonthFilter(e.target.value)} className={selectClass}>
                  <option value="all">Semua Bulan</option>
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
            </div>
          </>
        )}
      </section>

      {/* ── SCHEDULE LIST ───────────────────────────────────── */}
      {activeTab !== 'my-schedules' && (
        <section className="flex flex-col gap-3">
          {!loading && (
            <div className="flex items-center justify-between gap-3 px-1 min-h-8">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                <span className="font-bold text-slate-800 dark:text-slate-200">{filteredSchedules.length}</span> jadwal tersedia
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-sm font-semibold text-primary dark:text-red-400 hover:underline border-none bg-transparent cursor-pointer px-2 py-1.5"
                >
                  Reset filter
                </button>
              )}
            </div>
          )}

          {loading ? (
            <ScheduleCardSkeleton count={6} />
          ) : filteredSchedules.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 sm:p-12 text-center border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-3">
              <div className="size-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                <IconCalendar className="size-7" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">Tidak ada jadwal kelas ditemukan</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                {hasActiveFilters
                  ? 'Coba ubah kata kunci pencarian atau filter minggu/bulan untuk melihat jadwal lain.'
                  : 'Belum ada jadwal kelas yang dibuka. Cek kembali nanti, ya!'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-1 h-11 px-5 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-bold border-none cursor-pointer transition-colors"
                >
                  Reset Filter
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5">
              {filteredSchedules.map(sch => {
                const enrolledCount = getEnrolledCount(sch.id)
                const userRes = getUserReservation(sch.id)
                const { isLocked, reason } = checkLockStatus(sch)
                const isFull = enrolledCount >= sch.max_quota
                const remaining = Math.max(0, sch.max_quota - enrolledCount)
                const quotaPct = Math.min(100, Math.round((enrolledCount / Math.max(1, sch.max_quota)) * 100))
                const when = getScheduleWhen(sch)
                const isOnline = sch.type === 'online'

                return (
                  <article
                    key={sch.id}
                    className={`relative bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border flex flex-col gap-3.5 shadow-xs transition-all duration-200 ${
                      userRes
                        ? 'border-emerald-400 dark:border-emerald-700 ring-1 ring-emerald-400/30'
                        : 'border-slate-200 dark:border-slate-800 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {/* Date tile + title */}
                    <div className="flex gap-3.5">
                      {when.tile && (
                        <div className={`shrink-0 w-14 rounded-xl flex flex-col items-center justify-center py-2 ${
                          isOnline
                            ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300'
                            : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                        }`}>
                          <span className="text-[11px] font-semibold uppercase leading-none">{when.tile.weekday}</span>
                          <span className="text-2xl font-black leading-tight">{when.tile.day}</span>
                          <span className="text-[11px] font-semibold uppercase leading-none">{when.tile.month}</span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            isOnline
                              ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          }`}>
                            {isOnline ? <IconVideo className="size-3.5" /> : <IconBuilding className="size-3.5" />}
                            {isOnline ? 'Online' : `Offline · ${when.badgeLabel}`}
                          </span>
                          {userRes && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-white">
                              <IconCheck className="size-3" /> Terdaftar
                            </span>
                          )}
                        </div>
                        <h3 className="mt-1.5 text-[15px] sm:text-base font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">
                          {sch.title}
                        </h3>
                        {sch.subtitle_chapter && (
                          <p className="text-[13px] font-semibold text-primary dark:text-red-400 mt-0.5 line-clamp-1">
                            {sch.subtitle_chapter}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Details */}
                    <ul className="space-y-1.5 text-[13px] sm:text-sm text-slate-600 dark:text-slate-300">
                      {when.isMultiDay && (
                        <li className="flex items-start gap-2">
                          <IconCalendar className="size-4 mt-0.5 shrink-0 text-slate-400" />
                          <span>{when.dateLabel}</span>
                        </li>
                      )}
                      <li className="flex items-start gap-2">
                        <IconClock className="size-4 mt-0.5 shrink-0 text-slate-400" />
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{when.timeLabel}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <IconUser className="size-4 mt-0.5 shrink-0 text-slate-400" />
                        <span className="truncate">{sch.instructor_name || '-'}</span>
                      </li>
                    </ul>

                    {/* Quota */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">{enrolledCount}/{sch.max_quota} terisi</span>
                        <span className={`font-bold ${
                          isFull ? 'text-red-600 dark:text-red-400' : remaining <= 2 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'
                        }`}>
                          {isFull ? 'Penuh' : `Sisa ${remaining} kursi`}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isFull ? 'bg-red-500' : remaining <= 2 ? 'bg-amber-500' : isOnline ? 'bg-sky-500' : 'bg-emerald-500'}`}
                          style={{ width: `${quotaPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Action */}
                    <div className="mt-auto pt-1">
                      {userRes ? (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setActiveTab('my-schedules')}
                            className="h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-sm font-bold border-none cursor-pointer transition-colors"
                          >
                            Lihat Detail
                          </button>
                          <button
                            onClick={() => openCancelModal(sch, userRes.id)}
                            className="h-11 rounded-xl bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/40 text-sm font-bold cursor-pointer transition-colors"
                          >
                            Batalkan
                          </button>
                        </div>
                      ) : isLocked ? (
                        <button
                          disabled
                          className="w-full h-11 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm font-semibold border-none cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          <IconLock className="size-4 shrink-0" />
                          <span className="truncate">{reason}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => openBookModal(sch)}
                          className="w-full h-11 px-3 rounded-xl bg-primary hover:bg-primary-dark active:scale-[0.99] text-white text-sm font-bold border-none cursor-pointer transition-all shadow-sm shadow-primary/20 flex items-center justify-center gap-2"
                        >
                          <span>Reservasi Kelas</span>
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* ── MY RESERVATIONS ─────────────────────────────────── */}
      {activeTab === 'my-schedules' && (
        <section className="flex flex-col gap-3">
          <div className="px-1">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">Jadwal Kelas Saya</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {upcomingCount} kelas akan datang{myReservationsList.length > upcomingCount && ` · ${myReservationsList.length - upcomingCount} selesai`}
            </p>
          </div>

          {loading ? (
            <ScheduleCardSkeleton count={2} />
          ) : myReservationsList.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 sm:p-12 text-center border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-3">
              <div className="size-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                <IconBookmark className="size-7" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">Belum Ada Kelas yang Di-reservasi</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                Pilih jadwal kelas online atau offline yang sesuai dengan waktumu.
              </p>
              <button
                onClick={() => setActiveTab('all')}
                className="mt-1 h-11 px-5 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-bold border-none cursor-pointer transition-colors"
              >
                Lihat Jadwal Kelas
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5">
              {myReservationsList.map(({ reservation, schedule, isPast }) => {
                const when = getScheduleWhen(schedule)
                const isOnline = schedule.type === 'online'
                const location = schedule.location || 'Lokasi Dojo Utama'

                return (
                  <article
                    key={reservation.id}
                    className={`bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col gap-3.5 ${isPast ? 'opacity-70' : ''}`}
                  >
                    <div className="flex gap-3.5">
                      {when.tile && (
                        <div className={`shrink-0 w-14 rounded-xl flex flex-col items-center justify-center py-2 ${
                          isPast
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            : isOnline
                              ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300'
                              : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                        }`}>
                          <span className="text-[11px] font-semibold uppercase leading-none">{when.tile.weekday}</span>
                          <span className="text-2xl font-black leading-tight">{when.tile.day}</span>
                          <span className="text-[11px] font-semibold uppercase leading-none">{when.tile.month}</span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            isOnline
                              ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          }`}>
                            {isOnline ? <IconVideo className="size-3.5" /> : <IconBuilding className="size-3.5" />}
                            {isOnline ? 'Online · Google Meet' : `Offline · ${when.badgeLabel}`}
                          </span>
                          {isPast && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500">Selesai</span>
                          )}
                        </div>
                        <h3 className="mt-1.5 text-[15px] sm:text-base font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">
                          {schedule.title}
                        </h3>
                        {schedule.subtitle_chapter && (
                          <p className="text-[13px] font-semibold text-primary dark:text-red-400 mt-0.5 line-clamp-1">
                            {schedule.subtitle_chapter}
                          </p>
                        )}
                      </div>
                    </div>

                    <ul className="space-y-1.5 text-[13px] sm:text-sm text-slate-600 dark:text-slate-300">
                      <li className="flex items-start gap-2">
                        <IconCalendar className="size-4 mt-0.5 shrink-0 text-slate-400" />
                        <span>{when.dateLabel}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <IconClock className="size-4 mt-0.5 shrink-0 text-slate-400" />
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{when.timeLabel}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <IconUser className="size-4 mt-0.5 shrink-0 text-slate-400" />
                        <span className="truncate">{schedule.instructor_name || '-'}</span>
                      </li>
                      {!isOnline && (
                        <li className="flex items-start gap-2">
                          <IconPin className="size-4 mt-0.5 shrink-0 text-slate-400" />
                          <span>{location}</span>
                        </li>
                      )}
                    </ul>

                    {!isPast && (
                      <div className="mt-auto flex flex-col sm:flex-row gap-2 pt-1">
                        {isOnline ? (
                          schedule.meet_url ? (
                            <a
                              href={schedule.meet_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 h-11 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold no-underline flex items-center justify-center gap-2 shadow-sm transition-colors"
                            >
                              <IconVideo className="size-4" />
                              <span>Gabung Google Meet</span>
                            </a>
                          ) : (
                            <span className="flex-1 h-11 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm font-semibold flex items-center justify-center text-center">
                              Link Meet belum tersedia
                            </span>
                          )
                        ) : (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold no-underline flex items-center justify-center gap-2 shadow-sm transition-colors"
                          >
                            <IconPin className="size-4" />
                            <span>Buka di Maps</span>
                          </a>
                        )}
                        <button
                          onClick={() => openCancelModal(schedule, reservation.id)}
                          className="h-11 px-4 rounded-xl bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/40 text-sm font-bold cursor-pointer transition-colors"
                        >
                          Batalkan
                        </button>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* ── CONFIRMATION SHEET (bottom sheet di HP, dialog di desktop) ── */}
      {confirmModalType && targetSchedule && (() => {
        const when = getScheduleWhen(targetSchedule)
        const isBook = confirmModalType === 'book'
        const isOnline = targetSchedule.type === 'online'
        return (
          <div
            className="modal-overlay fixed inset-0 z-[999] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-fade-in"
            onClick={closeModal}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="cr-modal-title"
              onClick={e => e.stopPropagation()}
              className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92dvh] overflow-y-auto animate-fade-in-up px-5 pt-3 sm:pt-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6 flex flex-col gap-4"
            >
              {/* Grab handle (mobile) */}
              <div className="sm:hidden mx-auto h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`size-11 shrink-0 rounded-2xl flex items-center justify-center ${
                    isBook ? 'bg-primary/10 text-primary dark:text-red-400' : 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400'
                  }`}>
                    {isBook ? (
                      <IconCalendar className="size-5" />
                    ) : (
                      <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {isBook ? 'Konfirmasi Reservasi' : 'Konfirmasi Pembatalan'}
                    </p>
                    <h3 id="cr-modal-title" className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                      {isBook ? 'Reservasi kelas ini?' : 'Batalkan reservasi?'}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  disabled={actionLoading}
                  aria-label="Tutup"
                  className="size-10 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 border-none cursor-pointer flex items-center justify-center transition-colors disabled:opacity-50"
                >
                  <IconClose className="size-4" />
                </button>
              </div>

              {/* Schedule summary */}
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 p-4 flex flex-col gap-3">
                <div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    isOnline
                      ? 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300'
                      : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                  }`}>
                    {isOnline ? <IconVideo className="size-3.5" /> : <IconBuilding className="size-3.5" />}
                    {isOnline ? 'Online · Google Meet' : `Offline · ${when.badgeLabel}`}
                  </span>
                  <h4 className="mt-1.5 text-[15px] font-bold text-slate-900 dark:text-white leading-snug">
                    {targetSchedule.title}
                  </h4>
                  {targetSchedule.subtitle_chapter && (
                    <p className="text-[13px] font-semibold text-primary dark:text-red-400">{targetSchedule.subtitle_chapter}</p>
                  )}
                </div>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-200/70 dark:border-slate-700/60">
                  <li className="flex items-start gap-2">
                    <IconCalendar className="size-4 mt-0.5 shrink-0 text-slate-400" />
                    <span>{when.dateLabel}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconClock className="size-4 mt-0.5 shrink-0 text-slate-400" />
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{when.timeLabel}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconUser className="size-4 mt-0.5 shrink-0 text-slate-400" />
                    <span>{targetSchedule.instructor_name || '-'}</span>
                  </li>
                </ul>
              </div>

              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {isBook
                  ? 'Satu kursi akan dikunci untukmu. Link kelas atau lokasi akan muncul di tab "Jadwalku".'
                  : 'Kursimu akan dilepas untuk siswa lain dan reservasi tidak bisa dikembalikan otomatis.'}
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={closeModal}
                  disabled={actionLoading}
                  className="h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-bold border-none cursor-pointer transition-colors disabled:opacity-50"
                >
                  {isBook ? 'Batal' : 'Kembali'}
                </button>
                <button
                  disabled={actionLoading}
                  onClick={handleConfirmAction}
                  className={`h-12 rounded-xl text-white text-sm font-bold border-none cursor-pointer transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center gap-2 ${
                    isBook ? 'bg-primary hover:bg-primary-dark' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {actionLoading && <span className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {actionLoading ? 'Memproses...' : isBook ? 'Ya, Reservasi' : 'Ya, Batalkan'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </main>
  )
}
