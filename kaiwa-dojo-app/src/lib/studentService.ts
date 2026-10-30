import { supabase } from './supabaseClient'
import { matchGroupFromInstitution } from './groupService'

export type StudentStatus = 'approved' | 'pending' | 'rejected'

export type AccessLevel = 'full' | 'view_only'

export type PaymentStatus = 'paid' | 'unpaid' | 'pending' | 'expired'

export interface SubscriptionPlanOption {
  code: string
  id: string
  category: string
  name: string
  durationDays: number
  price: number
  priceFormatted: string
}

export const SUBSCRIPTION_PLANS: SubscriptionPlanOption[] = [
  { code: 'minna1-mandiri-1bln', id: 'minna1-mandiri-1bln', category: 'Minna 1 Mandiri Online', name: 'Minna 1 Mandiri · 1 Bulan', durationDays: 30, price: 200000, priceFormatted: 'Rp 200.000' },
  { code: 'minna1-mandiri-6bln', id: 'minna1-mandiri-6bln', category: 'Minna 1 Mandiri Online', name: 'Minna 1 Mandiri · 6 Bulan', durationDays: 180, price: 1000000, priceFormatted: 'Rp 1.000.000' },
  { code: 'minna1-mandiri-1thn', id: 'minna1-mandiri-1thn', category: 'Minna 1 Mandiri Online', name: 'Minna 1 Mandiri · 1 Tahun', durationDays: 365, price: 1500000, priceFormatted: 'Rp 1.500.000' },
  { code: 'minna1-kaiwa-1bln', id: 'minna1-kaiwa-1bln', category: 'Minna 1 Kaiwa Online', name: 'Minna 1 Kaiwa · 1 Bulan', durationDays: 30, price: 250000, priceFormatted: 'Rp 250.000' },
  { code: 'minna1-kaiwa-6bln', id: 'minna1-kaiwa-6bln', category: 'Minna 1 Kaiwa Online', name: 'Minna 1 Kaiwa · 6 Bulan', durationDays: 180, price: 1400000, priceFormatted: 'Rp 1.400.000' },
  { code: 'minna1-kaiwa-1thn', id: 'minna1-kaiwa-1thn', category: 'Minna 1 Kaiwa Online', name: 'Minna 1 Kaiwa · 1 Tahun', durationDays: 365, price: 1800000, priceFormatted: 'Rp 1.800.000' },
  { code: 'minna12-mandiri-1thn', id: 'minna12-mandiri-1thn', category: 'Minna 1&2 Mandiri Online', name: 'Minna 1&2 Mandiri · 1 Tahun', durationDays: 365, price: 2500000, priceFormatted: 'Rp 2.500.000' },
  { code: 'minna12-kaiwa-1thn', id: 'minna12-kaiwa-1thn', category: 'Minna 1&2 Kaiwa Online', name: 'Minna 1&2 Kaiwa · 1 Tahun', durationDays: 365, price: 3500000, priceFormatted: 'Rp 3.500.000' },
]

export interface StudentAccount {
  id: string
  full_name: string
  username: string
  email: string
  phone_number?: string
  institution?: string
  group_name?: string  // Matches admin registered group (e.g. 'VLI2608'), or empty for regular student
  referral_code?: string
  plan_code?: string        // Paket langganan (dari website pendaftaran) — menentukan grup/akses
  payment_status?: PaymentStatus // 'paid' | 'unpaid' | 'pending' | 'expired'
  subscription_ends_at?: string | null // Tanggal kedaluwarsa masa langganan
  access_level?: AccessLevel // 'full' atau 'view_only' (diatur manual admin saat langganan habis)
  domisili?: string
  kelurahan?: string
  kecamatan?: string
  kabupaten?: string
  role: 'pelajar'
  avatar_url?: string
  bio?: string
  streak_days: number
  status: StudentStatus
  last_active_at?: string | null
  created_at: string
}

/**
 * Normalisasi dan deteksi grup dari field institution.
 * - Jika mengandung keyword grup (cth: 'viva legacy' / 'vli2608') → 'VLI2608'
 * - Jika tidak ada grup yang terdaftar cocok → '' (Siswa Biasa)
 */
export function normalizeGroup(raw: string | null | undefined): string {
  return matchGroupFromInstitution(raw)
}

/**
 * Mengambil total jumlah akun pelajar secara instan via HEAD count query
 */
export async function fetchStudentsCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'pelajar')

    if (error) {
      console.warn('DB fetchStudentsCount error:', error.message)
      return 0
    }
    return count || 0
  } catch (e) {
    console.warn('fetchStudentsCount catch:', e)
    return 0
  }
}

/**
 * Mengambil seluruh data akun pelajar langsung dari Supabase Database (profiles)
 */
// Kolom yang diambil untuk list pelajar — bio dihilangkan (tidak ditampilkan di tabel, hemat egress)
const STUDENT_LIST_COLUMNS = [
  'id', 'full_name', 'username', 'email', 'phone_number',
  'institution', 'group_name', 'referral_code', 'plan_code', 'payment_status', 'subscription_ends_at', 'access_level', 'domisili', 'kelurahan', 'kecamatan', 'kabupaten',
  'avatar_url', 'streak_days', 'status', 'last_active_at', 'created_at',
].join(', ')

export async function fetchStudents(): Promise<StudentAccount[]> {
  try {
    const { data: profData, error } = await supabase
      .from('profiles')
      .select(STUDENT_LIST_COLUMNS)
      .eq('role', 'pelajar')
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('DB fetchStudents error:', error.message)
      return []
    }

    if (profData && profData.length > 0) {
      return profData.map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        username: p.username,
        email: p.email || `${p.username}@kaiwadojo.com`,
        phone_number: p.phone_number,
        institution: p.institution,
        group_name: p.group_name ? p.group_name.trim() : undefined,
        referral_code: p.referral_code || undefined,
        plan_code: p.plan_code || undefined,
        payment_status: (p.payment_status as PaymentStatus) || 'unpaid',
        subscription_ends_at: p.subscription_ends_at || null,
        access_level: (p.access_level as AccessLevel) || 'full',
        domisili: p.domisili || undefined,
        kelurahan: p.kelurahan || undefined,
        kecamatan: p.kecamatan || undefined,
        kabupaten: p.kabupaten || undefined,
        role: 'pelajar',
        avatar_url: p.avatar_url,
        bio: p.bio,
        streak_days: p.streak_days || 0,
        status: (p.status as StudentStatus) || 'approved',
        last_active_at: p.last_active_at || null,
        created_at: p.created_at || new Date().toISOString(),
      }))
    }
  } catch (e) {
    console.warn('DB fetchStudents catch:', e)
  }

  return []
}

/**
 * Menambahkan akun pelajar baru secara langsung ke Supabase Database
 */
export async function createStudentAccount(data: {
  id?: string
  full_name: string
  username: string
  email: string
  phone_number?: string
  institution?: string
  group_name?: string | null
  referral_code?: string | null
  domisili?: string | null
  kelurahan?: string | null
  kecamatan?: string | null
  kabupaten?: string | null
  bio?: string
  status?: StudentStatus
}): Promise<StudentAccount | null> {
  const cleanUser = data.username.toLowerCase().trim()
  const cleanEmail = data.email.toLowerCase().trim()
  const targetStatus = data.status || 'approved'
  const newId = data.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`)

  const resolvedGroup = data.group_name !== undefined
    ? (data.group_name ? data.group_name.trim() : null)
    : (normalizeGroup(data.institution) || null)

  const newStudent: StudentAccount = {
    id: newId,
    full_name: data.full_name,
    username: cleanUser,
    email: cleanEmail,
    phone_number: data.phone_number,
    institution: data.institution,
    group_name: resolvedGroup || undefined,
    referral_code: data.referral_code || undefined,
    domisili: data.domisili || undefined,
    kelurahan: data.kelurahan || undefined,
    kecamatan: data.kecamatan || undefined,
    kabupaten: data.kabupaten || undefined,
    role: 'pelajar',
    avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(data.full_name)}`,
    bio: data.bio || 'Siswa kaiwadojo',
    streak_days: 0,
    status: targetStatus,
    created_at: new Date().toISOString(),
  }

  try {
    const payload: any = {
      id: newStudent.id,
      full_name: newStudent.full_name,
      username: newStudent.username,
      email: newStudent.email,
      phone_number: newStudent.phone_number,
      institution: newStudent.institution,
      group_name: resolvedGroup,
      referral_code: data.referral_code || null,
      domisili: data.domisili || null,
      kelurahan: data.kelurahan || null,
      kecamatan: data.kecamatan || null,
      kabupaten: data.kabupaten || null,
      role: 'pelajar',
      avatar_url: newStudent.avatar_url,
      bio: newStudent.bio,
      streak_days: 0,
      status: targetStatus,
    }

    let { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })

    if (error) {
      console.warn('DB createStudentAccount primary error:', error.message, error)
      
      // Fallback 1: If group_name column doesn't exist in Supabase DB profiles table yet, retry without group_name
      delete payload.group_name
      const retry1 = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })
      
      if (retry1.error) {
        console.warn('DB createStudentAccount fallback 1 error:', retry1.error.message)
        // Fallback 2: Try simple insert if upsert fails
        const retry2 = await supabase.from('profiles').insert(payload)
        if (retry2.error) {
          console.error('DB createStudentAccount fallback 2 error:', retry2.error.message)
          return null
        }
      }
    }

    return newStudent
  } catch (e: any) {
    console.error('DB createStudentAccount catch:', e)
    return null
  }
}

/**
 * Menyetujui (approve) akun pelajar langsung di Supabase Database
 */
export async function approveStudentAccount(id: string): Promise<boolean> {
  try {
    const target = (id || '').trim()
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target)

    if (isUuid) {
      const { error } = await supabase.from('profiles').update({ status: 'approved' }).eq('id', target)
      if (!error) return true
    }

    const { error: err2 } = await supabase.from('profiles').update({ status: 'approved' }).ilike('username', target)
    if (err2) {
      await supabase.from('profiles').update({ status: 'approved' }).ilike('email', target)
    }
    return true
  } catch (e) {
    console.warn('DB approveStudentAccount catch:', e)
    return false
  }
}

/**
 * Ubah level akses pelajar: 'view_only' = hanya bisa melihat (mis. langganan habis), 'full' = akses penuh.
 * Untuk sementara diubah manual oleh admin dari halaman Kelola Pelajar.
 */
export async function setStudentAccessLevel(id: string, level: AccessLevel): Promise<boolean> {
  try {
    const { error } = await supabase.from('profiles').update({ access_level: level }).eq('id', id)
    if (error) {
      console.warn('DB setStudentAccessLevel error:', error.message)
      return false
    }
    return true
  } catch (e) {
    console.warn('DB setStudentAccessLevel catch:', e)
    return false
  }
}

/**
 * Memperbarui status pembayaran, paket langganan, dan masa kedaluwarsa pelajar oleh Admin.
 */
export async function updateStudentPayment(
  id: string,
  paymentStatus: PaymentStatus,
  planCode?: string | null,
  subscriptionEndsAt?: string | null
): Promise<boolean> {
  try {
    const payload: Record<string, any> = {
      payment_status: paymentStatus,
    }
    if (planCode !== undefined) payload.plan_code = planCode || null
    if (subscriptionEndsAt !== undefined) payload.subscription_ends_at = subscriptionEndsAt || null

    const { error } = await supabase.from('profiles').update(payload).eq('id', id)
    if (error) {
      console.warn('DB updateStudentPayment error:', error.message)
      return false
    }

    // Jika ada langganan di tabel subscriptions, update juga agar sinkron
    try {
      await supabase
        .from('subscriptions')
        .update({
          payment_status: paymentStatus,
          ends_at: subscriptionEndsAt || null,
          ...(planCode ? { plan_code: planCode } : {})
        })
        .eq('user_id', id)
    } catch {}

    return true
  } catch (e) {
    console.warn('DB updateStudentPayment catch:', e)
    return false
  }
}

/** Ringkasan langganan per pelajar (hanya admin/pemateri yang boleh membaca tabel subscriptions) */
export interface StudentSubscriptionInfo {
  plan_code: string
  payment_status: string
  status?: string
  ends_at: string | null
}

export async function fetchSubscriptionsByUser(): Promise<Map<string, StudentSubscriptionInfo>> {
  const map = new Map<string, StudentSubscriptionInfo>()
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('user_id, plan_code, payment_status, ends_at')
      .order('ends_at', { ascending: true })
    if (error || !data) return map
    // Jika satu pelajar punya beberapa langganan (perpanjangan), simpan yang berakhir paling akhir
    data.forEach((s: any) => {
      if (s.user_id) map.set(s.user_id, { plan_code: s.plan_code, payment_status: s.payment_status, ends_at: s.ends_at || null })
    })
  } catch (e) {
    console.warn('DB fetchSubscriptionsByUser catch:', e)
  }
  return map
}

/**
 * Menolak/menonaktifkan akun pelajar langsung di Supabase Database
 */
export async function rejectStudentAccount(id: string): Promise<boolean> {
  try {
    const target = (id || '').trim()
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target)

    if (isUuid) {
      const { error } = await supabase.from('profiles').update({ status: 'rejected' }).eq('id', target)
      if (!error) return true
    }

    const { error: err2 } = await supabase.from('profiles').update({ status: 'rejected' }).ilike('username', target)
    if (err2) {
      await supabase.from('profiles').update({ status: 'rejected' }).ilike('email', target)
    }
    return true
  } catch (e) {
    console.warn('DB rejectStudentAccount catch:', e)
    return false
  }
}

/**
 * Perbarui data akun pelajar langsung di Supabase Database
 */
export async function updateStudentAccount(
  id: string,
  data: {
    full_name: string
    username: string
    email: string
    institution?: string
    group_name?: string | null
    domisili?: string | null
    kelurahan?: string | null
    kecamatan?: string | null
    kabupaten?: string | null
    bio?: string
    status?: StudentStatus
  }
): Promise<boolean> {
  try {
    const target = (id || '').trim()
    const cleanUser = data.username.toLowerCase().trim()
    const cleanEmail = data.email.toLowerCase().trim()
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target)

    const resolvedGroup = data.group_name !== undefined
      ? (data.group_name ? data.group_name.trim() : null)
      : (normalizeGroup(data.institution) || null)

    const payload: any = {
      full_name: data.full_name,
      username: cleanUser,
      email: cleanEmail,
      institution: data.institution !== undefined ? (data.institution?.trim() || null) : undefined,
      group_name: resolvedGroup,
      domisili: data.domisili !== undefined ? (data.domisili?.trim() || null) : undefined,
      kelurahan: data.kelurahan !== undefined ? (data.kelurahan?.trim() || null) : undefined,
      kecamatan: data.kecamatan !== undefined ? (data.kecamatan?.trim() || null) : undefined,
      kabupaten: data.kabupaten !== undefined ? (data.kabupaten?.trim() || null) : undefined,
      bio: data.bio,
      status: data.status,
    }

    // Clean undefined keys
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key])

    if (isUuid) {
      const { error } = await supabase.from('profiles').update(payload).eq('id', target)
      if (!error) return true
    }

    const { error: err2 } = await supabase.from('profiles').update(payload).ilike('username', target)
    if (err2) {
      console.warn('DB updateStudentAccount error:', err2.message)
    }
    return true
  } catch (e) {
    console.warn('DB updateStudentAccount catch:', e)
    return false
  }
}

/**
 * Menghapus akun pelajar secara permanen dari Supabase:
 * 1. Memanggil RPC delete_auth_user(user_id, user_email) → hapus dari auth.users dan profiles
 * 2. Fallback: Hapus langsung dari tabel profiles (yang juga memicu trigger on_profile_deleted_cleanup_auth)
 */
export async function deleteStudentAccount(id: string, email?: string): Promise<boolean> {
  try {
    const target = (id || '').trim()
    const targetEmail = (email || '').trim().toLowerCase()
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target)

    console.log('[deleteStudentAccount] Memulai penghapusan akun:', { id: target, email: targetEmail, isUuid })

    // 1. Coba hapus via RPC delete_auth_user (membersihkan auth.users & profiles secara tuntas)
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('delete_auth_user', {
        user_id: isUuid ? target : null,
        user_email: targetEmail || null,
      })

      if (!rpcError && rpcResult === true) {
        console.log('[deleteStudentAccount] Berhasil hapus dari auth.users & profiles via RPC:', { id: target, email: targetEmail })
        return true
      }

      if (rpcError) {
        console.warn('[deleteStudentAccount] RPC delete_auth_user note:', rpcError.message)
      }
    } catch (rpcEx) {
      console.warn('[deleteStudentAccount] RPC call exception:', rpcEx)
    }

    // 2. Hapus dari tabel profiles (safety-net: akan memicu trigger database untuk membersihkan auth.users)
    if (isUuid) {
      const { error: profileErr } = await supabase.from('profiles').delete().eq('id', target)
      if (!profileErr) {
        console.log('[deleteStudentAccount] Berhasil hapus dari profiles by id:', target)
        return true
      }
      console.warn('[deleteStudentAccount] Delete by id error:', profileErr.message)
    }

    // 3. Fallback: Hapus by email dari profiles
    if (targetEmail) {
      const { error: errEmail } = await supabase.from('profiles').delete().ilike('email', targetEmail)
      if (!errEmail) {
        console.log('[deleteStudentAccount] Berhasil hapus dari profiles by email:', targetEmail)
        return true
      }
      console.warn('[deleteStudentAccount] Delete by email error:', errEmail.message)
    }

    // 4. Fallback: Hapus by username dari profiles
    const { error: errUser } = await supabase.from('profiles').delete().ilike('username', target)
    if (!errUser) {
      console.log('[deleteStudentAccount] Berhasil hapus dari profiles by username:', target)
      return true
    }
    console.warn('[deleteStudentAccount] Delete by username error:', errUser.message)

    return false
  } catch (e) {
    console.error('[deleteStudentAccount] Catch error:', e)
    return false
  }
}

