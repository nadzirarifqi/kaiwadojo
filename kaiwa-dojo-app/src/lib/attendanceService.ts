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
  /** tanggal (YYYY-MM-DD) → jam masuk pertama "HH:MM", atau null bila tidak hadir */
  days: Record<string, string | null>
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
 */
export async function touchAttendance(userId: string): Promise<void> {
  if (!userId) return
  const now = Date.now()
  const today = toDateKey(new Date())
  try {
    const [lastUser, lastDate, lastTs] = (localStorage.getItem(TOUCH_KEY) || '').split('|')
    if (lastUser === userId && lastDate === today && now - Number(lastTs || 0) < TOUCH_INTERVAL_MS) return
    localStorage.setItem(TOUCH_KEY, `${userId}|${today}|${now}`)
  } catch {
    // storage tidak tersedia → tetap kirim
  }
  try {
    await supabase.rpc('touch_attendance', {})
  } catch {}
}

/** Tanggal lokal → "YYYY-MM-DD" */
export function toDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function attendanceToCsv(report: AttendanceReport, rows: AttendanceStudent[] = report.students): string {
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = ['No', 'Nama Siswa', 'Username', 'Grup', 'Hadir (hari)', '% Hadir', 'Kategori', 'Terakhir Aktif', ...report.dates]
  const lines = rows.map((s, i) => [
    i + 1,
    s.full_name,
    s.username,
    s.group_name || 'Siswa Biasa',
    s.present_days,
    `${s.percentage}%`,
    s.category,
    s.last_seen_at || '',
    ...report.dates.map(d => s.days[d] || ''),
  ])
  return '﻿' + [header, ...lines].map(r => r.map(cell).join(',')).join('\n')
}
