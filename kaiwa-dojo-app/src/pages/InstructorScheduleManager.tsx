import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import AdaptiveIcon from '../components/AdaptiveIcon'
import {
  type ClassSchedule,
  type ClassReservation,
  type ClassType,
  fetchSchedules,
  fetchReservations,
  saveSchedule,
  updateSchedule,
  deleteSchedule,
  getWeekLabel,
  getMonthLabel,
  SCHEDULE_UPDATE_EVENT,
  RESERVATION_UPDATE_EVENT,
  subscribeToScheduleRealtime,
} from '../lib/scheduleService'
import { ScheduleCardSkeleton } from '../components/Skeleton'


export default function InstructorScheduleManagerPage() {
  const { profile } = useAuth()
  const instructorId = profile?.id || 'inst-1'
  const instructorName = profile?.full_name || 'Tanaka Sensei'

  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [reservations, setReservations] = useState<ClassReservation[]>([])
  const [loading, setLoading] = useState(true)

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ClassSchedule | null>(null)
  const [viewParticipantsSchedule, setViewParticipantsSchedule] = useState<ClassSchedule | null>(null)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form states
  const [formType, setFormType] = useState<ClassType>('online')
  const [formTitle, setFormTitle] = useState('')
  const [formSubtitle, setFormSubtitle] = useState('')
  const [formInstructorName, setFormInstructorName] = useState(instructorName)
  const [formDate, setFormDate] = useState('')
  const [formStartTime, setFormStartTime] = useState('19:00')
  const [formEndTime, setFormEndTime] = useState('20:30')
  const [formMeetUrl, setFormMeetUrl] = useState('https://meet.google.com/kaiwa-live-session')
  const [formLocation, setFormLocation] = useState('Kaiwa Dojo Center, Room A (Jl. Sudirman No. 12)')
  const [formMaxQuota, setFormMaxQuota] = useState(10)

  async function loadData() {
    setLoading(true)
    const [sData, rData] = await Promise.all([
      fetchSchedules(),
      fetchReservations(),
      new Promise(r => setTimeout(r, 1200)),
    ])
    setSchedules(sData)
    setReservations(rData)
    setLoading(false)
  }

  useEffect(() => {
    loadData()

    const handleSync = () => {
      loadData()
    }

    window.addEventListener(SCHEDULE_UPDATE_EVENT, handleSync)
    window.addEventListener(RESERVATION_UPDATE_EVENT, handleSync)
    const unsubscribeRealtime = subscribeToScheduleRealtime(handleSync)

    return () => {
      window.removeEventListener(SCHEDULE_UPDATE_EVENT, handleSync)
      window.removeEventListener(RESERVATION_UPDATE_EVENT, handleSync)
      unsubscribeRealtime()
    }
  }, [])

  function showToast(text: string, type: 'success' | 'error' = 'success') {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  function openCreateModal() {
    setEditingSchedule(null)
    const d = new Date()
    d.setDate(d.getDate() + 1)
    setFormDate(d.toISOString().split('T')[0])
    setFormType('online')
    setFormTitle('')
    setFormSubtitle('')
    setFormInstructorName(instructorName)
    setFormStartTime('19:00')
    setFormEndTime('20:30')
    setFormMeetUrl('https://meet.google.com/kaiwa-live-session')
    setFormLocation('Kaiwa Dojo Center, Room A (Jl. Sudirman No. 12)')
    setFormMaxQuota(10)
    setShowCreateModal(true)
  }

  function openEditModal(sch: ClassSchedule) {
    setEditingSchedule(sch)
    setFormType(sch.type)
    setFormTitle(sch.title)
    setFormSubtitle(sch.subtitle_chapter)
    setFormInstructorName(sch.instructor_name)
    setFormDate(sch.date)
    setFormStartTime(sch.start_time)
    setFormEndTime(sch.end_time)
    setFormMeetUrl(sch.meet_url || 'https://meet.google.com/kaiwa-live-session')
    setFormLocation(sch.location || 'Kaiwa Dojo Center, Room A (Jl. Sudirman No. 12)')
    setFormMaxQuota(sch.max_quota)
    setShowCreateModal(true)
  }

  async function handleSaveScheduleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formTitle.trim() || !formSubtitle.trim() || !formDate) {
      showToast('Harap lengkapi semua bidang yang wajib diisi!', 'error')
      return
    }

    setSubmitting(true)
    try {
      if (editingSchedule) {
        await updateSchedule(editingSchedule.id, {
          type: formType,
          title: formTitle.trim(),
          subtitle_chapter: formSubtitle.trim(),
          instructor_name: formInstructorName.trim() || instructorName,
          date: formDate,
          start_time: formStartTime,
          end_time: formEndTime,
          meet_url: formType === 'online' ? formMeetUrl : undefined,
          location: formType === 'offline' ? formLocation : undefined,
          max_quota: formMaxQuota,
        })
        showToast('Jadwal kelas berhasil diperbarui di database!')
      } else {
        await saveSchedule({
          type: formType,
          title: formTitle.trim(),
          subtitle_chapter: formSubtitle.trim(),
          instructor_id: instructorId,
          instructor_name: formInstructorName.trim() || instructorName,
          date: formDate,
          start_time: formStartTime,
          end_time: formEndTime,
          meet_url: formType === 'online' ? formMeetUrl : undefined,
          location: formType === 'offline' ? formLocation : undefined,
          max_quota: formMaxQuota,
        })
        showToast('Jadwal kelas baru berhasil dibuat di database!')
      }

      setShowCreateModal(false)
      setEditingSchedule(null)
      setFormTitle('')
      setFormSubtitle('')
      await loadData()
    } catch (err: any) {
      console.error('Save schedule error:', err)
      showToast(err?.message || 'Gagal menyimpan jadwal ke database.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(schId: string, title: string) {
    if (confirm(`Apakah Anda yakin ingin menghapus jadwal "${title}"?`)) {
      try {
        await deleteSchedule(schId)
        showToast('Jadwal kelas berhasil dihapus dari database!')
        await loadData()
      } catch (err: any) {
        console.error('Delete schedule error:', err)
        showToast(err?.message || 'Gagal menghapus jadwal dari database.', 'error')
      }
    }
  }

  // Stats calculation
  const totalSchedules = schedules.length
  const totalEnrolled = reservations.length
  const onlineCount = schedules.filter(s => s.type === 'online').length
  const offlineCount = schedules.filter(s => s.type === 'offline').length

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full flex flex-col gap-6 animate-page-slide">
      
      {/* Toast */}
      {toastMessage && (
        <div className={`fixed top-5 right-5 z-[600] px-5 py-3.5 rounded-2xl shadow-xl border flex items-center gap-3 animate-slide-down ${
          toastMessage.type === 'success' ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-red-500 text-white border-red-600'
        }`}>
          <span className="text-xl">{toastMessage.type === 'success' ? '✅' : '⚠️'}</span>
          <span className="text-xs sm:text-sm font-bold">{toastMessage.text}</span>
        </div>
      )}

      {/* Header & Create Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary dark:text-red-400">
            <AdaptiveIcon src="/task.png" alt="Management" className="size-4 object-contain" />
            <span>Panel Admin Pengajar (Pemateri)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white mt-1">
            Kelola Jadwal & Presensi Kelas
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Buat sesi kelas online/offline baru, atur kuota 10 orang per kelas, dan pantau daftar peserta yang mendaftar.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-5 py-3 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white text-xs sm:text-sm font-extrabold rounded-2xl border-none cursor-pointer transition-all shadow-md shrink-0 hover:-translate-y-0.5 flex items-center justify-center gap-2"
        >
          <span>+ Buat Jadwal Baru</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col gap-1">
          <span className="text-xs text-slate-400 font-bold uppercase">Total Jadwal Kelas</span>
          <span className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white">{totalSchedules}</span>
          <span className="text-[0.7rem] text-slate-400">Online & Offline Sesi</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col gap-1">
          <span className="text-xs text-slate-400 font-bold uppercase">Total Siswa Enrolled</span>
          <span className="text-2xl sm:text-3xl font-black text-emerald-600">{totalEnrolled}</span>
          <span className="text-[0.7rem] text-emerald-500 font-semibold">Aktif mendaftar</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col gap-1">
          <span className="text-xs text-sky-500 font-bold uppercase">Sesi Online (Weekly)</span>
          <span className="text-2xl sm:text-3xl font-black text-sky-600">{onlineCount}</span>
          <span className="text-[0.7rem] text-slate-400">Google Meet</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col gap-1">
          <span className="text-xs text-purple-500 font-bold uppercase">Sesi Offline (Monthly)</span>
          <span className="text-2xl sm:text-3xl font-black text-purple-600">{offlineCount}</span>
          <span className="text-[0.7rem] text-slate-400">Lokasi Dojo</span>
        </div>
      </div>

      {/* Schedule Table/Cards Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-5">
        <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">
          Daftar Jadwal Kelas yang Dibuat Pengajar
        </h2>

        {loading ? (
          <ScheduleCardSkeleton count={4} />
        ) : schedules.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            Belum ada jadwal yang dibuat. Klik tombol "+ Buat Jadwal Baru" di atas untuk menambahkan jadwal.
          </div>
        ) : (
          <div className="space-y-4">
            {schedules.map(sch => {
              const enrolledList = reservations.filter(r => r.schedule_id === sch.id)
              const isFull = enrolledList.length >= sch.max_quota

              return (
                <div
                  key={sch.id}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[0.68rem] font-black uppercase ${
                        sch.type === 'online'
                          ? 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300'
                          : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      }`}>
                        {sch.type === 'online' ? '💻 Online (Meet)' : '🏢 Offline (Dojo)'}
                      </span>

                      <span className="text-xs text-slate-400 font-bold">
                        {sch.type === 'online' ? getWeekLabel(sch.week_range_id, sch.date) : getMonthLabel(sch.month_range_id)}
                      </span>
                    </div>

                    <h3 className="text-base font-extrabold text-slate-800 dark:text-white truncate">
                      {sch.title}
                    </h3>
                    <p className="text-xs text-primary dark:text-red-400 font-bold">
                      {sch.subtitle_chapter}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-slate-500 font-medium flex-wrap pt-1">
                      <span>📅 <strong>{sch.date}</strong></span>
                      <span>⏰ {sch.start_time} - {sch.end_time} WIB</span>
                      <span>👨‍🏫 Instruktur: <strong>{sch.instructor_name}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-slate-200 dark:border-slate-700 pt-3 md:pt-0">
                    <button
                      onClick={() => setViewParticipantsSchedule(sch)}
                      className={`px-3.5 py-2 rounded-xl font-extrabold text-xs border-none cursor-pointer transition-all flex items-center gap-1.5 ${
                        isFull
                          ? 'bg-red-500 text-white shadow-sm'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300'
                      }`}
                    >
                      <span>👥 {enrolledList.length} / {sch.max_quota} Peserta</span>
                      {isFull && <span className="text-[0.65rem] bg-white/20 px-1.5 py-0.2 rounded-md">Penuh</span>}
                    </button>

                    <button
                      onClick={() => openEditModal(sch)}
                      className="px-3 py-2 rounded-xl bg-amber-500/10 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 font-extrabold text-xs border border-amber-500/20 cursor-pointer transition-all"
                    >
                      ✏️ Edit
                    </button>

                    <button
                      onClick={() => handleDelete(sch.id, sch.title)}
                      className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 font-extrabold text-xs border border-red-200 dark:border-red-900/40 cursor-pointer transition-all"
                    >
                      🗑️ Hapus
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── CREATE / EDIT SCHEDULE MODAL ───────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-primary to-primary-light text-white flex items-center justify-between shrink-0">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-white/80">Panel Admin Pengajar</span>
                <h3 className="text-lg font-extrabold">{editingSchedule ? '⚙️ Edit Jadwal Kelas' : 'Buat Jadwal Kelas Baru'}</h3>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setEditingSchedule(null)
                }}
                className="size-9 rounded-full bg-white/20 text-white hover:bg-white/30 border-none cursor-pointer text-xl flex items-center justify-center"
              >
                ×
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveScheduleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
              
              {/* Type Switch */}
              <div>
                <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                  Jenis Kelas
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormType('online')}
                    className={`py-2.5 rounded-xl font-extrabold border cursor-pointer transition-all flex items-center justify-center gap-2 ${
                      formType === 'online'
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span>💻 Online (Google Meet)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormType('offline')}
                    className={`py-2.5 rounded-xl font-extrabold border cursor-pointer transition-all flex items-center justify-center gap-2 ${
                      formType === 'offline'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span>🏢 Offline (Lokasi Dojo)</span>
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                  Judul Utama Kelas *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Kaiwa Special: Percakapan Bahasa Jepang Sehari-hari"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
                />
              </div>

              {/* Subtitle / Chapter detail */}
              <div>
                <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                  Subjudul (Detail Bab & Topik Sesi) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Bab 4: Memesan Makanan di Restoran & Etika Makan"
                  value={formSubtitle}
                  onChange={e => setFormSubtitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
                />
              </div>

              {/* Instructor Name */}
              <div>
                <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Instruktur / Pemateri *
                </label>
                <input
                  type="text"
                  required
                  value={formInstructorName}
                  onChange={e => setFormInstructorName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
                />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    Tanggal *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    Jam Mulai
                  </label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={e => setFormStartTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    Jam Selesai
                  </label>
                  <input
                    type="time"
                    required
                    value={formEndTime}
                    onChange={e => setFormEndTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              {/* Location or Meet Link */}
              {formType === 'online' ? (
                <div>
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    Link Google Meet
                  </label>
                  <input
                    type="url"
                    value={formMeetUrl}
                    onChange={e => setFormMeetUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    Detail Lokasi Ruangan / Dojo
                  </label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={e => setFormLocation(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>
              )}

              {/* Quota Limit */}
              <div>
                <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                  Maksimal Kuota Peserta (Standard: 10 Orang)
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={formMaxQuota}
                  onChange={e => setFormMaxQuota(parseInt(e.target.value, 10) || 10)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-extrabold text-slate-800 dark:text-slate-200 focus:outline-none"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setEditingSchedule(null)
                  }}
                  className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-extrabold text-xs border-none cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white font-extrabold text-xs border-none cursor-pointer transition-all shadow-md disabled:opacity-50"
                >
                  {submitting
                    ? 'Menyimpan ke Database...'
                    : (editingSchedule ? '💾 Simpan Perubahan Jadwal' : '🚀 Simpan & Terbitkan Jadwal')}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ── PARTICIPANTS MODAL DRAWER ───────────────────────── */}
      {viewParticipantsSchedule && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[0.68rem] font-bold uppercase text-primary dark:text-red-400">Daftar Siswa Enrolled</span>
                <h3 className="text-base font-extrabold text-slate-800 dark:text-white truncate">
                  {viewParticipantsSchedule.title}
                </h3>
              </div>
              <button
                onClick={() => setViewParticipantsSchedule(null)}
                className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold border-none cursor-pointer flex items-center justify-center"
              >
                ×
              </button>
            </div>

            <div className="text-xs text-slate-500">
              Kapasitas: <strong>{reservations.filter(r => r.schedule_id === viewParticipantsSchedule.id).length} / {viewParticipantsSchedule.max_quota} Siswa Terdaftar</strong>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {reservations.filter(r => r.schedule_id === viewParticipantsSchedule.id).length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Belum ada siswa yang mendaftar pada sesi kelas ini.
                </div>
              ) : (
                reservations
                  .filter(r => r.schedule_id === viewParticipantsSchedule.id)
                  .map((res, idx) => (
                    <div
                      key={res.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-800 dark:text-slate-200">{res.user_name}</div>
                          <div className="text-[0.7rem] text-slate-400">{res.user_email || 'Tidak ada email'}</div>
                        </div>
                      </div>
                      <span className="text-[0.68rem] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
                        Terdaftar
                      </span>
                    </div>
                  ))
              )}
            </div>

            <button
              onClick={() => setViewParticipantsSchedule(null)}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs border-none cursor-pointer mt-2"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
