import { supabase } from './supabaseClient'

export type ClassType = 'online' | 'offline'

export interface ClassSchedule {
  id: string
  type: ClassType
  title: string
  subtitle_chapter: string
  instructor_id: string
  instructor_name: string
  date: string // YYYY-MM-DD (start_date fallback)
  start_date?: string // YYYY-MM-DD (start of 3D2N offline or single day)
  end_date?: string // YYYY-MM-DD (end of 3D2N offline or single day)
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

/**
 * Bidirectional schedule ID matcher.
 * Handles the mismatch between localStorage string IDs (e.g. 'sch-online-1a')
 * and Supabase UUID IDs (e.g. '00000000-0000-0000-0001-000000000001').
 */
export function matchScheduleId(scheduleId: string, reservationScheduleId: string): boolean {
  if (!scheduleId || !reservationScheduleId) return false
  if (scheduleId === reservationScheduleId) return true
  // Check UUID form of scheduleId against reservationScheduleId
  const schUUID = ensureUUID(scheduleId, '00000000-0000-0000-0001-')
  if (schUUID === reservationScheduleId) return true
  // Check UUID form of reservationScheduleId against scheduleId
  const resUUID = ensureUUID(reservationScheduleId, '00000000-0000-0000-0001-')
  if (resUUID === scheduleId) return true
  return false
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


// Helper: Format YYYY-MM-DD to "Kamis, 8 Agustus 2026"
export function formatDateIndonesian(dateStr: string, lang: string = 'id'): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-').map(Number)
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return dateStr
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2])
  const locale = lang === 'ja' ? 'ja-JP' : lang === 'en' ? 'en-US' : 'id-ID'
  return dateObj.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

// Helper: Format Time string from HH:mm:ss to HH:mm (e.g. "12:00:00" -> "12:00")
export function formatTimeShort(timeStr: string | undefined): string {
  if (!timeStr) return ''
  const parts = timeStr.split(':')
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`
  }
  return timeStr
}

// Helper: Format Date Range for Multi-Day Schedules (e.g. 3 Hari 2 Malam)
export function formatDateRangeIndonesian(
  startDateStr: string,
  endDateStr: string | undefined,
  startTime: string,
  endTime: string,
  lang: string = 'id'
): { formattedRange: string; badgeLabel: string; dayCount: number } {
  if (!startDateStr) return { formattedRange: '', badgeLabel: '1 Hari', dayCount: 1 }

  const cleanStartTime = formatTimeShort(startTime)
  const cleanEndTime = formatTimeShort(endTime)

  const startFormatted = formatDateIndonesian(startDateStr, lang)
  if (!endDateStr || endDateStr === startDateStr) {
    return {
      formattedRange: `${startFormatted} (${cleanStartTime} - ${cleanEndTime} WIB)`,
      badgeLabel: '1 Hari',
      dayCount: 1,
    }
  }

  const endFormatted = formatDateIndonesian(endDateStr, lang)
  const d1 = new Date(startDateStr)
  const d2 = new Date(endDateStr)
  const diffTime = Math.abs(d2.getTime() - d1.getTime())
  const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1)
  const nights = Math.max(1, diffDays - 1)

  return {
    formattedRange: `${startFormatted} (${cleanStartTime} WIB) s/d ${endFormatted} (${cleanEndTime} WIB)`,
    badgeLabel: `${diffDays} Hari ${nights} Malam`,
    dayCount: diffDays,
  }
}

// Helper: Get human readable week label (e.g. "Minggu ke-1 Agustus 2026")
export function getWeekLabel(weekRangeIdOrDate: string, dateStr?: string): string {
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ]

  let targetDate: Date | null = null

  // 1. If explicit dateStr (YYYY-MM-DD) is provided
  if (dateStr && dateStr.includes('-')) {
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      targetDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
    }
  }

  // 2. If input is dateStr YYYY-MM-DD
  if (!targetDate && weekRangeIdOrDate.length === 10 && weekRangeIdOrDate.split('-').length === 3) {
    const parts = weekRangeIdOrDate.split('-')
    targetDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
  }

  // 3. If input is ISO week YYYY-Www (e.g. 2026-W34)
  if (!targetDate && weekRangeIdOrDate.includes('-W')) {
    const parts = weekRangeIdOrDate.split('-W')
    if (parts.length === 2) {
      const year = parseInt(parts[0], 10)
      const week = parseInt(parts[1], 10)
      const simple = new Date(year, 0, 1 + (week - 1) * 7)
      const dow = simple.getDay()
      const ISOweekStart = new Date(simple)
      if (dow <= 4) {
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1)
      } else {
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay())
      }
      targetDate = ISOweekStart
    }
  }

  if (!targetDate || isNaN(targetDate.getTime())) {
    return weekRangeIdOrDate
  }

  const weekNum = Math.ceil(targetDate.getDate() / 7)
  const monthName = monthNames[targetDate.getMonth()]
  const yearNum = targetDate.getFullYear()

  return `Minggu ke-${weekNum} ${monthName} ${yearNum}`
}

// Helper: Get human readable month label (e.g. "Bulan Agustus 2026")
export function getMonthLabel(monthRangeId: string): string {
  if (!monthRangeId || !monthRangeId.includes('-')) return monthRangeId
  const parts = monthRangeId.split('-')
  if (parts.length < 2) return monthRangeId
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ]
  const mIdx = parseInt(parts[1], 10) - 1
  if (mIdx >= 0 && mIdx < 12) {
    return `Bulan ${monthNames[mIdx]} ${parts[0]}`
  }
  return monthRangeId
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
  // 1. Fetch from Supabase DB first (Source of truth)
  try {
    const { data, error } = await supabase.from('class_schedules').select('*')
    if (!error && data) {
      const cleanedData = (data as ClassSchedule[]).map(s => ({
        ...s,
        start_time: formatTimeShort(s.start_time),
        end_time: formatTimeShort(s.end_time),
      }))
      const sortedData = sortSchedules(cleanedData)
      localStorage.setItem(LOCAL_SCHEDULES_KEY, JSON.stringify(sortedData))
      return sortedData
    }
  } catch (e) {
    console.warn('DB fetchSchedules warning:', e)
  }

  // 2. Fallback to local storage if DB is unreachable
  const stored = localStorage.getItem(LOCAL_SCHEDULES_KEY)
  if (stored) {
    try {
      const parsed: ClassSchedule[] = JSON.parse(stored)
      const cleaned = parsed.map(s => ({
        ...s,
        start_time: formatTimeShort(s.start_time),
        end_time: formatTimeShort(s.end_time),
      }))
      return sortSchedules(cleaned)
    } catch {
      // Fallback
    }
  }
  return []
}

export async function fetchReservations(): Promise<ClassReservation[]> {
  // 1. Fetch from Supabase DB first (Source of truth)
  try {
    const { data, error } = await supabase.from('class_reservations').select('*')
    if (!error && data) {
      const realData = (data as ClassReservation[]).filter(
        r => !r.id.startsWith('res-demo-') && !r.user_email?.includes('@example.com')
      )
      localStorage.setItem(LOCAL_RESERVATIONS_KEY, JSON.stringify(realData))
      return realData
    }
  } catch (e) {
    console.warn('DB fetchReservations warning:', e)
  }

  // 2. Fallback to local storage
  return getInitialReservations()
}

export async function saveSchedule(scheduleData: Omit<ClassSchedule, 'id' | 'created_at' | 'week_range_id' | 'month_range_id'>): Promise<ClassSchedule> {
  const week_range_id = getWeekRangeId(scheduleData.date)
  const month_range_id = getMonthRangeId(scheduleData.date)

  const dbScheduleId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : ensureUUID(`sch-${Date.now()}-${Math.random()}`, '00000000-0000-0000-0001-')
  const dbInstructorId = ensureUUID(scheduleData.instructor_id, '00000000-0000-0000-0000-')
  const createdAt = new Date().toISOString()

  const startDate = scheduleData.start_date || scheduleData.date
  const endDate = scheduleData.end_date || startDate

  const payload = {
    id: dbScheduleId,
    type: scheduleData.type,
    title: scheduleData.title,
    subtitle_chapter: scheduleData.subtitle_chapter,
    instructor_id: dbInstructorId,
    instructor_name: scheduleData.instructor_name,
    date: startDate,
    start_date: startDate,
    end_date: endDate,
    start_time: scheduleData.start_time,
    end_time: scheduleData.end_time,
    week_range_id,
    month_range_id,
    meet_url: scheduleData.meet_url || null,
    location: scheduleData.location || null,
    max_quota: scheduleData.max_quota,
    created_at: createdAt,
  }

  // 1. Save directly to Supabase DB
  const { data: dbResult, error } = await supabase
    .from('class_schedules')
    .insert(payload)
    .select()
    .single()

  if (error) {
    console.error('saveSchedule Supabase DB error:', error)
    throw new Error(`Gagal menyimpan jadwal ke database: ${error.message || 'Error pada Supabase DB'}`)
  }

  const newSchedule: ClassSchedule = dbResult ? {
    id: dbResult.id,
    type: dbResult.type,
    title: dbResult.title,
    subtitle_chapter: dbResult.subtitle_chapter,
    instructor_id: dbResult.instructor_id,
    instructor_name: dbResult.instructor_name,
    date: dbResult.date,
    start_time: dbResult.start_time,
    end_time: dbResult.end_time,
    week_range_id: dbResult.week_range_id,
    month_range_id: dbResult.month_range_id,
    meet_url: dbResult.meet_url,
    location: dbResult.location,
    max_quota: dbResult.max_quota,
    created_at: dbResult.created_at,
  } : {
    ...scheduleData,
    id: dbScheduleId,
    week_range_id,
    month_range_id,
    created_at: createdAt,
  }

  // 2. Sync LocalStorage cache after DB write
  const current = await fetchSchedules()
  const updated = sortSchedules([newSchedule, ...current.filter(s => !matchScheduleId(s.id, newSchedule.id))])
  localStorage.setItem(LOCAL_SCHEDULES_KEY, JSON.stringify(updated))

  notifyScheduleChanged()
  return newSchedule
}

export async function updateSchedule(scheduleId: string, scheduleData: Partial<ClassSchedule>): Promise<ClassSchedule> {
  const targetId = scheduleId
  const dbScheduleId = ensureUUID(scheduleId, '00000000-0000-0000-0001-')

  const updatePayload: any = {}
  if (scheduleData.type) updatePayload.type = scheduleData.type
  if (scheduleData.title) updatePayload.title = scheduleData.title
  if (scheduleData.subtitle_chapter) updatePayload.subtitle_chapter = scheduleData.subtitle_chapter
  if (scheduleData.instructor_name) updatePayload.instructor_name = scheduleData.instructor_name
  if (scheduleData.start_date || scheduleData.date) {
    const sDate = scheduleData.start_date || scheduleData.date
    updatePayload.date = sDate
    updatePayload.start_date = sDate
    updatePayload.week_range_id = getWeekRangeId(sDate!)
    updatePayload.month_range_id = getMonthRangeId(sDate!)
  }
  if (scheduleData.end_date) updatePayload.end_date = scheduleData.end_date
  if (scheduleData.start_time) updatePayload.start_time = scheduleData.start_time
  if (scheduleData.end_time) updatePayload.end_time = scheduleData.end_time
  if (scheduleData.meet_url !== undefined) updatePayload.meet_url = scheduleData.meet_url || null
  if (scheduleData.location !== undefined) updatePayload.location = scheduleData.location || null
  if (scheduleData.max_quota) updatePayload.max_quota = scheduleData.max_quota

  // Update both raw targetId and mapped dbScheduleId in DB
  const [{ error: err1 }, { error: err2 }] = await Promise.all([
    supabase.from('class_schedules').update(updatePayload).eq('id', targetId),
    supabase.from('class_schedules').update(updatePayload).eq('id', dbScheduleId),
  ])

  if (err1 && err2) {
    console.error('updateSchedule Supabase DB error:', err1 || err2)
    throw new Error(`Gagal memperbarui jadwal di database: ${(err1 || err2)?.message || 'Error pada Supabase DB'}`)
  }

  // Refresh schedules from DB to update LocalStorage cache
  const refreshedSchedules = await fetchSchedules()
  notifyScheduleChanged()
  const updatedItem = refreshedSchedules.find(s => matchScheduleId(s.id, targetId))
  if (updatedItem) return updatedItem

  return {
    id: targetId,
    type: scheduleData.type || 'online',
    title: scheduleData.title || '',
    subtitle_chapter: scheduleData.subtitle_chapter || '',
    instructor_id: scheduleData.instructor_id || 'inst-1',
    instructor_name: scheduleData.instructor_name || '',
    date: scheduleData.date || '',
    start_time: scheduleData.start_time || '19:00',
    end_time: scheduleData.end_time || '20:30',
    week_range_id: scheduleData.date ? getWeekRangeId(scheduleData.date) : '',
    month_range_id: scheduleData.date ? getMonthRangeId(scheduleData.date) : '',
    meet_url: scheduleData.meet_url,
    location: scheduleData.location,
    max_quota: scheduleData.max_quota || 10,
    created_at: new Date().toISOString(),
  }
}

export async function deleteSchedule(scheduleId: string): Promise<void> {
  const targetId = scheduleId
  const dbScheduleId = ensureUUID(scheduleId, '00000000-0000-0000-0001-')

  // 1. Delete associated reservations in DB for both ID variants
  try {
    await Promise.all([
      supabase.from('class_reservations').delete().eq('schedule_id', targetId),
      supabase.from('class_reservations').delete().eq('schedule_id', dbScheduleId),
    ])
  } catch (e) {
    console.warn('DB delete class_reservations note:', e)
  }

  // 2. Delete schedule in DB for both raw targetId and mapped dbScheduleId unconditionally
  const [{ error: err1 }, { error: err2 }] = await Promise.all([
    supabase.from('class_schedules').delete().eq('id', targetId),
    supabase.from('class_schedules').delete().eq('id', dbScheduleId),
  ])

  if (err1 && err2) {
    console.error('deleteSchedule Supabase DB error:', err1 || err2)
    throw new Error(`Gagal menghapus jadwal dari database: ${(err1 || err2)?.message || 'Error pada Supabase DB'}`)
  }

  // 3. Re-query DB to sync local storage with actual database state
  const { data: dbSchedules, error: fetchErr } = await supabase.from('class_schedules').select('*')
  let updatedList: ClassSchedule[] = []

  if (!fetchErr && dbSchedules) {
    updatedList = sortSchedules(dbSchedules as ClassSchedule[])
  } else {
    const current = await fetchSchedules()
    updatedList = current.filter(s => !matchScheduleId(s.id, targetId))
  }

  // 4. Sync LocalStorage cache after DB delete
  localStorage.setItem(LOCAL_SCHEDULES_KEY, JSON.stringify(updatedList))

  const reservations = await fetchReservations()
  const updatedRes = reservations.filter(r => !matchScheduleId(r.schedule_id, targetId))
  localStorage.setItem(LOCAL_RESERVATIONS_KEY, JSON.stringify(updatedRes))

  notifyScheduleChanged()
}

export const RESERVATION_UPDATE_EVENT = 'kaiwa_reservation_updated'
export const SCHEDULE_UPDATE_EVENT = 'kaiwa_schedule_updated'

export function notifyScheduleChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SCHEDULE_UPDATE_EVENT))
    window.dispatchEvent(new CustomEvent(RESERVATION_UPDATE_EVENT))
  }
}

export function subscribeToScheduleRealtime(onUpdate: () => void) {
  if (typeof window === 'undefined') return () => {}

  const channel = supabase
    .channel('public_schedules_realtime_channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'class_schedules' }, () => {
      notifyScheduleChanged()
      onUpdate()
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'class_reservations' }, () => {
      notifyScheduleChanged()
      onUpdate()
    })
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

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

  // 2. Already booked check — match both raw ID and mapped UUID for reliability
  const dbScheduleId = ensureUUID(schedule.id, '00000000-0000-0000-0001-')
  const alreadyBooked = reservations.some(
    r => (r.schedule_id === schedule.id || r.schedule_id === dbScheduleId) && r.user_id === userId
  )
  if (alreadyBooked) {
    return { success: false, message: 'Anda sudah mendaftar di kelas ini.' }
  }

  // 3. Conflict Check (weekly online / monthly offline)
  if (schedule.type === 'online') {
    const targetWeekId = schedule.week_range_id || getWeekRangeId(schedule.date)
    const userWeeklyOnlineBookings = reservations.filter(r => {
      if (r.user_id !== userId) return false
      const targetSch = schedules.find(s => s.id === r.schedule_id || ensureUUID(s.id, '00000000-0000-0000-0001-') === r.schedule_id)
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
      const targetSch = schedules.find(s => s.id === r.schedule_id || ensureUUID(s.id, '00000000-0000-0000-0001-') === r.schedule_id)
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

  // ── Attempt to save to Supabase DB first (source of truth) ──
  const newReservationId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : ensureUUID(`res-${Date.now()}-${Math.random()}`, '00000000-0000-0000-0003-')

  const createdAt = new Date().toISOString()

  let savedToDb = false
  let finalReservation: ClassReservation = {
    id: newReservationId,
    schedule_id: schedule.id,
    user_id: userId,
    user_name: userName,
    user_email: userEmail,
    created_at: createdAt,
  }

  try {
    // 1. Ensure the class schedule row exists in DB before reserving
    const { data: existingSch } = await supabase
      .from('class_schedules')
      .select('id')
      .eq('id', dbScheduleId)
      .maybeSingle()

    if (!existingSch) {
      await supabase.from('class_schedules').insert({
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
        created_at: schedule.created_at || createdAt,
      })
    }

    // 2. Insert reservation — RLS requires auth.uid() = user_id
    //    We use the real userId from Supabase Auth (passed in by the caller)
    const dbPayload = {
      id: newReservationId,
      schedule_id: dbScheduleId,
      user_id: userId,  // Must be real auth.uid() for RLS to pass
      user_name: userName,
      user_email: userEmail,
      created_at: createdAt,
    }
    const { data: insertedRow, error: insertError } = await supabase
      .from('class_reservations')
      .insert(dbPayload)
      .select()
      .single()

    if (insertError) {
      console.warn('DB insert class_reservations error:', insertError.message)
    } else if (insertedRow) {
      savedToDb = true
      // Use the DB row as canonical source — schedule_id may differ (hashed UUID vs original)
      finalReservation = {
        id: insertedRow.id,
        schedule_id: insertedRow.schedule_id,
        user_id: insertedRow.user_id,
        user_name: insertedRow.user_name,
        user_email: insertedRow.user_email,
        created_at: insertedRow.created_at,
      }
    }
  } catch (e) {
    console.warn('bookClass DB catch:', e)
  }

  // ── Always update localStorage for instant local UI feedback ──
  const updatedReservations = [finalReservation, ...reservations]
  localStorage.setItem(LOCAL_RESERVATIONS_KEY, JSON.stringify(updatedReservations))

  // Dispatch window event for instant same-browser sync
  window.dispatchEvent(new CustomEvent(RESERVATION_UPDATE_EVENT, { detail: finalReservation }))

  const message = savedToDb
    ? 'Reservasi kelas berhasil! Data tersimpan ke server.'
    : 'Reservasi dicatat (akan disinkronkan saat koneksi tersedia).'

  return { success: true, message, reservation: finalReservation }
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

// Helper: Check if a schedule is active on a specific date (handles multi-day 3D2N offline classes)
export function isScheduleActiveOnDate(sch: ClassSchedule, dateStr: string): boolean {
  if (!sch || !dateStr) return false
  const sDate = sch.start_date || sch.date
  const eDate = sch.end_date || sDate
  return dateStr >= sDate && dateStr <= eDate
}

// Calculate schedule status for a calendar date
export function calculateDateScheduleStatus(
  dateStr: string,
  userId: string,
  allSchedules: ClassSchedule[],
  allReservations: ClassReservation[]
): DateScheduleStatus {
  const daySchedules = sortSchedules(allSchedules.filter(s => isScheduleActiveOnDate(s, dateStr)))

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

  // Use matchScheduleId for bidirectional ID matching (handles UUID vs string mismatch)
  const isOnlineBooked = onlineSchedules.some(sch =>
    allReservations.some(r => matchScheduleId(sch.id, r.schedule_id) && r.user_id === userId)
  )

  const isOfflineBooked = offlineSchedules.some(sch =>
    allReservations.some(r => matchScheduleId(sch.id, r.schedule_id) && r.user_id === userId)
  )

  const isBooked = isOnlineBooked || isOfflineBooked

  let onlineCanEnroll = false
  let onlineLockReason: 'full' | 'week_locked' | undefined

  for (const sch of onlineSchedules) {
    const enrolled = allReservations.filter(r => matchScheduleId(sch.id, r.schedule_id)).length
    const isFull = enrolled >= sch.max_quota
    const schWeekId = sch.week_range_id || getWeekRangeId(sch.date)
    const locked = allReservations.some(r => {
      if (r.user_id !== userId) return false
      const targetSch = allSchedules.find(s => matchScheduleId(s.id, r.schedule_id))
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
    const enrolled = allReservations.filter(r => matchScheduleId(sch.id, r.schedule_id)).length
    const isFull = enrolled >= sch.max_quota
    const schMonthId = sch.month_range_id || getMonthRangeId(sch.date)
    const locked = allReservations.some(r => {
      if (r.user_id !== userId) return false
      const targetSch = allSchedules.find(s => matchScheduleId(s.id, r.schedule_id))
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

