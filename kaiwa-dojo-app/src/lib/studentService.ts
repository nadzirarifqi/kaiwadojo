import { supabase } from './supabaseClient'

export type StudentStatus = 'approved' | 'pending' | 'rejected'

export interface StudentAccount {
  id: string
  full_name: string
  username: string
  email: string
  phone_number?: string
  role: 'pelajar'
  avatar_url?: string
  bio?: string
  streak_days: number
  status: StudentStatus
  created_at: string
}

const LOCAL_STUDENTS_KEY = 'kaiwa_student_accounts_v1'

export const INITIAL_STUDENTS: StudentAccount[] = [
  {
    id: 'user-demo-active',
    full_name: 'Budi Santoso',
    username: 'budisantoso',
    email: 'budi@kaiwadojo.com',
    role: 'pelajar',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Budi',
    bio: 'Semangat belajar Bahasa Jepang untuk persiapan kerja & magang!',
    streak_days: 12,
    status: 'approved',
    created_at: new Date().toISOString(),
  },
  {
    id: 'std-102',
    full_name: 'Siti Rahma',
    username: 'sitirahma',
    email: 'siti@kaiwadojo.com',
    role: 'pelajar',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Siti',
    bio: 'Persiapan ujian JLPT N4 dan wawancara magang Jepang',
    streak_days: 8,
    status: 'approved',
    created_at: new Date().toISOString(),
  },
  {
    id: 'std-103',
    full_name: 'Ahmad Fauzi',
    username: 'ahmadfauzi',
    email: 'ahmad@kaiwadojo.com',
    role: 'pelajar',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ahmad',
    bio: 'Target kerja di Tokyo dalam 6 bulan',
    streak_days: 15,
    status: 'approved',
    created_at: new Date().toISOString(),
  },
]

export async function fetchStudents(): Promise<StudentAccount[]> {
  // 1. Ambil data lokal terlebih dahulu untuk membaca status yang pernah di-update
  let localMap: Record<string, StudentAccount> = {}
  const localStr = localStorage.getItem(LOCAL_STUDENTS_KEY)
  if (localStr) {
    try {
      const parsed: StudentAccount[] = JSON.parse(localStr)
      parsed.forEach(std => {
        if (std.id) localMap[std.id] = std
        if (std.username) localMap[std.username.toLowerCase()] = std
      })
    } catch {}
  }

  try {
    const { data: profData, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'pelajar')

    if (!error && profData && profData.length > 0) {
      const students: StudentAccount[] = profData.map((p: any) => {
        const cleanUser = (p.username || '').toLowerCase()
        const localMatched = localMap[p.id] || localMap[cleanUser]
        
        let finalStatus: StudentStatus = (p.status as StudentStatus) || 'pending'

        // Jika local cache mencatat approved/rejected (misal dari tindakan admin di UI), utamakan status terbaru tersebut
        if (localMatched?.status === 'approved' || localMatched?.status === 'rejected') {
          finalStatus = localMatched.status
        } else if (!p.status && (cleanUser === 'budisantoso' || cleanUser === 'sitirahma' || cleanUser === 'ahmadfauzi')) {
          finalStatus = 'approved'
        }

        return {
          id: p.id,
          full_name: p.full_name,
          username: p.username,
          email: p.email || `${p.username}@kaiwadojo.com`,
          phone_number: p.phone_number,
          role: 'pelajar',
          avatar_url: p.avatar_url,
          bio: p.bio,
          streak_days: p.streak_days || 0,
          status: finalStatus,
          created_at: p.created_at || new Date().toISOString(),
        }
      })

      localStorage.setItem(LOCAL_STUDENTS_KEY, JSON.stringify(students))
      return students
    }
  } catch (e) {
    console.warn('DB fetchStudents note:', e)
  }

  // Local fallback
  if (localStr) {
    try {
      const parsed: StudentAccount[] = JSON.parse(localStr)
      return parsed.map(std => ({
        ...std,
        status: std.status || 'pending',
      }))
    } catch {}
  }
  return INITIAL_STUDENTS
}

export async function createStudentAccount(data: {
  full_name: string
  username: string
  email: string
  phone_number?: string
  bio?: string
  status?: StudentStatus
}): Promise<StudentAccount> {
  const cleanUser = data.username.toLowerCase().trim()
  const cleanEmail = data.email.toLowerCase().trim()
  const targetStatus = data.status || 'pending'

  const newStudent: StudentAccount = {
    id: `std-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    full_name: data.full_name,
    username: cleanUser,
    email: cleanEmail,
    phone_number: data.phone_number,
    role: 'pelajar',
    avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(data.full_name)}`,
    bio: data.bio || 'Siswa Kaiwa Dojo',
    streak_days: 0,
    status: targetStatus,
    created_at: new Date().toISOString(),
  }

  // Save Local Cache
  const current = await fetchStudents()
  const filtered = current.filter(s => s.username !== cleanUser && s.id !== newStudent.id)
  const updated = [newStudent, ...filtered]
  localStorage.setItem(LOCAL_STUDENTS_KEY, JSON.stringify(updated))

  // Save DB Supabase
  try {
    const { error } = await supabase.from('profiles').upsert({
      id: newStudent.id,
      full_name: newStudent.full_name,
      username: newStudent.username,
      email: newStudent.email,
      phone_number: newStudent.phone_number,
      role: 'pelajar',
      avatar_url: newStudent.avatar_url,
      bio: newStudent.bio,
      streak_days: 0,
      status: targetStatus,
    }, { onConflict: 'username' })

    if (error) {
      console.warn('DB createStudentAccount note:', error.message)
    }
  } catch (e) {
    console.warn('DB createStudentAccount catch:', e)
  }

  return newStudent
}

export async function approveStudentAccount(id: string): Promise<void> {
  const target = (id || '').toLowerCase().trim()
  // 1. Update LocalStorage cache secara langsung (case-insensitive username & ID match)
  const localStr = localStorage.getItem(LOCAL_STUDENTS_KEY)
  if (localStr) {
    try {
      const current: StudentAccount[] = JSON.parse(localStr)
      const updated = current.map(std =>
        std.id === id || std.username.toLowerCase() === target ? { ...std, status: 'approved' as const } : std
      )
      localStorage.setItem(LOCAL_STUDENTS_KEY, JSON.stringify(updated))
    } catch {}
  }

  // 2. Update Supabase Database tanpa Error 400 UUID
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    if (isUuid) {
      await supabase.from('profiles').update({ status: 'approved' }).eq('id', id)
    }
    // Update berdasarkan username secara case-insensitive
    await supabase.from('profiles').update({ status: 'approved' }).ilike('username', target)
  } catch (e) {
    console.warn('DB approveStudentAccount note:', e)
  }
}

export async function rejectStudentAccount(id: string): Promise<void> {
  const target = (id || '').toLowerCase().trim()
  // 1. Update LocalStorage cache secara langsung
  const localStr = localStorage.getItem(LOCAL_STUDENTS_KEY)
  if (localStr) {
    try {
      const current: StudentAccount[] = JSON.parse(localStr)
      const updated = current.map(std =>
        std.id === id || std.username.toLowerCase() === target ? { ...std, status: 'rejected' as const } : std
      )
      localStorage.setItem(LOCAL_STUDENTS_KEY, JSON.stringify(updated))
    } catch {}
  }

  // 2. Update Supabase Database
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    if (isUuid) {
      await supabase.from('profiles').update({ status: 'rejected' }).eq('id', id)
    }
    await supabase.from('profiles').update({ status: 'rejected' }).ilike('username', target)
  } catch (e) {
    console.warn('DB rejectStudentAccount note:', e)
  }
}

export async function updateStudentAccount(
  id: string,
  data: {
    full_name: string
    username: string
    email: string
    bio?: string
    status?: StudentStatus
  }
): Promise<void> {
  const current = await fetchStudents()
  const updated = current.map(std => {
    if (std.id === id) {
      return {
        ...std,
        full_name: data.full_name,
        username: data.username.toLowerCase().trim(),
        email: data.email.toLowerCase().trim(),
        bio: data.bio || std.bio,
        status: data.status || std.status,
      }
    }
    return std
  })
  localStorage.setItem(LOCAL_STUDENTS_KEY, JSON.stringify(updated))

  try {
    await supabase
      .from('profiles')
      .update({
        full_name: data.full_name,
        username: data.username.toLowerCase().trim(),
        email: data.email.toLowerCase().trim(),
        bio: data.bio,
        status: data.status,
      })
      .eq('id', id)
  } catch (e) {
    console.warn('DB updateStudentAccount note:', e)
  }
}

export async function deleteStudentAccount(id: string): Promise<void> {
  const current = await fetchStudents()
  const updated = current.filter(std => std.id !== id)
  localStorage.setItem(LOCAL_STUDENTS_KEY, JSON.stringify(updated))

  try {
    await supabase.from('profiles').delete().eq('id', id)
  } catch (e) {
    console.warn('DB deleteStudentAccount note:', e)
  }
}
