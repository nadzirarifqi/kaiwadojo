import { supabase } from './supabaseClient'

export interface InstructorAccount {
  id: string
  full_name: string
  username: string
  email: string
  role: 'pemateri'
  avatar_url?: string
  bio?: string
  expertise: string[]
  total_students: number
  rating_avg: number
  created_at: string
}

const LOCAL_INSTRUCTORS_KEY = 'kaiwa_instructor_accounts_v1'

export const INITIAL_INSTRUCTORS: InstructorAccount[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    full_name: 'Tanaka Sensei',
    username: 'tanakasensei',
    email: 'tanaka@kaiwadojo.com',
    role: 'pemateri',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Tanaka',
    bio: 'Pengajar Kaiwa Dojo Spesialis Bunpou & Listening N4-N3',
    expertise: ['Bunpou', 'Listening', 'N4'],
    total_students: 120,
    rating_avg: 4.95,
    created_at: new Date().toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    full_name: 'Kenji Sensei',
    username: 'kenjisensei',
    email: 'kenji@kaiwadojo.com',
    role: 'pemateri',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Kenji',
    bio: 'Pengajar Percakapan Alami & JLPT Preparation',
    expertise: ['Kaiwa', 'JLPT N3', 'Shadowing'],
    total_students: 95,
    rating_avg: 4.90,
    created_at: new Date().toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    full_name: 'Yuki Sensei',
    username: 'yukisensei',
    email: 'yuki@kaiwadojo.com',
    role: 'pemateri',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Yuki',
    bio: 'Pengajar Business Japanese & Keigo Practice',
    expertise: ['Business Japanese', 'Keigo', 'Culture'],
    total_students: 88,
    rating_avg: 4.98,
    created_at: new Date().toISOString(),
  },
]

export async function fetchInstructors(): Promise<InstructorAccount[]> {
  try {
    const { data: profData, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'pemateri')

    if (!error && profData && profData.length > 0) {
      const instructors: InstructorAccount[] = profData.map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        username: p.username,
        email: p.email || `${p.username}@kaiwadojo.com`,
        role: 'pemateri',
        avatar_url: p.avatar_url,
        bio: p.bio,
        expertise: ['Japanese', 'Kaiwa'],
        total_students: 50,
        rating_avg: 4.9,
        created_at: p.created_at || new Date().toISOString(),
      }))

      localStorage.setItem(LOCAL_INSTRUCTORS_KEY, JSON.stringify(instructors))
      return instructors
    }
  } catch (e) {
    console.warn('DB fetchInstructors note:', e)
  }

  // Local fallback
  const local = localStorage.getItem(LOCAL_INSTRUCTORS_KEY)
  if (local) {
    try {
      return JSON.parse(local)
    } catch {
      // Fallback
    }
  }
  return INITIAL_INSTRUCTORS
}

export async function createInstructorAccount(data: {
  full_name: string
  username: string
  email: string
  bio?: string
  expertise?: string[]
}): Promise<InstructorAccount> {
  const newInst: InstructorAccount = {
    id: `inst-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    full_name: data.full_name,
    username: data.username.toLowerCase().trim(),
    email: data.email.toLowerCase().trim(),
    role: 'pemateri',
    avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(data.full_name)}`,
    bio: data.bio || 'Pengajar Kaiwa Dojo',
    expertise: data.expertise || ['Kaiwa', 'Japanese'],
    total_students: 0,
    rating_avg: 5.0,
    created_at: new Date().toISOString(),
  }

  // 1. Save to LocalStorage
  const current = await fetchInstructors()
  const updated = [newInst, ...current]
  localStorage.setItem(LOCAL_INSTRUCTORS_KEY, JSON.stringify(updated))

  // 2. Insert to Supabase DB profiles
  try {
    await supabase.from('profiles').insert({
      id: newInst.id,
      full_name: newInst.full_name,
      username: newInst.username,
      email: newInst.email,
      role: 'pemateri',
      avatar_url: newInst.avatar_url,
      bio: newInst.bio,
    })

    await supabase.from('instructor_profiles').insert({
      id: newInst.id,
      expertise: newInst.expertise,
      total_students: 0,
      rating_avg: 5.0,
      verified: true,
    })
  } catch (e) {
    console.warn('DB createInstructorAccount note:', e)
  }

  return newInst
}
