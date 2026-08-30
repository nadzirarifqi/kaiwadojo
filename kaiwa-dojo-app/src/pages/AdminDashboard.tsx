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

import LoadingScreen from '../components/LoadingScreen'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [instructors, setInstructors] = useState<InstructorAccount[]>([])
  const [students, setStudents] = useState<StudentAccount[]>([])
  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [reservations, setReservations] = useState<ClassReservation[]>([])
  const [chapterSettings, setChapterSettings] = useState<Record<number, ChapterSetting>>({})
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)

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
    const [instData, stdData, schData, resData, chapData, fbData] = await Promise.all([
      fetchInstructors(),
      fetchStudents(),
      fetchSchedules(),
      fetchReservations(),
      getChapterSettingsMap(),
      fetchFeedbacks(),
    ])
    setInstructors(instData)
    setStudents(stdData)
    setSchedules(sortSchedules(schData))
    setReservations(resData)
    setChapterSettings(chapData)
    setFeedbacks(fbData)
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
    window.addEventListener('storage', handleReservationSync)

    const channel = supabase
      .channel('admin_reservations_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_reservations' }, () => {
        loadData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback_suggestions' }, () => {
        loadData()
      })
      .subscribe()

    return () => {
      window.removeEventListener(RESERVATION_UPDATE_EVENT, handleReservationSync)
      window.removeEventListener(GROUP_UPDATE_EVENT, handleReservationSync)
      window.removeEventListener(FEEDBACK_UPDATE_EVENT, handleReservationSync)
      window.removeEventListener('storage', handleReservationSync)
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading) {
    return <LoadingScreen message="Memuat Dashboard Admin..." fullScreen={false} />
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
              <span>Admin ({profile?.username || 'kaiwahiroshima'})</span>
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black">
              ● Akses Penuh Sistem
            </span>
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span>Halo Admin, {profile?.full_name || 'Admin Hiroshima'}!</span>
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
            onClick={() => navigate('/kelola-grup')}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-extrabold rounded-2xl border-none cursor-pointer transition-all shadow-md flex items-center gap-2"
          >
            <span>👥 Kelola Grup</span>
          </button>
          <button
            onClick={() => navigate('/kelola-masukan')}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs sm:text-sm font-extrabold rounded-2xl border-none cursor-pointer transition-all shadow-md flex items-center gap-2"
          >
            <span>💡 Masukan & Saran</span>
            {feedbacks.filter(f => f.status === 'unread').length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-white text-amber-700 text-[0.65rem] font-black">
                {feedbacks.filter(f => f.status === 'unread').length}
              </span>
            )}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* Stat 1: Pemateri Accounts */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Total Pemateri</span>
            <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white">
              {instructors.length} <span className="text-xs font-bold text-slate-400">Sensei</span>
            </div>
            <span className="text-[0.68rem] font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
              ✅ Reservasi Live
            </span>
          </div>
          <div className="size-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-2xl shrink-0">
            👨‍🏫
          </div>
        </div>

        {/* Stat 2: Course Chapters */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Bab Rilis</span>
            <div className="text-2xl sm:text-3xl font-black text-primary dark:text-red-400">
              {publishedCount} <span className="text-xs font-bold text-slate-400">/ 50 Bab</span>
            </div>
            <span className="text-[0.68rem] font-bold text-sky-600 dark:text-sky-400 mt-1 block">
              🟢 Edit Kursus
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
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Total Pelajar</span>
            <div className="text-2xl sm:text-3xl font-black text-sky-600 dark:text-sky-400">
              {students.length} <span className="text-xs font-bold text-slate-400">Siswa</span>
            </div>
            <span className="text-[0.68rem] font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
              🎓 Terdaftar
            </span>
          </div>
          <div className="size-12 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-2xl shrink-0">
            🎓
          </div>
        </div>

        {/* Stat 5: Masukan & Saran */}
        <div 
          onClick={() => navigate('/kelola-masukan')}
          className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-amber-500/30 hover:border-amber-500 shadow-2xs flex items-center justify-between cursor-pointer transition-all hover:shadow-md"
        >
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Masukan Pengguna</span>
            <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
              {feedbacks.length} <span className="text-xs font-bold text-slate-400">Pesan</span>
            </div>
            <span className="text-[0.68rem] font-bold text-amber-600 dark:text-amber-400 mt-1 block">
              {feedbacks.filter(f => f.status === 'unread').length > 0
                ? `● ${feedbacks.filter(f => f.status === 'unread').length} Belum Dibaca`
                : '✅ Semua Terbaca'}
            </span>
          </div>
          <div className="size-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-2xl shrink-0">
            💡
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

      {/* ── MASUKAN & SARAN TERBARU ─────────────────────────── */}
      <div className="mt-6 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
              <span>💡 Masukan & Saran Pengguna Terbaru</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Evaluasi, ide penambahan fitur baru, serta laporan kendala teknis yang dikirimkan oleh pengguna website.
            </p>
          </div>
          <button
            onClick={() => navigate('/kelola-masukan')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold border-none cursor-pointer transition-all shadow-xs flex items-center gap-1.5"
          >
            <span>Buka Panel Masukan Lengkap &rarr;</span>
          </button>
        </div>

        {feedbacks.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-6">Belum ada masukan dari pengguna.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {feedbacks.slice(0, 3).map(fb => {
              const meta = CATEGORY_META[fb.category] || CATEGORY_META.saran_fitur
              return (
                <div
                  key={fb.id}
                  onClick={() => navigate('/kelola-masukan')}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/70 hover:border-amber-400 transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded-lg text-[0.7rem] font-bold border flex items-center gap-1 ${meta.badgeClass}`}>
                        <span>{meta.icon}</span>
                        <span>{meta.label}</span>
                      </span>
                      <span className="text-xs font-bold text-amber-500">
                        {'★'.repeat(fb.rating || 5)}
                      </span>
                    </div>
                    {fb.title && (
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white mb-1 line-clamp-1">
                        {fb.title}
                      </h4>
                    )}
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                      {fb.message}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[0.68rem] text-slate-400">
                    <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                      👤 {fb.name}
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

      {/* ── KELOLA GRUP ─────────────────────────────────────── */}
      <div className="mt-6 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
              <span>👥 Kelola Grup & Label Pelajar</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Grup membatasi visibilitas kelas. Siswa yang mendaftar di luar keyword grup admin otomatis menjadi Siswa Biasa.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {groupToast && (
              <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                ✅ {groupToast}
              </span>
            )}
            <button
              onClick={() => navigate('/kelola-grup')}
              className="px-3.5 py-1.5 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 hover:bg-purple-200 text-xs font-extrabold border border-purple-200 dark:border-purple-800 cursor-pointer transition-all flex items-center gap-1.5"
            >
              <span>Buka Menu Lengkap &rarr;</span>
            </button>
          </div>
        </div>

        {/* Add Group Quick Form */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-4">
          <input
            type="text"
            placeholder="Nama grup (cth: VLI2608)"
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            className="sm:col-span-4 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 font-bold"
          />
          <input
            type="text"
            placeholder="Keywords (cth: viva legacy, vli2608, vli)"
            value={newGroupKeywords}
            onChange={e => setNewGroupKeywords(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
            className="sm:col-span-6 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 font-medium"
          />
          <button
            type="button"
            onClick={handleAddGroup}
            disabled={groupLoading || !newGroupName.trim()}
            className="sm:col-span-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold border-none cursor-pointer transition-all disabled:opacity-50 shrink-0"
          >
            + Tambah
          </button>
        </div>

        {/* Group List */}
        {groups.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-6">Belum ada grup terdaftar.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {groups.map(g => {
              const kws = parseKeywords(g.keywords)
              return (
                <div
                  key={g.id}
                  className="flex items-start justify-between p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-800/60"
                >
                  <div>
                    <div className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                      <span className="text-purple-600 dark:text-purple-400">🏷️</span>
                      <span>{g.name}</span>
                    </div>
                    <div className="text-[0.68rem] text-slate-500 dark:text-slate-400 font-mono mt-0.5 line-clamp-1">
                      key: {kws.join(', ') || g.name.toLowerCase()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteGroup(g.id, g.name)}
                    disabled={groupLoading}
                    title="Hapus Grup"
                    className="size-7 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 hover:bg-red-100 border border-red-200 dark:border-red-900/40 cursor-pointer transition-all text-xs font-black flex items-center justify-center disabled:opacity-40 shrink-0"
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
