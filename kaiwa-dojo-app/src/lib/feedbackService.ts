import { supabase } from './supabaseClient'

export type FeedbackCategory =
  | 'saran_fitur'
  | 'laporan_bug'
  | 'materi'
  | 'desain_ui'
  | 'lainnya'

export type FeedbackStatus =
  | 'unread'
  | 'read'
  | 'in_progress'
  | 'resolved'
  | 'archived'

export interface FeedbackItem {
  id: string
  user_id?: string | null
  name: string
  email?: string | null
  phone_number?: string | null
  role: string
  category: FeedbackCategory
  rating: number
  title?: string | null
  message: string
  page_url?: string | null
  status: FeedbackStatus
  admin_notes?: string | null
  created_at: string
  updated_at?: string
}

export interface CreateFeedbackPayload {
  user_id?: string | null
  name: string
  email?: string | null
  phone_number?: string | null
  role?: string
  category: FeedbackCategory
  rating: number
  title?: string | null
  message: string
  page_url?: string | null
}

export const FEEDBACK_UPDATE_EVENT = 'kaiwa_feedback_updated'
const LOCAL_FEEDBACK_KEY = 'kaiwa_local_feedbacks'

export const CATEGORY_META: Record<
  FeedbackCategory,
  { label: string; icon: string; badgeClass: string; desc: string }
> = {
  saran_fitur: {
    label: 'Saran Fitur Baru',
    icon: '💡',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300 border-amber-500/20',
    desc: 'Ide atau penambahan fitur baru untuk KaiwaDojo',
  },
  laporan_bug: {
    label: 'Laporan Bug / Kendala',
    icon: '🐛',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:bg-rose-400/20 dark:text-rose-300 border-rose-500/20',
    desc: 'Masalah teknis, error, atau fungsi yang tidak berjalan',
  },
  materi: {
    label: 'Materi & Konten',
    icon: '📚',
    badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/20 dark:text-indigo-300 border-indigo-500/20',
    desc: 'Masukan seputar bab pelajaran, video, atau kotoba',
  },
  desain_ui: {
    label: 'Tampilan & Desain',
    icon: '🎨',
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:bg-purple-400/20 dark:text-purple-300 border-purple-500/20',
    desc: 'Saran perbaikan estetika, kemudahan penggunaan (UX/UI)',
  },
  lainnya: {
    label: 'Masukan Lainnya',
    icon: '💬',
    badgeClass: 'bg-teal-500/10 text-teal-600 dark:bg-teal-400/20 dark:text-teal-300 border-teal-500/20',
    desc: 'Kritik, apresiasi, atau masukan umum lainnya',
  },
}

export const STATUS_META: Record<
  FeedbackStatus,
  { label: string; badgeClass: string; icon: string }
> = {
  unread: {
    label: 'Belum Dibaca',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:bg-blue-400/20 dark:text-blue-300 border-blue-500/30',
    icon: '📬',
  },
  read: {
    label: 'Sudah Dibaca',
    badgeClass: 'bg-slate-500/10 text-slate-600 dark:bg-slate-400/20 dark:text-slate-300 border-slate-500/30',
    icon: '👀',
  },
  in_progress: {
    label: 'Sedang Diproses',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300 border-amber-500/30',
    icon: '⏳',
  },
  resolved: {
    label: 'Selesai / Diterapkan',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300 border-emerald-500/30',
    icon: '✅',
  },
  archived: {
    label: 'Diarsipkan',
    badgeClass: 'bg-slate-400/10 text-slate-500 dark:bg-slate-600/20 dark:text-slate-400 border-slate-400/30',
    icon: '📁',
  },
}

function notifyFeedbackUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(FEEDBACK_UPDATE_EVENT))
  }
}

function getLocalFeedbacks(): FeedbackItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_FEEDBACK_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalFeedbacks(items: FeedbackItem[]) {
  try {
    localStorage.setItem(LOCAL_FEEDBACK_KEY, JSON.stringify(items))
  } catch {
    // ignore
  }
}

/**
 * Submit user feedback to database (with fallback to local storage)
 */
export async function submitFeedback(payload: CreateFeedbackPayload): Promise<{ success: boolean; data?: FeedbackItem; error?: string }> {
  try {
    const itemToInsert = {
      user_id: payload.user_id || null,
      name: payload.name.trim() || 'Anonim',
      email: payload.email?.trim() || null,
      phone_number: payload.phone_number?.trim() || null,
      role: payload.role || 'tamu',
      category: payload.category,
      rating: payload.rating || 5,
      title: payload.title?.trim() || null,
      message: payload.message.trim(),
      page_url: payload.page_url || (typeof window !== 'undefined' ? window.location.href : null),
      status: 'unread',
    }

    const { data, error } = await supabase
      .from('feedback_suggestions')
      .insert([itemToInsert])
      .select()
      .single()

    if (error) {
      console.warn('Supabase feedback insert error, using local fallback:', error.message)
      // Fallback local storage
      const fallbackItem: FeedbackItem = {
        id: 'local-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
        ...itemToInsert,
        created_at: new Date().toISOString(),
      } as FeedbackItem

      const locals = getLocalFeedbacks()
      saveLocalFeedbacks([fallbackItem, ...locals])
      notifyFeedbackUpdate()
      return { success: true, data: fallbackItem }
    }

    notifyFeedbackUpdate()
    return { success: true, data: data as FeedbackItem }
  } catch (err: any) {
    console.error('Error submitting feedback:', err)
    return { success: false, error: err?.message || 'Gagal mengirim masukan & saran' }
  }
}

/**
 * Fetch all feedbacks (Admin usage)
 */
export async function fetchFeedbacks(): Promise<FeedbackItem[]> {
  try {
    const { data, error } = await supabase
      .from('feedback_suggestions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Error fetching feedback from supabase, returning local fallback:', error.message)
      return getLocalFeedbacks()
    }

    const remoteItems = (data || []) as FeedbackItem[]
    // Merge with any offline/local-only items if present
    const localItems = getLocalFeedbacks()
    const mergedMap = new Map<string, FeedbackItem>()

    remoteItems.forEach(item => mergedMap.set(item.id, item))
    localItems.forEach(item => {
      if (!mergedMap.has(item.id)) {
        mergedMap.set(item.id, item)
      }
    })

    const result = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    return result
  } catch (err) {
    console.error('Failed to fetch feedbacks:', err)
    return getLocalFeedbacks()
  }
}

/**
 * Update feedback status
 */
export async function updateFeedbackStatus(id: string, status: FeedbackStatus): Promise<{ success: boolean; error?: string }> {
  try {
    if (id.startsWith('local-')) {
      const locals = getLocalFeedbacks()
      const updated = locals.map(f => (f.id === id ? { ...f, status, updated_at: new Date().toISOString() } : f))
      saveLocalFeedbacks(updated)
      notifyFeedbackUpdate()
      return { success: true }
    }

    const { error } = await supabase
      .from('feedback_suggestions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      // Also update local cache just in case
      const locals = getLocalFeedbacks()
      const updated = locals.map(f => (f.id === id ? { ...f, status, updated_at: new Date().toISOString() } : f))
      saveLocalFeedbacks(updated)
      notifyFeedbackUpdate()
      return { success: true }
    }

    notifyFeedbackUpdate()
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal mengubah status masukan' }
  }
}

/**
 * Update admin internal notes
 */
export async function updateFeedbackAdminNotes(id: string, adminNotes: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (id.startsWith('local-')) {
      const locals = getLocalFeedbacks()
      const updated = locals.map(f => (f.id === id ? { ...f, admin_notes: adminNotes, updated_at: new Date().toISOString() } : f))
      saveLocalFeedbacks(updated)
      notifyFeedbackUpdate()
      return { success: true }
    }

    const { error } = await supabase
      .from('feedback_suggestions')
      .update({ admin_notes: adminNotes, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      const locals = getLocalFeedbacks()
      const updated = locals.map(f => (f.id === id ? { ...f, admin_notes: adminNotes, updated_at: new Date().toISOString() } : f))
      saveLocalFeedbacks(updated)
      notifyFeedbackUpdate()
      return { success: true }
    }

    notifyFeedbackUpdate()
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal menyimpan catatan admin' }
  }
}

/**
 * Delete a feedback item
 */
export async function deleteFeedback(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (id.startsWith('local-')) {
      const locals = getLocalFeedbacks()
      saveLocalFeedbacks(locals.filter(f => f.id !== id))
      notifyFeedbackUpdate()
      return { success: true }
    }

    const { error } = await supabase
      .from('feedback_suggestions')
      .delete()
      .eq('id', id)

    if (error) {
      const locals = getLocalFeedbacks()
      saveLocalFeedbacks(locals.filter(f => f.id !== id))
    }

    notifyFeedbackUpdate()
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal menghapus masukan' }
  }
}
