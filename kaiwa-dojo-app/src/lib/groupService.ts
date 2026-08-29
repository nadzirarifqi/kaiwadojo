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

/**
 * Fetch all groups from DB (kaiwa_groups table) with auto-migration/fallback
 */
export async function fetchGroups(forceRefresh = false): Promise<KaiwaGroup[]> {
  const now = Date.now()
  if (!forceRefresh && cachedGroups.length > 0 && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedGroups
  }

  try {
    // Try full select with keywords & description
    const { data, error } = await supabase
      .from('kaiwa_groups')
      .select('*')
      .order('name', { ascending: true })

    if (!error && data) {
      const formatted: KaiwaGroup[] = data.map((g: any) => ({
        id: g.id || g.name,
        name: g.name,
        keywords: g.keywords || (g.name.toLowerCase().includes('vli') || g.name.toLowerCase().includes('viva') ? 'viva legacy, vli2608, vli 2608, viva' : g.name.toLowerCase()),
        description: g.description || '',
        created_at: g.created_at,
        updated_at: g.updated_at,
      }))

      cachedGroups = formatted
      cacheTimestamp = now
      return formatted
    }

    // Fallback: If table has only id & name
    const { data: fallbackData } = await supabase
      .from('kaiwa_groups')
      .select('id, name')
      .order('name', { ascending: true })

    if (fallbackData && fallbackData.length > 0) {
      const formatted: KaiwaGroup[] = fallbackData.map((g: any) => ({
        id: g.id || g.name,
        name: g.name,
        keywords: g.name.toLowerCase().includes('vli') || g.name.toLowerCase().includes('viva') ? 'viva legacy, vli2608, vli 2608, viva' : g.name.toLowerCase(),
        description: '',
      }))
      cachedGroups = formatted
      cacheTimestamp = now
      return formatted
    }
  } catch (err) {
    console.warn('fetchGroups error:', err)
  }

  // Default fallback if database empty
  const defaultGroups: KaiwaGroup[] = [
    {
      id: 'default-vli2608',
      name: 'VLI2608',
      keywords: 'viva legacy, vli2608, vli 2608, viva, vli',
      description: 'Grup Resmi Pelajar VIVA Legacy (VLI2608)',
    },
  ]
  cachedGroups = defaultGroups
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

  const payload: any = {
    name: cleanName,
    keywords: cleanKeywords,
    description: (group.description || '').trim(),
  }

  try {
    const { data, error } = await supabase
      .from('kaiwa_groups')
      .insert(payload)
      .select()
      .single()

    if (error) {
      // Fallback without extra columns if column does not exist
      if (error.message.includes('column') || error.code === '42703') {
        const { error: fErr } = await supabase.from('kaiwa_groups').insert({ name: cleanName })
        if (fErr) return { success: false, error: fErr.message }
      } else {
        return { success: false, error: error.message }
      }
    }

    await fetchGroups(true)
    window.dispatchEvent(new CustomEvent(GROUP_UPDATE_EVENT))
    return {
      success: true,
      group: data || { id: cleanName, name: cleanName, keywords: cleanKeywords, description: payload.description },
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal menambahkan grup.' }
  }
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

  const payload: any = {
    updated_at: new Date().toISOString(),
  }
  if (newName) payload.name = newName
  if (cleanKeywords !== undefined) payload.keywords = cleanKeywords
  if (updates.description !== undefined) payload.description = updates.description.trim()

  try {
    let { error } = await supabase.from('kaiwa_groups').update(payload).eq('id', id)

    if (error && (error.message.includes('column') || error.code === '42703')) {
      const { error: simpleErr } = await supabase.from('kaiwa_groups').update({ name: newName }).eq('id', id)
      error = simpleErr
    }

    if (error) {
      return { success: false, error: error.message }
    }

    // If group name changed, cascade update student profiles & class schedules
    if (oldName && newName && oldName !== newName) {
      await supabase.from('profiles').update({ group_name: newName }).eq('group_name', oldName)
      await supabase.from('class_schedules').update({ target_group: newName }).eq('target_group', oldName)
    }

    await fetchGroups(true)
    window.dispatchEvent(new CustomEvent(GROUP_UPDATE_EVENT))
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal memperbarui grup.' }
  }
}

/**
 * Delete a group
 */
export async function deleteGroup(id: string, name: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('kaiwa_groups').delete().eq('id', id)
    if (error) {
      // Try delete by name
      const { error: errName } = await supabase.from('kaiwa_groups').delete().eq('name', name)
      if (errName) return { success: false, error: errName.message }
    }

    // Reset students who had this group to null (Siswa Biasa)
    await supabase.from('profiles').update({ group_name: null }).eq('group_name', name)
    // Clear schedule restriction
    await supabase.from('class_schedules').update({ target_group: null }).eq('target_group', name)

    await fetchGroups(true)
    window.dispatchEvent(new CustomEvent(GROUP_UPDATE_EVENT))
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal menghapus grup.' }
  }
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
