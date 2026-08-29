import { supabase } from './supabaseClient'

export interface KaiwaGroup {
  id: string
  name: string
  keywords: string // Comma-separated keywords, e.g. "viva legacy, vli2608, vli"
  description?: string
  student_count?: number
  created_at?: string
  updated_at?: string
}

export const GROUP_UPDATE_EVENT = 'kaiwa_group_updated'

// In-memory cache for fast synchronous / near-instant matching across UI components
let cachedGroups: KaiwaGroup[] = []
let cacheTimestamp = 0
const CACHE_TTL_MS = 60000 // 1 minute

/**
 * Normalizes keyword string into array of trimmed lowercase keywords
 */
export function parseKeywords(rawKeywords: string | null | undefined): string[] {
  if (!rawKeywords) return []
  return rawKeywords
    .split(',')
    .map(k => k.trim().toLowerCase())
    .filter(k => k.length > 0)
}

/**
 * Matches an institution string against a list of KaiwaGroup objects.
 * - Checks if the institution contains any group keyword or exact group name (case-insensitive).
 * - If match found -> returns the formal group name (e.g. 'VLI2608').
 * - If NO match -> returns '' (empty string / Siswa Biasa).
 */
export function matchGroupFromInstitution(
  rawInstitution: string | null | undefined,
  groups: KaiwaGroup[] = cachedGroups
): string {
  if (!rawInstitution) return ''

  const cleanInst = rawInstitution.trim().toLowerCase()
  if (!cleanInst) return ''

  // 1. Priority check against loaded groups
  if (groups && groups.length > 0) {
    for (const grp of groups) {
      const gName = (grp.name || '').trim().toLowerCase()
      if (!gName) continue

      // Direct match with group name (e.g. "VLI2608" or "VLI 2608")
      if (cleanInst.includes(gName) || cleanInst.replace(/\s+/g, '').includes(gName.replace(/\s+/g, ''))) {
        return grp.name
      }

      // Keyword matches
      const kws = parseKeywords(grp.keywords)
      for (const kw of kws) {
        if (cleanInst.includes(kw) || cleanInst.replace(/\s+/g, '').includes(kw.replace(/\s+/g, ''))) {
          return grp.name
        }
      }
    }
  }

  // 2. Built-in hardcoded fallback for VLI2608 / VIVA Legacy
  // (ensures instant matching even before DB groups load)
  if (cleanInst.includes('viva legacy') || cleanInst.includes('vli2608') || cleanInst.includes('vli 2608')) {
    return 'VLI2608'
  }

  // 3. If no defined group matches, return empty string (Siswa Biasa)
  return ''
}

const LOCAL_STORAGE_KEY = 'kaiwa_custom_groups_v1'

/**
 * Helper to get local stored groups
 */
function getLocalGroups(): KaiwaGroup[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch (e) {
    console.warn('getLocalGroups parse error:', e)
  }
  return []
}

/**
 * Helper to save local stored groups
 */
function saveLocalGroups(list: KaiwaGroup[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list))
  } catch (e) {
    console.warn('saveLocalGroups error:', e)
  }
}

/**
 * Fetch all groups from DB (kaiwa_groups table) with auto-migration/localStorage fallback
 */
export async function fetchGroups(forceRefresh = false): Promise<KaiwaGroup[]> {
  const now = Date.now()
  if (!forceRefresh && cachedGroups.length > 0 && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedGroups
  }

  try {
    // 1. Try full select from Supabase kaiwa_groups
    const { data, error } = await supabase
      .from('kaiwa_groups')
      .select('*')
      .order('name', { ascending: true })

    if (!error && data && data.length > 0) {
      const formatted: KaiwaGroup[] = data.map((g: any) => ({
        id: String(g.id || g.name),
        name: g.name,
        keywords: g.keywords || (g.name.toLowerCase().includes('vli') || g.name.toLowerCase().includes('viva') ? 'viva legacy, vli2608, vli 2608, viva' : g.name.toLowerCase()),
        description: g.description || '',
        created_at: g.created_at,
        updated_at: g.updated_at,
      }))

      cachedGroups = formatted
      cacheTimestamp = now
      saveLocalGroups(formatted)
      return formatted
    }

    // 2. Fallback: select id, name
    const { data: fallbackData } = await supabase
      .from('kaiwa_groups')
      .select('id, name')
      .order('name', { ascending: true })

    if (fallbackData && fallbackData.length > 0) {
      const formatted: KaiwaGroup[] = fallbackData.map((g: any) => ({
        id: String(g.id || g.name),
        name: g.name,
        keywords: g.name.toLowerCase().includes('vli') || g.name.toLowerCase().includes('viva') ? 'viva legacy, vli2608, vli 2608, viva' : g.name.toLowerCase(),
        description: '',
      }))
      cachedGroups = formatted
      cacheTimestamp = now
      saveLocalGroups(formatted)
      return formatted
    }
  } catch (err) {
    console.warn('fetchGroups DB error, using local fallback:', err)
  }

  // 3. Check localStorage if DB is not populated yet
  const local = getLocalGroups()
  if (local.length > 0) {
    cachedGroups = local
    cacheTimestamp = now
    return local
  }

  // 4. Default baseline fallback
  const defaultGroups: KaiwaGroup[] = [
    {
      id: 'vli2608-default',
      name: 'VLI2608',
      keywords: 'viva legacy, vli2608, vli 2608, viva, vli',
      description: 'Grup Resmi Pelajar VIVA Legacy (VLI2608)',
    },
  ]
  cachedGroups = defaultGroups
  cacheTimestamp = now
  saveLocalGroups(defaultGroups)
  return defaultGroups
}

/**
 * Add a new group
 */
export async function createGroup(group: {
  name: string
  keywords?: string
  description?: string
}): Promise<{ success: boolean; group?: KaiwaGroup; error?: string }> {
  const cleanName = group.name.trim()
  if (!cleanName) return { success: false, error: 'Nama grup tidak boleh kosong.' }

  const cleanKeywords = (group.keywords || cleanName.toLowerCase())
    .split(',')
    .map(k => k.trim())
    .filter(Boolean)
    .join(', ')

  const newGroupObj: KaiwaGroup = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
    name: cleanName,
    keywords: cleanKeywords,
    description: (group.description || '').trim(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // Update memory & local storage immediately
  const existing = await fetchGroups(false)
  const updatedList = [...existing.filter(g => g.name.toLowerCase() !== cleanName.toLowerCase()), newGroupObj]
  cachedGroups = updatedList
  saveLocalGroups(updatedList)

  try {
    const payload: any = {
      id: newGroupObj.id,
      name: cleanName,
      keywords: cleanKeywords,
      description: newGroupObj.description,
    }

    const { error } = await supabase.from('kaiwa_groups').upsert(payload, { onConflict: 'name' })

    if (error) {
      // Fallback without extra columns if column does not exist
      if (error.message.includes('column') || error.code === '42703') {
        await supabase.from('kaiwa_groups').upsert({ name: cleanName }, { onConflict: 'name' })
      }
    }
  } catch (err: any) {
    console.warn('createGroup DB catch:', err)
  }

  window.dispatchEvent(new CustomEvent(GROUP_UPDATE_EVENT))
  return { success: true, group: newGroupObj }
}

/**
 * Update an existing group (including renaming and updating keywords)
 */
export async function updateGroup(
  id: string,
  oldName: string,
  updates: {
    name?: string
    keywords?: string
    description?: string
  }
): Promise<{ success: boolean; error?: string }> {
  const newName = updates.name ? updates.name.trim() : oldName
  const cleanKeywords = updates.keywords !== undefined
    ? updates.keywords.split(',').map(k => k.trim()).filter(Boolean).join(', ')
    : undefined

  // 1. Update in-memory & local storage instantly
  const currentGroups = await fetchGroups(false)
  let found = false
  const updatedGroups = currentGroups.map(g => {
    if (g.id === id || g.name.toLowerCase() === oldName.toLowerCase()) {
      found = true
      return {
        ...g,
        name: newName,
        keywords: cleanKeywords !== undefined ? cleanKeywords : g.keywords,
        description: updates.description !== undefined ? updates.description.trim() : g.description,
        updated_at: new Date().toISOString(),
      }
    }
    return g
  })

  if (!found) {
    updatedGroups.push({
      id: id || `${Date.now()}`,
      name: newName,
      keywords: cleanKeywords || newName.toLowerCase(),
      description: updates.description ? updates.description.trim() : '',
      updated_at: new Date().toISOString(),
    })
  }

  cachedGroups = updatedGroups
  saveLocalGroups(updatedGroups)

  // 2. Persist to DB kaiwa_groups table
  try {
    const payload: any = {
      name: newName,
      updated_at: new Date().toISOString(),
    }
    if (cleanKeywords !== undefined) payload.keywords = cleanKeywords
    if (updates.description !== undefined) payload.description = updates.description.trim()

    // Try update by id first
    let isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    let updatedInDb = false

    if (isUuid) {
      const { error, data } = await supabase.from('kaiwa_groups').update(payload).eq('id', id).select()
      if (!error && data && data.length > 0) {
        updatedInDb = true
      }
    }

    // If not updated by id, try update by oldName
    if (!updatedInDb && oldName) {
      const { error, data } = await supabase.from('kaiwa_groups').update(payload).eq('name', oldName).select()
      if (!error && data && data.length > 0) {
        updatedInDb = true
      }
    }

    // If still not updated, upsert by name
    if (!updatedInDb) {
      const upsertPayload: any = {
        name: newName,
        keywords: cleanKeywords || newName.toLowerCase(),
        description: updates.description ? updates.description.trim() : '',
      }
      const { error: upErr } = await supabase.from('kaiwa_groups').upsert(upsertPayload, { onConflict: 'name' })
      if (upErr && (upErr.message.includes('column') || upErr.code === '42703')) {
        await supabase.from('kaiwa_groups').upsert({ name: newName }, { onConflict: 'name' })
      }
    }

    // 3. Cascade update student profiles & class schedules in Supabase DB
    if (oldName && newName && oldName !== newName) {
      await supabase.from('profiles').update({ group_name: newName }).eq('group_name', oldName)
      await supabase.from('class_schedules').update({ target_group: newName }).eq('target_group', oldName)
    }
  } catch (err: any) {
    console.warn('updateGroup DB catch:', err)
  }

  window.dispatchEvent(new CustomEvent(GROUP_UPDATE_EVENT))
  return { success: true }
}

/**
 * Delete a group
 */
export async function deleteGroup(id: string, name: string): Promise<{ success: boolean; error?: string }> {
  // Update local memory & storage
  const currentGroups = await fetchGroups(false)
  const updatedGroups = currentGroups.filter(g => g.id !== id && g.name.toLowerCase() !== name.toLowerCase())
  cachedGroups = updatedGroups
  saveLocalGroups(updatedGroups)

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    if (isUuid) {
      await supabase.from('kaiwa_groups').delete().eq('id', id)
    }
    await supabase.from('kaiwa_groups').delete().eq('name', name)

    // Reset students who had this group to null (Siswa Biasa)
    await supabase.from('profiles').update({ group_name: null }).eq('group_name', name)
    // Clear schedule restriction
    await supabase.from('class_schedules').update({ target_group: null }).eq('target_group', name)
  } catch (err) {
    console.warn('deleteGroup DB catch:', err)
  }

  window.dispatchEvent(new CustomEvent(GROUP_UPDATE_EVENT))
  return { success: true }
}

/**
 * Evaluates all student profiles against registered groups:
 * - If institution matches a group's keywords -> set group_name = group.name
 * - If NO match -> set group_name = null (Siswa Biasa)
 */
export async function syncAllStudentsWithGroups(): Promise<{
  total: number
  matched: number
  unmatched: number
  updated: number
  error?: string
}> {
  try {
    const groups = await fetchGroups(true)
    const { data: students, error } = await supabase
      .from('profiles')
      .select('id, full_name, institution, group_name')
      .eq('role', 'pelajar')

    if (error || !students) {
      return { total: 0, matched: 0, unmatched: 0, updated: 0, error: error?.message }
    }

    let matched = 0
    let unmatched = 0
    let updated = 0

    for (const std of students) {
      const resolved = matchGroupFromInstitution(std.institution, groups)
      const targetGroupName = resolved || null

      if (resolved) {
        matched++
      } else {
        unmatched++
      }

      // Only update if changed
      if (std.group_name !== targetGroupName) {
        const { error: upErr } = await supabase
          .from('profiles')
          .update({ group_name: targetGroupName })
          .eq('id', std.id)

        if (!upErr) {
          updated++
        }
      }
    }

    // Also update any schedules with old 'VIVA Legacy' name -> 'VLI2608'
    await supabase.from('class_schedules').update({ target_group: 'VLI2608' }).ilike('target_group', '%viva legacy%')

    return {
      total: students.length,
      matched,
      unmatched,
      updated,
    }
  } catch (err: any) {
    return { total: 0, matched: 0, unmatched: 0, updated: 0, error: err?.message || 'Gagal sinkronisasi data siswa.' }
  }
}
