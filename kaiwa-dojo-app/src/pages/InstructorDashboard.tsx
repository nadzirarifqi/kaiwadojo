import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  type ClassSchedule,
  type ClassReservation,
  fetchSchedules,
  fetchReservations,
  sortSchedules,
  RESERVATION_UPDATE_EVENT,
  SCHEDULE_UPDATE_EVENT,
  subscribeToScheduleRealtime,
} from '../lib/scheduleService'
import {
  getChapterSettingsMap,
  type ChapterSetting
} from '../lib/chapterService'
import {
  type Announcement,
  fetchActiveAnnouncementsForUser,
  ANNOUNCEMENT_UPDATE_EVENT,
  subscribeToAnnouncementRealtime,
} from '../lib/announcementService'
import AnnouncementModal from '../components/AnnouncementModal'
import LoadingScreen from '../components/LoadingScreen'

export default function InstructorDashboard() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [reservations, setReservations] = useState<ClassReservation[]>([])
  const [chapterSettings, setChapterSettings] = useState<Record<number, ChapterSetting>>({})
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [unreadAnnouncements, setUnreadAnnouncements] = useState<Announcement[]>([])
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    const [sData, rData, cData, annRes] = await Promise.all([
      fetchSchedules(),
      fetchReservations(),
      getChapterSettingsMap(),
      fetchActiveAnnouncementsForUser(profile),
    ])
    setSchedules(sortSchedules(sData))
    setReservations(rData)
    setChapterSettings(cData)
    setAnnouncements(annRes.announcements)
    setUnreadAnnouncements(annRes.unreadAnnouncements)

    if (annRes.unreadAnnouncements.length > 0) {
      const sessionSeenKey = `kaiwa_ann_seen_session_${profile?.id || 'instructor'}`
      const alreadySeen = sessionStorage.getItem(sessionSeenKey)
      if (!alreadySeen) {
        setShowAnnouncementModal(true)
        sessionStorage.setItem(sessionSeenKey, 'true')
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()

    const handleSync = () => {
      loadData()
    }
    window.addEventListener(RESERVATION_UPDATE_EVENT, handleSync)
    window.addEventListener(SCHEDULE_UPDATE_EVENT, handleSync)
    window.addEventListener(ANNOUNCEMENT_UPDATE_EVENT, handleSync)
    window.addEventListener('storage', handleSync)

    const unsubscribeRealtime = subscribeToScheduleRealtime(handleSync)
    const unsubscribeAnnouncementRealtime = subscribeToAnnouncementRealtime(handleSync)

    return () => {
      window.removeEventListener(RESERVATION_UPDATE_EVENT, handleSync)
      window.removeEventListener(SCHEDULE_UPDATE_EVENT, handleSync)
      window.removeEventListener(ANNOUNCEMENT_UPDATE_EVENT, handleSync)
      window.removeEventListener('storage', handleSync)
      unsubscribeRealtime()
      unsubscribeAnnouncementRealtime()
    }
  }, [profile])

  if (loading) {
    return <LoadingScreen message="Memuat Dashboard Pengajar..." fullScreen={false} />
  }

  // Filter schedules assigned to this instructor (by name match or show all if match not strictly found)
  const mySchedules = schedules.filter(s => 
    s.instructor_name?.toLowerCase().includes(profile?.full_name?.toLowerCase() || '') ||
    profile?.full_name?.toLowerCase().includes(s.instructor_name?.toLowerCase() || '')
  )

  const displaySchedules = mySchedules.length > 0 ? mySchedules : schedules

  // Calculations
  const onlineSchedules = displaySchedules.filter(s => s.type === 'online')
  const offlineSchedules = displaySchedules.filter(s => s.type === 'offline')
  const publishedChapters = Object.values(chapterSettings).filter(c => !c.is_hidden).length
  const totalReservationsCount = reservations.length

  return (
    <main className="flex-1 p-3 sm:p-6 lg:p-8 min-w-0 overflow-x-clip animate-fade-in">
      {/* Header Banner */}
      <div
        className="mb-6 rounded-3xl p-5 sm:p-7 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-700/50 bg-cover bg-center text-white"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(15,23,42,0.92), rgba(127,29,29,0.85)), url('/japan-background(4).jpg')",
        }}
      >
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-3 py-1 rounded-full bg-primary/20 text-red-300 border border-primary/30 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
              <svg className="size-3.5 text-red-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
              <span className="font-jp font-bold mr-1">先生</span>
              <span>Mode Pengajar & Sensei</span>
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black">
              ● Sistem Terhubung
            </span>
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span>Halo Sensei, {profile?.full_name || 'Pengajar kaiwadojo'}!</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed font-medium">
            <span className="font-jp font-bold text-red-300 mr-1.5">ようこそ先生!</span>
            Selamat datang di Dashboard Pengajar. Di sini Anda dapat mengelola materi bab, rilis durasi video, serta memantau reservasi kelas live online dan offline siswa secara real-time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {announcements.length > 0 && (
            <button
              onClick={() => setShowAnnouncementModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs sm:text-sm font-extrabold rounded-2xl border-none cursor-pointer transition-all shadow-md flex items-center gap-2"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
              <span>Pengumuman</span>
              {unreadAnnouncements.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-white text-rose-700 text-[0.65rem] font-black animate-pulse">
                  {unreadAnnouncements.length} Baru
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => navigate('/kelola-kursus')}
            className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white text-xs sm:text-sm font-extrabold rounded-2xl border-none cursor-pointer transition-all shadow-md flex items-center gap-2"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span>Kelola Kursus</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Stat 1: Published Chapters */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Bab Dipublikasikan</span>
            <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white">
              {publishedChapters} <span className="text-xs font-bold text-slate-400">/ 50 Bab</span>
            </div>
            <span className="text-[0.68rem] font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Siswa dapat mengakses video</span>
            </span>
          </div>
          <div className="size-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0">
            <svg className="size-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        </div>

        {/* Stat 2: Total Reservations */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Pendaftaran Kelas Live</span>
            <div className="text-2xl sm:text-3xl font-black text-primary dark:text-red-400">
              {totalReservationsCount} <span className="text-xs font-bold text-slate-400">Siswa</span>
            </div>
            <span className="text-[0.68rem] font-bold text-sky-600 dark:text-sky-400 mt-1 flex items-center gap-1">
              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Terdaftar di jadwal aktif</span>
            </span>
          </div>
          <div className="size-12 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center shrink-0">
            <svg className="size-6 text-sky-600 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </div>
        </div>

        {/* Stat 3: Online Sessions */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Sesi Kelas Online</span>
            <div className="text-2xl sm:text-3xl font-black text-sky-600 dark:text-sky-400">
              {onlineSchedules.length} <span className="text-xs font-bold text-slate-400">Jadwal</span>
            </div>
            <span className="text-[0.68rem] font-bold text-slate-500 mt-1 flex items-center gap-1">
              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Google Meet Sesi Live</span>
            </span>
          </div>
          <div className="size-12 rounded-2xl bg-sky-100 dark:bg-sky-900/50 border border-sky-300 dark:border-sky-700 flex items-center justify-center shrink-0">
            <svg className="size-6 text-sky-600 dark:text-sky-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        {/* Stat 4: Offline Sessions */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Sesi Kelas Offline</span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {offlineSchedules.length} <span className="text-xs font-bold text-slate-400">Jadwal</span>
            </div>
            <span className="text-[0.68rem] font-bold text-slate-500 mt-1 flex items-center gap-1">
              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>kaiwadojo Center</span>
            </span>
          </div>
          <div className="size-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center shrink-0">
            <svg className="size-6 text-emerald-600 dark:text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        </div>
      </div>

      {/* Main Admin Quick Control Hub & Recent Enrollments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Live Class Student Reservations */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                <span>Data Pendaftaran Siswa Kelas Live</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Daftar reservasi terbaru siswa untuk kelas online dan offline
              </p>
            </div>
            <button
              onClick={() => navigate('/kelola-jadwal')}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors border-none cursor-pointer"
            >
              + Buat Jadwal ↗
            </button>
          </div>

          {reservations.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm italic">
              Belum ada pendaftaran kelas dari siswa.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[0.7rem] font-black uppercase text-slate-400 tracking-wider">
                    <th className="pb-3 px-2">Nama Siswa</th>
                    <th className="pb-3 px-2">Kelas & Topik</th>
                    <th className="pb-3 px-2">Tipe</th>
                    <th className="pb-3 px-2">Tanggal & Jam</th>
                    <th className="pb-3 px-2 text-right">Kuota Terisi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-semibold">
                  {reservations.map(res => {
                    const sch = schedules.find(s => s.id === res.schedule_id)
                    const enrolledCount = reservations.filter(r => r.schedule_id === res.schedule_id).length
                    const maxQuota = sch?.max_quota || 10

                    return (
                      <tr key={res.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-2">
                          <div className="font-extrabold text-slate-800 dark:text-white">{res.user_name || 'Siswa Kaiwa'}</div>
                          <div className="text-[0.68rem] text-slate-400">{res.user_email || 'siswa@kaiwadojo.com'}</div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="font-bold text-slate-700 dark:text-slate-200">{sch?.title || 'Kelas Live'}</div>
                          <div className="text-[0.68rem] text-primary dark:text-red-400 font-semibold">{sch?.subtitle_chapter || '-'}</div>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`px-2 py-0.5 rounded-md text-[0.65rem] font-extrabold uppercase flex items-center gap-1 w-fit ${
                            sch?.type === 'offline'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300'
                          }`}>
                            <span>{sch?.type === 'offline' ? 'Offline' : 'Online'}</span>
                          </span>
                        </td>
                        <td className="py-3 px-2 text-slate-600 dark:text-slate-300">
                          <div className="flex items-center gap-1">
                            <svg className="size-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>{sch?.date || '-'}</span>
                          </div>
                          <div className="text-[0.68rem] text-slate-400 flex items-center gap-1 mt-0.5">
                            <svg className="size-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{sch?.start_time || '-'} WIB</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black inline-flex items-center gap-1">
                            <svg className="size-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            <span>{enrolledCount}/{maxQuota}</span>
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Col: Admin Shortcut Action Panel */}
        <div className="flex flex-col gap-5">
          {/* Quick Action Card 1: Kelola Kursus */}
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent dark:from-primary/20 dark:to-transparent p-5 sm:p-6 rounded-3xl border border-primary/20 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-primary text-white flex items-center justify-center shrink-0 shadow-md">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-800 dark:text-white">Kelola Kursus & Durasi</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Atur status tampil/sembunyi bab dan masukan durasi video (format 3.44)</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/kelola-kursus')}
              className="w-full py-2.5 bg-primary hover:bg-primary-dark text-white text-xs font-extrabold rounded-xl border-none cursor-pointer transition-all shadow-xs mt-1"
            >
              Buka Editor Kursus ↗
            </button>
          </div>

          {/* Quick Action Card 2: Kelola Jadwal Sesi */}
          <div className="bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-transparent dark:from-sky-950/30 dark:to-transparent p-5 sm:p-6 rounded-3xl border border-sky-200 dark:border-sky-800 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-800 dark:text-white">Kelola Jadwal & Kuota</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Buat jadwal sesi live online/offline & batasi kuota per sesi</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/kelola-jadwal')}
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-extrabold rounded-xl border-none cursor-pointer transition-all shadow-xs mt-1"
            >
              Kelola Jadwal Sesi ↗
            </button>
          </div>

          {/* Quick Action Card 3: Preview Course View */}
          <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center shrink-0">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-800 dark:text-white">Preview Modul Siswa</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Lihat tampilan daftar bab & durasi video dari sisi siswa</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/my-courses')}
              className="w-full py-2.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white text-xs font-extrabold rounded-xl border-none cursor-pointer transition-all shadow-xs mt-1"
            >
              Lihat Tampilan Siswa ↗
            </button>
          </div>
        </div>
      </div>

      {/* Announcement Pop-up Modal */}
      <AnnouncementModal
        isOpen={showAnnouncementModal}
        onClose={() => setShowAnnouncementModal(false)}
        announcements={unreadAnnouncements.length > 0 ? unreadAnnouncements : announcements}
        onMarkRead={(id) => {
          setUnreadAnnouncements(prev => prev.filter(a => a.id !== id))
        }}
        onMarkAllRead={() => {
          setUnreadAnnouncements([])
        }}
      />
    </main>
  )
}
