import { supabase } from './supabaseClient'
import { sanitizeInput } from './securityUtils'
import type { Profile } from '../hooks/useAuth'

export type AnnouncementCategory = 'info' | 'update' | 'important' | 'event' | 'maintenance'
export type TargetAudience = 'all' | 'pelajar' | 'pemateri' | 'admin'

export interface Announcement {
  id: string
  title: string
  content: string
  category: AnnouncementCategory
  target_audience: TargetAudience
  target_group?: string | null
  is_active: boolean
  is_pinned: boolean
  author_id?: string | null
  author_name: string
  action_url?: string | null
  action_text?: string | null
  expires_at?: string | null
  created_at: string
  updated_at: string
  // Computed / client-side properties
  is_read?: boolean
  read_count?: number
}

export interface CreateAnnouncementPayload {
  title: string
  content: string
  category: AnnouncementCategory
  target_audience: TargetAudience
  target_group?: string | null
  is_active?: boolean
  is_pinned?: boolean
  author_id?: string | null
  author_name?: string
  action_url?: string | null
  action_text?: string | null
  expires_at?: string | null
}

export const ANNOUNCEMENT_UPDATE_EVENT = 'kaiwa_announcement_updated'
const LOCAL_ANNOUNCEMENTS_KEY = 'kaiwa_local_announcements_cache'
const LOCAL_READS_KEY = 'kaiwa_local_announcement_reads'

export const CATEGORY_CONFIG: Record<
  AnnouncementCategory,
  {
    label: string
    icon: string
    badgeClass: string
    borderClass: string
    bgGradient: string
    desc: string
  }
> = {
  important: {
    label: 'Penting',
    icon: '📢',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border-rose-500/30',
    borderClass: 'border-rose-500/40',
    bgGradient: 'from-rose-500/10 via-rose-500/5 to-transparent',
    desc: 'Pengumuman krusial yang memerlukan perhatian segera seluruh anggota',
  },
  update: {
    label: 'Update Baru',
    icon: '🚀',
    badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border-indigo-500/30',
    borderClass: 'border-indigo-500/40',
    bgGradient: 'from-indigo-500/10 via-indigo-500/5 to-transparent',
    desc: 'Pembaruan fitur, materi bab baru, atau peningkatan sistem KaiwaDojo',
  },
  event: {
    label: 'Acara & Dojo',
    icon: '🎏',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/30',
    borderClass: 'border-amber-500/40',
    bgGradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
    desc: 'Jadwal kaiwa spesial, webinar, tantangan kotoba, atau gathering',
  },
  info: {
    label: 'Info Dojo',
    icon: '💡',
    badgeClass: 'bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400 border-teal-500/30',
    borderClass: 'border-teal-500/40',
    bgGradient: 'from-teal-500/10 via-teal-500/5 to-transparent',
    desc: 'Informasi umum, tips belajar, tata tertib, dan panduan belajar',
  },
  maintenance: {
    label: 'Pemeliharaan',
    icon: '🛠️',
    badgeClass: 'bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400 border-slate-500/30',
    borderClass: 'border-slate-500/40',
    bgGradient: 'from-slate-500/10 via-slate-500/5 to-transparent',
    desc: 'Pemberitahuan perawatan server, sinkronisasi data, atau downtime',
  },
}

export const AUDIENCE_CONFIG: Record<TargetAudience, { label: string; icon: string }> = {
  all: { label: 'Semua Pengguna', icon: '🌐' },
  pelajar: { label: 'Hanya Pelajar', icon: '🧑‍🎓' },
  pemateri: { label: 'Hanya Pemateri', icon: '👨‍🏫' },
  admin: { label: 'Hanya Admin', icon: '🛡️' },
}

function notifyUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ANNOUNCEMENT_UPDATE_EVENT))
  }
}

// Fallback initial seeds if database has 0 announcements initially
const DEFAULT_SEED_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'seed-announcement-001',
    title: 'Selamat Datang di Portal Pembelajaran KaiwaDojo! ⛩️',
    content:
      'Selamat datang para pejuang Kaiwa! Di platform ini Anda dapat mengakses materi video terstruktur, setoran kotoba harian, reservasi kelas interaktif dengan Sensei penutur asli, dan memantau progres belajar Anda. Pastikan untuk menyelesaikan Daily Mission setiap hari untuk menjaga streak belajar!',
    category: 'important',
    target_audience: 'all',
    is_active: true,
    is_pinned: true,
    author_name: 'Admin Dojo',
    action_text: 'Mulai Belajar di Rencana Belajar',
    action_url: '/learning-plan',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
  },
]

/* ── Fetch Local Cache ─────────────────────────────── */
function getLocalAnnouncements(): Announcement[] {
  if (typeof window === 'undefined') return DEFAULT_SEED_ANNOUNCEMENTS
  try {
    const raw = localStorage.getItem(LOCAL_ANNOUNCEMENTS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return DEFAULT_SEED_ANNOUNCEMENTS
}

function saveLocalAnnouncements(list: Announcement[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOCAL_ANNOUNCEMENTS_KEY, JSON.stringify(list))
  } catch {}
}

function getLocalReadIds(userId: string): Set<string> {
  if (typeof window === 'undefined' || !userId) return new Set()
  try {
    const raw = localStorage.getItem(`${LOCAL_READS_KEY}_${userId}`)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return new Set(arr)
    }
  } catch {}
  return new Set()
}

function saveLocalReadId(userId: string, announcementId: string) {
  if (typeof window === 'undefined' || !userId || !announcementId) return
  try {
    const set = getLocalReadIds(userId)
    set.add(announcementId)
    localStorage.setItem(`${LOCAL_READS_KEY}_${userId}`, JSON.stringify(Array.from(set)))
  } catch {}
}

/* ── Public API: Fetch All Announcements (Admin / General) ── */
export async function fetchAnnouncements(options?: {
  activeOnly?: boolean
  targetRole?: TargetAudience
  targetGroup?: string | null
}): Promise<Announcement[]> {
  try {
    let query = supabase
      .from('announcements')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (options?.activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      console.warn('Supabase fetchAnnouncements note:', error.message)
      let list = getLocalAnnouncements()
      if (options?.activeOnly) {
        list = list.filter(a => a.is_active)
      }
      return list
    }

    if (data && data.length > 0) {
      saveLocalAnnouncements(data)
      return data as Announcement[]
    }

    // If DB returned 0 rows, check local cache or fallback
    const local = getLocalAnnouncements()
    return local
  } catch (err) {
    console.warn('fetchAnnouncements fallback exception:', err)
    return getLocalAnnouncements()
  }
}

/* ── Fetch Active Announcements for a Specific User with Read State ── */
export async function fetchActiveAnnouncementsForUser(
  user: Profile | null
): Promise<{ announcements: Announcement[]; unreadAnnouncements: Announcement[] }> {
  if (!user) {
    return { announcements: [], unreadAnnouncements: [] }
  }

  const allActive = await fetchAnnouncements({ activeOnly: true })
  const userRole = user.role || 'pelajar'
  const userGroup = (user.group_name || '').trim().toLowerCase()

  // 1. Filter by audience and group
  const filtered = allActive.filter(ann => {
    if (!ann.is_active) return false

    // Check expiration
    if (ann.expires_at) {
      const expDate = new Date(ann.expires_at).getTime()
      if (!isNaN(expDate) && expDate < Date.now()) return false
    }

    // Target Audience check
    if (ann.target_audience !== 'all') {
      if (ann.target_audience !== userRole) {
        // Exception: admin can see everything
        if (userRole !== 'admin') return false
      }
    }

    // Target Group check (if specified)
    if (ann.target_group && ann.target_group.trim()) {
      if (userRole === 'admin') return true
      const targetG = ann.target_group.trim().toLowerCase()
      if (userGroup !== targetG && !userGroup.includes(targetG) && !targetG.includes(userGroup)) {
        return false
      }
    }

    return true
  })

  // 2. Fetch read receipts from DB and local cache
  const localReads = getLocalReadIds(user.id)
  const dbReadIds = new Set<string>()

  try {
    const { data: readsData } = await supabase
      .from('user_announcement_reads')
      .select('announcement_id')
      .eq('user_id', user.id)

    if (readsData && Array.isArray(readsData)) {
      readsData.forEach(r => dbReadIds.add(r.announcement_id))
    }
  } catch (e) {
    console.warn('fetch user reads note:', e)
  }

  const processed: Announcement[] = filtered.map(ann => {
    const isRead = dbReadIds.has(ann.id) || localReads.has(ann.id)
    return {
      ...ann,
      is_read: isRead,
    }
  })

  const unreadAnnouncements = processed.filter(a => !a.is_read)

  return {
    announcements: processed,
    unreadAnnouncements,
  }
}

/* ── Mark Announcement as Read ──────────────────────── */
export async function markAnnouncementAsRead(userId: string, announcementId: string): Promise<boolean> {
  if (!userId || !announcementId) return false

  saveLocalReadId(userId, announcementId)

  try {
    const { error } = await supabase.from('user_announcement_reads').upsert(
      {
        user_id: userId,
        announcement_id: announcementId,
        read_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,announcement_id' }
    )

    if (error) {
      console.warn('markAnnouncementAsRead DB note:', error.message)
    }
    notifyUpdate()
    return true
  } catch (err) {
    console.warn('markAnnouncementAsRead error:', err)
    notifyUpdate()
    return true
  }
}

/* ── Mark All Announcements as Read ─────────────────── */
export async function markAllAnnouncementsAsRead(
  userId: string,
  announcementIds: string[]
): Promise<boolean> {
  if (!userId || announcementIds.length === 0) return false

  announcementIds.forEach(id => saveLocalReadId(userId, id))

  try {
    const rows = announcementIds.map(id => ({
      user_id: userId,
      announcement_id: id,
      read_at: new Date().toISOString(),
    }))

    await supabase.from('user_announcement_reads').upsert(rows, {
      onConflict: 'user_id,announcement_id',
    })

    notifyUpdate()
    return true
  } catch (err) {
    console.warn('markAllAnnouncementsAsRead error:', err)
    notifyUpdate()
    return true
  }
}

/* ── Admin: Create Announcement ─────────────────────── */
export async function createAnnouncement(
  payload: CreateAnnouncementPayload
): Promise<{ success: boolean; data?: Announcement; error?: string }> {
  const cleanTitle = sanitizeInput(payload.title).trim()
  const cleanContent = sanitizeInput(payload.content).trim()

  if (!cleanTitle) return { success: false, error: 'Judul pengumuman wajib diisi.' }
  if (!cleanContent) return { success: false, error: 'Isi pengumuman wajib diisi.' }

  const newRecord: Partial<Announcement> = {
    title: cleanTitle,
    content: cleanContent,
    category: payload.category || 'info',
    target_audience: payload.target_audience || 'all',
    target_group: payload.target_group ? sanitizeInput(payload.target_group).trim() : null,
    is_active: payload.is_active ?? true,
    is_pinned: payload.is_pinned ?? false,
    author_id: payload.author_id || null,
    author_name: payload.author_name ? sanitizeInput(payload.author_name).trim() : 'Admin Dojo',
    action_url: payload.action_url ? sanitizeInput(payload.action_url).trim() : null,
    action_text: payload.action_text ? sanitizeInput(payload.action_text).trim() : null,
    expires_at: payload.expires_at || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  try {
    const { data, error } = await supabase
      .from('announcements')
      .insert(newRecord)
      .select('*')
      .single()

    if (error) {
      console.warn('Supabase createAnnouncement insert error, using local:', error.message)
      const fallbackItem: Announcement = {
        id: `ann-${Date.now()}`,
        ...(newRecord as any),
      }
      const existing = getLocalAnnouncements()
      saveLocalAnnouncements([fallbackItem, ...existing])
      notifyUpdate()
      return { success: true, data: fallbackItem }
    }

    const existing = getLocalAnnouncements()
    saveLocalAnnouncements([data as Announcement, ...existing])
    notifyUpdate()
    return { success: true, data: data as Announcement }
  } catch (err: any) {
    console.warn('createAnnouncement exception:', err)
    const fallbackItem: Announcement = {
      id: `ann-${Date.now()}`,
      ...(newRecord as any),
    }
    const existing = getLocalAnnouncements()
    saveLocalAnnouncements([fallbackItem, ...existing])
    notifyUpdate()
    return { success: true, data: fallbackItem }
  }
}

/* ── Admin: Update Announcement ─────────────────────── */
export async function updateAnnouncement(
  id: string,
  payload: Partial<CreateAnnouncementPayload>
): Promise<{ success: boolean; data?: Announcement; error?: string }> {
  if (!id) return { success: false, error: 'ID pengumuman tidak valid.' }

  const updates: any = {
    updated_at: new Date().toISOString(),
  }

  if (payload.title !== undefined) updates.title = sanitizeInput(payload.title).trim()
  if (payload.content !== undefined) updates.content = sanitizeInput(payload.content).trim()
  if (payload.category !== undefined) updates.category = payload.category
  if (payload.target_audience !== undefined) updates.target_audience = payload.target_audience
  if (payload.target_group !== undefined)
    updates.target_group = payload.target_group ? sanitizeInput(payload.target_group).trim() : null
  if (payload.is_active !== undefined) updates.is_active = payload.is_active
  if (payload.is_pinned !== undefined) updates.is_pinned = payload.is_pinned
  if (payload.action_url !== undefined)
    updates.action_url = payload.action_url ? sanitizeInput(payload.action_url).trim() : null
  if (payload.action_text !== undefined)
    updates.action_text = payload.action_text ? sanitizeInput(payload.action_text).trim() : null
  if (payload.expires_at !== undefined) updates.expires_at = payload.expires_at

  try {
    const { data, error } = await supabase
      .from('announcements')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.warn('Supabase updateAnnouncement error:', error.message)
    }

    // Update local cache
    const existing = getLocalAnnouncements()
    const updatedList = existing.map(item => (item.id === id ? { ...item, ...updates } : item))
    saveLocalAnnouncements(updatedList)
    notifyUpdate()

    return { success: true, data: data as Announcement }
  } catch (err: any) {
    const existing = getLocalAnnouncements()
    const updatedList = existing.map(item => (item.id === id ? { ...item, ...updates } : item))
    saveLocalAnnouncements(updatedList)
    notifyUpdate()
    return { success: true }
  }
}

/* ── Admin: Delete Announcement ─────────────────────── */
export async function deleteAnnouncement(id: string): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'ID pengumuman tidak valid.' }

  try {
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) console.warn('Supabase delete error:', error.message)

    const existing = getLocalAnnouncements()
    saveLocalAnnouncements(existing.filter(item => item.id !== id))
    notifyUpdate()
    return { success: true }
  } catch (err: any) {
    const existing = getLocalAnnouncements()
    saveLocalAnnouncements(existing.filter(item => item.id !== id))
    notifyUpdate()
    return { success: true }
  }
}

/* ── Admin: Fetch Read Count Stats ──────────────────── */
export async function fetchAnnouncementReadStats(): Promise<Record<string, number>> {
  const stats: Record<string, number> = {}
  try {
    const { data, error } = await supabase
      .from('user_announcement_reads')
      .select('announcement_id')

    if (!error && data) {
      data.forEach(row => {
        stats[row.announcement_id] = (stats[row.announcement_id] || 0) + 1
      })
    }
  } catch (err) {
    console.warn('fetchAnnouncementReadStats error:', err)
  }
  return stats
}

/* ── Realtime Listener ──────────────────────────────── */
export function subscribeToAnnouncementRealtime(callback: () => void) {
  try {
    const channel = supabase
      .channel('announcements_realtime_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
        callback()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  } catch {
    return () => {}
  }
}
