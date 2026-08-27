import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../contexts/LanguageContext'
import { supabase } from '../lib/supabaseClient'
import { normalizeGroup } from '../lib/studentService'
import {
  type ClassSchedule,
  type ClassReservation,
  fetchSchedules,
  fetchReservations,
  bookClass,
  cancelClassBooking,
  getMonthlyOnlineRequirementStatus,
  getWeekLabel,
  formatDateIndonesian,
  formatDateRangeIndonesian,
  formatTimeShort,
  RESERVATION_UPDATE_EVENT,
  matchScheduleId,
  getScheduleDatesList,
  areDatesOverlapping,
} from '../lib/scheduleService'
import { ScheduleCardSkeleton } from '../components/Skeleton'


export default function ClassReservationPage() {
  const { profile } = useAuth()
  const { language, t } = useLanguage()

  // Use real Supabase Auth UUID — critical for RLS policy (auth.uid() = user_id)
  const userId = profile?.id ?? ''
  const userName = profile?.full_name || profile?.username || 'Pengguna'
  const userEmail = profile?.email || ''

  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [reservations, setReservations] = useState<ClassReservation[]>([])
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState<'all' | 'online' | 'offline' | 'my-schedules'>('all')
  const [selectedWeekFilter, setSelectedWeekFilter] = useState<string>('all')
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Modal Confirmation states
  const [targetSchedule, setTargetSchedule] = useState<ClassSchedule | null>(null)
  const [confirmModalType, setConfirmModalType] = useState<'book' | 'cancel' | null>(null)
  const [targetReservationId, setTargetReservationId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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

  async function loadData() {
    setLoading(true)
    const [sData, rData] = await Promise.all([
      fetchSchedules(),
      fetchReservations(),
      new Promise(r => setTimeout(r, 1000)),
    ])
    setSchedules(sData)
    setReservations(rData)

    const status = await getMonthlyOnlineRequirementStatus(userId)
    setReqStatus(status)
    setLoading(false)
  }

  useEffect(() => {
    loadData()

    // 1. Instant local window event sync (multi-tab / role switcher)
    const handleLocalSync = () => loadData()
    window.addEventListener(RESERVATION_UPDATE_EVENT, handleLocalSync)
    window.addEventListener('storage', handleLocalSync)

    // 2. Supabase Realtime channel for cross-device live quota updates
    const channel = supabase
      .channel('class_reservations_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'class_reservations' },
        () => loadData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'class_schedules' },
        () => loadData()
      )
      .subscribe()

    return () => {
      window.removeEventListener(RESERVATION_UPDATE_EVENT, handleLocalSync)
      window.removeEventListener('storage', handleLocalSync)
      supabase.removeChannel(channel)
    }
  }, [userId])

  function showToast(text: string, type: 'success' | 'error' = 'success') {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Get enrolled count for a schedule (uses matchScheduleId for UUID/string compatibility)
  function getEnrolledCount(schId: string): number {
    return reservations.filter(r => matchScheduleId(schId, r.schedule_id)).length
  }

  // Check if user is enrolled in a schedule
  function getUserReservation(schId: string): ClassReservation | undefined {
    return reservations.find(r => matchScheduleId(schId, r.schedule_id) && r.user_id === userId)
  }

  // Check locking constraint for user
  function checkLockStatus(sch: ClassSchedule): { isLocked: boolean; reason?: string } {
    if (getUserReservation(sch.id)) return { isLocked: false }

    const enrolled = getEnrolledCount(sch.id)
    if (enrolled >= sch.max_quota) {
      return { isLocked: true, reason: 'Kuota Penuh' }
    }

    // 1. Same-Day Date Conflict check (Online vs Offline or same date)
    const targetDates = getScheduleDatesList(sch)
    const userReservations = reservations.filter(r => r.user_id === userId)
    for (const r of userReservations) {
      const existingSch = schedules.find(s => matchScheduleId(s.id, r.schedule_id))
      if (!existingSch) continue

      const existingDates = getScheduleDatesList(existingSch)
      if (areDatesOverlapping(targetDates, existingDates)) {
        if (sch.type === 'online' && existingSch.type === 'offline') {
          return { isLocked: true, reason: 'Ada Kelas Offline di Hari Ini' }
        }
        if (sch.type === 'offline' && existingSch.type === 'online') {
          return { isLocked: true, reason: 'Ada Kelas Online di Hari Ini' }
        }
        if (sch.type === existingSch.type) {
          return { isLocked: true, reason: 'Sudah Reservasi Hari Ini' }
        }
      }
    }

    // 2. Weekly online limit (1 per week)
    if (sch.type === 'online') {
      const hasOtherOnlineInWeek = reservations.some(r => {
        if (r.user_id !== userId) return false
        const targetSch = schedules.find(s => matchScheduleId(s.id, r.schedule_id))
        return targetSch && targetSch.type === 'online' && targetSch.week_range_id === sch.week_range_id
      })
      if (hasOtherOnlineInWeek) {
        return { isLocked: true, reason: 'Sudah Reservasi Minggu Ini' }
      }
    }

    // 3. Monthly offline limit (1 per month)
    if (sch.type === 'offline') {
      const hasOtherOfflineInMonth = reservations.some(r => {
        if (r.user_id !== userId) return false
        const targetSch = schedules.find(s => matchScheduleId(s.id, r.schedule_id))
        return targetSch && targetSch.type === 'offline' && targetSch.month_range_id === sch.month_range_id
      })
      if (hasOtherOfflineInMonth) {
        return { isLocked: true, reason: 'Sudah Reservasi Bulan Ini' }
      }
    }

    return { isLocked: false }
  }

  async function handleConfirmAction() {
    if (!targetSchedule) return
    if (!userId) {
      showToast('Silakan login terlebih dahulu untuk melakukan reservasi.', 'error')
      setConfirmModalType(null)
      setTargetSchedule(null)
      return
    }
    setActionLoading(true)

    if (confirmModalType === 'book') {
      const res = await bookClass(targetSchedule, userId, userName, userEmail)
      if (res.success) {
        showToast(res.message || `Berhasil reservasi kelas "${targetSchedule.title}"!`)
        await loadData()
      } else {
        showToast(res.message, 'error')
      }
    } else if (confirmModalType === 'cancel' && targetReservationId) {
      const ok = await cancelClassBooking(targetReservationId)
      if (ok) {
        showToast('Reservasi kelas berhasil dibatalkan.')
        await loadData()
      } else {
        showToast('Gagal membatalkan reservasi.', 'error')
      }
    }

    setActionLoading(false)
    setConfirmModalType(null)
    setTargetSchedule(null)
    setTargetReservationId(null)
  }

  // Filter schedules
  const availableWeeks = Array.from(new Set(schedules.map(s => s.week_range_id))).sort()
  const availableMonths = Array.from(new Set(schedules.map(s => s.month_range_id))).sort()

  // Group-based visibility:
  // - userGroupName comes from DB field group_name or fallback to institution
  const userGroupName = normalizeGroup((profile as any)?.group_name || (profile as any)?.institution)

  const filteredSchedules = schedules.filter(sch => {
    // Type tab
    if (activeTab === 'online' && sch.type !== 'online') return false
    if (activeTab === 'offline' && sch.type !== 'offline') return false

    // Group visibility filter:
    // - if schedule has no target_group → visible to all
    // - if schedule has target_group → only visible if user's group matches (case+space insensitive)
    if (sch.target_group) {
      const schedGroup = normalizeGroup(sch.target_group)
      if (!userGroupName || userGroupName.toLowerCase() !== schedGroup.toLowerCase()) return false
    }

    // Week filter
    if (selectedWeekFilter !== 'all' && sch.week_range_id !== selectedWeekFilter) return false

    // Month filter
    if (selectedMonthFilter !== 'all' && sch.month_range_id !== selectedMonthFilter) return false

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      const matchTitle = sch.title.toLowerCase().includes(term)
      const matchSub = sch.subtitle_chapter.toLowerCase().includes(term)
      const matchInst = sch.instructor_name.toLowerCase().includes(term)
      if (!matchTitle && !matchSub && !matchInst) return false
    }

    return true
  })

  // User's booked reservations
  const myReservationsList = reservations
    .filter(r => r.user_id === userId)
    .map(r => ({
      reservation: r,
      schedule: schedules.find(s => s.id === r.schedule_id),
    }))
    .filter((item): item is { reservation: ClassReservation; schedule: ClassSchedule } => Boolean(item.schedule))

  // Guard: if user not logged in, show login prompt
  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 border border-slate-200 dark:border-slate-800 shadow-lg flex flex-col items-center gap-4 max-w-sm text-center">
          <span className="text-5xl">🔒</span>
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">Login Diperlukan</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Kamu perlu login terlebih dahulu untuk melihat jadwal dan melakukan reservasi kelas.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full flex flex-col gap-6 animate-page-slide">

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-5 right-5 z-[600] px-5 py-3.5 rounded-2xl shadow-xl border flex items-center gap-3 animate-slide-down ${
          toastMessage.type === 'success'
            ? 'bg-emerald-500 text-white border-emerald-600'
            : 'bg-red-500 text-white border-red-600'
        }`}>
          <span className="text-xl">{toastMessage.type === 'success' ? '✅' : '⚠️'}</span>
          <span className="text-xs sm:text-sm font-bold">{toastMessage.text}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary dark:text-red-400">
            <span className="size-6 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 flex items-center justify-center font-bold text-xs">
              💻
            </span>
            <span>{t('cr_tag', 'Jadwal & Interaktif Class')}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white mt-1">
            {t('cr_title', 'Reservasi Kelas Online & Offline')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('cr_subtitle', 'Pilih hari dan jam terbaik untuk mengasah percakapan (Kaiwa) dengan instruktur.')}
          </p>
        </div>

        {/* User Role Badge */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex items-center gap-3 shadow-xs shrink-0">
          <div className="size-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-lg font-serif">
            学
          </div>
          <div>
            <div className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">Login Sebagai</div>
            <div className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200">{userName}</div>
          </div>
        </div>
      </div>

      {/* ── MANDATORY ONLINE CLASS BANNER ────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-primary/90 to-primary text-white rounded-3xl p-5 sm:p-6 shadow-md border border-white/10 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="relative z-10 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-[0.7rem] font-extrabold uppercase tracking-wider text-white">
              Target Wajib Bulanan
            </span>
            <span className="text-xs text-white/80 font-bold">({reqStatus.currentMonthLabel})</span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-white">
            *{t('cr_requirement', 'Wajib Mengambil Minimal 2 Kelas Online / Bulan')}
          </h2>
          <p className="text-xs sm:text-sm text-white/80 mt-1 max-w-2xl leading-relaxed">
            {t('cr_requirement_sub', 'Untuk memastikan kemampuan percakapan Bahasa Jepang kamu terus terasah, setiap siswa diwajibkan mengikuti sekurang-kurangnya 2 sesi kelas online live per minggu/bulan.')}
          </p>
        </div>

        {/* Progress Card */}
        <div className="relative z-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center min-w-[200px] w-full md:w-auto shrink-0">
          <div className="text-xs font-bold text-white/90 mb-1">Status Progres</div>
          <div className="text-3xl font-black text-white flex items-baseline gap-1">
            <span>{reqStatus.bookedCount}</span>
            <span className="text-lg text-white/70">/ {reqStatus.targetCount}</span>
            <span className="text-sm text-white/90 font-bold ml-1">Kelas</span>
          </div>
          <div className={`mt-2.5 px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 ${
            reqStatus.isFulfilled
              ? 'bg-emerald-400 text-slate-950'
              : 'bg-amber-400 text-slate-950'
          }`}>
            {reqStatus.isFulfilled ? '✅ Target Terpenuhi' : '⚠️ Belum Terpenuhi'}
          </div>
        </div>
      </div>

      {/* ── FILTER & TAB BAR ────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all border-none cursor-pointer whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-primary text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {t('cr_tab_all', 'Semua Kelas')} ({schedules.length})
          </button>

          <button
            onClick={() => setActiveTab('online')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all border-none cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'online'
                ? 'bg-sky-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>{t('cr_tab_online', '💻 Kelas Online (Mingguan)')}</span>
          </button>

          <button
            onClick={() => setActiveTab('offline')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all border-none cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'offline'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>{t('cr_tab_offline', '🏢 Kelas Offline (Bulanan)')}</span>
          </button>

          <button
            onClick={() => setActiveTab('my-schedules')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all border-none cursor-pointer whitespace-nowrap flex items-center gap-2 ml-auto ${
              activeTab === 'my-schedules'
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/60'
            }`}
          >
            <span>{t('cr_tab_my_booking', '📌 Jadwal Saya')} ({myReservationsList.length})</span>
          </button>
        </div>

        {/* Search & Range Filters */}
        {activeTab !== 'my-schedules' && (
          <div className="flex flex-col gap-3">
            {/* Search Input */}
            <div className="w-full relative">
              <input
                type="text"
                placeholder={t('cr_search_placeholder', 'Cari judul bab, materi, atau instruktur...')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            </div>

            {/* Week & Month Filter — 2 columns on mobile, inline on sm+ */}
            <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-3">
              {/* Week Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
                <span className="text-[0.65rem] sm:text-xs font-bold text-slate-400 shrink-0">{t('cr_filter_week_label', 'Filter Minggu:')}</span>
                <select
                  value={selectedWeekFilter}
                  onChange={e => setSelectedWeekFilter(e.target.value)}
                  className="w-full min-w-0 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[0.7rem] sm:text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none truncate"
                >
                  <option value="all">{t('cr_all_weeks', 'Semua Minggu')}</option>
                  {availableWeeks.map(w => (
                    <option key={w} value={w}>{getWeekLabel(w)}</option>
                  ))}
                </select>
              </div>

              {/* Month Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
                <span className="text-[0.65rem] sm:text-xs font-bold text-slate-400 shrink-0">Filter Bulan:</span>
                <select
                  value={selectedMonthFilter}
                  onChange={e => setSelectedMonthFilter(e.target.value)}
                  className="w-full min-w-0 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[0.7rem] sm:text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none truncate"
                >
                  <option value="all">Semua Bulan</option>
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── TAB 1, 2, 3: SCHEDULE CARDS GRID ─────────────────── */}
      {activeTab !== 'my-schedules' && (
        <>
          {loading ? (
            <ScheduleCardSkeleton count={6} />
          ) : filteredSchedules.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-3">
              <span className="text-5xl">📅</span>
              <h3 className="text-lg font-extrabold text-slate-800 dark:text-white">Tidak ada jadwal kelas ditemukan</h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md">
                Coba ubah kata kunci pencarian atau filter minggu/bulan untuk melihat jadwal lain.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSchedules.map(sch => {
                const enrolledCount = getEnrolledCount(sch.id)
                const userRes = getUserReservation(sch.id)
                const { isLocked, reason } = checkLockStatus(sch)
                const isFull = enrolledCount >= sch.max_quota

                const isOfflineMultiDay = sch.type === 'offline' || Boolean(sch.end_date && sch.end_date !== (sch.start_date || sch.date))
                const sDateStr = sch.start_date || sch.date
                const eDateStr = sch.end_date || sDateStr
                const { formattedRange, badgeLabel } = formatDateRangeIndonesian(sDateStr, eDateStr, sch.start_time, sch.end_time, language)

                return (
                  <div
                    key={sch.id}
                    className={`bg-white dark:bg-slate-900 rounded-3xl p-5 border transition-all duration-200 flex flex-col justify-between shadow-sm hover:shadow-md relative overflow-hidden ${
                      userRes
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/10'
                        : isLocked
                          ? 'border-slate-200 dark:border-slate-800 opacity-90'
                          : 'border-slate-200 dark:border-slate-800 hover:border-primary/40'
                    }`}
                  >
                    {/* Top Ribbon Badge */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className={`px-3 py-1 rounded-full text-[0.7rem] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                        userRes
                          ? sch.type === 'online'
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'bg-emerald-600 text-white shadow-xs'
                          : sch.type === 'online'
                            ? 'bg-transparent border border-sky-400 text-sky-600 dark:text-sky-300 font-extrabold'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-400 font-black'
                      }`}>
                        {sch.type === 'online' ? '💻 ONLINE (G-Meet)' : `⛺ OFFLINE (${badgeLabel})`}
                      </span>

                      {/* Quota Badge */}
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-black ${
                        isFull
                          ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                          : enrolledCount >= 8
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        👥 {enrolledCount} / {sch.max_quota} Orang
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex flex-col gap-2 mb-4">
                      <h3 className="text-base font-extrabold text-slate-800 dark:text-white leading-snug line-clamp-2">
                        {sch.title}
                      </h3>
                      <p className="text-xs text-primary dark:text-red-400 font-bold line-clamp-2 bg-primary/5 dark:bg-primary/20 p-2.5 rounded-xl border border-primary/10">
                        {sch.subtitle_chapter}
                      </p>

                      {/* Date & Time */}
                      <div className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                        {isOfflineMultiDay ? (
                          <>
                            <div className="flex items-start gap-2 bg-emerald-50/80 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200/60 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200">
                              <span className="text-base shrink-0">⛺</span>
                              <div className="text-[0.72rem] leading-snug">
                                <div className="font-black text-emerald-700 dark:text-emerald-400 uppercase text-[0.65rem] tracking-wider mb-0.5">
                                  Jadwal 3 Hari 2 Malam:
                                </div>
                                <span className="font-extrabold">{formattedRange}</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <span>📅</span>
                              <span className="font-extrabold">{formatDateIndonesian(sDateStr, language)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span>⏰</span>
                              <span>{formatTimeShort(sch.start_time)} - {formatTimeShort(sch.end_time)} WIB</span>
                            </div>
                          </>
                        )}

                        <div className="flex items-center gap-2">
                          <span>👨‍🏫</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200">{sch.instructor_name}</span>
                        </div>

                        {/* Location / Meet info */}
                        {sch.type === 'online' ? (
                          <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-semibold truncate pt-1">
                            <span>🔗</span>
                            <span className="truncate">Google Meet Sesi Live</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold truncate pt-1">
                            <span>📍</span>
                            <span className="truncate">{sch.location || 'Kaiwa Dojo Center'}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                      {userRes ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-500 text-white font-extrabold text-xs text-center flex items-center justify-center gap-1.5 shadow-sm">
                            <span>✅ Terdaftar</span>
                          </div>
                          <button
                            onClick={() => {
                              setTargetSchedule(sch)
                              setTargetReservationId(userRes.id)
                              setConfirmModalType('cancel')
                            }}
                            className="px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 font-bold text-xs border-none cursor-pointer transition-all"
                            title="Batalkan Reservasi"
                          >
                            Batalkan
                          </button>
                        </div>
                      ) : isLocked ? (
                        <button
                          disabled
                          className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold text-xs border-none cursor-not-allowed flex items-center justify-center gap-1.5"
                        >
                          <span>🔒</span>
                          <span>{reason}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setTargetSchedule(sch)
                            setConfirmModalType('book')
                          }}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white font-extrabold text-xs border-none cursor-pointer transition-all shadow-md hover:-translate-y-0.5 flex items-center justify-center gap-2"
                        >
                          <span>+ Reservasi Kelas</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── TAB 4: MY RESERVATIONS VIEW ──────────────────────── */}
      {activeTab === 'my-schedules' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">
              Sesi Kelas Terdaftar Kamu ({myReservationsList.length})
            </h2>
          </div>

          {myReservationsList.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-3">
              <span className="text-5xl">🔖</span>
              <h3 className="text-lg font-extrabold text-slate-800 dark:text-white">Belum Ada Kelas yang Di-reservasi</h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md">
                Kamu belum mendaftar kelas apapun. Buka tab "Semua Kelas" di atas untuk memilih hari dan jam belajar!
              </p>
              <button
                onClick={() => setActiveTab('all')}
                className="mt-2 px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold border-none cursor-pointer"
              >
                Lihat Jadwal Kelas
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {myReservationsList.map(({ reservation, schedule }) => {
                const dateObj = new Date(schedule.date)
                const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][dateObj.getDay()]
                const monthName = [
                  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
                ][dateObj.getMonth()]
                const formattedDate = `${dayName}, ${dateObj.getDate()} ${monthName} ${dateObj.getFullYear()}`

                return (
                  <div
                    key={reservation.id}
                    className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-md flex flex-col justify-between gap-5 relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className={`px-3 py-1 rounded-full text-[0.7rem] font-black uppercase tracking-wider inline-block mb-2 ${
                          schedule.type === 'online'
                            ? 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300'
                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        }`}>
                          {schedule.type === 'online' ? '💻 Online Live Class' : '🏢 Sesi Offline Dojo'}
                        </span>
                        <h3 className="text-base font-extrabold text-slate-800 dark:text-white leading-snug">
                          {schedule.title}
                        </h3>
                        <p className="text-xs font-bold text-primary dark:text-red-400 mt-1">
                          {schedule.subtitle_chapter}
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setTargetSchedule(schedule)
                          setTargetReservationId(reservation.id)
                          setConfirmModalType('cancel')
                        }}
                        className="px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 text-xs font-bold border-none cursor-pointer shrink-0"
                      >
                        Batalkan
                      </button>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 space-y-2 text-xs text-slate-700 dark:text-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Detail Tanggal:</span>
                        <span className="font-extrabold">{formattedDate}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Jam Pelaksanaan:</span>
                        <span className="font-extrabold">{schedule.start_time} - {schedule.end_time} WIB</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Instruktur:</span>
                        <span className="font-bold text-primary dark:text-red-400">{schedule.instructor_name}</span>
                      </div>

                      {/* Launch Link / Location Details */}
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-1.5">
                        <span className="text-slate-400 font-medium">Akses Kelas:</span>
                        {schedule.type === 'online' ? (
                          <a
                            href={schedule.meet_url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs text-center no-underline flex items-center justify-center gap-2 shadow-sm transition-all"
                          >
                            <span>🎥 Buka Link Google Meet</span>
                          </a>
                        ) : (
                          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-start gap-2">
                            <span>📍</span>
                            <span>{schedule.location || 'Lokasi Dojo Utama'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CONFIRMATION MODAL ──────────────────────────────── */}
      {confirmModalType && targetSchedule && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[999] flex items-start sm:items-center justify-center p-2 sm:p-4 pt-8 sm:pt-0 animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4 sm:gap-5 animate-scale-up my-auto max-h-[90dvh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`size-10 rounded-2xl flex items-center justify-center text-lg ${
                  confirmModalType === 'book'
                    ? 'bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400'
                    : 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400'
                }`}>
                  {confirmModalType === 'book' ? '📝' : '⚠️'}
                </div>
                <div>
                  <span className="text-[0.68rem] font-black uppercase tracking-wider text-slate-400">
                    {confirmModalType === 'book' ? 'Konfirmasi Reservasi' : 'Konfirmasi Pembatalan'}
                  </span>
                  <h3 className="text-base font-extrabold text-slate-800 dark:text-white leading-tight">
                    {confirmModalType === 'book' ? 'Reservasi Kelas Live' : 'Batalkan Reservasi Kelas'}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => {
                  setConfirmModalType(null)
                  setTargetSchedule(null)
                }}
                className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold border-none cursor-pointer flex items-center justify-center transition-colors"
              >
                ×
              </button>
            </div>

            {/* Schedule Info Card */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 space-y-3 text-xs border border-slate-200/80 dark:border-slate-700/60">
              <div>
                <span className={`px-2.5 py-0.5 rounded-full text-[0.65rem] font-black uppercase inline-block mb-1.5 ${
                  targetSchedule.type === 'online'
                    ? 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300'
                    : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                }`}>
                  {targetSchedule.type === 'online' ? '💻 ONLINE (Google Meet)' : '🏢 OFFLINE (Lokasi Dojo)'}
                </span>
                <h4 className="text-sm font-extrabold text-slate-800 dark:text-white leading-snug">
                  {targetSchedule.title}
                </h4>
                <p className="text-xs text-primary dark:text-red-400 font-bold">
                  {targetSchedule.subtitle_chapter}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1.5 text-slate-600 dark:text-slate-300 font-medium">
                <div className="flex items-center gap-2">
                  <span>📅</span>
                  <span>Hari & Tanggal: <strong className="text-slate-800 dark:text-white font-extrabold">{formatDateIndonesian(targetSchedule.date, language)}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span>⏰</span>
                  <span>Waktu Sesi: <strong className="text-slate-800 dark:text-white font-extrabold">{targetSchedule.start_time} - {targetSchedule.end_time} WIB</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span>👨‍🏫</span>
                  <span>Instruktur: <strong className="text-slate-800 dark:text-white font-extrabold">{targetSchedule.instructor_name}</strong></span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {confirmModalType === 'book'
                ? 'Dengan melakukan reservasi, 1 slot kuota akan terkunci untuk Anda dan Anda dapat bergabung dalam sesi belajar live ini.'
                : 'Apakah Anda yakin ingin membatalkan reservasi ini? Slot kuota akan dilepaskan untuk siswa lain.'}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => {
                  setConfirmModalType(null)
                  setTargetSchedule(null)
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-xs border-none cursor-pointer transition-colors"
              >
                Batal
              </button>

              <button
                disabled={actionLoading}
                onClick={handleConfirmAction}
                className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs text-white border-none cursor-pointer transition-all shadow-md ${
                  confirmModalType === 'book'
                    ? 'bg-gradient-to-r from-sky-600 to-primary hover:from-sky-700 hover:to-primary-dark'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {actionLoading ? 'Memproses...' : confirmModalType === 'book' ? 'Ya, Reservasi Sekarang' : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
