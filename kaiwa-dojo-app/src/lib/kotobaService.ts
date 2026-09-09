import { supabase } from './supabaseClient'
import { fetchStudents, type StudentAccount } from './studentService'

export interface UserKotoba {
  id: string
  user_id: string
  japanese: string
  romaji: string
  meaning: string
  image_url?: string
  is_mastered: boolean
  created_at?: string
}

export interface StudentKotobaStat {
  student_id: string
  full_name: string
  username: string
  email: string
  avatar_url?: string
  group_name?: string
  institution?: string
  status: string
  last_active_at?: string | null
  total_kotoba: number
  mastered_count: number
  unmastered_count: number
  mastery_percentage: number
  last_submitted_at?: string | null
  kotoba_list: UserKotoba[]
}

export interface GlobalKotobaSummary {
  totalStudents: number
  activeStudents: number
  totalKotoba: number
  masteredKotoba: number
  unmasteredKotoba: number
  globalMasteryRate: number
}

export const KOTOBA_TRACKER_UPDATE_EVENT = 'kaiwa_kotoba_tracker_updated'

/**
 * Mengambil seluruh data setoran kotoba dari seluruh siswa dan menghitung statistik agregasi.
 */
export async function fetchAllStudentKotobaStats(): Promise<{
  stats: StudentKotobaStat[]
  summary: GlobalKotobaSummary
}> {
  try {
    // 1. Ambil daftar seluruh pelajar
    const students: StudentAccount[] = await fetchStudents()

    // 2. Ambil seluruh data setoran kotoba
    const { data: rawKotoba, error } = await supabase
      .from('user_kotoba_submissions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Error fetching user_kotoba_submissions:', error.message)
    }

    const allKotoba: UserKotoba[] = (rawKotoba || []).map((k: any) => ({
      id: k.id,
      user_id: k.user_id,
      japanese: k.japanese,
      romaji: k.romaji,
      meaning: k.meaning,
      image_url: k.image_url || undefined,
      is_mastered: Boolean(k.is_mastered),
      created_at: k.created_at || undefined,
    }))

    // 3. Kelompokkan kotoba berdasarkan user_id
    const kotobaByUser = new Map<string, UserKotoba[]>()
    for (const item of allKotoba) {
      if (!item.user_id) continue
      const existing = kotobaByUser.get(item.user_id) || []
      existing.push(item)
      kotobaByUser.set(item.user_id, existing)
    }

    // 4. Bangun array statistik per siswa
    const stats: StudentKotobaStat[] = students.map(student => {
      const studentKotobas = kotobaByUser.get(student.id) || []
      const total = studentKotobas.length
      const mastered = studentKotobas.filter(k => k.is_mastered).length
      const unmastered = total - mastered
      const percentage = total > 0 ? Math.round((mastered / total) * 100) : 0
      const lastSub = studentKotobas.length > 0 && studentKotobas[0].created_at
        ? studentKotobas[0].created_at
        : null

      return {
        student_id: student.id,
        full_name: student.full_name,
        username: student.username,
        email: student.email,
        avatar_url: student.avatar_url,
        group_name: student.group_name,
        institution: student.institution,
        status: student.status,
        last_active_at: student.last_active_at,
        total_kotoba: total,
        mastered_count: mastered,
        unmastered_count: unmastered,
        mastery_percentage: percentage,
        last_submitted_at: lastSub,
        kotoba_list: studentKotobas,
      }
    })

    // Urutkan default: siswa yang memiliki setoran kotoba terbanyak di atas
    stats.sort((a, b) => {
      if (b.total_kotoba !== a.total_kotoba) {
        return b.total_kotoba - a.total_kotoba
      }
      return a.full_name.localeCompare(b.full_name)
    })

    // 5. Hitung Summary Global
    const totalStudents = students.length
    const activeStudents = stats.filter(s => s.total_kotoba > 0).length
    const totalKotoba = allKotoba.length
    const masteredKotoba = allKotoba.filter(k => k.is_mastered).length
    const unmasteredKotoba = totalKotoba - masteredKotoba
    const globalMasteryRate = totalKotoba > 0 ? Math.round((masteredKotoba / totalKotoba) * 100) : 0

    const summary: GlobalKotobaSummary = {
      totalStudents,
      activeStudents,
      totalKotoba,
      masteredKotoba,
      unmasteredKotoba,
      globalMasteryRate,
    }

    return { stats, summary }
  } catch (err) {
    console.warn('Catch fetchAllStudentKotobaStats:', err)
    return {
      stats: [],
      summary: {
        totalStudents: 0,
        activeStudents: 0,
        totalKotoba: 0,
        masteredKotoba: 0,
        unmasteredKotoba: 0,
        globalMasteryRate: 0,
      },
    }
  }
}

/**
 * Mengambil daftar kotoba spesifik untuk satu siswa.
 */
export async function fetchKotobaByStudent(studentId: string): Promise<UserKotoba[]> {
  try {
    const { data, error } = await supabase
      .from('user_kotoba_submissions')
      .select('*')
      .eq('user_id', studentId)
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Error fetching student kotoba:', error.message)
      return []
    }

    return (data || []).map((k: any) => ({
      id: k.id,
      user_id: k.user_id,
      japanese: k.japanese,
      romaji: k.romaji,
      meaning: k.meaning,
      image_url: k.image_url || undefined,
      is_mastered: Boolean(k.is_mastered),
      created_at: k.created_at || undefined,
    }))
  } catch (e) {
    console.warn('Catch fetchKotobaByStudent:', e)
    return []
  }
}

/**
 * Berlangganan realtime Postgres perubahan tabel user_kotoba_submissions
 */
export function subscribeToKotobaRealtime(callback: () => void): () => void {
  const channel = supabase
    .channel('kotoba_tracker_realtime_' + Date.now())
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'user_kotoba_submissions' },
      () => {
        window.dispatchEvent(new CustomEvent(KOTOBA_TRACKER_UPDATE_EVENT))
        callback()
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
