import { supabase } from './supabaseClient'

export interface StudentAccount {
  id: string
  full_name: string
  username: string
  email: string
  role: 'pelajar'
  avatar_url?: string
  bio?: string
  streak_days: number
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
    created_at: new Date().toISOString(),
  },
]

export async function fetchStudents(): Promise<StudentAccount[]> {
  try {
    const { data: profData, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'pelajar')

    if (!error && profData && profData.length > 0) {
      const students: StudentAccount[] = profData.map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        username: p.username,
        email: p.email || `${p.username}@kaiwadojo.com`,
        role: 'pelajar',
        avatar_url: p.avatar_url,
        bio: p.bio,
        streak_days: p.streak_days || 0,
        created_at: p.created_at || new Date().toISOString(),
      }))

      localStorage.setItem(LOCAL_STUDENTS_KEY, JSON.stringify(students))
      return students
    }
  } catch (e) {
    console.warn('DB fetchStudents note:', e)
  }

  // Local fallback
  const local = localStorage.getItem(LOCAL_STUDENTS_KEY)
  if (local) {
    try {
      return JSON.parse(local)
    } catch {
      // Fallback
    }
  }
  return INITIAL_STUDENTS
}

export async function createStudentAccount(data: {
  full_name: string
  username: string
  email: string
  bio?: string
}): Promise<StudentAccount> {
  const newStudent: StudentAccount = {
    id: `std-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    full_name: data.full_name,
    username: data.username.toLowerCase().trim(),
    email: data.email.toLowerCase().trim(),
    role: 'pelajar',
    avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(data.full_name)}`,
    bio: data.bio || 'Siswa Kaiwa Dojo',
    streak_days: 0,
    created_at: new Date().toISOString(),
  }

  const current = await fetchStudents()
  const updated = [newStudent, ...current]
  localStorage.setItem(LOCAL_STUDENTS_KEY, JSON.stringify(updated))

  try {
    await supabase.from('profiles').insert({
      id: newStudent.id,
      full_name: newStudent.full_name,
      username: newStudent.username,
      email: newStudent.email,
      role: 'pelajar',
      avatar_url: newStudent.avatar_url,
      bio: newStudent.bio,
      streak_days: 0,
    })
  } catch (e) {
    console.warn('DB createStudentAccount note:', e)
  }

  return newStudent
}

export async function updateStudentAccount(
  id: string,
  data: {
    full_name: string
    username: string
    email: string
    bio?: string
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
