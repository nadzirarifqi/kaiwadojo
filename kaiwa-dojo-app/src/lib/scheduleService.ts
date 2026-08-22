import { supabase } from './supabaseClient'

export type ClassType = 'online' | 'offline'

export interface ClassSchedule {
  id: string
  type: ClassType
  title: string
  subtitle_chapter: string
  instructor_id: string
  instructor_name: string
  date: string // YYYY-MM-DD
  start_time: string // HH:mm
  end_time: string // HH:mm
  week_range_id: string // e.g. 2026-W34
  month_range_id: string // e.g. 2026-08
  meet_url?: string
  location?: string
  max_quota: number
  created_at: string
}

export interface ClassReservation {
  id: string
  schedule_id: string
  user_id: string
  user_name: string
  user_email: string
  created_at: string
}

export interface DateScheduleStatus {
  hasSchedule: boolean
  isBooked: boolean
  canEnroll: boolean
  availableCount: number
  schedules: ClassSchedule[]
  lockReason?: 'full' | 'week_locked' | 'month_locked'

  hasOnline: boolean
  hasOffline: boolean
  isOnlineBooked: boolean
  isOfflineBooked: boolean
  onlineCount: number
  offlineCount: number
  onlineCanEnroll: boolean
  offlineCanEnroll: boolean
}


const LOCAL_SCHEDULES_KEY = 'kaiwa_class_schedules'
const LOCAL_RESERVATIONS_KEY = 'kaiwa_class_reservations'

export function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

export function ensureUUID(id: string, defaultPrefix = '00000000-0000-0000-0000-'): string {
  if (!id) return `${defaultPrefix}000000000001`
  if (isUUID(id)) return id

  // Map known demo IDs to seeded Postgres UUIDs
  if (id === 'inst-1' || id === 'tanakasensei') return '00000000-0000-0000-0000-000000000001'
  if (id === 'inst-2' || id === 'kenjisensei') return '00000000-0000-0000-0000-000000000002'
  if (id === 'inst-3' || id === 'yukisensei') return '00000000-0000-0000-0000-000000000003'
  if (id === 'user-demo-active' || id === 'budisantoso') return '00000000-0000-0000-0000-000000000099'

  if (id === 'sch-online-1a') return '00000000-0000-0000-0001-000000000001'
  if (id === 'sch-online-1b') return '00000000-0000-0000-0001-000000000002'
  if (id === 'sch-online-2a') return '00000000-0000-0000-0001-000000000003'
  if (id === 'sch-online-2b') return '00000000-0000-0000-0001-000000000004'
  if (id === 'sch-offline-1a') return '00000000-0000-0000-0001-000000000005'
  if (id === 'sch-online-5a') return '00000000-0000-0000-0001-000000000006'
  if (id === 'sch-online-8') return '00000000-0000-0000-0001-000000000007'
  if (id === 'sch-offline-2') return '00000000-0000-0000-0001-000000000008'

  // Hash string into a valid 12-char hex for UUID suffix
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i)
    hash |= 0
  }
  const hex = Math.abs(hash).toString(16).padStart(12, '0').substring(0, 12)
  return `${defaultPrefix}${hex}`
}

// Helper: Calculate ISO Week ID (e.g. 2026-W34)
export function getWeekRangeId(dateStr: string): string {
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)

  const d = new Date(year, month, day)
  d.setHours(0, 0, 0, 0)
  const dayNum = d.getDay() || 7
  d.setDate(d.getDate() + 4 - dayNum)

  const yearStart = new Date(d.getFullYear(), 0, 1)
  yearStart.setHours(0, 0, 0, 0)
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  const weekStr = String(weekNo).padStart(2, '0')
  return `${d.getFullYear()}-W${weekStr}`
}


// Helper: Get human readable week label
export function getWeekLabel(weekRangeId: string): string {
  const parts = weekRangeId.split('-W')
  if (parts.length !== 2) return weekRangeId
  return `Minggu Ke-${parseInt(parts[1], 10)} (${parts[0]})`
}

// Helper: Calculate Month ID (e.g. 2026-08)
export function getMonthRangeId(dateStr: string): string {
  return dateStr.substring(0, 7)
}

// Seed initial mock data if not present in localStorage
export function getInitialSchedules(): ClassSchedule[] {
  const today = new Date()
  const formatDate = (offsetDays: number) => {
    const d = new Date(today)
    d.setDate(today.getDate() + offsetDays)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const dateTomorrow = formatDate(1)
  const dateDay3 = formatDate(3)
  const dateDay5 = formatDate(5)
  const dateDay8 = formatDate(8)
  const dateDay12 = formatDate(12)

  const initial: ClassSchedule[] = [
    // ── TANGGAL 1 (BESOK): 2 Kelas di Jam Berbeda ──
    {
      id: 'sch-online-1a',
      type: 'online',
      title: 'Kaiwa Special: Percakapan Bahasa Jepang Sehari-hari',
      subtitle_chapter: 'Bab 4: Memesan Makanan di Restoran & Etika Makan (Sesi Pagi)',
      instructor_id: 'inst-1',
      instructor_name: 'Tanaka Sensei',
      date: dateTomorrow,
      start_time: '10:00',
      end_time: '11:30',
      week_range_id: getWeekRangeId(dateTomorrow),
      month_range_id: getMonthRangeId(dateTomorrow),
      meet_url: 'https://meet.google.com/abc-kaiwa-morning',
      max_quota: 10,
      created_at: new Date().toISOString(),
    },
    {
      id: 'sch-online-1b',
      type: 'online',
      title: 'Grammar Bootcamp: Pola Kalimat N4 & Kaiwa Praktis',
      subtitle_chapter: 'Bab 7: Penggunaan Pola ~te morau & ~te kureru (Sesi Malam)',
      instructor_id: 'inst-2',
      instructor_name: 'Kenji Sensei',
      date: dateTomorrow,
      start_time: '19:00',
      end_time: '20:30',
      week_range_id: getWeekRangeId(dateTomorrow),
      month_range_id: getMonthRangeId(dateTomorrow),
      meet_url: 'https://meet.google.com/xyz-kaiwa-night',
      max_quota: 10,
      created_at: new Date().toISOString(),
    },

    // ── TANGGAL 2 (+3 HARI): 2 Kelas di Jam Berbeda ──
    {
      id: 'sch-online-2a',
      type: 'online',
      title: 'Listening & Shadowing Kaiwa Lab',
      subtitle_chapter: 'Bab 9: Teknik Mendengar Cepat & Intonasi Alami (Sesi Siang)',
      instructor_id: 'inst-2',
      instructor_name: 'Kenji Sensei',
      date: dateDay3,
      start_time: '14:00',
      end_time: '15:30',
      week_range_id: getWeekRangeId(dateDay3),
      month_range_id: getMonthRangeId(dateDay3),
      meet_url: 'https://meet.google.com/shadowing-lab',
      max_quota: 10,
      created_at: new Date().toISOString(),
    },
    {
      id: 'sch-online-2b',
      type: 'online',
      title: 'Business Japanese: Presentasi & Etika Kantor',
      subtitle_chapter: 'Bab 12: Keigo dalam Email & Diskusi Tim (Sesi Malam)',
      instructor_id: 'inst-3',
      instructor_name: 'Yuki Sensei',
      date: dateDay3,
      start_time: '19:30',
      end_time: '21:00',
      week_range_id: getWeekRangeId(dateDay3),
      month_range_id: getMonthRangeId(dateDay3),
      meet_url: 'https://meet.google.com/biz-keigo-night',
      max_quota: 10,
      created_at: new Date().toISOString(),
    },

    // ── TANGGAL 3 (+5 HARI): 1 Offline + 1 Online di Jam Berbeda ──
    {
      id: 'sch-offline-1a',
      type: 'offline',
      title: 'Workshop Budaya & Practice Room Kaiwa Dojo',
      subtitle_chapter: 'Bab 10: Simulasi Percakapan Langsung & Ocha Ceremony (Pagi)',
      instructor_id: 'inst-3',
      instructor_name: 'Yuki Sensei',
      date: dateDay5,
      start_time: '10:00',
      end_time: '13:00',
      week_range_id: getWeekRangeId(dateDay5),
      month_range_id: getMonthRangeId(dateDay5),
      location: 'Kaiwa Dojo Center, Room A (Jl. Sudirman No. 12, Jakarta)',
      max_quota: 10,
      created_at: new Date().toISOString(),
    },
    {
      id: 'sch-online-5a',
      type: 'online',
      title: 'Free Talk Kaiwa & Discussion Club',
      subtitle_chapter: 'Bab 14: Topik Bebas, Hobi & Budaya Populer (Sore)',
      instructor_id: 'inst-1',
      instructor_name: 'Tanaka Sensei',
      date: dateDay5,
      start_time: '16:00',
      end_time: '17:30',
      week_range_id: getWeekRangeId(dateDay5),
      month_range_id: getMonthRangeId(dateDay5),
      meet_url: 'https://meet.google.com/freetalk-session',
      max_quota: 10,
      created_at: new Date().toISOString(),
    },

    // ── TANGGAL LAIN ──
    {
      id: 'sch-online-8',
      type: 'online',
      title: 'Kanji & Vocabulary in Context',
      subtitle_chapter: 'Bab 18: Penggunaan Kanji N4 dalam Skenario Nyata',
      instructor_id: 'inst-1',
      instructor_name: 'Tanaka Sensei',
      date: dateDay8,
      start_time: '19:00',
      end_time: '20:30',
      week_range_id: getWeekRangeId(dateDay8),
      month_range_id: getMonthRangeId(dateDay8),
      meet_url: 'https://meet.google.com/kanji-n4-live',
      max_quota: 10,
      created_at: new Date().toISOString(),
    },
    {
      id: 'sch-offline-2',
      type: 'offline',
      title: 'JLPT N3 Kaiwa & Listening Lab Offline',
      subtitle_chapter: 'Bab 15: Latihan Pendengaran Cepat & Roleplay Interaktif',
      instructor_id: 'inst-2',
      instructor_name: 'Kenji Sensei',
      date: dateDay12,
      start_time: '13:30',
      end_time: '16:00',
      week_range_id: getWeekRangeId(dateDay12),
      month_range_id: getMonthRangeId(dateDay12),
      location: 'Kaiwa Dojo Lab 2 (Jl. Asia Afrika No. 45, Bandung)',
      max_quota: 10,
      created_at: new Date().toISOString(),
    },
  ]

  localStorage.setItem(LOCAL_SCHEDULES_KEY, JSON.stringify(initial))
  return initial
}

export function getInitialReservations(): ClassReservation[] {
  const stored = localStorage.getItem(LOCAL_RESERVATIONS_KEY)
  if (stored) {
    try {
      const parsed: ClassReservation[] = JSON.parse(stored)
      // Filter out any legacy fake demo mock reservations (res-demo-1, res-demo-2, Siswa A/B/C, etc.)
      const realOnly = parsed.filter(r => !r.id.startsWith('res-demo-') && !r.user_email.includes('@example.com'))
      localStorage.setItem(LOCAL_RESERVATIONS_KEY, JSON.stringify(realOnly))
      return realOnly
    } catch {
      // Fallback
    }
  }

  const empty: ClassReservation[] = []
  localStorage.setItem(LOCAL_RESERVATIONS_KEY, JSON.stringify(empty))
  return empty
}


// ── CRUD Functions ──

// Helper: Sort schedules (Offline first, then Online, then Date, then Start Time)
export function sortSchedules(schedules: ClassSchedule[]): ClassSchedule[] {
  return [...schedules].sort((a, b) => {
    // 1. Class type: Offline (0) comes before Online (1)
    if (a.type !== b.type) {
      return a.type === 'offline' ? -1 : 1
    }
    // 2. Date ascending
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date)
    }
    // 3. Start time ascending
    return a.start_time.localeCompare(b.start_time)
  })
}

// Seed initial schedules to DB if table is empty
export async function seedInitialSchedulesIfEmpty() {
  try {
    const { data } = await supabase.from('class_schedules').select('id').limit(1)
    if (!data || data.length === 0) {
      const initials = getInitialSchedules()
      const dbRows = initials.map(s => ({
        id: ensureUUID(s.id, '00000000-0000-0000-0001-'),
        type: s.type,
        title: s.title,
        subtitle_chapter: s.subtitle_chapter,
        instructor_id: ensureUUID(s.instructor_id, '00000000-0000-0000-0000-'),
        instructor_name: s.instructor_name,
        date: s.date,
        start_time: s.start_time,
        end_time: s.end_time,
        week_range_id: s.week_range_id,
        month_range_id: s.month_range_id,
        meet_url: s.meet_url || null,
        location: s.location || null,
        max_quota: s.max_quota,
        created_at: s.created_at,
      }))
      await supabase.from('class_schedules').upsert(dbRows, { onConflict: 'id' })
    }
  } catch (e) {
    console.warn('Seed initial schedules catch:', e)
  }
}

export async function fetchSchedules(): Promise<ClassSchedule[]> {
  try {
    const { data, error } = await supabase.from('class_schedules').select('*')
    if (!error && data && data.length > 0) {
      const sortedData = sortSchedules(data as ClassSchedule[])
      localStorage.setItem(LOCAL_SCHEDULES_KEY, JSON.stringify(sortedData))
      return sortedData
    }
  } catch {
    // Fallback to local
  }
  await seedInitialSchedulesIfEmpty()
  return sortSchedules(getInitialSchedules())
}

export async function fetchReservations(): Promise<ClassReservation[]> {
  try {
    const { data, error } = await supabase.from('class_reservations').select('*')
    if (!error && data) {
      const realData = (data as ClassReservation[]).filter(r => !r.id.startsWith('res-demo-') && !r.user_email?.includes('@example.com'))
      localStorage.setItem(LOCAL_RESERVATIONS_KEY, JSON.stringify(realData))
      return realData
    }
  } catch {
    // Fallback
  }
  return getInitialReservations()
}

export async function saveSchedule(scheduleData: Omit<ClassSchedule, 'id' | 'created_at' | 'week_range_id' | 'month_range_id'>): Promise<ClassSchedule> {
  const week_range_id = getWeekRangeId(scheduleData.date)
  const month_range_id = getMonthRangeId(scheduleData.date)

  const rawId = `sch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  const newSchedule: ClassSchedule = {
    ...scheduleData,
    id: rawId,
    week_range_id,
    month_range_id,
    created_at: new Date().toISOString(),
  }

  // Save to local
  const current = await fetchSchedules()
  const updated = [newSchedule, ...current]
  localStorage.setItem(LOCAL_SCHEDULES_KEY, JSON.stringify(updated))

  // Try DB insert async
  try {
    const dbScheduleId = ensureUUID(newSchedule.id, '00000000-0000-0000-0001-')
    const dbInstructorId = ensureUUID(newSchedule.instructor_id, '00000000-0000-0000-0000-')
    await supabase.from('class_schedules').insert({
      id: dbScheduleId,
      type: newSchedule.type,
      title: newSchedule.title,
      subtitle_chapter: newSchedule.subtitle_chapter,
      instructor_id: dbInstructorId,
      instructor_name: newSchedule.instructor_name,
      date: newSchedule.date,
      start_time: newSchedule.start_time,
      end_time: newSchedule.end_time,
      week_range_id: newSchedule.week_range_id,
      month_range_id: newSchedule.month_range_id,
      meet_url: newSchedule.meet_url || null,
      location: newSchedule.location || null,
      max_quota: newSchedule.max_quota,
      created_at: newSchedule.created_at,
    })
  } catch (e) {
    console.warn('saveSchedule DB catch:', e)
  }

  return newSchedule
}

export async function deleteSchedule(scheduleId: string): Promise<void> {
  const current = await fetchSchedules()
  const updated = current.filter(s => s.id !== scheduleId)
  localStorage.setItem(LOCAL_SCHEDULES_KEY, JSON.stringify(updated))

  const reservations = await fetchReservations()
  const updatedRes = reservations.filter(r => r.schedule_id !== scheduleId)
  localStorage.setItem(LOCAL_RESERVATIONS_KEY, JSON.stringify(updatedRes))

  try {
    const dbScheduleId = ensureUUID(scheduleId, '00000000-0000-0000-0001-')
    await supabase.from('class_schedules').delete().eq('id', dbScheduleId)
    await supabase.from('class_schedules').delete().eq('id', scheduleId)
  } catch {
    // Silent fallback
  }
}

export const RESERVATION_UPDATE_EVENT = 'kaiwa_reservation_updated'

export async function bookClass(
  schedule: ClassSchedule,
  userId: string,
  userName: string,
  userEmail: string
): Promise<{ success: boolean; message: string; reservation?: ClassReservation }> {
  const schedules = await fetchSchedules()
  const reservations = await fetchReservations()

  // 1. Quota Check (Max 10 per class)
  const currentEnrolled = reservations.filter(r => r.schedule_id === schedule.id)
  if (currentEnrolled.length >= schedule.max_quota) {
    return { success: false, message: `Kuota kelas sudah penuh (Maksimal ${schedule.max_quota} orang per kelas).` }
  }

  // 2. Already booked check
  const alreadyBooked = reservations.some(r => r.schedule_id === schedule.id && r.user_id === userId)
  if (alreadyBooked) {
    return { success: false, message: 'Anda sudah mendaftar di kelas ini.' }
  }

  // 3. Conflict Check
  if (schedule.type === 'online') {
    const targetWeekId = schedule.week_range_id || getWeekRangeId(schedule.date)
    const userWeeklyOnlineBookings = reservations.filter(r => {
      if (r.user_id !== userId) return false
      const targetSch = schedules.find(s => s.id === r.schedule_id)
      if (!targetSch || targetSch.type !== 'online') return false
      const schWeekId = targetSch.week_range_id || getWeekRangeId(targetSch.date)
      return schWeekId === targetWeekId
    })

    if (userWeeklyOnlineBookings.length > 0) {
      return {
        success: false,
        message: `Anda sudah mendaftar 1 kelas online pada ${getWeekLabel(targetWeekId)}. Sesuai aturan, Anda hanya bisa memilih 1 jadwal online per minggu.`,
      }
    }
  }

  if (schedule.type === 'offline') {
    const targetMonthId = schedule.month_range_id || getMonthRangeId(schedule.date)
    const userMonthlyOfflineBookings = reservations.filter(r => {
      if (r.user_id !== userId) return false
      const targetSch = schedules.find(s => s.id === r.schedule_id)
      if (!targetSch || targetSch.type !== 'offline') return false
      const schMonthId = targetSch.month_range_id || getMonthRangeId(targetSch.date)
      return schMonthId === targetMonthId
    })

    if (userMonthlyOfflineBookings.length > 0) {
      return {
        success: false,
        message: 'Anda sudah mendaftar 1 kelas offline untuk bulan ini. Sesuai aturan, Anda hanya bisa memilih 1 jadwal offline per bulan.',
      }
    }
  }

  // Create Reservation
  const dbReservationId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : ensureUUID(`res-${Date.now()}-${Math.random()}`, '00000000-0000-0000-0003-')
  const dbScheduleId = ensureUUID(schedule.id, '00000000-0000-0000-0001-')
  const dbUserId = ensureUUID(userId, '00000000-0000-0000-0009-')

  const newReservation: ClassReservation = {
    id: dbReservationId,
    schedule_id: schedule.id,
    user_id: userId,
    user_name: userName,
    user_email: userEmail,
    created_at: new Date().toISOString(),
  }

  const updatedReservations = [newReservation, ...reservations]
  localStorage.setItem(LOCAL_RESERVATIONS_KEY, JSON.stringify(updatedReservations))

  // Dispatch custom window event for instant local tab sync
  window.dispatchEvent(new CustomEvent(RESERVATION_UPDATE_EVENT, { detail: newReservation }))

  // Ensure schedule row exists in Supabase DB first
  try {
    await supabase.from('class_schedules').upsert({
      id: dbScheduleId,
      type: schedule.type,
      title: schedule.title,
      subtitle_chapter: schedule.subtitle_chapter,
      instructor_id: ensureUUID(schedule.instructor_id, '00000000-0000-0000-0000-'),
      instructor_name: schedule.instructor_name,
      date: schedule.date,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      week_range_id: schedule.week_range_id || getWeekRangeId(schedule.date),
      month_range_id: schedule.month_range_id || getMonthRangeId(schedule.date),
      meet_url: schedule.meet_url || null,
      location: schedule.location || null,
      max_quota: schedule.max_quota,
      created_at: schedule.created_at || new Date().toISOString(),
    }, { onConflict: 'id' })

    // Ensure user profile exists in Supabase DB
    await supabase.from('profiles').upsert({
      id: dbUserId,
      full_name: userName,
      username: userEmail.split('@')[0] || 'user',
      email: userEmail,
      role: 'pelajar',
    }, { onConflict: 'id' })

    // Save reservation to Supabase DB
    const dbPayload = {
      id: dbReservationId,
      schedule_id: dbScheduleId,
      user_id: dbUserId,
      user_name: userName,
      user_email: userEmail,
      created_at: newReservation.created_at,
    }
    const { error } = await supabase.from('class_reservations').insert(dbPayload)
    if (error) {
      console.warn('DB insert class_reservations note:', error)
    }
  } catch (e) {
    console.warn('DB insert class_reservations catch:', e)
  }

  return { success: true, message: 'Reservasi kelas berhasil!', reservation: newReservation }
}

export async function cancelClassBooking(reservationId: string): Promise<boolean> {
  const reservations = await fetchReservations()
  const targetRes = reservations.find(r => r.id === reservationId)
  const updated = reservations.filter(r => r.id !== reservationId)
  localStorage.setItem(LOCAL_RESERVATIONS_KEY, JSON.stringify(updated))

  // Dispatch custom window event for instant local tab sync
  window.dispatchEvent(new CustomEvent(RESERVATION_UPDATE_EVENT, { detail: reservationId }))

  const dbReservationId = ensureUUID(reservationId, '00000000-0000-0000-0003-')

  try {
    await supabase.from('class_reservations').delete().eq('id', dbReservationId)
    await supabase.from('class_reservations').delete().eq('id', reservationId)
    if (targetRes) {
      const dbScheduleId = ensureUUID(targetRes.schedule_id, '00000000-0000-0000-0001-')
      const dbUserId = ensureUUID(targetRes.user_id, '00000000-0000-0000-0009-')
      await supabase.from('class_reservations').delete().match({ schedule_id: dbScheduleId, user_id: dbUserId })
    }
  } catch (e) {
    console.warn('DB delete class_reservations catch:', e)
  }
  return true
}

// Monthly Online Class Requirement Check (Min 2 per month)
export async function getMonthlyOnlineRequirementStatus(userId: string, monthRangeId?: string): Promise<{
  bookedCount: number
  targetCount: number
  isFulfilled: boolean
  currentMonthLabel: string
}> {
  const currentMonth = monthRangeId || getMonthRangeId(new Date().toISOString().split('T')[0])
  const schedules = await fetchSchedules()
  const reservations = await fetchReservations()

  const userOnlineThisMonth = reservations.filter(r => {
    if (r.user_id !== userId) return false
    const sch = schedules.find(s => s.id === r.schedule_id)
    return sch && sch.type === 'online' && sch.month_range_id === currentMonth
  })

  const bookedCount = userOnlineThisMonth.length
  const targetCount = 2

  const dateObj = new Date()
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ]
  const currentMonthLabel = `${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`

  return {
    bookedCount,
    targetCount,
    isFulfilled: bookedCount >= targetCount,
    currentMonthLabel,
  }
}

// Calculate schedule status for a calendar date
export function calculateDateScheduleStatus(
  dateStr: string,
  userId: string,
  allSchedules: ClassSchedule[],
  allReservations: ClassReservation[]
): DateScheduleStatus {
  const daySchedules = sortSchedules(allSchedules.filter(s => s.date === dateStr))

  if (daySchedules.length === 0) {
    return {
      hasSchedule: false,
      isBooked: false,
      canEnroll: false,
      availableCount: 0,
      schedules: [],
      hasOnline: false,
      hasOffline: false,
      isOnlineBooked: false,
      isOfflineBooked: false,
      onlineCount: 0,
      offlineCount: 0,
      onlineCanEnroll: false,
      offlineCanEnroll: false,
    }
  }

  const onlineSchedules = daySchedules.filter(s => s.type === 'online')
  const offlineSchedules = daySchedules.filter(s => s.type === 'offline')

  const isOnlineBooked = onlineSchedules.some(sch =>
    allReservations.some(r => r.schedule_id === sch.id && r.user_id === userId)
  )

  const isOfflineBooked = offlineSchedules.some(sch =>
    allReservations.some(r => r.schedule_id === sch.id && r.user_id === userId)
  )

  const isBooked = isOnlineBooked || isOfflineBooked

  let onlineCanEnroll = false
  let onlineLockReason: 'full' | 'week_locked' | undefined

  for (const sch of onlineSchedules) {
    const enrolled = allReservations.filter(r => r.schedule_id === sch.id).length
    const isFull = enrolled >= sch.max_quota
    const schWeekId = sch.week_range_id || getWeekRangeId(sch.date)
    const locked = allReservations.some(r => {
      if (r.user_id !== userId) return false
      const targetSch = allSchedules.find(s => s.id === r.schedule_id)
      if (!targetSch || targetSch.type !== 'online') return false
      const targetWeekId = targetSch.week_range_id || getWeekRangeId(targetSch.date)
      return targetWeekId === schWeekId
    })
    if (locked) onlineLockReason = 'week_locked'
    else if (isFull) onlineLockReason = 'full'

    if (!isFull && !locked) {
      onlineCanEnroll = true
      break
    }
  }

  let offlineCanEnroll = false
  let offlineLockReason: 'full' | 'month_locked' | undefined

  for (const sch of offlineSchedules) {
    const enrolled = allReservations.filter(r => r.schedule_id === sch.id).length
    const isFull = enrolled >= sch.max_quota
    const schMonthId = sch.month_range_id || getMonthRangeId(sch.date)
    const locked = allReservations.some(r => {
      if (r.user_id !== userId) return false
      const targetSch = allSchedules.find(s => s.id === r.schedule_id)
      if (!targetSch || targetSch.type !== 'offline') return false
      const targetMonthId = targetSch.month_range_id || getMonthRangeId(targetSch.date)
      return targetMonthId === schMonthId
    })
    if (locked) offlineLockReason = 'month_locked'
    else if (isFull) offlineLockReason = 'full'

    if (!isFull && !locked) {
      offlineCanEnroll = true
      break
    }
  }

  const canEnroll = onlineCanEnroll || offlineCanEnroll
  const lockReason = onlineLockReason || offlineLockReason

  return {
    hasSchedule: true,
    isBooked,
    canEnroll,
    availableCount: daySchedules.length,
    schedules: daySchedules,
    lockReason: canEnroll ? undefined : lockReason,

    hasOnline: onlineSchedules.length > 0,
    hasOffline: offlineSchedules.length > 0,
    isOnlineBooked,
    isOfflineBooked,
    onlineCount: onlineSchedules.length,
    offlineCount: offlineSchedules.length,
    onlineCanEnroll,
    offlineCanEnroll,
  }
}

