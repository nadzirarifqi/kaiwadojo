import { supabase } from './supabaseClient'

export type StudentStatus = 'approved' | 'pending' | 'rejected'

export interface StudentAccount {
  id: string
  full_name: string
  username: string
  email: string
  phone_number?: string
  institution?: string
  group_name?: string  // Extracted from institution (text before '|'), normalized
  role: 'pelajar'
  avatar_url?: string
  bio?: string
  streak_days: number
  status: StudentStatus
  created_at: string
}

/**
 * Ekstrak nama grup dari field institution.
 * Case-insensitive dan whitespace-insensitive.
 * Contoh: "VIVA Legacy | STAI DT" → "viva legacy"
 * Contoh: "  viva legacy  " → "viva legacy"
 */
export function normalizeGroup(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw.split('|')[0].trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Mengambil seluruh data akun pelajar langsung dari Supabase Database (profiles)
 */
export async function fetchStudents(): Promise<StudentAccount[]> {
  try {
    const { data: profData, error } = await supabase
      .from('profiles')
      .select('*')
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
        group_name: p.group_name || normalizeGroup(p.institution),
        role: 'pelajar',
        avatar_url: p.avatar_url,
        bio: p.bio,
        streak_days: p.streak_days || 0,
        status: (p.status as StudentStatus) || 'approved',
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
  bio?: string
  status?: StudentStatus
}): Promise<StudentAccount | null> {
  const cleanUser = data.username.toLowerCase().trim()
  const cleanEmail = data.email.toLowerCase().trim()
  const targetStatus = data.status || 'approved'
  const newId = data.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`)

  const newStudent: StudentAccount = {
    id: newId,
    full_name: data.full_name,
    username: cleanUser,
    email: cleanEmail,
    phone_number: data.phone_number,
    institution: data.institution,
    group_name: normalizeGroup(data.institution),
    role: 'pelajar',
    avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(data.full_name)}`,
    bio: data.bio || 'Siswa Kaiwa Dojo',
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
      role: 'pelajar',
      avatar_url: newStudent.avatar_url,
      bio: newStudent.bio,
      streak_days: 0,
      status: targetStatus,
    }
    const grp = normalizeGroup(newStudent.institution)
    if (grp) payload.group_name = grp

    let { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })

    if (error) {
      console.warn('DB createStudentAccount primary error:', error.message)
      // Fallback: If group_name column doesn't exist in Supabase DB profiles table yet, retry without group_name
      if (error.message?.toLowerCase().includes('group_name') || error.code === 'PGRST204' || (error as any).status === 400) {
        delete payload.group_name
        const retry = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })
        if (retry.error) {
          console.error('DB createStudentAccount fallback error:', retry.error.message)
        }
      }
    }

    return newStudent
  } catch (e) {
    console.error('DB createStudentAccount catch:', e)
    return null
  }
}
  } catch (e) {
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
    bio?: string
    status?: StudentStatus
  }
): Promise<boolean> {
  try {
    const target = (id || '').trim()
    const cleanUser = data.username.toLowerCase().trim()
    const cleanEmail = data.email.toLowerCase().trim()
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target)

    const payload = {
      full_name: data.full_name,
      username: cleanUser,
      email: cleanEmail,
      institution: data.institution,
      group_name: normalizeGroup(data.institution),
      bio: data.bio,
      status: data.status,
    }

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
 * Menghapus akun pelajar secara permanen dari Supabase Database (profiles table)
 */
export async function deleteStudentAccount(id: string): Promise<boolean> {
  try {
    const target = (id || '').trim()
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target)

    if (isUuid) {
      const { error } = await supabase.from('profiles').delete().eq('id', target)
      if (!error) {
        return true
      }
      console.warn('DB deleteStudentAccount by id error:', error.message)
    }

    // Try deleting by username
    const { error: errUser } = await supabase.from('profiles').delete().ilike('username', target)
    if (errUser) {
      console.warn('DB deleteStudentAccount by username error:', errUser.message)
      // Try deleting by email
      const { error: errEmail } = await supabase.from('profiles').delete().ilike('email', target)
      if (errEmail) {
        console.error('DB deleteStudentAccount by email error:', errEmail.message)
        return false
      }
    }
    return true
  } catch (e) {
    console.error('DB deleteStudentAccount catch:', e)
    return false
  }
}
