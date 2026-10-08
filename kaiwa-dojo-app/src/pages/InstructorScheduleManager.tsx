import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import AdaptiveIcon from '../components/AdaptiveIcon'
import {
  type ClassSchedule,
  type ClassReservation,
  type ClassType,
  fetchSchedules,
  fetchReservations,
  saveMultipleSchedules,
  updateSchedule,
  deleteSchedule,
  getWeekLabel,
  getMonthLabel,
  formatDateRangeIndonesian,
  SCHEDULE_UPDATE_EVENT,
  RESERVATION_UPDATE_EVENT,
  subscribeToScheduleRealtime,
} from '../lib/scheduleService'
import { fetchGroups, sortGroupsAlphabetically, type KaiwaGroup, GROUP_UPDATE_EVENT } from '../lib/groupService'
import { parseTargetGroups } from '../lib/chapterService'
import { ScheduleCardSkeleton } from '../components/Skeleton'

interface ScheduleSlotItem {
  id: string
  date: string
  endDate?: string
  startTime: string
  endTime: string
}

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
  const [formMeetUrl, setFormMeetUrl] = useState('https://meet.google.com/kaiwa-live-session')
  const [formLocation, setFormLocation] = useState('Kaiwa Dojo Center (Jl. Sudirman No. 12)')
  const [formMaxQuota, setFormMaxQuota] = useState(10)
  const [formTargetGroup, setFormTargetGroup] = useState<string>('') // '' = semua siswa

  // Multi-schedule slots state
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlotItem[]>([])

  // Available groups from DB (kaiwa_groups table)
  const [availableGroups, setAvailableGroups] = useState<KaiwaGroup[]>([])

  function calculateDefaultEndDate(startDateStr: string): string {
    if (!startDateStr) return ''
    const parts = startDateStr.split('-').map(Number)
    if (parts.length !== 3) return startDateStr
    const d = new Date(parts[0], parts[1] - 1, parts[2])
    d.setDate(d.getDate() + 2) // +2 days = 3 Days 2 Nights
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  async function loadData() {
    setLoading(true)
    const [sData, rData] = await Promise.all([
      fetchSchedules(),
      fetchReservations(),
    ])
    setSchedules(sData)
    setReservations(rData)
    setLoading(false)
  }

  async function loadGroups() {
    try {
      const data = await fetchGroups(true)
      setAvailableGroups(sortGroupsAlphabetically(data))
    } catch {
      setAvailableGroups([])
    }
  }

  useEffect(() => {
    loadData()
    loadGroups()

    const handleSync = () => {
      loadData()
      loadGroups()
    }

    window.addEventListener(SCHEDULE_UPDATE_EVENT, handleSync)
    window.addEventListener(RESERVATION_UPDATE_EVENT, handleSync)
    window.addEventListener(GROUP_UPDATE_EVENT, handleSync)
    const unsubscribeRealtime = subscribeToScheduleRealtime(handleSync)

    return () => {
      window.removeEventListener(SCHEDULE_UPDATE_EVENT, handleSync)
      window.removeEventListener(RESERVATION_UPDATE_EVENT, handleSync)
      window.removeEventListener(GROUP_UPDATE_EVENT, handleSync)
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
    const startDateStr = d.toISOString().split('T')[0]
    setFormType('online')
    setFormTitle('')
    setFormSubtitle('')
    setFormInstructorName(instructorName)
    setFormMeetUrl('https://meet.google.com/kaiwa-live-session')
    setFormLocation('Kaiwa Dojo Center, Room A (Jl. Sudirman No. 12)')
    setFormMaxQuota(10)
    setFormTargetGroup('')
    setScheduleSlots([
      {
        id: 'slot-1',
        date: startDateStr,
        endDate: calculateDefaultEndDate(startDateStr),
        startTime: '19:00',
        endTime: '20:30',
      }
    ])
    setShowCreateModal(true)
  }

  function openEditModal(sch: ClassSchedule) {
    setEditingSchedule(sch)
    setFormType(sch.type)
    setFormTitle(sch.title)
    setFormSubtitle(sch.subtitle_chapter)
    setFormInstructorName(sch.instructor_name)
    setFormMeetUrl(sch.meet_url || 'https://meet.google.com/kaiwa-live-session')
    setFormLocation(sch.location || 'Kaiwa Dojo Center, Room A (Jl. Sudirman No. 12)')
    setFormMaxQuota(sch.max_quota)
    setFormTargetGroup(sch.target_group || '')
    setScheduleSlots([
      {
        id: 'slot-1',
        date: sch.start_date || sch.date,
        endDate: sch.end_date || sch.start_date || sch.date,
        startTime: sch.start_time,
        endTime: sch.end_time,
      }
    ])
    setShowCreateModal(true)
  }

  function handleAddSlot() {
    const lastSlot = scheduleSlots[scheduleSlots.length - 1]
    let nextDate = ''
    if (lastSlot?.date) {
      const parts = lastSlot.date.split('-').map(Number)
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2])
        d.setDate(d.getDate() + (formType === 'online' ? 7 : 30))
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        nextDate = `${yyyy}-${mm}-${dd}`
      }
    }
    if (!nextDate) {
      const d = new Date()
      d.setDate(d.getDate() + scheduleSlots.length + 1)
      nextDate = d.toISOString().split('T')[0]
    }

    setScheduleSlots(prev => [
      ...prev,
      {
        id: `slot-${Date.now()}-${Math.random()}`,
        date: nextDate,
        endDate: calculateDefaultEndDate(nextDate),
        startTime: lastSlot?.startTime || (formType === 'offline' ? '14:00' : '19:00'),
        endTime: lastSlot?.endTime || (formType === 'offline' ? '12:00' : '20:30'),
      }
    ])
  }

  function handleRemoveSlot(slotId: string) {
    if (scheduleSlots.length <= 1) return
    setScheduleSlots(prev => prev.filter(s => s.id !== slotId))
  }

  function handleUpdateSlot(slotId: string, updates: Partial<ScheduleSlotItem>) {
    setScheduleSlots(prev =>
      prev.map(s => {
        if (s.id !== slotId) return s
        const updated = { ...s, ...updates }
        if (updates.date && formType === 'offline' && (!updated.endDate || updated.endDate === s.date)) {
          updated.endDate = calculateDefaultEndDate(updates.date)
        }
        return updated
      })
    )
  }

  async function handleSaveScheduleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formTitle.trim() || !formSubtitle.trim() || scheduleSlots.length === 0 || !scheduleSlots[0].date) {
      showToast('Harap lengkapi semua bidang yang wajib diisi dan minimal 1 tanggal sesi!', 'error')
      return
    }

    setSubmitting(true)
    try {
      if (editingSchedule) {
        const slot = scheduleSlots[0]
        const sDate = slot.date
        const eDate = formType === 'offline' ? (slot.endDate || slot.date) : slot.date

        await updateSchedule(editingSchedule.id, {
          type: formType,
          title: formTitle.trim(),
          subtitle_chapter: formSubtitle.trim(),
          instructor_name: formInstructorName.trim() || instructorName,
          date: sDate,
          start_date: sDate,
          end_date: eDate,
          start_time: slot.startTime,
          end_time: slot.endTime,
          meet_url: formType === 'online' ? formMeetUrl : undefined,
          location: formType === 'offline' ? formLocation : undefined,
          max_quota: formMaxQuota,
          target_group: formTargetGroup || null,
        })
        showToast('Jadwal kelas berhasil diperbarui di database!')
      } else {
        const listToSave = scheduleSlots.map(slot => {
          const sDate = slot.date
          const eDate = formType === 'offline' ? (slot.endDate || slot.date) : slot.date
          return {
            type: formType,
            title: formTitle.trim(),
            subtitle_chapter: formSubtitle.trim(),
            instructor_id: instructorId,
            instructor_name: formInstructorName.trim() || instructorName,
            date: sDate,
            start_date: sDate,
            end_date: eDate,
            start_time: slot.startTime,
            end_time: slot.endTime,
            meet_url: formType === 'online' ? formMeetUrl : undefined,
            location: formType === 'offline' ? formLocation : undefined,
            max_quota: formMaxQuota,
            target_group: formTargetGroup || null,
          }
        })

        await saveMultipleSchedules(listToSave)
        showToast(`Berhasil membuat ${listToSave.length} sesi jadwal kelas terpisah sekaligus di database!`)
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
          toastMessage.type === 'success' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-red-600 text-white border-red-700'
        }`}>
          {toastMessage.type === 'success' ? (
            <svg className="size-5 shrink-0 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="size-5 shrink-0 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
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
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          <span>Buat Jadwal Baru</span>
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
                      <span className={`px-2.5 py-0.5 rounded-full text-[0.68rem] font-black uppercase flex items-center gap-1.5 ${
                        sch.type === 'online'
                          ? 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300'
                          : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      }`}>
                        {sch.type === 'online' ? (
                          <>
                            <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span>Online (Meet)</span>
                          </>
                        ) : (
                          <>
                            <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <span>Offline (Dojo)</span>
                          </>
                        )}
                      </span>

                      <span className="text-xs text-slate-400 font-bold">
                        {sch.type === 'online' ? getWeekLabel(sch.week_range_id, sch.date) : getMonthLabel(sch.month_range_id)}
                      </span>

                      {/* Target Group Badge */}
                      {(() => {
                        const grpList = parseTargetGroups(sch.target_group)
                        if (grpList.length === 0) {
                          return (
                            <span className="px-2.5 py-0.5 rounded-full text-[0.68rem] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                              </svg>
                              <span>Semua Siswa</span>
                            </span>
                          )
                        }
                        return (
                          <span className="px-2.5 py-0.5 rounded-full text-[0.68rem] font-black bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 flex items-center gap-1">
                            <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span>{grpList.join(', ')}</span>
                          </span>
                        )
                      })()}
                    </div>

                    <h3 className="text-base font-extrabold text-slate-800 dark:text-white truncate">
                      {sch.title}
                    </h3>
                    <p className="text-xs text-primary dark:text-red-400 font-bold">
                      {sch.subtitle_chapter}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-slate-500 font-medium flex-wrap pt-1">
                      <span className="flex items-center gap-1.5">
                        <svg className="size-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <strong>{sch.date}</strong>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <svg className="size-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{sch.start_time} - {sch.end_time} WIB</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <svg className="size-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>Instruktur: <strong>{sch.instructor_name}</strong></span>
                      </span>
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
                      <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <span>{enrolledList.length} / {sch.max_quota} Peserta</span>
                      {isFull && <span className="text-[0.65rem] bg-white/20 px-1.5 py-0.2 rounded-md">Penuh</span>}
                    </button>

                    <button
                      onClick={() => openEditModal(sch)}
                      className="px-3 py-2 rounded-xl bg-amber-500/10 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 font-extrabold text-xs border border-amber-500/20 cursor-pointer transition-all flex items-center gap-1"
                    >
                      <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => handleDelete(sch.id, sch.title)}
                      className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 font-extrabold text-xs border border-red-200 dark:border-red-900/40 cursor-pointer transition-all flex items-center gap-1"
                    >
                      <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Hapus</span>
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
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[999] flex items-start justify-center p-3 sm:p-6 pt-8 sm:pt-12 md:pt-14 lg:pt-16 pb-12 animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[90dvh] border border-slate-200 dark:border-slate-800">
            {/* Modal Header */}
            <div className="px-4 py-3 sm:px-6 sm:py-4 bg-gradient-to-r from-primary to-primary-light text-white flex items-center justify-between shrink-0">
              <div>
                <span className="text-[0.65rem] sm:text-xs font-bold uppercase tracking-wider text-white/80">Panel Admin Pengajar</span>
                <h3 className="text-base sm:text-lg font-extrabold">
                  {editingSchedule ? 'Edit Jadwal Kelas' : 'Buat Jadwal Kelas Baru (Multi-Schedule)'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setEditingSchedule(null)
                }}
                className="size-8 sm:size-9 rounded-full bg-white/20 text-white hover:bg-white/30 border-none cursor-pointer text-lg sm:text-xl flex items-center justify-center"
              >
                ×
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveScheduleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              
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
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Online (Google Meet)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormType('offline')
                      setScheduleSlots(prev =>
                        prev.map(slot => ({
                          ...slot,
                          endDate: slot.endDate || calculateDefaultEndDate(slot.date),
                          startTime: slot.startTime === '19:00' ? '14:00' : slot.startTime,
                          endTime: slot.endTime === '20:30' ? '12:00' : slot.endTime,
                        }))
                      )
                    }}
                    className={`py-2.5 rounded-xl font-extrabold border cursor-pointer transition-all flex items-center justify-center gap-2 ${
                      formType === 'offline'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span>Offline (3 Hari 2 Malam)</span>
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

              {/* ── Multi-Schedule Date & Time Slots Section ── */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1.5">
                    <svg className="size-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Tanggal & Sesi Jadwal Kelas ({scheduleSlots.length} Sesi Terpisah) *</span>
                  </label>
                  {!editingSchedule && (
                    <button
                      type="button"
                      onClick={handleAddSlot}
                      className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary dark:text-red-400 font-extrabold text-[0.7rem] border-none cursor-pointer flex items-center gap-1 transition-all"
                    >
                      <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Tambah Sesi Tanggal Lain</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2.5">
                  {scheduleSlots.map((slot, index) => {
                    const isOffline = formType === 'offline'
                    return (
                      <div
                        key={slot.id}
                        className={`p-3.5 rounded-2xl border flex flex-col gap-2.5 relative transition-all ${
                          isOffline
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/80'
                            : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[0.68rem] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            isOffline
                              ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                              : 'bg-primary/10 dark:bg-primary/20 text-primary dark:text-red-400'
                          }`}>
                            Sesi #{index + 1} {isOffline ? '(Offline 3D2N)' : '(Online)'}
                          </span>

                          {!editingSchedule && scheduleSlots.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSlot(slot.id)}
                              className="px-2 py-0.5 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 hover:bg-red-200 text-[0.65rem] font-bold border-none cursor-pointer transition-all"
                            >
                              Hapus Sesi
                            </button>
                          )}
                        </div>

                        {isOffline ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-0.5 text-[0.68rem]">
                                  Tanggal Check-in (Hari Ke-1) *
                                </label>
                                <input
                                  type="date"
                                  required
                                  value={slot.date}
                                  onChange={e => handleUpdateSlot(slot.id, { date: e.target.value })}
                                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200 focus:outline-none text-xs"
                                />
                              </div>

                              <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-0.5 text-[0.68rem]">
                                  Jam Check-in (Mulai) *
                                </label>
                                <input
                                  type="time"
                                  required
                                  value={slot.startTime}
                                  onChange={e => handleUpdateSlot(slot.id, { startTime: e.target.value })}
                                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200 focus:outline-none text-xs"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-0.5 text-[0.68rem]">
                                  Tanggal Check-out (Hari Ke-3) *
                                </label>
                                <input
                                  type="date"
                                  required
                                  value={slot.endDate || calculateDefaultEndDate(slot.date)}
                                  onChange={e => handleUpdateSlot(slot.id, { endDate: e.target.value })}
                                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200 focus:outline-none text-xs"
                                />
                              </div>

                              <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-0.5 text-[0.68rem]">
                                  Jam Check-out (Selesai) *
                                </label>
                                <input
                                  type="time"
                                  required
                                  value={slot.endTime}
                                  onChange={e => handleUpdateSlot(slot.id, { endTime: e.target.value })}
                                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200 focus:outline-none text-xs"
                                />
                              </div>
                            </div>

                            <div className="text-[0.65rem] font-bold text-emerald-700 dark:text-emerald-300 bg-white/80 dark:bg-slate-900/80 p-1.5 rounded-lg border border-emerald-200/50 flex items-center gap-1.5">
                              <svg className="size-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>Durasi: {formatDateRangeIndonesian(slot.date, slot.endDate || calculateDefaultEndDate(slot.date), slot.startTime, slot.endTime).badgeLabel}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div>
                              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-0.5 text-[0.68rem]">
                                Tanggal *
                              </label>
                              <input
                                type="date"
                                required
                                value={slot.date}
                                onChange={e => handleUpdateSlot(slot.id, { date: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200 focus:outline-none text-xs"
                              />
                            </div>

                            <div>
                              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-0.5 text-[0.68rem]">
                                Jam Mulai *
                              </label>
                              <input
                                type="time"
                                required
                                value={slot.startTime}
                                onChange={e => handleUpdateSlot(slot.id, { startTime: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200 focus:outline-none text-xs"
                              />
                            </div>

                            <div>
                              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-0.5 text-[0.68rem]">
                                Jam Selesai *
                              </label>
                              <input
                                type="time"
                                required
                                value={slot.endTime}
                                onChange={e => handleUpdateSlot(slot.id, { endTime: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200 focus:outline-none text-xs"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {!editingSchedule && (
                  <button
                    type="button"
                    onClick={handleAddSlot}
                    className="w-full py-2.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary dark:text-red-400 font-extrabold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                  >
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Tambah Slot Tanggal Lain untuk Kelas Ini</span>
                  </button>
                )}

                {!editingSchedule && scheduleSlots.length > 1 && (
                  <div className="p-2.5 bg-sky-50 dark:bg-sky-950/40 rounded-xl border border-sky-200 dark:border-sky-800 text-[0.68rem] text-sky-800 dark:text-sky-300 font-semibold flex items-center gap-2">
                    <svg className="size-4 text-sky-600 dark:text-sky-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>1 Kali Pengaturan ini akan otomatis menerbitkan <strong>{scheduleSlots.length} jadwal terpisah</strong> di sistem dan kalender siswa.</span>
                  </div>
                )}
              </div>

              {/* Location or Meet Link */}
              {formType === 'online' ? (
                <div>
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    Link Google Meet / Zoom
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

              {/* Target Group Multi-choice Control */}
              {(() => {
                const selectedFormGroups = parseTargetGroups(formTargetGroup)
                return (
                  <div className="p-3.5 bg-violet-50/60 dark:bg-violet-950/20 rounded-2xl border border-violet-200/80 dark:border-violet-800/50 flex flex-col gap-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <label className="block font-extrabold text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1.5">
                          <svg className="size-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <span>Target Grup Siswa (Bisa Pilih &gt;1 Grup)</span>
                        </label>
                        <p className="text-[0.68rem] text-slate-400 mt-0.5">
                          Pilih grup yang berhak melihat & mendaftar sesi ini. Kosongkan untuk terbuka bagi semua siswa.
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setFormTargetGroup('')}
                          className={`px-2.5 py-1 rounded-lg font-extrabold text-[0.68rem] transition-all cursor-pointer border flex items-center gap-1 ${
                            selectedFormGroups.length === 0
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                          </svg>
                          <span>Semua Siswa (Publik)</span>
                        </button>

                        {availableGroups.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setFormTargetGroup(availableGroups.map(g => g.name).join(', '))}
                            className="px-2 py-1 rounded-lg font-bold text-[0.68rem] bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 hover:bg-violet-200 cursor-pointer"
                          >
                            Pilih Semua
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Multi-choice Pills */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-violet-200/50 dark:border-violet-800/50">
                      {availableGroups.map(g => {
                        const isChecked = selectedFormGroups.includes(g.name)
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => {
                              let next: string[] = []
                              if (isChecked) {
                                next = selectedFormGroups.filter(x => x !== g.name)
                              } else {
                                next = [...selectedFormGroups, g.name]
                              }
                              setFormTargetGroup(next.length > 0 ? next.join(', ') : '')
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5 select-none ${
                              isChecked
                                ? 'bg-violet-600 text-white border-violet-600 shadow-xs font-black scale-[1.02]'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-violet-400'
                            }`}
                          >
                            <span className={`size-3.5 rounded-md flex items-center justify-center ${
                              isChecked ? 'bg-white text-violet-600' : 'border border-slate-300 dark:border-slate-600'
                            }`}>
                              {isChecked && (
                                <svg className="size-2.5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </span>
                            <span>{g.name}</span>
                          </button>
                        )
                      })}
                    </div>

                    {/* Summary */}
                    <div className="text-[0.68rem] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                      <span>Status:</span>
                      {selectedFormGroups.length === 0 ? (
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">Terbuka untuk Semua Siswa (Tanpa Batasan)</span>
                      ) : (
                        <span className="font-bold text-violet-600 dark:text-violet-400">
                          Dibatasi khusus {selectedFormGroups.length} grup: {selectedFormGroups.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })()}

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
                    : (editingSchedule ? 'Simpan Perubahan Jadwal' : `Simpan & Terbitkan ${scheduleSlots.length > 1 ? `${scheduleSlots.length} Jadwal` : 'Jadwal'}`)}
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
