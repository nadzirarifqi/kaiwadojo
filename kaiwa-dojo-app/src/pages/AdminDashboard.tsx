import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabaseClient'
import { fetchInstructors, type InstructorAccount } from '../lib/instructorService'
import { fetchStudents, type StudentAccount } from '../lib/studentService'
import { fetchSchedules, fetchReservations, type ClassSchedule, type ClassReservation, sortSchedules, RESERVATION_UPDATE_EVENT } from '../lib/scheduleService'
import { getChapterSettingsMap, type ChapterSetting } from '../lib/chapterService'
import { fetchGroups, createGroup, deleteGroup, parseKeywords, type KaiwaGroup, GROUP_UPDATE_EVENT } from '../lib/groupService'
import { fetchFeedbacks, type FeedbackItem, CATEGORY_META, FEEDBACK_UPDATE_EVENT } from '../lib/feedbackService'
import { fetchAllStudentKotobaStats, type GlobalKotobaSummary, KOTOBA_TRACKER_UPDATE_EVENT } from '../lib/kotobaService'
import { fetchAnnouncements, type Announcement, ANNOUNCEMENT_UPDATE_EVENT } from '../lib/announcementService'

import LoadingScreen from '../components/LoadingScreen'
import WhatsAppBroadcastModal from '../components/WhatsAppBroadcastModal'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [instructors, setInstructors] = useState<InstructorAccount[]>([])
  const [students, setStudents] = useState<StudentAccount[]>([])
  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [reservations, setReservations] = useState<ClassReservation[]>([])
  const [chapterSettings, setChapterSettings] = useState<Record<number, ChapterSetting>>({})
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([])
  const [kotobaSummary, setKotobaSummary] = useState<GlobalKotobaSummary | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  // Broadcast WA Modal state
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)

  // Group management state
  const [groups, setGroups] = useState<KaiwaGroup[]>([])
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupKeywords, setNewGroupKeywords] = useState('')
  const [groupLoading, setGroupLoading] = useState(false)
  const [groupToast, setGroupToast] = useState<string | null>(null)

  function showGroupToast(msg: string) {
    setGroupToast(msg)
    setTimeout(() => setGroupToast(null), 3000)
  }

  async function loadGroups() {
    const data = await fetchGroups(true)
    setGroups(data)
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
      await loadGroups()
      showGroupToast(`Grup "${name}" berhasil ditambahkan!`)
    } else {
      showGroupToast(`Gagal: ${res.error}`)
    }
    setGroupLoading(false)
  }

  async function handleDeleteGroup(id: string, name: string) {
    if (!confirm(`Hapus grup "${name}"? Siswa di grup ini akan menjadi Siswa Biasa dan jadwal kelas terbuka untuk umum.`)) return
    setGroupLoading(true)
    const res = await deleteGroup(id, name)
    if (res.success) {
      await loadGroups()
      showGroupToast(`Grup "${name}" dihapus.`)
    } else {
      showGroupToast(`Gagal: ${res.error}`)
    }
    setGroupLoading(false)
  }


  async function loadData() {
    setLoading(true)
    const [instData, stdData, schData, resData, chapData, fbData, kotobaData, annData] = await Promise.all([
      fetchInstructors(),
      fetchStudents(),
      fetchSchedules(),
      fetchReservations(),
      getChapterSettingsMap(),
      fetchFeedbacks(),
      fetchAllStudentKotobaStats(),
      fetchAnnouncements(),
    ])
    setInstructors(instData)
    setStudents(stdData)
    setSchedules(sortSchedules(schData))
    setReservations(resData)
    setChapterSettings(chapData)
    setFeedbacks(fbData)
    setKotobaSummary(kotobaData.summary)
    setAnnouncements(annData)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    loadGroups()

    const handleReservationSync = () => {
      loadData()
      loadGroups()
    }
    window.addEventListener(RESERVATION_UPDATE_EVENT, handleReservationSync)
    window.addEventListener(GROUP_UPDATE_EVENT, handleReservationSync)
    window.addEventListener(FEEDBACK_UPDATE_EVENT, handleReservationSync)
    window.addEventListener(KOTOBA_TRACKER_UPDATE_EVENT, handleReservationSync)
    window.addEventListener(ANNOUNCEMENT_UPDATE_EVENT, handleReservationSync)
    window.addEventListener('storage', handleReservationSync)

    // Realtime Supabase listener
    const channel = supabase
      .channel('admin_dashboard_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_reservations' }, () => {
        handleReservationSync()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_schedules' }, () => {
        handleReservationSync()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        handleReservationSync()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
        handleReservationSync()
      })
      .subscribe()

    return () => {
      window.removeEventListener(RESERVATION_UPDATE_EVENT, handleReservationSync)
      window.removeEventListener(GROUP_UPDATE_EVENT, handleReservationSync)
      window.removeEventListener(FEEDBACK_UPDATE_EVENT, handleReservationSync)
      window.removeEventListener(KOTOBA_TRACKER_UPDATE_EVENT, handleReservationSync)
      window.removeEventListener(ANNOUNCEMENT_UPDATE_EVENT, handleReservationSync)
      window.removeEventListener('storage', handleReservationSync)
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading) {
    return <LoadingScreen message="Memuat Dashboard Admin..." fullScreen={false} />
  }

  const publishedCount = Object.values(chapterSettings).filter(c => !c.is_hidden).length
  const unreadFeedbacks = feedbacks.filter(f => f.status === 'unread').length
  const activeAnnouncements = announcements.filter(a => a.is_active).length
  const todayStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      <main className="flex-1 p-3 sm:p-6 lg:p-8 min-w-0 overflow-x-clip animate-page-slide space-y-6">

        {/* ── 1. HERO HEADER ───────────────────────────────── */}
        <div
          className="rounded-3xl overflow-hidden border border-slate-700/50 shadow-xl text-white relative"
          style={{
            backgroundImage: "linear-gradient(135deg, rgba(15,23,42,0.96) 0%, rgba(120,20,30,0.90) 55%, rgba(15,23,42,0.96) 100%), url('/japan-background(4).jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="p-6 sm:p-8">
            {/* Top Bar: Role badge + System status + Date */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-white/10 text-red-200 border border-white/20 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
                  <span>👑</span>
                  <span className="font-jp">管理者</span>
                  <span>·</span>
                  <span>{profile?.full_name || profile?.username || 'Admin'}</span>
                </span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  Sistem Aktif
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                <span>🗓️</span>
                <span>{todayStr}</span>
              </div>
            </div>

            {/* Greeting and description */}
            <div className="max-w-3xl mb-6">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                Panel Utama Administrator Dojo ⛩️
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed font-normal">
                Pusat kendali materi kursus Minna no Nihongo, manajemen jadwal & akun pengajar, verifikasi pelajar, serta pemantauan aktivitas pembelajaran secara realtime.
              </p>
            </div>

            {/* Quick Action Pills Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-2 border-t border-white/10">
              {[
                { label: 'Broadcast WA',    icon: '📲', color: 'from-emerald-500 to-teal-700',      onClick: () => setShowBroadcastModal(true) },
                { label: 'Edit Kursus',     icon: '📖', color: 'from-red-600 to-rose-700',          onClick: () => navigate('/kelola-kursus') },
                { label: 'Akun Pemateri',   icon: '👨‍🏫', color: 'from-blue-600 to-indigo-700',       onClick: () => navigate('/kelola-pemateri') },
                { label: 'Akun Pelajar',    icon: '🎓', color: 'from-sky-500 to-cyan-700',          onClick: () => navigate('/kelola-pelajar') },
                { label: 'Kelola Grup',     icon: '👥', color: 'from-purple-600 to-indigo-700',     onClick: () => navigate('/kelola-grup') },
                { label: 'Pengumuman',      icon: '📢', color: 'from-rose-500 to-pink-700',         onClick: () => navigate('/kelola-pengumuman'), badge: activeAnnouncements > 0 ? activeAnnouncements : undefined },
                { label: 'Masukan Saran',   icon: '💡', color: 'from-amber-500 to-amber-700',       onClick: () => navigate('/kelola-masukan'), badge: unreadFeedbacks > 0 ? unreadFeedbacks : undefined },
                { label: 'Tracker Kotoba',  icon: '語', color: 'from-orange-500 to-amber-700',      onClick: () => navigate('/tracker-kotoba'), serif: true },
              ].map(item => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className={`relative flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl bg-gradient-to-br ${item.color} hover:brightness-110 active:scale-95 text-white font-bold text-[0.72rem] border border-white/15 cursor-pointer transition-all shadow-sm hover:shadow-md group`}
                >
                  {item.badge !== undefined && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[0.62rem] font-black flex items-center justify-center shadow-md ring-2 ring-slate-900 animate-pulse">
                      {item.badge}
                    </span>
                  )}
                  <span className={`text-xl mb-1 transition-transform group-hover:scale-110 ${item.serif ? 'font-serif' : ''}`}>{item.icon}</span>
                  <span className="text-center leading-tight line-clamp-1">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── 2. METRICS OVERVIEW (STAT CARDS) ─────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {[
            {
              label: 'Total Sensei',
              value: instructors.length,
              unit: 'Guru',
              sub: '👨‍🏫 Pengajar Aktif',
              icon: '👨‍🏫',
              iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
              valueCls: 'text-emerald-700 dark:text-emerald-300',
              onClick: () => navigate('/kelola-pemateri'),
            },
            {
              label: 'Total Pelajar',
              value: students.length,
              unit: 'Siswa',
              sub: '🎓 Akun Terdaftar',
              icon: '🎓',
              iconBg: 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400 border-sky-200 dark:border-sky-800',
              valueCls: 'text-sky-700 dark:text-sky-300',
              onClick: () => navigate('/kelola-pelajar'),
            },
            {
              label: 'Materi Bab',
              value: publishedCount,
              unit: '/ 50 Bab',
              sub: '📖 Minna no Nihongo',
              icon: '📖',
              iconBg: 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400 border-red-200 dark:border-red-800',
              valueCls: 'text-red-700 dark:text-red-300',
              onClick: () => navigate('/kelola-kursus'),
            },
            {
              label: 'Jadwal Sesi',
              value: schedules.length,
              unit: 'Kelas',
              sub: '💻 Online & 🏢 Offline',
              icon: '📅',
              iconBg: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
              valueCls: 'text-indigo-700 dark:text-indigo-300',
            },
            {
              label: 'Setoran Kotoba',
              value: kotobaSummary?.totalKotoba || 0,
              unit: 'Kata',
              sub: `✅ ${kotobaSummary?.masteredKotoba || 0} Dikuasai`,
              icon: '語',
              iconBg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-800',
              valueCls: 'text-amber-700 dark:text-amber-300',
              serif: true,
              onClick: () => navigate('/tracker-kotoba'),
            },
            {
              label: 'Masukan User',
              value: feedbacks.length,
              unit: 'Pesan',
              sub: unreadFeedbacks > 0 ? `● ${unreadFeedbacks} Belum Dibaca` : '✅ Semua Ditinjau',
              icon: '💡',
              iconBg: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200 dark:border-rose-800',
              valueCls: unreadFeedbacks > 0 ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-slate-700 dark:text-white',
              onClick: () => navigate('/kelola-masukan'),
            },
          ].map((s, i) => (
            <div
              key={i}
              onClick={s.onClick}
              className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-3 ${
                s.onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 hover:-translate-y-0.5 transition-all' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.68rem] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
                  {s.label}
                </span>
                <div className={`size-8 rounded-xl border flex items-center justify-center text-sm shrink-0 ${s.iconBg} ${s.serif ? 'font-serif font-black' : ''}`}>
                  {s.icon}
                </div>
              </div>
              <div>
                <div className={`text-2xl font-black ${s.valueCls} leading-tight`}>
                  {s.value}
                  <span className="text-xs font-bold text-slate-400 ml-1.5 align-baseline">{s.unit}</span>
                </div>
                <span className="text-[0.68rem] font-bold text-slate-500 dark:text-slate-400 mt-0.5 block truncate">
                  {s.sub}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* ── 3. ANNOUNCEMENT NOTICE BAR ────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 bg-gradient-to-r from-rose-50 via-pink-50 to-amber-50 dark:from-rose-950/30 dark:via-pink-950/20 dark:to-amber-950/20 border border-rose-200/80 dark:border-rose-800/40 rounded-2xl px-5 py-3.5 shadow-xs">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="size-10 rounded-xl bg-rose-500 text-white flex items-center justify-center text-lg shadow-xs shrink-0">
              📢
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">Papan Pengumuman Dojo</h3>
                <span className="text-[0.65rem] font-black px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  {activeAnnouncements} Aktif Tayang
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                Pengumuman aktif otomatis muncul sebagai pop-up layar penuh bagi siswa saat pertama kali login.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/kelola-pengumuman')}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold border-none cursor-pointer transition-all shadow-xs flex items-center gap-1.5 shrink-0 self-end sm:self-auto"
          >
            <span>Kelola Pengumuman</span>
            <span>&rarr;</span>
          </button>
        </div>

        {/* ── 4. TWO-COLUMN MAIN CONTENT ───────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── LEFT 2 COLS: Live Activity, Feedback, Groups ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* A. Live Enrollments (Reservasi Kelas) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex size-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500" />
                  </span>
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-800 dark:text-white">
                      Aktivitas Reservasi Kelas Terkini
                    </h2>
                    <p className="text-[0.68rem] text-slate-400 mt-0.5">Pendaftaran siswa pada jadwal kelas Sensei secara live</p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {reservations.length} Siswa Terdaftar
                </span>
              </div>

              {reservations.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <div className="text-3xl mb-2">📋</div>
                  <p className="text-xs font-semibold">Belum ada siswa yang mendaftar ke jadwal kelas saat ini.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-72 overflow-y-auto">
                  {reservations.slice(0, 8).map(res => {
                    const sch = schedules.find(s => s.id === res.schedule_id)
                    return (
                      <div key={res.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="size-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 border border-primary/20">
                            {res.user_name ? res.user_name.charAt(0).toUpperCase() : 'S'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 dark:text-white text-xs truncate">
                              {res.user_name || 'Pelajar Dojo'}
                            </div>
                            <div className="text-[0.68rem] text-slate-500 dark:text-slate-400 truncate">
                              {sch?.title || 'Sesi Kelas'} · Sensei: {sch?.instructor_name || 'Sensei'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2.5 py-0.5 rounded-full text-[0.65rem] font-extrabold flex items-center gap-1 ${
                            sch?.type === 'online'
                              ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          }`}>
                            <span>{sch?.type === 'online' ? '💻' : '🏢'}</span>
                            <span>{sch?.type === 'online' ? 'Online' : 'Offline'}</span>
                          </span>
                          <span className="text-[0.65rem] text-slate-400 hidden sm:inline-block">
                            {new Date(res.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* B. Masukan & Saran Siswa */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                    <span>💡</span>
                    <span>Masukan & Saran Terbaru</span>
                  </h2>
                  {unreadFeedbacks > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[0.62rem] font-black">
                      {unreadFeedbacks} Baru
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/kelola-masukan')}
                  className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer bg-transparent border-none"
                >
                  Lihat Semua ({feedbacks.length}) &rarr;
                </button>
              </div>

              {feedbacks.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs italic">
                  Belum ada pesan masukan atau ulasan dari siswa.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4">
                  {feedbacks.slice(0, 4).map(fb => {
                    const meta = CATEGORY_META[fb.category] || CATEGORY_META.saran_fitur
                    return (
                      <div
                        key={fb.id}
                        onClick={() => navigate('/kelola-masukan')}
                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 hover:border-amber-400 dark:hover:border-amber-600 transition-all cursor-pointer flex flex-col justify-between gap-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`px-2 py-0.5 rounded-md text-[0.62rem] font-bold border flex items-center gap-1 ${meta.badgeClass}`}>
                            <span>{meta.icon}</span>
                            <span>{meta.label}</span>
                          </span>
                          <span className="text-xs text-amber-500 tracking-tight">{'★'.repeat(fb.rating || 5)}</span>
                        </div>
                        {fb.title && (
                          <h4 className="text-xs font-extrabold text-slate-800 dark:text-white line-clamp-1">{fb.title}</h4>
                        )}
                        <p className="text-[0.72rem] text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                          {fb.message}
                        </p>
                        <div className="flex items-center justify-between text-[0.65rem] text-slate-400 border-t border-slate-200/60 dark:border-slate-700/60 pt-2">
                          <span className="font-bold text-slate-600 dark:text-slate-300 truncate max-w-[140px]">👤 {fb.name}</span>
                          <span>{new Date(fb.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* C. Kelola Grup & Label Siswa */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                    <span>👥</span>
                    <span>Kelola Grup & Label Pelajar</span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-[0.62rem] font-black border border-purple-200 dark:border-purple-800">
                      {groups.length} Grup
                    </span>
                  </h2>
                  <p className="text-[0.68rem] text-slate-400 mt-0.5">
                    Grup membatasi visibilitas kelas live secara otomatis berdasarkan kode saat registrasi siswa.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {groupToast && (
                    <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 animate-fade-in">
                      {groupToast}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate('/kelola-grup')}
                    className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline bg-transparent border-none cursor-pointer"
                  >
                    Buka Panel Lengkap &rarr;
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Inline Quick Add Group */}
                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                  <input
                    type="text"
                    placeholder="Nama grup (cth: VLI2608)"
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 font-bold"
                  />
                  <input
                    type="text"
                    placeholder="Keyword registrasi (cth: vli2608, viva)"
                    value={newGroupKeywords}
                    onChange={e => setNewGroupKeywords(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
                    className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 font-medium"
                  />
                  <button
                    type="button"
                    onClick={handleAddGroup}
                    disabled={groupLoading || !newGroupName.trim()}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-bold border-none cursor-pointer transition-all disabled:opacity-50 shrink-0"
                  >
                    + Tambah
                  </button>
                </div>

                {/* Group Badges List */}
                {groups.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-4">Belum ada grup khusus.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {groups.map(g => {
                      const kws = parseKeywords(g.keywords)
                      return (
                        <div
                          key={g.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-800/50 gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5 truncate">
                              <span className="text-purple-500">🏷️</span>
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
                            className="size-6 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-500 hover:bg-red-100 border border-red-200 dark:border-red-900/40 cursor-pointer transition-all text-xs font-black flex items-center justify-center disabled:opacity-40 shrink-0"
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

          {/* ── RIGHT 1 COL: Quick Action Hub & Instructor List ── */}
          <div className="space-y-6">

            {/* A. Pusat Kontrol Cepat Admin */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-3.5">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                  <span>⚡</span>
                  <span>Aksi Utama Administrator</span>
                </h3>
                <p className="text-[0.68rem] text-slate-400 mt-0.5">Jalan pintas fungsi manajerial prioritas</p>
              </div>

              {/* Action 1: Broadcast WhatsApp */}
              <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 border border-emerald-200/80 dark:border-emerald-800/40 flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-sm shrink-0 shadow-xs">
                    📲
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white">Broadcast WhatsApp</h4>
                    <p className="text-[0.65rem] text-slate-500 dark:text-slate-400">Kirim pengumuman massal ke kontak WA siswa</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(true)}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold rounded-lg border-none cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  <span>Buka Broadcast Modal</span>
                  <span>&rarr;</span>
                </button>
              </div>

              {/* Action 2: Edit Kursus */}
              <div className="p-3.5 rounded-xl bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/20 border border-red-200/80 dark:border-red-800/40 flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-primary text-white flex items-center justify-center text-sm shrink-0 shadow-xs">
                    📖
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white">Kurikulum & Durasi Bab</h4>
                    <p className="text-[0.65rem] text-slate-500 dark:text-slate-400">Atur status publish & durasi video Bab 1-50</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/kelola-kursus')}
                  className="w-full py-2 bg-primary hover:bg-primary-dark active:scale-98 text-white text-xs font-bold rounded-lg border-none cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  <span>Buka Editor Kursus</span>
                  <span>&rarr;</span>
                </button>
              </div>

              {/* Action 3: Kelola Pemateri */}
              <div className="p-3.5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 border border-blue-200/80 dark:border-blue-800/40 flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm shrink-0 shadow-xs">
                    👨‍🏫
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white">Akun Pengajar (Sensei)</h4>
                    <p className="text-[0.65rem] text-slate-500 dark:text-slate-400">Daftarkan sensei baru dan atur kredensial</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/kelola-pemateri')}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-bold rounded-lg border-none cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  <span>Kelola Akun Pemateri</span>
                  <span>&rarr;</span>
                </button>
              </div>

              {/* Action 4: Kelola Pelajar */}
              <div className="p-3.5 rounded-xl bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-sky-950/30 dark:to-cyan-950/20 border border-sky-200/80 dark:border-sky-800/40 flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-sky-600 text-white flex items-center justify-center text-sm shrink-0 shadow-xs">
                    🎓
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white">Verifikasi Akun Pelajar</h4>
                    <p className="text-[0.65rem] text-slate-500 dark:text-slate-400">Setujui pendaftaran dan tinjau data siswa</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/kelola-pelajar')}
                  className="w-full py-2 bg-sky-600 hover:bg-sky-700 active:scale-98 text-white text-xs font-bold rounded-lg border-none cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  <span>Kelola Akun Siswa</span>
                  <span>&rarr;</span>
                </button>
              </div>
            </div>

            {/* B. Daftar Sensei / Pengajar Terdaftar */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                    <span>👨‍🏫</span>
                    <span>Sensei Aktif</span>
                  </h3>
                  <p className="text-[0.68rem] text-slate-400 mt-0.5">Daftar pengajar sesi live</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/kelola-pemateri')}
                  className="text-xs font-bold text-primary hover:underline bg-transparent border-none cursor-pointer"
                >
                  + Tambah &rarr;
                </button>
              </div>

              {instructors.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs italic">
                  Belum ada akun pemateri terdaftar.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {instructors.slice(0, 5).map(inst => (
                    <div key={inst.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={inst.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${inst.username}`}
                          alt={inst.full_name}
                          className="size-8 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 dark:text-white text-xs truncate">
                            {inst.full_name}
                          </div>
                          <div className="text-[0.65rem] text-slate-400 truncate">
                            @{inst.username}
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[0.62rem] font-black shrink-0">
                        ● Aktif
                      </span>
                    </div>
                  ))}
                  {instructors.length > 5 && (
                    <div
                      onClick={() => navigate('/kelola-pemateri')}
                      className="px-4 py-2.5 text-center text-[0.7rem] font-bold text-primary hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      +{instructors.length - 5} sensei lainnya &rarr;
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

