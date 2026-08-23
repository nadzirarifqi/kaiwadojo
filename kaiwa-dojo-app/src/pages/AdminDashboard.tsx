import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabaseClient'
import { fetchInstructors, type InstructorAccount } from '../lib/instructorService'
import { fetchStudents, type StudentAccount } from '../lib/studentService'
import { fetchSchedules, fetchReservations, type ClassSchedule, type ClassReservation, sortSchedules, RESERVATION_UPDATE_EVENT } from '../lib/scheduleService'
import { getChapterSettingsMap, type ChapterSetting } from '../lib/chapterService'

import LoadingScreen from '../components/LoadingScreen'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [instructors, setInstructors] = useState<InstructorAccount[]>([])
  const [students, setStudents] = useState<StudentAccount[]>([])
  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [reservations, setReservations] = useState<ClassReservation[]>([])
  const [chapterSettings, setChapterSettings] = useState<Record<number, ChapterSetting>>({})
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    const [instData, stdData, schData, resData, chapData] = await Promise.all([
      fetchInstructors(),
      fetchStudents(),
      fetchSchedules(),
      fetchReservations(),
      getChapterSettingsMap(),
    ])
    setInstructors(instData)
    setStudents(stdData)
    setSchedules(sortSchedules(schData))
    setReservations(resData)
    setChapterSettings(chapData)
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
      .channel('admin_reservations_realtime')
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
    return <LoadingScreen message="Memuat Dashboard Super Admin..." fullScreen={false} />
  }

  const publishedCount = Object.values(chapterSettings).filter(c => !c.is_hidden).length

  return (
    <main className="flex-1 p-3 sm:p-6 lg:p-8 min-w-0 overflow-x-clip animate-page-slide">
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
            <span className="px-3 py-1 rounded-full bg-primary/20 text-red-300 border border-primary/30 text-xs font-black uppercase tracking-wider flex items-center gap-1">
              <span>👑</span>
              <span className="font-jp font-bold mr-1">管理者</span>
              <span>Super Admin ({profile?.username || 'kaiwahiroshima'})</span>
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black">
              ● Akses Penuh Sistem
            </span>
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span>Halo Admin, {profile?.full_name || 'Super Admin Hiroshima'}!</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed font-medium">
            <span className="font-jp font-bold text-red-300 mr-1.5">システム管理</span>
            Sebagai Admin Utama, tugas Anda adalah mengedit materi kursus, mempublikasikan durasi video, serta membuat dan mengelola akun Pemateri/Pengajar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/kelola-pemateri')}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs sm:text-sm font-extrabold rounded-2xl border-none cursor-pointer transition-all shadow-md flex items-center gap-2"
          >
            <span>👨‍🏫 Akun Pemateri</span>
          </button>
          <button
            onClick={() => navigate('/kelola-pelajar')}
            className="px-4 py-2.5 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white text-xs sm:text-sm font-extrabold rounded-2xl border-none cursor-pointer transition-all shadow-md flex items-center gap-2"
          >
            <span>🎓 Akun Pelajar</span>
          </button>
          <button
            onClick={() => navigate('/kelola-kursus')}
            className="px-4 py-2.5 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white text-xs sm:text-sm font-extrabold rounded-2xl border-none cursor-pointer transition-all shadow-md flex items-center gap-2"
          >
            <span>🟢 Edit Kursus</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Stat 1: Pemateri Accounts */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Total Pemateri</span>
            <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white">
              {instructors.length} <span className="text-xs font-bold text-slate-400">Sensei</span>
            </div>
            <span className="text-[0.68rem] font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
              ✅ Tugas: Reservasi Kelas Live
            </span>
          </div>
          <div className="size-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-2xl shrink-0">
            👨‍🏫
          </div>
        </div>

        {/* Stat 2: Course Chapters */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Bab Dipublikasikan</span>
            <div className="text-2xl sm:text-3xl font-black text-primary dark:text-red-400">
              {publishedCount} <span className="text-xs font-bold text-slate-400">/ 50 Bab</span>
            </div>
            <span className="text-[0.68rem] font-bold text-sky-600 dark:text-sky-400 mt-1 block">
              🟢 Tugas Admin: Edit Kursus
            </span>
          </div>
          <div className="size-12 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-2xl shrink-0">
            📖
          </div>
        </div>

        {/* Stat 3: Total Schedules */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Sesi Kelas Live</span>
            <div className="text-2xl sm:text-3xl font-black text-sky-600 dark:text-sky-400">
              {schedules.length} <span className="text-xs font-bold text-slate-400">Jadwal</span>
            </div>
            <span className="text-[0.68rem] font-bold text-slate-500 mt-1 block">
              💻 Online & 🏢 Offline
            </span>
          </div>
          <div className="size-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-2xl shrink-0">
            📅
          </div>
        </div>

        {/* Stat 4: Student Accounts */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Total Akun Pelajar</span>
            <div className="text-2xl sm:text-3xl font-black text-sky-600 dark:text-sky-400">
              {students.length} <span className="text-xs font-bold text-slate-400">Siswa</span>
            </div>
            <span className="text-[0.68rem] font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
              🎓 Terdaftar di Sistem
            </span>
          </div>
          <div className="size-12 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-2xl shrink-0">
            🎓
          </div>
        </div>
      </div>

      {/* Main Admin Duty Cards & Instructors List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Pemateri List Summary */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                <span>👨‍🏫 Manajemen Akun Pemateri / Pengajar</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Daftar pengajar terdaftar yang bertugas mengelola reservasi kelas live
              </p>
            </div>
            <button
              onClick={() => navigate('/kelola-pemateri')}
              className="px-3.5 py-1.5 rounded-xl bg-primary text-white text-xs font-extrabold hover:bg-primary-dark transition-colors border-none cursor-pointer shadow-xs"
            >
              + Tambah Pemateri Baru ↗
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {instructors.slice(0, 5).map(inst => (
              <div key={inst.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={inst.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${inst.username}`}
                    alt={inst.full_name}
                    className="size-10 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 object-cover shrink-0"
                  />
                  <div>
                    <div className="font-extrabold text-slate-800 dark:text-white text-sm">{inst.full_name}</div>
                    <div className="text-xs text-slate-400">@{inst.username} • {inst.email}</div>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold">
                  👨‍🏫 Pemateri Aktif
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Admin Duty Action Panel */}
        <div className="flex flex-col gap-5">
          {/* Duty 1: Edit Kursus & Durasi */}
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent dark:from-primary/20 dark:to-transparent p-5 sm:p-6 rounded-3xl border border-primary/20 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-primary text-white flex items-center justify-center text-xl shrink-0 shadow-md">
                🟢
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-800 dark:text-white">Tugas Admin 1: Edit Kursus</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Kelola status tampil/sembunyi bab dan masukan durasi video (format 3.44)</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/kelola-kursus')}
              className="w-full py-2.5 bg-primary hover:bg-primary-dark text-white text-xs font-extrabold rounded-xl border-none cursor-pointer transition-all shadow-xs mt-1"
            >
              Buka Editor Kursus ↗
            </button>
          </div>

          {/* Duty 2: Buat Akun Pemateri */}
          <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-950/30 dark:to-transparent p-5 sm:p-6 rounded-3xl border border-emerald-200 dark:border-emerald-800 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-xl shrink-0 shadow-md">
                👨‍🏫
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-800 dark:text-white">Tugas Admin 2: Buat Akun Pemateri</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Daftarkan akun pengajar/sensei baru ke platform</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/kelola-pemateri')}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl border-none cursor-pointer transition-all shadow-xs mt-1"
            >
              Kelola Akun Pemateri ↗
            </button>
          </div>

          {/* Live Tracking Card */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500"></span>
                </span>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">📡 Live Tracking Enroll Pelajar</h3>
              </div>
              <span className="text-[0.65rem] font-bold text-slate-400">{reservations.length} Pendaftaran</span>
            </div>

            {reservations.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-3 text-center">Belum ada pendaftaran siswa baru secara live.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                {reservations.slice(0, 5).map(res => {
                  const targetSch = schedules.find(s => s.id === res.schedule_id)
                  return (
                    <div key={res.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
                      <div className="font-extrabold text-slate-800 dark:text-white flex items-center justify-between">
                        <span>{res.user_name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[0.62rem] font-black uppercase ${targetSch?.type === 'online' ? 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'}`}>
                          {targetSch?.type === 'online' ? '💻 Online' : '🏢 Offline'}
                        </span>
                      </div>
                      <div className="text-[0.68rem] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{targetSch?.title || 'Sesi Kelas'}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
