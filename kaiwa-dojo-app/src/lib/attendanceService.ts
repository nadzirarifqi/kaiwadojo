import { supabase } from './supabaseClient'

/**
 * Rekap kehadiran pelajar berdasarkan login / aktivitas harian.
 * Data dicatat server di tabel student_daily_logins (lihat api/lib/attendance.php).
 */

export type AttendanceCategory = 'Sangat Aktif' | 'Aktif' | 'Kurang Aktif' | 'Pasif'

export interface AttendanceStudent {
  id: string
  full_name: string
  username: string
  email: string | null
  phone_number: string | null
  group_name: string | null
  institution: string | null
  status: string
  present_days: number
  percentage: number
  category: AttendanceCategory
  last_seen_at: string | null
  /** Total menit aktif selama periode (akumulasi heartbeat ~10 menit) */
  total_active_minutes: number
  /** tanggal (YYYY-MM-DD) → { time: "HH:MM", mins: number } jika hadir, atau null */
  days: Record<string, { time: string; mins: number } | null>
}

export interface AttendanceReport {
  start: string
  end: string
  timezone: string
  total_days: number
  dates: string[]
  present_per_date: Record<string, number>
  students: AttendanceStudent[]
}

export interface AttendanceQuery {
  start: string
  end: string
  /** 'all' | nama grup | '__no_group__' */
  group: string
  include_unapproved: boolean
}

function errorMessage(res: any, fallback: string): string {
  return res?.error?.message || (typeof res?.error === 'string' ? res.error : '') || fallback
}

export async function compileAttendance(q: AttendanceQuery): Promise<AttendanceReport> {
  const res = await supabase.rpc('admin_compile_attendance', q)
  if (res?.error || !res?.data) throw new Error(errorMessage(res, 'Gagal memuat rekap kehadiran'))
  return res.data as AttendanceReport
}

export async function pushAttendanceToSheet(q: AttendanceQuery): Promise<{ students: number; days: number; sheet_url: string | null }> {
  const res = await supabase.rpc('admin_push_attendance_sheet', q)
  if (res?.error || !res?.data) throw new Error(errorMessage(res, 'Gagal mengirim ke Google Sheets'))
  return res.data
}

const TOUCH_KEY = 'kaiwa_last_attendance_touch'
const TOUCH_INTERVAL_MS = 10 * 60 * 1000

/**
 * Tandai pengguna "hadir hari ini". Dipanggil dari heartbeat aktivitas;
 * dibatasi 1x per 10 menit (atau segera saat tanggal berganti).
 * Setiap panggilan menambahkan ~10 menit ke kolom active_minutes.
 */
export async function touchAttendance(userId: string): Promise<void> {
  if (!userId) return
  const now = Date.now()
  const today = toDateKey(new Date())
  let isFirstTouch = false
  try {
    const [lastUser, lastDate, lastTs] = (localStorage.getItem(TOUCH_KEY) || '').split('|')
    if (lastUser === userId && lastDate === today && now - Number(lastTs || 0) < TOUCH_INTERVAL_MS) return
    isFirstTouch = lastUser !== userId || lastDate !== today
    localStorage.setItem(TOUCH_KEY, `${userId}|${today}|${now}`)
  } catch {
    // storage tidak tersedia → tetap kirim
  }
  try {
    // Touch pertama hari itu = 0 menit (baru login), berikutnya +10 menit per interval
    await supabase.rpc('touch_attendance', { add_minutes: isFirstTouch ? 0 : 10 })
  } catch {}
}

/** Tanggal lokal → "YYYY-MM-DD" */
export function toDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Format menit → "2j 30m", atau "-" jika 0 */
export function formatActiveDuration(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return '-'
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  return m > 0 ? `${h}j ${m}m` : `${h}j`
}

/** Ambil jam masuk dari data day (backward-compatible: string lama atau objek baru) */
export function getDayTime(day: { time: string; mins: number } | string | null | undefined): string | null {
  if (!day) return null
  if (typeof day === 'string') return day
  return day.time || null
}

/** Ambil menit aktif dari data day */
export function getDayMins(day: { time: string; mins: number } | string | null | undefined): number {
  if (!day || typeof day === 'string') return 0
  return day.mins || 0
}

export function attendanceToCsv(report: AttendanceReport, rows: AttendanceStudent[] = report.students): string {
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = ['No', 'Nama Siswa', 'Username', 'Grup', 'Hadir (hari)', '% Hadir', 'Durasi Aktif', 'Kategori', 'Terakhir Aktif', ...report.dates]
  const lines = rows.map((s, i) => [
    i + 1,
    s.full_name,
    s.username,
    s.group_name || 'Siswa Biasa',
    s.present_days,
    `${s.percentage}%`,
    formatActiveDuration(s.total_active_minutes),
    s.category,
    s.last_seen_at || '',
    ...report.dates.map(d => getDayTime(s.days[d]) || ''),
  ])
  return '﻿' + [header, ...lines].map(r => r.map(cell).join(',')).join('\n')
}
