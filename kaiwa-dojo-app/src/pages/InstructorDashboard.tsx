import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabaseClient'
import {
  type ClassSchedule,
  type ClassReservation,
  fetchSchedules,
  fetchReservations,
  sortSchedules,
  RESERVATION_UPDATE_EVENT
} from '../lib/scheduleService'
import {
  getChapterSettingsMap,
  type ChapterSetting
} from '../lib/chapterService'

export default function InstructorDashboard() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [reservations, setReservations] = useState<ClassReservation[]>([])
  const [chapterSettings, setChapterSettings] = useState<Record<number, ChapterSetting>>({})
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    const [sData, rData, cData] = await Promise.all([
      fetchSchedules(),
      fetchReservations(),
      getChapterSettingsMap(),
    ])
    setSchedules(sortSchedules(sData))
    setReservations(rData)
    setChapterSettings(cData)
    setLoading(false)
  }

  useEffect(() => {
    loadData()

    const handleReservationSync = () => {
      loadData()
    }
    window.addEventListener(RESERVATION_UPDATE_EVENT, handleReservationSync)
    window.addEventListener('storage', handleReservationSync)

    const channel = supabase
      .channel('instructor_reservations_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_reservations' }, () => {
        loadData()
      })
      .subscribe()

    return () => {
      window.removeEventListener(RESERVATION_UPDATE_EVENT, handleReservationSync)
      window.removeEventListener('storage', handleReservationSync)
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading) {
    return (
      <main className="flex-1 p-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-slate-400">Memuat Dashboard Pengajar...</span>
        </div>
      </main>
    )
  }

  // Calculations
  const onlineSchedules = schedules.filter(s => s.type === 'online')
  const offlineSchedules = schedules.filter(s => s.type === 'offline')
  const publishedChapters = Object.values(chapterSettings).filter(c => !c.is_hidden).length
  const totalReservationsCount = reservations.length

  return (
    <main className="flex-1 p-3 sm:p-6 lg:p-8 min-w-0 overflow-x-clip animate-fade-in">
      {/* Header Banner */}
      <div className="mb-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 sm:p-7 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-700/50">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-3 py-1 rounded-full bg-primary/20 text-red-300 border border-primary/30 text-xs font-black uppercase tracking-wider">
              👨‍🏫 Mode Pengajardojo & Admin
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black">
              ● Live Database Connected
            </span>
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span>Halo Sensei, {profile?.full_name || 'Pengajar KaiwaDojo'}!</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Selamat datang di Dashboard Pengajar. Di sini Anda dapat mengelola materi bab, rilis durasi video, serta memantau reservasi kelas live online dan offline siswa secara real-time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/kelola-kursus')}
            className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white text-xs sm:text-sm font-extrabold rounded-2xl border-none cursor-pointer transition-all shadow-md flex items-center gap-2"
          >
            <span>🟢 Kelola Kursus</span>
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
            <span className="text-[0.68rem] font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
              ✅ Siswa dapat mengakses video
            </span>
          </div>
          <div className="size-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-2xl shrink-0">
            📚
          </div>
        </div>

        {/* Stat 2: Total Reservations */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Pendaftaran Kelas Live</span>
            <div className="text-2xl sm:text-3xl font-black text-primary dark:text-red-400">
              {totalReservationsCount} <span className="text-xs font-bold text-slate-400">Siswa</span>
            </div>
            <span className="text-[0.68rem] font-bold text-sky-600 dark:text-sky-400 mt-1 block">
              👥 Terdaftar di jadwal aktif
            </span>
          </div>
          <div className="size-12 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-2xl shrink-0">
            🎓
          </div>
        </div>

        {/* Stat 3: Online Sessions */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Sesi Kelas Online</span>
            <div className="text-2xl sm:text-3xl font-black text-sky-600 dark:text-sky-400">
              {onlineSchedules.length} <span className="text-xs font-bold text-slate-400">Jadwal</span>
            </div>
            <span className="text-[0.68rem] font-bold text-slate-500 mt-1 block">
              💻 Google Meet Sesi Live
            </span>
          </div>
          <div className="size-12 rounded-2xl bg-sky-100 dark:bg-sky-900/50 border border-sky-300 dark:border-sky-700 flex items-center justify-center text-2xl shrink-0">
            💻
          </div>
        </div>

        {/* Stat 4: Offline Sessions */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Sesi Kelas Offline</span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {offlineSchedules.length} <span className="text-xs font-bold text-slate-400">Jadwal</span>
            </div>
            <span className="text-[0.68rem] font-bold text-slate-500 mt-1 block">
              🏢 Kaiwa Dojo Center
            </span>
          </div>
          <div className="size-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center text-2xl shrink-0">
            🏢
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
                <span>📋 Data Pendaftaran Siswa Kelas Live</span>
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
                          <span className={`px-2 py-0.5 rounded-md text-[0.65rem] font-extrabold uppercase ${
                            sch?.type === 'offline'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300'
                          }`}>
                            {sch?.type === 'offline' ? '🏢 Offline' : '💻 Online'}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-slate-600 dark:text-slate-300">
                          <div>📅 {sch?.date || '-'}</div>
                          <div className="text-[0.68rem] text-slate-400">⏰ {sch?.start_time || '-'} WIB</div>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black">
                            👥 {enrolledCount}/{maxQuota}
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
              <div className="size-11 rounded-2xl bg-primary text-white flex items-center justify-center text-xl shrink-0 shadow-md">
                🟢
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
              <div className="size-11 rounded-2xl bg-sky-600 text-white flex items-center justify-center text-xl shrink-0 shadow-md">
                📅
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
              <div className="size-11 rounded-2xl bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center text-xl shrink-0">
                📖
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
    </main>
  )
}
