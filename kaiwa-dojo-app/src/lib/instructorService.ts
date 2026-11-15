import { supabase } from './supabaseClient'

/**
 * Akun pemateri/pengajar hanya bisa dibuat oleh admin (lewat halaman Kelola Pemateri)
 * atau secara manual di database. Pendaftaran publik selalu menghasilkan akun pelajar.
 */
export interface InstructorAccount {
  id: string
  full_name: string
  username: string
  email: string
  phone_number?: string
  role: 'pemateri'
  avatar_url?: string
  bio?: string
  expertise: string[]
  total_students: number
  last_active_at?: string | null
  created_at: string
}

export interface InstructorInput {
  full_name: string
  username: string
  email: string
  phone_number?: string
  /** Wajib saat membuat akun; saat edit, kosongkan jika tidak ingin mengganti password. */
  password?: string
  bio?: string
  expertise?: string[]
}

const LOCAL_INSTRUCTORS_KEY = 'kaiwa_instructor_accounts_v1'

const INSTRUCTOR_LIST_COLUMNS = [
  'id', 'full_name', 'username', 'email', 'phone_number',
  'avatar_url', 'bio', 'last_active_at', 'created_at',
].join(', ')

function parseExpertise(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
    } catch {
      return raw.split(',').map(s => s.trim()).filter(Boolean)
    }
  }
  return []
}

function errorMessage(res: any, fallback: string): string {
  return res?.error?.message || (typeof res?.error === 'string' ? res.error : '') || fallback
}

export async function fetchInstructors(): Promise<InstructorAccount[]> {
  try {
    const { data: profData, error } = await supabase
      .from('profiles')
      .select(INSTRUCTOR_LIST_COLUMNS)
      .eq('role', 'pemateri')

    if (!error && Array.isArray(profData)) {
      const expertiseById = new Map<string, { expertise: string[]; total_students: number }>()
      try {
        const { data: instData } = await supabase
          .from('instructor_profiles')
          .select('id, expertise, total_students')
        ;(instData || []).forEach((row: any) => {
          expertiseById.set(row.id, {
            expertise: parseExpertise(row.expertise),
            total_students: Number(row.total_students) || 0,
          })
        })
      } catch {
        // Detail keahlian opsional
      }

      const instructors: InstructorAccount[] = profData
        .map((p: any) => {
          const extra = expertiseById.get(p.id)
          return {
            id: p.id,
            full_name: p.full_name,
            username: p.username,
            email: p.email || '',
            phone_number: p.phone_number || undefined,
            role: 'pemateri' as const,
            avatar_url: p.avatar_url || undefined,
            bio: p.bio || undefined,
            expertise: extra?.expertise.length ? extra.expertise : [],
            total_students: extra?.total_students ?? 0,
            last_active_at: p.last_active_at || null,
            created_at: p.created_at || new Date().toISOString(),
          }
        })
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))

      try { localStorage.setItem(LOCAL_INSTRUCTORS_KEY, JSON.stringify(instructors)) } catch {}
      return instructors
    }
  } catch (e) {
    console.warn('DB fetchInstructors note:', e)
  }

  // Cache terakhir bila server tidak bisa dihubungi
  try {
    const local = localStorage.getItem(LOCAL_INSTRUCTORS_KEY)
    if (local) return JSON.parse(local)
  } catch {}
  return []
}

/** Admin membuat akun pemateri baru. Sesi admin tidak berubah. */
export async function createInstructorAccount(data: InstructorInput): Promise<InstructorAccount> {
  const res = await supabase.rpc('admin_create_instructor', {
    ...data,
    username: data.username.toLowerCase().trim(),
    email: data.email.toLowerCase().trim(),
  })
  if (res?.error || !res?.data) {
    throw new Error(errorMessage(res, 'Gagal membuat akun pemateri'))
  }
  const d = res.data
  return {
    id: d.id,
    full_name: d.full_name,
    username: d.username,
    email: d.email,
    phone_number: d.phone_number || undefined,
    role: 'pemateri',
    avatar_url: d.avatar_url,
    bio: d.bio || undefined,
    expertise: parseExpertise(d.expertise),
    total_students: 0,
    last_active_at: null,
    created_at: new Date().toISOString(),
  }
}

/** Admin memperbarui akun pemateri. Isi `password` untuk mereset password. */
export async function updateInstructorAccount(id: string, data: InstructorInput): Promise<void> {
  const res = await supabase.rpc('admin_update_instructor', {
    id,
    ...data,
    username: data.username.toLowerCase().trim(),
    email: data.email.toLowerCase().trim(),
  })
  if (res?.error) {
    throw new Error(errorMessage(res, 'Gagal memperbarui akun pemateri'))
  }
}

/** Menghapus akun pemateri beserta kredensial login-nya. */
export async function deleteInstructorAccount(id: string): Promise<void> {
  const res = await supabase.rpc('delete_auth_user', { user_id: id })
  if (res?.error) {
    throw new Error(errorMessage(res, 'Gagal menghapus akun pemateri'))
  }
}

/** Password acak yang mudah dibacakan (tanpa karakter ambigu seperti 0/O, 1/l). */
export function generateInstructorPassword(length = 10): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => chars[b % chars.length]).join('')
}
