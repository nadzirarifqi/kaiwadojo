import { useState, useEffect, useRef, type FormEvent, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  type ClassSchedule,
  type ClassReservation,
  type ClassType,
  fetchSchedules,
  fetchReservations,
  saveMultipleSchedules,
  updateSchedule,
  deleteSchedule,
  matchScheduleId,
  formatDateRangeIndonesian,
  SCHEDULE_UPDATE_EVENT,
  RESERVATION_UPDATE_EVENT,
  subscribeToScheduleRealtime,
} from '../lib/scheduleService'
import { fetchGroups, sortGroupsAlphabetically, type KaiwaGroup, GROUP_UPDATE_EVENT } from '../lib/groupService'
import { parseTargetGroups } from '../lib/chapterService'
import { ScheduleCardSkeleton } from '../components/Skeleton'
import ModalPortal from '../components/ModalPortal'
import { useConfirm } from '../contexts/ConfirmContext'
import { useToast } from '../contexts/ToastContext'

interface ScheduleSlotItem {
  id: string
  date: string
  endDate?: string
  startTime: string
  endTime: string
}

type TimeTab = 'upcoming' | 'past' | 'all'
type TypeFilter = 'all' | ClassType

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const DEFAULT_LOCATION = 'kaiwadojo Center, Room A (Jl. Sudirman No. 12)'

const CARD = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm'
const inputClass =
  'w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors'
const labelClass = 'block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5'

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function parseDate(s: string): Date | null {
  const [y, m, d] = (s || '').split('T')[0].split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d) : null
}
function addDays(s: string, n: number) {
  const d = parseDate(s) || new Date()
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}
function dateHeading(s: string, today: string) {
  const d = parseDate(s)
  if (!d) return s
  const label = `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
  if (s === today) return `Hari ini · ${label}`
  if (s === addDays(today, 1)) return `Besok · ${label}`
  return label
}
const startOf = (s: ClassSchedule) => (s.start_date || s.date || '').split('T')[0]
const endOf = (s: ClassSchedule) => (s.end_date || s.start_date || s.date || '').split('T')[0]
const shortTime = (t: string) => (t || '').slice(0, 5)

function Icon({ d, className = 'size-4' }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}
const ICON = {
  plus: 'M12 4v16m8-8H4',
  video: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
  pin: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z',
  users: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  copy: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  dots: 'M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z',
  close: 'M6 18L18 6M6 6l12 12',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  link: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  check: 'M5 13l4 4L19 7',
  mail: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
}

function Fieldset({ legend, hint, children }: { legend: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="border-0 p-0 m-0 min-w-0">
      <legend className="text-base font-bold text-slate-900 dark:text-white">{legend}</legend>
      {hint && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{hint}</p>}
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </fieldset>
  )
}

export default function InstructorScheduleManagerPage() {
  const confirm = useConfirm()
  const { toast } = useToast()
  const { profile } = useAuth()
  const instructorId = profile?.id || 'inst-1'
  const instructorName = profile?.full_name || 'Sensei'
  const today = toDateStr(new Date())

  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [reservations, setReservations] = useState<ClassReservation[]>([])
  const [availableGroups, setAvailableGroups] = useState<KaiwaGroup[]>([])
  const [loading, setLoading] = useState(true)

  // Filter
  const [timeTab, setTimeTab] = useState<TimeTab>('upcoming')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [search, setSearch] = useState('')

  // Modal & menu
  const [showForm, setShowForm] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ClassSchedule | null>(null)
  const [participantsOf, setParticipantsOf] = useState<ClassSchedule | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  // Form
  const [formType, setFormType] = useState<ClassType>('online')
  const [formTitle, setFormTitle] = useState('')
  const [formSubtitle, setFormSubtitle] = useState('')
  const [formInstructorName, setFormInstructorName] = useState(instructorName)
  const [formMeetUrl, setFormMeetUrl] = useState('')
  const [formLocation, setFormLocation] = useState(DEFAULT_LOCATION)
  const [formMaxQuota, setFormMaxQuota] = useState(10)
  const [formGroups, setFormGroups] = useState<string[]>([])
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlotItem[]>([])

  async function loadData(silent = false) {
    if (!silent) setLoading(true)
    const [sData, rData, gData] = await Promise.all([
      fetchSchedules(),
      fetchReservations(),
      fetchGroups(true).catch(() => [] as KaiwaGroup[]),
    ])
    setSchedules(sData)
    setReservations(rData)
    setAvailableGroups(sortGroupsAlphabetically(gData))
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    const handleSync = () => loadData(true)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tutup menu aksi saat klik di luar / Escape
  useEffect(() => {
    if (!menuFor) return
    const onPointer = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuFor(null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuFor(null) }
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuFor])

  const enrolledOf = (sch: ClassSchedule) => reservations.filter(r => matchScheduleId(sch.id, r.schedule_id))

  /* ── Form ── */
  function lastValue<K extends 'meet_url' | 'location'>(type: ClassType, key: K): string {
    const last = [...schedules].filter(s => s.type === type && s[key]).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0]
    return (last?.[key] as string) || ''
  }

  function fillForm(sch: ClassSchedule | null, slots: ScheduleSlotItem[]) {
    setFormType(sch?.type || 'online')
    setFormTitle(sch?.title || '')
    setFormSubtitle(sch?.subtitle_chapter || '')
    setFormInstructorName(sch?.instructor_name || instructorName)
    setFormMeetUrl(sch?.meet_url || lastValue('online', 'meet_url'))
    setFormLocation(sch?.location || lastValue('offline', 'location') || DEFAULT_LOCATION)
    setFormMaxQuota(sch?.max_quota || 10)
    setFormGroups(parseTargetGroups(sch?.target_group))
    setScheduleSlots(slots)
    setShowErrors(false)
    setShowForm(true)
  }

  function openCreate() {
    setEditingSchedule(null)
    const date = addDays(today, 1)
    fillForm(null, [{ id: 'slot-1', date, endDate: addDays(date, 2), startTime: '19:00', endTime: '20:30' }])
  }

  function openEdit(sch: ClassSchedule) {
    setMenuFor(null)
    setEditingSchedule(sch)
    fillForm(sch, [{ id: 'slot-1', date: startOf(sch), endDate: endOf(sch), startTime: shortTime(sch.start_time), endTime: shortTime(sch.end_time) }])
  }

  /** Duplikat: jadwal baru dengan data sama, satu minggu (online) / satu bulan (offline) setelahnya */
  function openDuplicate(sch: ClassSchedule) {
    setMenuFor(null)
    setEditingSchedule(null)
    const shift = sch.type === 'online' ? 7 : 28
    const date = addDays(startOf(sch), shift)
    fillForm(sch, [{ id: 'slot-1', date, endDate: addDays(endOf(sch), shift), startTime: shortTime(sch.start_time), endTime: shortTime(sch.end_time) }])
  }

  function closeForm() {
    setShowForm(false)
    setEditingSchedule(null)
  }

  function switchType(type: ClassType) {
    setFormType(type)
    setScheduleSlots(prev =>
      prev.map(slot =>
        type === 'offline'
          ? { ...slot, endDate: slot.endDate && slot.endDate !== slot.date ? slot.endDate : addDays(slot.date, 2), startTime: slot.startTime === '19:00' ? '14:00' : slot.startTime, endTime: slot.endTime === '20:30' ? '12:00' : slot.endTime }
          : { ...slot, startTime: slot.startTime === '14:00' ? '19:00' : slot.startTime, endTime: slot.endTime === '12:00' ? '20:30' : slot.endTime }
      )
    )
  }

  function addSlot() {
    const last = scheduleSlots[scheduleSlots.length - 1]
    const date = addDays(last?.date || today, formType === 'online' ? 7 : 28)
    setScheduleSlots(prev => [
      ...prev,
      { id: `slot-${Date.now()}`, date, endDate: addDays(date, 2), startTime: last?.startTime || '19:00', endTime: last?.endTime || '20:30' },
    ])
  }

  function updateSlot(id: string, updates: Partial<ScheduleSlotItem>) {
    setScheduleSlots(prev => prev.map(s => {
      if (s.id !== id) return s
      const next = { ...s, ...updates }
      // Geser tanggal selesai offline mengikuti tanggal mulai (pertahankan durasinya)
      if (updates.date && formType === 'offline' && s.endDate) {
        const span = Math.max(0, Math.round(((parseDate(s.endDate)?.getTime() || 0) - (parseDate(s.date)?.getTime() || 0)) / 86400000))
        next.endDate = addDays(updates.date, span || 2)
      }
      return next
    }))
  }

  function slotError(slot: ScheduleSlotItem): string | null {
    if (!slot.date) return 'Tanggal wajib diisi.'
    if (formType === 'online') {
      if (slot.endTime <= slot.startTime) return 'Jam selesai harus setelah jam mulai.'
    } else if ((slot.endDate || slot.date) < slot.date) {
      return 'Tanggal selesai tidak boleh sebelum tanggal mulai.'
    }
    if (!editingSchedule && slot.date < today) return 'Tanggal sudah lewat.'
    return null
  }

  const formErrors = {
    title: !formTitle.trim() ? 'Judul kelas wajib diisi.' : null,
    subtitle: !formSubtitle.trim() ? 'Topik / bab wajib diisi.' : null,
    instructor: !formInstructorName.trim() ? 'Nama pengajar wajib diisi.' : null,
    meet: formType === 'online' && !/^https?:\/\/\S+\.\S+/.test(formMeetUrl.trim()) ? 'Masukkan tautan yang valid (diawali https://).' : null,
    location: formType === 'offline' && !formLocation.trim() ? 'Lokasi wajib diisi.' : null,
    quota: formMaxQuota < 1 || formMaxQuota > 50 ? 'Kuota 1–50 orang.' : null,
    slots: scheduleSlots.some(s => slotError(s)) ? 'Periksa tanggal & jam sesi.' : null,
  }
  const hasFormErrors = Object.values(formErrors).some(Boolean)
  const err = (key: keyof typeof formErrors) => (showErrors ? formErrors[key] : null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (hasFormErrors) {
      setShowErrors(true)
      toast.error('Masih ada isian yang perlu diperbaiki.', 'Jadwal Kelas')
      return
    }
    setSubmitting(true)
    const base = {
      type: formType,
      title: formTitle.trim(),
      subtitle_chapter: formSubtitle.trim(),
      instructor_name: formInstructorName.trim() || instructorName,
      meet_url: formType === 'online' ? formMeetUrl.trim() : undefined,
      location: formType === 'offline' ? formLocation.trim() : undefined,
      max_quota: formMaxQuota,
      target_group: formGroups.length > 0 ? formGroups.join(', ') : null,
    }
    try {
      if (editingSchedule) {
        const slot = scheduleSlots[0]
        await updateSchedule(editingSchedule.id, {
          ...base,
          date: slot.date,
          start_date: slot.date,
          end_date: formType === 'offline' ? slot.endDate || slot.date : slot.date,
          start_time: slot.startTime,
          end_time: slot.endTime,
        })
        toast.success('Jadwal diperbarui.', 'Jadwal Kelas')
      } else {
        const list = scheduleSlots.map(slot => ({
          ...base,
          instructor_id: instructorId,
          date: slot.date,
          start_date: slot.date,
          end_date: formType === 'offline' ? slot.endDate || slot.date : slot.date,
          start_time: slot.startTime,
          end_time: slot.endTime,
        }))
        await saveMultipleSchedules(list)
        toast.success(list.length > 1 ? `${list.length} jadwal diterbitkan.` : 'Jadwal diterbitkan.', 'Jadwal Kelas')
      }
      closeForm()
      await loadData(true)
    } catch (error: any) {
      console.error('Save schedule error:', error)
      toast.error(error?.message || 'Gagal menyimpan jadwal.', 'Jadwal Kelas')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(sch: ClassSchedule) {
    setMenuFor(null)
    const count = enrolledOf(sch).length
    const ok = await confirm({
      title: 'Hapus jadwal kelas?',
      message: count > 0
        ? `"${sch.title}" sudah memiliki ${count} peserta. Jadwal dan semua reservasinya akan dihapus.`
        : `Jadwal "${sch.title}" akan dihapus.`,
      confirmLabel: 'Ya, hapus',
      icon: 'trash',
    })
    if (!ok) return
    try {
      await deleteSchedule(sch.id)
      toast.success('Jadwal dihapus.', 'Jadwal Kelas')
      await loadData(true)
    } catch (error: any) {
      toast.error(error?.message || 'Gagal menghapus jadwal.', 'Jadwal Kelas')
    }
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} disalin.`, 'Jadwal Kelas')
    } catch {
      toast.error('Gagal menyalin.', 'Jadwal Kelas')
    }
  }

  /* ── Data turunan ── */
  const upcoming = schedules.filter(s => endOf(s) >= today)
  const upcomingSeats = upcoming.reduce((acc, s) => acc + s.max_quota, 0)
  const upcomingEnrolled = upcoming.reduce((acc, s) => acc + enrolledOf(s).length, 0)
  const fullCount = upcoming.filter(s => enrolledOf(s).length >= s.max_quota).length
  const fillPct = upcomingSeats > 0 ? Math.round((upcomingEnrolled / upcomingSeats) * 100) : 0

  const q = search.trim().toLowerCase()
  const filtered = schedules
    .filter(s => (timeTab === 'upcoming' ? endOf(s) >= today : timeTab === 'past' ? endOf(s) < today : true))
    .filter(s => typeFilter === 'all' || s.type === typeFilter)
    .filter(s => !q || `${s.title} ${s.subtitle_chapter} ${s.instructor_name} ${s.target_group || ''}`.toLowerCase().includes(q))
    .sort((a, b) => {
      const cmp = `${startOf(a)} ${a.start_time}`.localeCompare(`${startOf(b)} ${b.start_time}`)
      return timeTab === 'past' ? -cmp : cmp
    })

  const groupedByDate: { date: string; items: ClassSchedule[] }[] = []
  filtered.forEach(s => {
    const date = startOf(s)
    const last = groupedByDate[groupedByDate.length - 1]
    if (last && last.date === date) last.items.push(s)
    else groupedByDate.push({ date, items: [s] })
  })

  const stats = [
    { label: 'Jadwal mendatang', value: upcoming.length, hint: `${upcoming.filter(s => s.type === 'online').length} online · ${upcoming.filter(s => s.type === 'offline').length} offline` },
    { label: 'Peserta terdaftar', value: upcomingEnrolled, hint: `dari ${upcomingSeats} kursi` },
    { label: 'Keterisian', value: `${fillPct}%`, hint: 'rata-rata kelas mendatang' },
    { label: 'Kelas penuh', value: fullCount, hint: fullCount > 0 ? 'pertimbangkan sesi tambahan' : 'masih ada kursi' },
  ]

  const segBtn = (active: boolean) =>
    `h-9 px-3 rounded-lg text-sm font-semibold border-none cursor-pointer transition-colors ${
      active ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'bg-transparent text-slate-500 dark:text-slate-400'
    }`

  const participants = participantsOf ? enrolledOf(participantsOf) : []

  return (
    <main className="flex-1 px-4 py-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full min-w-0 animate-page-slide">
      {/* ── Judul halaman ── */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4 sm:mb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Jadwal Kelas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Buat sesi kelas online & offline, atur kuota, dan pantau peserta.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="h-11 px-4 shrink-0 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-bold border-none cursor-pointer flex items-center justify-center gap-2 transition-colors"
        >
          <Icon d={ICON.plus} className="size-5" /> Buat jadwal
        </button>
      </header>

      {/* ── Ringkasan ── */}
      <section aria-label="Ringkasan jadwal" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        {stats.map(s => (
          <div key={s.label} className={`${CARD} p-4`}>
            <p className="text-sm text-slate-500 dark:text-slate-400">{s.label}</p>
            <p className="text-2xl font-black tabular-nums text-slate-900 dark:text-white mt-1 leading-none">{s.value}</p>
            <p className="text-xs text-slate-400 mt-1.5 truncate">{s.hint}</p>
          </div>
        ))}
      </section>

      {/* ── Toolbar ── */}
      <section className={`${CARD} p-3 sm:p-4 mb-4 flex flex-col lg:flex-row lg:items-center gap-3`}>
        <div role="tablist" aria-label="Rentang waktu" className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/70 w-full lg:w-auto">
          {([
            ['upcoming', 'Mendatang', upcoming.length],
            ['past', 'Selesai', schedules.length - upcoming.length],
            ['all', 'Semua', schedules.length],
          ] as const).map(([key, label, count]) => (
            <button key={key} type="button" role="tab" aria-selected={timeTab === key} onClick={() => setTimeTab(key)} className={`flex-1 lg:flex-none ${segBtn(timeTab === key)}`}>
              {label} <span className="text-xs font-normal text-slate-400 tabular-nums">{count}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/70 w-full lg:w-auto">
          {([['all', 'Semua tipe'], ['online', 'Online'], ['offline', 'Offline']] as const).map(([key, label]) => (
            <button key={key} type="button" aria-pressed={typeFilter === key} onClick={() => setTypeFilter(key)} className={`flex-1 lg:flex-none ${segBtn(typeFilter === key)}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-0">
          <Icon d={ICON.search} className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari judul, topik, pengajar, atau grup…" className={`${inputClass} pl-10`} />
        </div>
      </section>

      {/* ── Daftar jadwal per tanggal ── */}
      {loading ? (
        <ScheduleCardSkeleton count={4} />
      ) : groupedByDate.length === 0 ? (
        <div className={`${CARD} p-10 text-center`}>
          <span className="mx-auto size-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
            <Icon d={ICON.calendar} className="size-6" />
          </span>
          <p className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
            {schedules.length === 0 ? 'Belum ada jadwal kelas' : 'Tidak ada jadwal yang cocok'}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {schedules.length === 0 ? 'Buat jadwal pertama agar pelajar bisa mendaftar.' : 'Ubah filter atau kata kunci pencarian.'}
          </p>
          {schedules.length === 0 && (
            <button type="button" onClick={openCreate} className="mt-4 h-11 px-4 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-bold border-none cursor-pointer inline-flex items-center gap-2">
              <Icon d={ICON.plus} className="size-5" /> Buat jadwal
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groupedByDate.map(group => (
            <section key={group.date} aria-labelledby={`day-${group.date}`}>
              <h2 id={`day-${group.date}`} className={`text-sm font-semibold mb-2 px-1 ${group.date === today ? 'text-primary dark:text-primary-lighter' : 'text-slate-500 dark:text-slate-400'}`}>
                <time dateTime={group.date}>{dateHeading(group.date, today)}</time>
              </h2>
              <ul className={`${CARD} divide-y divide-slate-100 dark:divide-slate-800`}>
                {group.items.map(sch => {
                  const enrolled = enrolledOf(sch).length
                  const pct = Math.min(100, Math.round((enrolled / Math.max(1, sch.max_quota)) * 100))
                  const isFull = enrolled >= sch.max_quota
                  const isPast = endOf(sch) < today
                  const groupsOfSch = parseTargetGroups(sch.target_group)
                  const multiDay = endOf(sch) !== startOf(sch)
                  return (
                    <li key={sch.id}>
                      <article className={`p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4 ${isPast ? 'opacity-70' : ''}`}>
                        {/* Waktu */}
                        <div className="sm:w-24 shrink-0 flex sm:flex-col items-baseline sm:items-start gap-2 sm:gap-0.5">
                          <time className="text-base font-bold tabular-nums text-slate-900 dark:text-white">{shortTime(sch.start_time)}</time>
                          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            {multiDay ? formatDateRangeIndonesian(startOf(sch), endOf(sch), sch.start_time, sch.end_time).badgeLabel : `s.d. ${shortTime(sch.end_time)} WIB`}
                          </span>
                        </div>

                        {/* Detail */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1 ${
                              sch.type === 'online' ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            }`}>
                              <Icon d={sch.type === 'online' ? ICON.video : ICON.pin} className="size-3" />
                              {sch.type === 'online' ? 'Online' : 'Offline'}
                            </span>
                            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${groupsOfSch.length > 0 ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                              {groupsOfSch.length === 0 ? 'Semua siswa' : groupsOfSch.join(', ')}
                            </span>
                            {isPast && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Selesai</span>}
                          </div>
                          <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white leading-snug">{sch.title}</h3>
                          <p className="text-sm text-slate-600 dark:text-slate-300 truncate">{sch.subtitle_chapter}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="flex items-center gap-1"><Icon d={ICON.user} className="size-3.5" />{sch.instructor_name}</span>
                            {sch.type === 'online' && sch.meet_url && (
                              <button type="button" onClick={() => copyText(sch.meet_url!, 'Tautan kelas')} className="flex items-center gap-1 bg-transparent border-none p-0 cursor-pointer text-sky-600 dark:text-sky-400 hover:underline max-w-[14rem]">
                                <Icon d={ICON.link} className="size-3.5 shrink-0" /><span className="truncate">{sch.meet_url.replace(/^https?:\/\//, '')}</span>
                              </button>
                            )}
                            {sch.type === 'offline' && sch.location && (
                              <span className="flex items-center gap-1 min-w-0"><Icon d={ICON.pin} className="size-3.5 shrink-0" /><span className="truncate max-w-[16rem]">{sch.location}</span></span>
                            )}
                          </p>
                        </div>

                        {/* Kapasitas & aksi */}
                        <div className="flex items-center gap-2 sm:w-64 shrink-0">
                          <button
                            type="button"
                            onClick={() => setParticipantsOf(sch)}
                            className="flex-1 min-w-0 text-left rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border-none cursor-pointer transition-colors"
                            aria-label={`Lihat ${enrolled} peserta`}
                          >
                            <span className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1"><Icon d={ICON.users} className="size-3.5" />{enrolled}/{sch.max_quota} peserta</span>
                              {isFull && <span className="font-bold text-red-600 dark:text-red-400">Penuh</span>}
                            </span>
                            <span className="mt-1.5 block h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <span className={`block h-full rounded-full ${isFull ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                            </span>
                          </button>
                          <button type="button" onClick={() => openEdit(sch)} aria-label={`Edit ${sch.title}`} title="Edit" className="size-10 shrink-0 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 bg-transparent border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                            <Icon d={ICON.edit} />
                          </button>
                          <div className="relative" ref={menuFor === sch.id ? menuRef : undefined}>
                            <button
                              type="button"
                              onClick={() => setMenuFor(menuFor === sch.id ? null : sch.id)}
                              aria-haspopup="menu"
                              aria-expanded={menuFor === sch.id}
                              aria-label="Aksi lainnya"
                              className="size-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 bg-transparent border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Icon d={ICON.dots} />
                            </button>
                            {menuFor === sch.id && (
                              <div role="menu" className="absolute right-0 top-full mt-1.5 z-30 w-52 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl p-1.5 animate-fade-in-up">
                                <button type="button" role="menuitem" onClick={() => openDuplicate(sch)} className="w-full h-10 px-3 rounded-lg flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200 bg-transparent border-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
                                  <Icon d={ICON.copy} className="size-4 text-slate-400" /> Duplikat jadwal
                                </button>
                                <button type="button" role="menuitem" onClick={() => { setMenuFor(null); setParticipantsOf(sch) }} className="w-full h-10 px-3 rounded-lg flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200 bg-transparent border-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
                                  <Icon d={ICON.users} className="size-4 text-slate-400" /> Lihat peserta
                                </button>
                                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                                <button type="button" role="menuitem" onClick={() => handleDelete(sch)} className="w-full h-10 px-3 rounded-lg flex items-center gap-2.5 text-sm text-red-600 dark:text-red-400 bg-transparent border-none cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/40">
                                  <Icon d={ICON.trash} className="size-4" /> Hapus
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* ── Form buat / edit jadwal ── */}
      {showForm && (
        <ModalPortal>
          <div className="modal-overlay fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in" onClick={() => !submitting && closeForm()}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="schedule-form-title"
              onClick={e => e.stopPropagation()}
              className="w-full sm:max-w-2xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[94dvh] sm:max-h-[90dvh] flex flex-col animate-fade-in-up"
            >
              <div className="shrink-0 px-5 pt-3 sm:pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 id="schedule-form-title" className="text-lg font-bold text-slate-900 dark:text-white">{editingSchedule ? 'Edit jadwal' : 'Buat jadwal kelas'}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{editingSchedule ? 'Perubahan langsung terlihat oleh pelajar.' : 'Bisa membuat beberapa sesi sekaligus.'}</p>
                  </div>
                  <button type="button" onClick={closeForm} disabled={submitting} aria-label="Tutup" className="size-10 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-none cursor-pointer flex items-center justify-center">
                    <Icon d={ICON.close} className="size-5" />
                  </button>
                </div>
              </div>

              <form id="schedule-form" onSubmit={handleSubmit} noValidate className="flex-1 min-h-0 overflow-y-auto px-5 py-5 flex flex-col gap-7">
                {/* Jenis kelas */}
                <Fieldset legend="Jenis kelas">
                  <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:gap-3">
                    {([
                      ['online', 'Online', 'Google Meet / Zoom', ICON.video, 'sky'],
                      ['offline', 'Offline', 'Tatap muka, multi-hari', ICON.pin, 'emerald'],
                    ] as const).map(([type, label, hint, icon, tone]) => {
                      const active = formType === type
                      return (
                        <button
                          key={type}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => switchType(type)}
                          className={`p-3 rounded-xl border-2 flex items-center gap-3 text-left cursor-pointer transition-colors bg-white dark:bg-slate-900 ${active ? 'border-primary' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                        >
                          <span className={`size-10 shrink-0 rounded-xl flex items-center justify-center ${tone === 'sky' ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'}`}>
                            <Icon d={icon} className="size-5" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-slate-900 dark:text-white">{label}</span>
                            <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </Fieldset>

                {/* Informasi */}
                <Fieldset legend="Informasi kelas">
                  <div>
                    <label htmlFor="sch-title" className={labelClass}>Judul kelas</label>
                    <input id="sch-title" type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Kaiwa Special: Percakapan Sehari-hari" maxLength={120} aria-invalid={Boolean(err('title'))} className={`${inputClass} ${err('title') ? '!border-red-400' : ''}`} />
                    {err('title') && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{err('title')}</p>}
                  </div>
                  <div>
                    <label htmlFor="sch-sub" className={labelClass}>Topik / bab</label>
                    <input id="sch-sub" type="text" value={formSubtitle} onChange={e => setFormSubtitle(e.target.value)} placeholder="Bab 4: Memesan makanan di restoran" maxLength={160} aria-invalid={Boolean(err('subtitle'))} className={`${inputClass} ${err('subtitle') ? '!border-red-400' : ''}`} />
                    {err('subtitle') && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{err('subtitle')}</p>}
                  </div>
                  <div>
                    <label htmlFor="sch-inst" className={labelClass}>Pengajar</label>
                    <input id="sch-inst" type="text" value={formInstructorName} onChange={e => setFormInstructorName(e.target.value)} maxLength={100} aria-invalid={Boolean(err('instructor'))} className={`${inputClass} ${err('instructor') ? '!border-red-400' : ''}`} />
                    {err('instructor') && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{err('instructor')}</p>}
                  </div>
                </Fieldset>

                {/* Waktu */}
                <Fieldset legend="Waktu" hint={formType === 'offline' ? 'Kelas offline bisa berlangsung beberapa hari (default 3 hari 2 malam).' : 'Semua waktu dalam WIB.'}>
                  <ol className="flex flex-col gap-2.5">
                    {scheduleSlots.map((slot, index) => {
                      const slotErr = showErrors ? slotError(slot) : null
                      return (
                        <li key={slot.id} className={`rounded-xl border p-3 ${slotErr ? 'border-red-300 dark:border-red-800' : 'border-slate-200 dark:border-slate-700'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                              {scheduleSlots.length > 1 ? `Sesi ${index + 1}` : 'Sesi'}
                              {formType === 'offline' && slot.date && (
                                <> · {formatDateRangeIndonesian(slot.date, slot.endDate || slot.date, slot.startTime, slot.endTime).badgeLabel}</>
                              )}
                            </span>
                            {!editingSchedule && scheduleSlots.length > 1 && (
                              <button type="button" onClick={() => setScheduleSlots(prev => prev.filter(s => s.id !== slot.id))} aria-label={`Hapus sesi ${index + 1}`} className="size-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 bg-transparent border-none cursor-pointer">
                                <Icon d={ICON.trash} />
                              </button>
                            )}
                          </div>
                          {formType === 'online' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1fr] gap-2">
                              <div>
                                <label htmlFor={`date-${slot.id}`} className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Tanggal</label>
                                <input id={`date-${slot.id}`} type="date" value={slot.date} min={editingSchedule ? undefined : today} onChange={e => updateSlot(slot.id, { date: e.target.value })} className={inputClass} />
                              </div>
                              <div className="grid grid-cols-2 sm:contents gap-2">
                                <div>
                                  <label htmlFor={`st-${slot.id}`} className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Mulai</label>
                                  <input id={`st-${slot.id}`} type="time" value={slot.startTime} onChange={e => updateSlot(slot.id, { startTime: e.target.value })} className={inputClass} />
                                </div>
                                <div>
                                  <label htmlFor={`et-${slot.id}`} className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Selesai</label>
                                  <input id={`et-${slot.id}`} type="time" value={slot.endTime} onChange={e => updateSlot(slot.id, { endTime: e.target.value })} className={inputClass} />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label htmlFor={`date-${slot.id}`} className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Check-in</label>
                                <input id={`date-${slot.id}`} type="date" value={slot.date} min={editingSchedule ? undefined : today} onChange={e => updateSlot(slot.id, { date: e.target.value })} className={inputClass} />
                              </div>
                              <div>
                                <label htmlFor={`st-${slot.id}`} className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Jam check-in</label>
                                <input id={`st-${slot.id}`} type="time" value={slot.startTime} onChange={e => updateSlot(slot.id, { startTime: e.target.value })} className={inputClass} />
                              </div>
                              <div>
                                <label htmlFor={`ed-${slot.id}`} className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Check-out</label>
                                <input id={`ed-${slot.id}`} type="date" value={slot.endDate || slot.date} min={slot.date} onChange={e => updateSlot(slot.id, { endDate: e.target.value })} className={inputClass} />
                              </div>
                              <div>
                                <label htmlFor={`et-${slot.id}`} className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Jam check-out</label>
                                <input id={`et-${slot.id}`} type="time" value={slot.endTime} onChange={e => updateSlot(slot.id, { endTime: e.target.value })} className={inputClass} />
                              </div>
                            </div>
                          )}
                          {slotErr && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{slotErr}</p>}
                        </li>
                      )
                    })}
                  </ol>
                  {!editingSchedule && (
                    <button type="button" onClick={addSlot} className="h-11 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-center gap-2">
                      <Icon d={ICON.plus} /> Tambah sesi {formType === 'online' ? '(+1 minggu)' : '(+4 minggu)'}
                    </button>
                  )}
                </Fieldset>

                {/* Tempat */}
                <Fieldset legend={formType === 'online' ? 'Tautan kelas' : 'Lokasi'}>
                  {formType === 'online' ? (
                    <div>
                      <label htmlFor="sch-meet" className="sr-only">Tautan Google Meet / Zoom</label>
                      <input id="sch-meet" type="url" inputMode="url" value={formMeetUrl} onChange={e => setFormMeetUrl(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" aria-invalid={Boolean(err('meet'))} className={`${inputClass} ${err('meet') ? '!border-red-400' : ''}`} />
                      {err('meet') ? <p className="text-xs text-red-600 dark:text-red-400 mt-1">{err('meet')}</p> : <p className="text-xs text-slate-400 mt-1">Dibagikan ke peserta yang terdaftar.</p>}
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="sch-loc" className="sr-only">Lokasi</label>
                      <input id="sch-loc" type="text" value={formLocation} onChange={e => setFormLocation(e.target.value)} placeholder="Nama tempat & alamat" aria-invalid={Boolean(err('location'))} className={`${inputClass} ${err('location') ? '!border-red-400' : ''}`} />
                      {err('location') && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{err('location')}</p>}
                    </div>
                  )}
                </Fieldset>

                {/* Peserta */}
                <Fieldset legend="Peserta">
                  <div>
                    <span className={labelClass}>Kuota maksimal</span>
                    <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <button type="button" onClick={() => setFormMaxQuota(v => Math.max(1, v - 1))} aria-label="Kurangi kuota" className="size-11 flex items-center justify-center text-lg text-slate-600 dark:text-slate-300 bg-transparent border-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">−</button>
                      <input type="number" min={1} max={50} value={formMaxQuota} onChange={e => setFormMaxQuota(parseInt(e.target.value, 10) || 1)} aria-label="Kuota maksimal" className="w-16 h-11 text-center text-base font-semibold tabular-nums bg-transparent border-x border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none" />
                      <button type="button" onClick={() => setFormMaxQuota(v => Math.min(50, v + 1))} aria-label="Tambah kuota" className="size-11 flex items-center justify-center text-lg text-slate-600 dark:text-slate-300 bg-transparent border-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">+</button>
                    </div>
                    <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">orang per sesi</span>
                    {err('quota') && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{err('quota')}</p>}
                  </div>
                  <div>
                    <span className={labelClass}>Siapa yang bisa mendaftar?</span>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" aria-pressed={formGroups.length === 0} onClick={() => setFormGroups([])} className={`h-9 px-3 rounded-lg text-sm font-semibold border cursor-pointer transition-colors ${formGroups.length === 0 ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                        Semua siswa
                      </button>
                      {availableGroups.map(g => {
                        const selected = formGroups.includes(g.name)
                        return (
                          <button key={g.id} type="button" aria-pressed={selected} onClick={() => setFormGroups(prev => (selected ? prev.filter(x => x !== g.name) : [...prev, g.name]))} className={`h-9 px-3 rounded-lg text-sm font-semibold border cursor-pointer flex items-center gap-1.5 transition-colors ${selected ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                            {selected && <Icon d={ICON.check} />}
                            {g.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </Fieldset>
              </form>

              <div className="shrink-0 px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <span className="hidden sm:block mr-auto text-sm text-slate-500 dark:text-slate-400">
                  {editingSchedule ? 'Mengubah 1 jadwal' : `Akan menerbitkan ${scheduleSlots.length} jadwal`}
                </span>
                <button type="button" onClick={closeForm} disabled={submitting} className="h-11 px-4 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-none cursor-pointer">
                  Batal
                </button>
                <button type="submit" form="schedule-form" disabled={submitting} className="flex-1 sm:flex-none h-11 px-5 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-bold border-none cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60">
                  {submitting && <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                  {submitting ? 'Menyimpan…' : editingSchedule ? 'Simpan perubahan' : scheduleSlots.length > 1 ? `Terbitkan ${scheduleSlots.length} jadwal` : 'Terbitkan jadwal'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ── Daftar peserta ── */}
      {participantsOf && (
        <ModalPortal>
          <div className="modal-overlay fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in" onClick={() => setParticipantsOf(null)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="participants-title"
              onClick={e => e.stopPropagation()}
              className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90dvh] flex flex-col animate-fade-in-up"
            >
              <div className="shrink-0 px-5 pt-3 sm:pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 id="participants-title" className="text-lg font-bold text-slate-900 dark:text-white truncate">{participantsOf.title}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {formatDateRangeIndonesian(startOf(participantsOf), endOf(participantsOf), participantsOf.start_time, participantsOf.end_time).formattedRange}
                    </p>
                  </div>
                  <button type="button" onClick={() => setParticipantsOf(null)} aria-label="Tutup" className="size-10 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-none cursor-pointer flex items-center justify-center">
                    <Icon d={ICON.close} className="size-5" />
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (participants.length / Math.max(1, participantsOf.max_quota)) * 100)}%` }} />
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">{participants.length}/{participantsOf.max_quota}</span>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
                {participants.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Belum ada peserta yang mendaftar.</p>
                ) : (
                  <ol className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                    {participants.map((res, idx) => (
                      <li key={res.id} className="py-2.5 flex items-center gap-3">
                        <span className="size-9 shrink-0 rounded-full bg-primary/10 text-primary dark:text-primary-lighter text-sm font-bold flex items-center justify-center tabular-nums">{idx + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-900 dark:text-white truncate">{res.user_name}</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{res.user_email || 'Tanpa email'}</span>
                        </span>
                        {res.created_at && (
                          <time dateTime={res.created_at} className="text-xs text-slate-400 shrink-0">
                            {new Date(res.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </time>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div className="shrink-0 px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                {participants.some(p => p.user_email) && (
                  <button
                    type="button"
                    onClick={() => copyText(participants.map(p => p.user_email).filter(Boolean).join(', '), 'Email peserta')}
                    className="flex-1 h-11 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-2"
                  >
                    <Icon d={ICON.mail} /> Salin semua email
                  </button>
                )}
                <button type="button" onClick={() => setParticipantsOf(null)} className="flex-1 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold border-none cursor-pointer">
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </main>
  )
}
