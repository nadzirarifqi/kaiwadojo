import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { fetchInstructors, type InstructorAccount } from '../lib/instructorService'
import { fetchSchedules, fetchReservations, type ClassSchedule, type ClassReservation, sortSchedules } from '../lib/scheduleService'
import { getChapterSettingsMap, type ChapterSetting } from '../lib/chapterService'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [instructors, setInstructors] = useState<InstructorAccount[]>([])
  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [reservations, setReservations] = useState<ClassReservation[]>([])
  const [chapterSettings, setChapterSettings] = useState<Record<number, ChapterSetting>>({})
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    const [instData, schData, resData, chapData] = await Promise.all([
      fetchInstructors(),
      fetchSchedules(),
      fetchReservations(),
      getChapterSettingsMap(),
    ])
    setInstructors(instData)
    setSchedules(sortSchedules(schData))
    setReservations(resData)
    setChapterSettings(chapData)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading) {
    return (
      <main className="flex-1 p-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-slate-400">Memuat Dashboard Super Admin...</span>
        </div>
      </main>
    )
  }

  const publishedCount = Object.values(chapterSettings).filter(c => !c.is_hidden).length

  return (
    <main className="flex-1 p-3 sm:p-6 lg:p-8 min-w-0 overflow-x-clip animate-fade-in">
      {/* Header Banner */}
      <div className="mb-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 sm:p-7 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-700/50">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-3 py-1 rounded-full bg-primary/20 text-red-300 border border-primary/30 text-xs font-black uppercase tracking-wider">
              👑 Mode Super Admin ({profile?.username || 'kaiwahiroshima'})
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black">
              ● Akses Penuh Sistem
            </span>
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span>Halo Admin, {profile?.full_name || 'Super Admin Hiroshima'}!</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Sebagai Admin Utama, tugas Anda adalah mengedit materi kursus, mempublikasikan durasi video, serta membuat dan mengelola akun Pemateri/Pengajar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/kelola-pemateri')}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs sm:text-sm font-extrabold rounded-2xl border-none cursor-pointer transition-all shadow-md flex items-center gap-2"
          >
            <span>👨‍🏫 Buat Akun Pemateri</span>
          </button>
          <button
            onClick={() => navigate('/kelola-kursus')}
            className="px-4 py-2.5 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white text-xs sm:text-sm font-extrabold rounded-2xl border-none cursor-pointer transition-all shadow-md flex items-center gap-2"
          >
            <span>🟢 Edit Kursus & Durasi</span>
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

        {/* Stat 4: Student Reservations */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Reservasi Siswa</span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {reservations.length} <span className="text-xs font-bold text-slate-400">Siswa</span>
            </div>
            <span className="text-[0.68rem] font-bold text-slate-500 mt-1 block">
              🎓 Pendaftaran Aktif
            </span>
          </div>
          <div className="size-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-2xl shrink-0">
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
                <p className="text-xs text-slate-500 dark:text-slate-400">Daftarkan akun pengajar/sensei baru ke sistem database</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/kelola-pemateri')}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl border-none cursor-pointer transition-all shadow-xs mt-1"
            >
              Kelola Akun Pemateri ↗
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
