import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabaseClient'
import { fetchInstructors, type InstructorAccount } from '../lib/instructorService'
import { fetchStudentsCount } from '../lib/studentService'
import { fetchSchedules, fetchReservations, type ClassSchedule, type ClassReservation, sortSchedules, RESERVATION_UPDATE_EVENT } from '../lib/scheduleService'
import { getChapterSettingsMap, type ChapterSetting } from '../lib/chapterService'
import { fetchGroups, createGroup, deleteGroup, parseKeywords, sortGroupsAlphabetically, type KaiwaGroup, GROUP_UPDATE_EVENT } from '../lib/groupService'
import { fetchFeedbacks, type FeedbackItem, CATEGORY_META, FEEDBACK_UPDATE_EVENT } from '../lib/feedbackService'
import { fetchKotobaSummary, type GlobalKotobaSummary, KOTOBA_TRACKER_UPDATE_EVENT } from '../lib/kotobaService'
import { fetchAnnouncements, type Announcement, ANNOUNCEMENT_UPDATE_EVENT } from '../lib/announcementService'

import LoadingScreen from '../components/LoadingScreen'
import WhatsAppBroadcastModal from '../components/WhatsAppBroadcastModal'

const ADMIN_CACHE_KEY = 'kaiwa_admin_dashboard_cache_v2'

interface AdminCacheData {
  instructors: InstructorAccount[]
  studentCount: number
  schedules: ClassSchedule[]
  reservations: ClassReservation[]
  chapterSettings: Record<number, ChapterSetting>
  feedbacks: FeedbackItem[]
  kotobaSummary: GlobalKotobaSummary | null
  announcements: Announcement[]
  groups: KaiwaGroup[]
}

function getInitialCache(): AdminCacheData | null {
  try {
    const raw = sessionStorage.getItem(ADMIN_CACHE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  // Instant SWR Cache
  const initialCache = useRef(getInitialCache()).current

  const [instructors, setInstructors] = useState<InstructorAccount[]>(() => initialCache?.instructors || [])
  const [studentCount, setStudentCount] = useState<number>(() => initialCache?.studentCount || 0)
  const [schedules, setSchedules] = useState<ClassSchedule[]>(() => initialCache?.schedules || [])
  const [reservations, setReservations] = useState<ClassReservation[]>(() => initialCache?.reservations || [])
  const [chapterSettings, setChapterSettings] = useState<Record<number, ChapterSetting>>(() => initialCache?.chapterSettings || {})
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>(() => initialCache?.feedbacks || [])
  const [kotobaSummary, setKotobaSummary] = useState<GlobalKotobaSummary | null>(() => initialCache?.kotobaSummary || null)
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => initialCache?.announcements || [])
  const [groups, setGroups] = useState<KaiwaGroup[]>(() => sortGroupsAlphabetically(initialCache?.groups || []))

  const [loading, setLoading] = useState<boolean>(() => !initialCache)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Broadcast WA Modal state
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)

  // Group management state
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupKeywords, setNewGroupKeywords] = useState('')
  const [groupLoading, setGroupLoading] = useState(false)
  const [groupToast, setGroupToast] = useState<string | null>(null)
  const [groupSearch, setGroupSearch] = useState('')

  // Live reservations filter & search
  const [reservationSearch, setReservationSearch] = useState('')
  const [reservationTypeFilter, setReservationTypeFilter] = useState<'all' | 'online' | 'offline'>('all')

  function showGroupToast(msg: string) {
    setGroupToast(msg)
    setTimeout(() => setGroupToast(null), 3500)
  }

  async function handleAddGroup() {
    const name = newGroupName.trim()
    if (!name) return
    setGroupLoading(true)
    const res = await createGroup({
      name,
      keywords: newGroupKeywords || name.toLowerCase(),
    })
    if (res.success) {
      setNewGroupName('')
      setNewGroupKeywords('')
      const updatedGroups = await fetchGroups(true)
      setGroups(updatedGroups)
      showGroupToast(`Grup "${name}" berhasil ditambahkan!`)
    } else {
      showGroupToast(`Gagal: ${res.error}`)
    }
    setGroupLoading(false)
  }

  async function handleDeleteGroup(id: string, name: string) {
    if (!confirm(`Hapus grup "${name}"? Siswa di grup ini akan dialihkan ke Siswa Umum.`)) return
    setGroupLoading(true)
    const res = await deleteGroup(id, name)
    if (res.success) {
      const updatedGroups = await fetchGroups(true)
      setGroups(updatedGroups)
      showGroupToast(`Grup "${name}" dihapus.`)
    } else {
      showGroupToast(`Gagal: ${res.error}`)
    }
    setGroupLoading(false)
  }

  async function loadData(showSpinner = false) {
    if (showSpinner) {
      setLoading(true)
    } else {
      setIsRefreshing(true)
    }

    try {
      const [
        instData,
        stdCount,
        schData,
        resData,
        chapData,
        fbData,
        kotobaSummaryData,
        annData,
        grpData,
      ] = await Promise.all([
        fetchInstructors(),
        fetchStudentsCount(),
        fetchSchedules(),
        fetchReservations(),
        getChapterSettingsMap(),
        fetchFeedbacks(),
        fetchKotobaSummary(),
        fetchAnnouncements(),
        fetchGroups(true),
      ])

      const sortedSchedules = sortSchedules(schData)

      setInstructors(instData)
      setStudentCount(stdCount)
      setSchedules(sortedSchedules)
      setReservations(resData)
      setChapterSettings(chapData)
      setFeedbacks(fbData)
      setKotobaSummary(kotobaSummaryData)
      setAnnouncements(annData)
      setGroups(grpData)

      const cacheToSave: AdminCacheData = {
        instructors: instData,
        studentCount: stdCount,
        schedules: sortedSchedules,
        reservations: resData,
        chapterSettings: chapData,
        feedbacks: fbData,
        kotobaSummary: kotobaSummaryData,
        announcements: annData,
        groups: grpData,
      }
      sessionStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify(cacheToSave))
    } catch (err) {
      console.warn('Admin loadData error:', err)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadData(!initialCache)

    let syncTimer: any = null
    const handleSync = () => {
      clearTimeout(syncTimer)
      syncTimer = setTimeout(() => {
        loadData(false)
      }, 300)
    }

    window.addEventListener(RESERVATION_UPDATE_EVENT, handleSync)
    window.addEventListener(GROUP_UPDATE_EVENT, handleSync)
    window.addEventListener(FEEDBACK_UPDATE_EVENT, handleSync)
    window.addEventListener(KOTOBA_TRACKER_UPDATE_EVENT, handleSync)
    window.addEventListener(ANNOUNCEMENT_UPDATE_EVENT, handleSync)
    window.addEventListener('storage', handleSync)

    const channel = supabase
      .channel('admin_dashboard_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_reservations' }, handleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_schedules' }, handleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, handleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, handleSync)
      .subscribe()

    return () => {
      clearTimeout(syncTimer)
      window.removeEventListener(RESERVATION_UPDATE_EVENT, handleSync)
      window.removeEventListener(GROUP_UPDATE_EVENT, handleSync)
      window.removeEventListener(FEEDBACK_UPDATE_EVENT, handleSync)
      window.removeEventListener(KOTOBA_TRACKER_UPDATE_EVENT, handleSync)
      window.removeEventListener(ANNOUNCEMENT_UPDATE_EVENT, handleSync)
      window.removeEventListener('storage', handleSync)
      supabase.removeChannel(channel)
    }
  }, [])

  // Filtered reservations
  const filteredReservations = useMemo(() => {
    return reservations.filter(res => {
      const sch = schedules.find(s => s.id === res.schedule_id)
      if (reservationTypeFilter !== 'all') {
        if (sch?.type !== reservationTypeFilter) return false
      }
      if (reservationSearch.trim()) {
        const query = reservationSearch.toLowerCase()
        const matchUser = (res.user_name || '').toLowerCase().includes(query)
        const matchTitle = (sch?.title || '').toLowerCase().includes(query)
        const matchInst = (sch?.instructor_name || '').toLowerCase().includes(query)
        if (!matchUser && !matchTitle && !matchInst) return false
      }
      return true
    })
  }, [reservations, schedules, reservationTypeFilter, reservationSearch])

  // Filtered groups
  const filteredGroups = useMemo(() => {
    if (!groupSearch.trim()) return groups
    const q = groupSearch.toLowerCase()
    return groups.filter(g => g.name.toLowerCase().includes(q) || (g.keywords || '').toLowerCase().includes(q))
  }, [groups, groupSearch])

  // Today & upcoming schedules for the daily operations radar
  const upcomingSchedules = useMemo(() => {
    const todayISO = new Date().toISOString().split('T')[0]
    return schedules
      .filter(s => (s.date || s.start_date || '') >= todayISO)
      .slice(0, 5)
  }, [schedules])

  if (loading && !initialCache) {
    return <LoadingScreen message="Memuat Dashboard Admin..." fullScreen={false} />
  }

  const publishedCount = Object.values(chapterSettings).filter(c => !c.is_hidden).length
  const unreadFeedbacks = feedbacks.filter(f => f.status === 'unread').length
  const activeAnnouncements = announcements.filter(a => a.is_active).length
  const todayStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      <main className="flex-1 p-3.5 sm:p-6 lg:p-8 min-w-0 overflow-x-clip animate-page-slide space-y-6 bg-slate-50/60 dark:bg-slate-950/60">

        {/* ── 1. EXECUTIVE COMMAND HEADER ───────────────────────────────── */}
        <div className="rounded-2xl sm:rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-xl relative overflow-hidden">
          {/* Subtle architectural background pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(#b91c1c_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />
          <div className="absolute -top-24 -right-24 size-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="p-4 sm:p-7 relative z-10 space-y-5">
            {/* Top Status Bar: Identity, System Health, Refresh & Date */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 sm:px-3 py-1 rounded-lg sm:rounded-xl bg-white/10 text-white border border-white/15 text-[0.68rem] sm:text-xs font-bold flex items-center gap-1.5 shadow-xs">
                  <svg className="size-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                  <span>Administrator Dojo</span>
                  <span className="opacity-40">|</span>
                  <span className="font-extrabold text-white">{profile?.full_name || profile?.username || 'Admin'}</span>
                </span>

                <span className="px-2.5 py-1 rounded-lg sm:rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[0.68rem] sm:text-xs font-bold flex items-center gap-1.5">
                  <span className="size-1.5 sm:size-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  <span>Sistem Aktif</span>
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-300">
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 text-[0.7rem] text-slate-300 font-medium border border-slate-700/60">
                  <svg className="size-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span>{todayStr}</span>
                </div>

                <button
                  type="button"
                  onClick={() => loadData(false)}
                  disabled={isRefreshing}
                  title="Sinkronkan data realtime"
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 text-[0.7rem] font-bold cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <svg className={`size-3.5 ${isRefreshing ? 'animate-spin text-primary' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  <span>{isRefreshing ? 'Sinkron...' : 'Segarkan'}</span>
                </button>
              </div>
            </div>

            {/* Title & Short Description */}
            <div className="max-w-2xl">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-snug">
                Pusat Kontrol Administrator
              </h1>
              <p className="text-[0.75rem] sm:text-xs text-slate-300 mt-1 leading-relaxed font-normal">
                Manajemen kurikulum pembelajaran, pantauan reservasi sesi live, verifikasi pelajar, dan kontrol operasional dojo.
              </p>
            </div>

            {/* Quick Navigation Hub (Single Responsive Action Row) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-1">
              {[
                {
                  label: 'Broadcast WA',
                  onClick: () => setShowBroadcastModal(true),
                  color: 'hover:border-emerald-500 hover:bg-emerald-500/10 text-emerald-300',
                  icon: (
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v5.01z" />
                    </svg>
                  ),
                },
                {
                  label: 'Edit Kursus',
                  onClick: () => navigate('/kelola-kursus'),
                  color: 'hover:border-red-500 hover:bg-red-500/10 text-red-300',
                  icon: (
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  ),
                },
                {
                  label: 'Jadwal Sesi',
                  onClick: () => navigate('/kelola-jadwal'),
                  color: 'hover:border-indigo-500 hover:bg-indigo-500/10 text-indigo-300',
                  icon: (
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.253M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                  ),
                },
                {
                  label: 'Akun Pemateri',
                  onClick: () => navigate('/kelola-pemateri'),
                  color: 'hover:border-blue-500 hover:bg-blue-500/10 text-blue-300',
                  icon: (
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
                    </svg>
                  ),
                },
                {
                  label: 'Akun Pelajar',
                  onClick: () => navigate('/kelola-pelajar'),
                  color: 'hover:border-sky-500 hover:bg-sky-500/10 text-sky-300',
                  icon: (
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                  ),
                },
                {
                  label: 'Kelola Grup',
                  onClick: () => navigate('/kelola-grup'),
                  color: 'hover:border-purple-500 hover:bg-purple-500/10 text-purple-300',
                  icon: (
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                    </svg>
                  ),
                },
                {
                  label: 'Pengumuman',
                  onClick: () => navigate('/kelola-pengumuman'),
                  badge: activeAnnouncements > 0 ? activeAnnouncements : undefined,
                  color: 'hover:border-rose-500 hover:bg-rose-500/10 text-rose-300',
                  icon: (
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                    </svg>
                  ),
                },
                {
                  label: 'Masukan Siswa',
                  onClick: () => navigate('/kelola-masukan'),
                  badge: unreadFeedbacks > 0 ? unreadFeedbacks : undefined,
                  color: 'hover:border-amber-500 hover:bg-amber-500/10 text-amber-300',
                  icon: (
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v5.01z" />
                    </svg>
                  ),
                },
              ].map(item => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className={`relative flex flex-col items-center justify-center py-2 px-1.5 sm:py-2.5 sm:px-2 rounded-xl bg-slate-800/70 border border-slate-700/80 cursor-pointer transition-all active:scale-95 text-slate-200 group ${item.color}`}
                >
                  {item.badge !== undefined && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[0.58rem] font-black flex items-center justify-center shadow-md ring-2 ring-slate-900 animate-pulse">
                      {item.badge}
                    </span>
                  )}
                  <div className="mb-1 transition-transform group-hover:scale-110">
                    {item.icon}
                  </div>
                  <span className="text-[0.65rem] sm:text-[0.7rem] font-bold text-center leading-tight line-clamp-1">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── 2. METRICS OVERVIEW (CLEAN KPI CARDS) ─────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {[
            {
              label: 'Total Sensei',
              value: instructors.length,
              unit: 'Guru',
              sub: 'Pengajar Aktif',
              iconColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800',
              valueColor: 'text-emerald-700 dark:text-emerald-300',
              onClick: () => navigate('/kelola-pemateri'),
              icon: (
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
                </svg>
              ),
            },
            {
              label: 'Total Pelajar',
              value: studentCount,
              unit: 'Siswa',
              sub: 'Akun Terdaftar',
              iconColor: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800',
              valueColor: 'text-sky-700 dark:text-sky-300',
              onClick: () => navigate('/kelola-pelajar'),
              icon: (
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              ),
            },
            {
              label: 'Materi Bab',
              value: publishedCount,
              unit: '/ 50 Bab',
              sub: 'Minna no Nihongo',
              iconColor: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800',
              valueColor: 'text-red-700 dark:text-red-300',
              onClick: () => navigate('/kelola-kursus'),
              icon: (
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              ),
            },
            {
              label: 'Jadwal Sesi',
              value: schedules.length,
              unit: 'Kelas',
              sub: 'Online & Offline',
              iconColor: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800',
              valueColor: 'text-indigo-700 dark:text-indigo-300',
              onClick: () => navigate('/kelola-jadwal'),
              icon: (
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.253M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              ),
            },
            {
              label: 'Setoran Kotoba',
              value: kotobaSummary?.totalKotoba || 0,
              unit: 'Kata',
              sub: `${kotobaSummary?.masteredKotoba || 0} Dikuasai`,
              iconColor: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800',
              valueColor: 'text-amber-700 dark:text-amber-300',
              onClick: () => navigate('/tracker-kotoba'),
              icon: (
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              ),
            },
            {
              label: 'Masukan Siswa',
              value: feedbacks.length,
              unit: 'Pesan',
              sub: unreadFeedbacks > 0 ? `${unreadFeedbacks} Perlu Ditinjau` : 'Semua Ditinjau',
              iconColor: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800',
              valueColor: unreadFeedbacks > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-white',
              onClick: () => navigate('/kelola-masukan'),
              icon: (
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v5.01z" />
                </svg>
              ),
            },
          ].map((item, i) => (
            <div
              key={i}
              onClick={item.onClick}
              className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-2.5 transition-all cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 hover:-translate-y-0.5 group`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[0.65rem] sm:text-[0.68rem] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
                  {item.label}
                </span>
                <div className={`size-7 sm:size-8 rounded-lg sm:rounded-xl border flex items-center justify-center shrink-0 ${item.iconColor} transition-transform group-hover:scale-105`}>
                  {item.icon}
                </div>
              </div>

              <div>
                <div className={`text-xl sm:text-2xl font-black ${item.valueColor} leading-tight`}>
                  {item.value}
                  <span className="text-[0.68rem] sm:text-xs font-semibold text-slate-400 ml-1">
                    {item.unit}
                  </span>
                </div>
                <span className="text-[0.65rem] sm:text-[0.68rem] font-medium text-slate-500 dark:text-slate-400 mt-0.5 block truncate">
                  {item.sub}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* ── 3. ANNOUNCEMENT NOTICE BAR (IF ACTIVE) ───────────────────── */}
        {activeAnnouncements > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-rose-500/10 via-pink-500/5 to-amber-500/10 dark:from-rose-950/40 dark:via-pink-950/20 dark:to-amber-950/20 border border-rose-500/20 dark:border-rose-900/40 rounded-xl sm:rounded-2xl px-4 py-3 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-8 sm:size-9 rounded-lg sm:rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-white">
                    Papan Pengumuman Aktif
                  </h3>
                  <span className="text-[0.62rem] sm:text-[0.68rem] font-black px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    {activeAnnouncements} Siaran Berjalan
                  </span>
                </div>
                <p className="text-[0.68rem] sm:text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                  {announcements[0]?.title || 'Pengumuman aktif akan muncul otomatis saat pelajar membuka dashboard.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/kelola-pengumuman')}
              className="px-3 sm:px-3.5 py-1.5 rounded-lg sm:rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-[0.7rem] sm:text-xs font-bold border-none cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0 self-end sm:self-auto"
            >
              <span>Kelola Pengumuman</span>
              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* ── 4. TWO-COLUMN OPERATIONAL WORKSPACE ───────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 items-start">

          {/* ── LEFT 2 COLS: Live Feed, User Feedback, Groups Hub ── */}
          <div className="lg:col-span-2 space-y-5 sm:space-y-6">

            {/* A. Live Class Reservations Feed */}
            <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex size-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500" />
                  </span>
                  <div>
                    <h2 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-white">
                      Aktivitas Reservasi Siswa Terkini
                    </h2>
                    <p className="text-[0.65rem] sm:text-[0.68rem] text-slate-400 mt-0.5">
                      Pendaftaran live sesi kelas online & tatap muka
                    </p>
                  </div>
                </div>

                {/* Filter & Search Bar */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-[0.65rem] font-bold border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setReservationTypeFilter('all')}
                      className={`px-2 py-1 rounded-md transition-all cursor-pointer border-none ${
                        reservationTypeFilter === 'all'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-black'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      Semua ({reservations.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReservationTypeFilter('online')}
                      className={`px-2 py-1 rounded-md transition-all cursor-pointer border-none ${
                        reservationTypeFilter === 'online'
                          ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-xs font-black'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      Online
                    </button>
                    <button
                      type="button"
                      onClick={() => setReservationTypeFilter('offline')}
                      className={`px-2 py-1 rounded-md transition-all cursor-pointer border-none ${
                        reservationTypeFilter === 'offline'
                          ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-xs font-black'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      Offline
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Cari siswa/judul..."
                      value={reservationSearch}
                      onChange={e => setReservationSearch(e.target.value)}
                      className="w-32 sm:w-44 px-2.5 py-1 text-[0.68rem] rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {filteredReservations.length === 0 ? (
                <div className="py-10 text-center text-slate-400 space-y-1.5">
                  <svg className="size-8 mx-auto text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-xs font-medium">Tidak ada aktivitas reservasi yang sesuai filter.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
                  {filteredReservations.slice(0, 10).map(res => {
                    const sch = schedules.find(s => s.id === res.schedule_id)
                    return (
                      <div key={res.id} className="flex items-center justify-between p-3 sm:px-5 sm:py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="size-7 sm:size-8 rounded-lg bg-red-50 dark:bg-red-950/60 text-primary dark:text-red-400 font-extrabold text-xs flex items-center justify-center shrink-0 border border-red-200 dark:border-red-900/50">
                            {res.user_name ? res.user_name.charAt(0).toUpperCase() : 'S'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-extrabold text-slate-800 dark:text-white text-xs truncate">
                              {res.user_name || 'Pelajar Dojo'}
                            </div>
                            <div className="text-[0.65rem] sm:text-[0.68rem] text-slate-500 dark:text-slate-400 truncate">
                              {sch?.title || 'Sesi Kelas'} · Sensei: {sch?.instructor_name || 'Sensei'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2 py-0.5 rounded-md text-[0.62rem] sm:text-[0.65rem] font-extrabold flex items-center gap-1 ${
                            sch?.type === 'online'
                              ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          }`}>
                            <span className="size-1.5 rounded-full bg-current" />
                            <span>{sch?.type === 'online' ? 'Online' : 'Offline'}</span>
                          </span>

                          <span className="text-[0.62rem] text-slate-400 font-mono hidden sm:inline-block">
                            {new Date(res.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* B. Masukan & Saran Siswa Terbaru */}
            <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v5.01z" />
                    </svg>
                  </div>
                  <h2 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-white">
                    Masukan & Saran Pelajar
                  </h2>
                  {unreadFeedbacks > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[0.6rem] font-black">
                      {unreadFeedbacks} Baru
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/kelola-masukan')}
                  className="text-[0.7rem] sm:text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer bg-transparent border-none flex items-center gap-1"
                >
                  <span>Lihat Semua ({feedbacks.length})</span>
                  <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {feedbacks.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs italic">
                  Belum ada pesan masukan atau ulasan dari siswa.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 sm:p-4">
                  {feedbacks.slice(0, 4).map(fb => {
                    const meta = CATEGORY_META[fb.category] || CATEGORY_META.saran_fitur
                    return (
                      <div
                        key={fb.id}
                        onClick={() => navigate('/kelola-masukan')}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 hover:border-amber-400 dark:hover:border-amber-600 transition-all cursor-pointer flex flex-col justify-between gap-2"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className={`px-2 py-0.5 rounded-md text-[0.62rem] font-bold border ${meta.badgeClass}`}>
                            {meta.label}
                          </span>
                          <div className="flex text-amber-500">
                            {[...Array(fb.rating || 5)].map((_, idx) => (
                              <svg key={idx} className="size-3 fill-current" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                        </div>

                        {fb.title && (
                          <h4 className="text-xs font-extrabold text-slate-800 dark:text-white line-clamp-1">
                            {fb.title}
                          </h4>
                        )}

                        <p className="text-[0.7rem] text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                          {fb.message}
                        </p>

                        <div className="flex items-center justify-between text-[0.62rem] text-slate-400 border-t border-slate-200/60 dark:border-slate-700/60 pt-1.5">
                          <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[130px]">
                            {fb.name}
                          </span>
                          <span>
                            {new Date(fb.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* C. Kelola Grup & Label Siswa */}
            <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-white">
                      Kelola Grup & Akses Siswa
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[0.62rem] font-black border border-purple-200 dark:border-purple-800">
                      {groups.length} Grup Terdaftar
                    </span>
                  </div>
                  <p className="text-[0.65rem] sm:text-[0.68rem] text-slate-400 mt-0.5">
                    Grup menentukan hak akses materi dan jadwal kelas eksklusif untuk komunitas pelajar.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {groupToast && (
                    <span className="text-[0.62rem] sm:text-[0.68rem] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 animate-fade-in">
                      {groupToast}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate('/kelola-grup')}
                    className="text-[0.7rem] sm:text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1"
                  >
                    <span>Panel Lengkap</span>
                    <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-3.5">
                {/* Ergonomic Quick Add Input Bar */}
                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                  <input
                    type="text"
                    placeholder="Nama grup baru (cth: VLI2608)"
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 font-bold"
                  />
                  <input
                    type="text"
                    placeholder="Kata kunci registrasi (cth: vli2608, viva)"
                    value={newGroupKeywords}
                    onChange={e => setNewGroupKeywords(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 font-medium"
                  />
                  <button
                    type="button"
                    onClick={handleAddGroup}
                    disabled={groupLoading || !newGroupName.trim()}
                    className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-bold border-none cursor-pointer transition-all disabled:opacity-50 shrink-0 flex items-center justify-center gap-1 shadow-xs"
                  >
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    <span>Tambah</span>
                  </button>
                </div>

                {/* Search existing groups */}
                {groups.length > 4 && (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Cari grup atau keyword..."
                      value={groupSearch}
                      onChange={e => setGroupSearch(e.target.value)}
                      className="w-full px-3 py-1 text-[0.68rem] rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                )}

                {/* Groups Grid */}
                {filteredGroups.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-4">Belum ada grup yang terdaftar.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-0.5">
                    {filteredGroups.map(g => {
                      const kws = parseKeywords(g.keywords)
                      return (
                        <div
                          key={g.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-900/50 gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-black text-slate-800 dark:text-white truncate flex items-center gap-1.5">
                              <span className="size-1.5 rounded-full bg-purple-500 shrink-0" />
                              <span className="truncate">{g.name}</span>
                            </div>
                            <div className="text-[0.62rem] text-slate-400 font-mono mt-0.5 truncate">
                              {kws.join(', ') || g.name.toLowerCase()}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteGroup(g.id, g.name)}
                            disabled={groupLoading}
                            title="Hapus Grup"
                            className="size-5 rounded-md bg-red-50 dark:bg-red-950/40 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-900/40 cursor-pointer transition-all text-xs font-bold flex items-center justify-center shrink-0"
                          >
                            ×
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* ── RIGHT 1 COL: Schedule Radar & Instructor Roster ── */}
          <div className="space-y-5 sm:space-y-6">

            {/* A. Radar Sesi Kelas Hari Ini & Mendatang (Daily Operational Hub) */}
            <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
                    <svg className="size-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Jadwal Kelas Terdekat</span>
                  </h3>
                  <p className="text-[0.65rem] sm:text-[0.68rem] text-slate-400 mt-0.5">
                    Monitoring sesi live & kapasitas kuota
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/kelola-jadwal')}
                  className="text-[0.68rem] sm:text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1"
                >
                  <span>Atur</span>
                  <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {upcomingSchedules.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs italic">
                  Belum ada jadwal sesi kelas aktif terdaftar.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {upcomingSchedules.map(sch => {
                    const enrolledCount = reservations.filter(r => r.schedule_id === sch.id).length
                    const quotaPct = Math.min(100, Math.round((enrolledCount / (sch.max_quota || 1)) * 100))
                    return (
                      <div
                        key={sch.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-slate-800 dark:text-white text-xs truncate">
                              {sch.title}
                            </h4>
                            <span className="text-[0.65rem] text-slate-400 font-medium block truncate">
                              {sch.instructor_name} · {sch.date} ({sch.start_time} - {sch.end_time} WIB)
                            </span>
                          </div>

                          <span className={`px-2 py-0.5 rounded-md text-[0.6rem] font-black shrink-0 ${
                            sch.type === 'online'
                              ? 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300'
                              : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          }`}>
                            {sch.type === 'online' ? 'Online' : 'Offline'}
                          </span>
                        </div>

                        {/* Quota Progress Bar */}
                        <div>
                          <div className="flex justify-between text-[0.62rem] text-slate-500 dark:text-slate-400 font-semibold mb-1">
                            <span>Kuota Terdaftar: {enrolledCount}/{sch.max_quota} Siswa</span>
                            <span>{quotaPct}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                quotaPct >= 100 ? 'bg-red-500' : 'bg-primary'
                              }`}
                              style={{ width: `${quotaPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={() => navigate('/kelola-jadwal')}
                className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                <span>Buka Manajemen Jadwal Sensei</span>
                <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* B. Sensei Aktif Dojo */}
            <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
                    <svg className="size-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                    <span>Roster Sensei Aktif</span>
                  </h3>
                  <p className="text-[0.65rem] sm:text-[0.68rem] text-slate-400 mt-0.5">
                    Daftar pengajar sesi kelas
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/kelola-pemateri')}
                  className="text-[0.68rem] sm:text-xs font-bold text-primary hover:underline bg-transparent border-none cursor-pointer flex items-center gap-0.5"
                >
                  <span>+ Tambah</span>
                </button>
              </div>

              {instructors.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs italic">
                  Belum ada akun sensei terdaftar.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {instructors.slice(0, 6).map(inst => (
                    <div key={inst.id} className="flex items-center justify-between p-3 sm:px-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={inst.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${inst.username}`}
                          alt={inst.full_name}
                          className="size-7 sm:size-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-800 dark:text-white text-xs truncate">
                            {inst.full_name}
                          </div>
                          <div className="text-[0.62rem] text-slate-400 truncate">
                            @{inst.username}
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[0.6rem] font-bold border border-emerald-200 dark:border-emerald-800/60 shrink-0">
                        Aktif
                      </span>
                    </div>
                  ))}

                  {instructors.length > 6 && (
                    <div
                      onClick={() => navigate('/kelola-pemateri')}
                      className="p-2.5 text-center text-[0.68rem] font-bold text-primary hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      +{instructors.length - 6} sensei lainnya &rarr;
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

        </div>

      </main>

      {/* WhatsApp Broadcast Modal */}
      {showBroadcastModal && (
        <WhatsAppBroadcastModal
          adminId={profile?.id || ''}
          adminName={profile?.full_name || profile?.username || 'Admin'}
          onClose={() => setShowBroadcastModal(false)}
        />
      )}
    </>
  )
}
