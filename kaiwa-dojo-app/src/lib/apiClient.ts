/**
 * apiClient.ts - Drop-in replacement shim untuk supabase-js
 * Terhubung ke backend PHP di CyberPanel via REST API & Polling Realtime.
 */

export interface Session {
  access_token: string
  refresh_token: string
  expires_at: number
  expires_in: number
  token_type: string
  user: User
}

import { AppConfig } from '../config/appConfig'

export interface User {
  id: string
  email?: string | null
  role?: string
  user_metadata?: Record<string, any>
  created_at?: string
}

export type AuthChangeEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED'

const API_BASE = AppConfig.api.baseUrl
const TOKEN_STORAGE_KEY = AppConfig.storageKeys.jwtSession

// ── Auth Token State ──
let currentSession: Session | null = null

function loadStoredSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY)
    if (raw) {
      const s = JSON.parse(raw) as Session
      if (s && s.access_token && s.expires_at > Date.now() / 1000) {
        return s
      }
    }
  } catch {}
  return null
}

function saveSession(s: Session | null) {
  currentSession = s
  if (s) {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(s))
  } else {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY)
  }
}

currentSession = loadStoredSession()

// ── Auth Listeners ──
const authListeners = new Set<(event: AuthChangeEvent, session: Session | null) => void>()

function notifyAuth(event: AuthChangeEvent, s: Session | null) {
  saveSession(s)
  authListeners.forEach(cb => {
    try { cb(event, s) } catch {}
  })
}

// ── Query Builder Shim ──
class QueryChain<T = any> implements PromiseLike<{ data: T | null; error: any; count?: number | null }> {
  private payload: {
    table: string
    action: 'select' | 'insert' | 'update' | 'upsert' | 'delete'
    columns?: string
    count?: string
    head?: boolean
    rows?: any[]
    row?: any
    updates?: any
    filters?: Array<{ column: string; op: string; value: any }>
    order?: Array<{ column: string; ascending?: boolean; nullsFirst?: boolean }>
    limit?: number
    range?: [number, number]
    single?: boolean
    maybeSingle?: boolean
    onConflict?: string
  }

  constructor(table: string) {
    this.payload = { table, action: 'select', filters: [] }
  }

  select(columns: string = '*', options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) {
    this.payload.action = 'select'
    this.payload.columns = columns
    if (options?.count) this.payload.count = options.count
    if (options?.head) this.payload.head = options.head
    return this
  }

  insert(values: any | any[]) {
    this.payload.action = 'insert'
    if (Array.isArray(values)) {
      this.payload.rows = values
    } else {
      this.payload.row = values
    }
    return this
  }

  update(values: any) {
    this.payload.action = 'update'
    this.payload.updates = values
    return this
  }

  upsert(values: any | any[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.payload.action = 'upsert'
    if (Array.isArray(values)) {
      this.payload.rows = values
    } else {
      this.payload.row = values
    }
    if (options?.onConflict) {
      this.payload.onConflict = options.onConflict
    }
    return this
  }

  delete(_options?: any) {
    this.payload.action = 'delete'
    return this
  }

  eq(column: string, value: any) {
    this.payload.filters = this.payload.filters || []
    this.payload.filters.push({ column, op: 'eq', value })
    return this
  }

  neq(column: string, value: any) {
    this.payload.filters = this.payload.filters || []
    this.payload.filters.push({ column, op: 'neq', value })
    return this
  }

  gt(column: string, value: any) {
    this.payload.filters = this.payload.filters || []
    this.payload.filters.push({ column, op: 'gt', value })
    return this
  }

  gte(column: string, value: any) {
    this.payload.filters = this.payload.filters || []
    this.payload.filters.push({ column, op: 'gte', value })
    return this
  }

  lt(column: string, value: any) {
    this.payload.filters = this.payload.filters || []
    this.payload.filters.push({ column, op: 'lt', value })
    return this
  }

  lte(column: string, value: any) {
    this.payload.filters = this.payload.filters || []
    this.payload.filters.push({ column, op: 'lte', value })
    return this
  }

  in(column: string, values: any[]) {
    this.payload.filters = this.payload.filters || []
    this.payload.filters.push({ column, op: 'in', value: values })
    return this
  }

  is(column: string, value: any) {
    this.payload.filters = this.payload.filters || []
    this.payload.filters.push({ column, op: 'is', value })
    return this
  }

  like(column: string, pattern: string) {
    this.payload.filters = this.payload.filters || []
    this.payload.filters.push({ column, op: 'like', value: pattern })
    return this
  }

  ilike(column: string, pattern: string) {
    this.payload.filters = this.payload.filters || []
    this.payload.filters.push({ column, op: 'ilike', value: pattern })
    return this
  }

  contains(column: string, value: any) {
    this.payload.filters = this.payload.filters || []
    this.payload.filters.push({ column, op: 'like', value: `%${value}%` })
    return this
  }

  match(obj: Record<string, any>) {
    Object.entries(obj).forEach(([k, v]) => this.eq(k, v))
    return this
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.payload.order = this.payload.order || []
    this.payload.order.push({
      column,
      ascending: options?.ascending ?? true,
      nullsFirst: options?.nullsFirst ?? false,
    })
    return this
  }

  limit(count: number) {
    this.payload.limit = count
    return this
  }

  range(from: number, to: number) {
    this.payload.range = [from, to]
    return this
  }

  single() {
    this.payload.single = true
    return this
  }

  maybeSingle() {
    this.payload.maybeSingle = true
    return this
  }

  async execute(): Promise<{ data: T | null; error: any; count?: number | null }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (currentSession?.access_token) {
        headers['Authorization'] = `Bearer ${currentSession.access_token}`
        headers['X-Authorization'] = `Bearer ${currentSession.access_token}`
      }

      const res = await fetch(`${API_BASE}/query.php`, {
        method: 'POST',
        headers,
        body: JSON.stringify(this.payload),
      })

      const rawText = await res.text()
      let json: any = null
      try {
        json = JSON.parse(rawText)
      } catch {
        return { data: null, error: { message: `Server HTTP ${res.status}: ${rawText.slice(0, 300) || 'Respons kosong dari server'}` } }
      }

      if (!res.ok && !json.error) {
        return { data: null, error: { message: `HTTP Error ${res.status}` } }
      }
      return json
    } catch (err: any) {
      return { data: null, error: { message: err.message || 'Koneksi API gagal' } }
    }
  }

  then<TResult1 = { data: T | null; error: any; count?: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T | null; error: any; count?: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }
}

// ── Realtime Polling Manager ──
interface ChannelSubscription {
  table: string
  callback: (payload: any) => void
}

class RealtimeChannel {
  public id: string
  private subscriptions: ChannelSubscription[] = []

  constructor(id: string) {
    this.id = id
  }

  on(_event: string, filter: { table: string; [key: string]: any }, callback: (payload: any) => void) {
    if (filter?.table) {
      this.subscriptions.push({ table: filter.table, callback })
    }
    return this
  }

  subscribe(callback?: (status: string) => void) {
    RealtimeManager.register(this)
    if (callback) callback('SUBSCRIBED')
    return this
  }

  dispatch(change: { table: string; event: string; new: any; old: any }) {
    this.subscriptions.forEach(s => {
      if (s.table === '*' || s.table === change.table) {
        try {
          s.callback({
            eventType: change.event,
            new: change.new,
            old: change.old,
            table: change.table,
          })
        } catch {}
      }
    })
  }
}

class RealtimeManager {
  private static channels = new Set<RealtimeChannel>()
  private static lastChangeId = 0
  private static pollTimer: any = null
  private static isPolling = false

  static register(ch: RealtimeChannel) {
    this.channels.add(ch)
    this.ensurePolling()
  }

  static unregister(ch: RealtimeChannel) {
    this.channels.delete(ch)
    if (this.channels.size === 0 && this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  private static ensurePolling() {
    if (!this.pollTimer && typeof window !== 'undefined') {
      this.pollTimer = setInterval(() => this.poll(), AppConfig.auth.realtimePollIntervalMs)
      this.poll()
    }
  }

  private static async poll() {
    if (this.isPolling || this.channels.size === 0) return
    this.isPolling = true
    try {
      const res = await fetch(`${API_BASE}/changes.php?since=${this.lastChangeId}`)
      if (res.ok) {
        const json = await res.json()
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          json.data.forEach((change: any) => {
            this.channels.forEach(ch => ch.dispatch(change))
          })
        }
        if (json.last_id) {
          this.lastChangeId = json.last_id
        }
      }
    } catch {}
    finally {
      this.isPolling = false
    }
  }
}

// ── Client Object ──
export const supabase = {
  from: (table: string) => new QueryChain(table),

  auth: {
    async signUp(params: { email: string; password: string; options?: { data?: Record<string, any> } }) {
      try {
        const res = await fetch(`${API_BASE}/auth.php?action=signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })
        const json = await res.json()
        if (json.data?.session) {
          notifyAuth('SIGNED_IN', json.data.session)
        }
        return json
      } catch (err: any) {
        return { data: null, error: { message: err.message || 'Gagal mendaftar akun' } }
      }
    },

    async signInWithPassword(params: { email: string; password: string }) {
      try {
        const res = await fetch(`${API_BASE}/auth.php?action=signin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })
        const json = await res.json()
        if (json.data?.session) {
          notifyAuth('SIGNED_IN', json.data.session)
        }
        return json
      } catch (err: any) {
        return { data: null, error: { message: err.message || 'Gagal masuk akun' } }
      }
    },

    async signOut(_options?: { scope?: 'global' | 'local' | 'others' }) {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (currentSession?.access_token) {
          headers['Authorization'] = `Bearer ${currentSession.access_token}`
          headers['X-Authorization'] = `Bearer ${currentSession.access_token}`
        }
        await fetch(`${API_BASE}/auth.php?action=signout`, {
          method: 'POST',
          headers,
        })
      } catch {}
      notifyAuth('SIGNED_OUT', null)
      return { error: null }
    },

    async getSession() {
      if (currentSession && currentSession.expires_at > Date.now() / 1000) {
        return { data: { session: currentSession }, error: null }
      }
      return { data: { session: null }, error: null }
    },

    async updateUser(attributes: { email?: string; password?: string }) {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (currentSession?.access_token) {
          headers['Authorization'] = `Bearer ${currentSession.access_token}`
          headers['X-Authorization'] = `Bearer ${currentSession.access_token}`
        }
        const res = await fetch(`${API_BASE}/auth.php?action=update_user`, {
          method: 'POST',
          headers,
          body: JSON.stringify(attributes),
        })
        const json = await res.json()
        if (json.data?.session) {
          notifyAuth('USER_UPDATED', json.data.session)
        }
        return json
      } catch (err: any) {
        return { data: null, error: { message: err.message || 'Gagal memperbarui akun' } }
      }
    },

    onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
      authListeners.add(callback)
      // Langsung panggil dengan state terkini
      callback(currentSession ? 'SIGNED_IN' : 'SIGNED_OUT', currentSession)
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListeners.delete(callback)
            },
          },
        },
      }
    },
  },

  async rpc(fn: string, args: Record<string, any> = {}) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (currentSession?.access_token) {
        headers['Authorization'] = `Bearer ${currentSession.access_token}`
        headers['X-Authorization'] = `Bearer ${currentSession.access_token}`
      }
      const res = await fetch(`${API_BASE}/rpc.php?fn=${encodeURIComponent(fn)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(args),
      })
      const json = await res.json()
      return json
    } catch (err: any) {
      return { data: null, error: { message: err.message || `Gagal menjalankan fungsi ${fn}` } }
    }
  },

  channel(id: string) {
    return new RealtimeChannel(id)
  },

  removeChannel(ch: RealtimeChannel) {
    RealtimeManager.unregister(ch)
  },

  storage: {
    from(_bucket: string) {
      return {
        async upload(path: string, file: File, _options?: any) {
          try {
            const formData = new FormData()
            formData.append('avatar', file)
            formData.append('path', path)
            const res = await fetch('/upload_avatar.php', {
              method: 'POST',
              body: formData,
            })
            const json = await res.json()
            if (json.success) {
              return { data: { path: json.url || json.relative_url }, error: null }
            }
            return { data: null, error: { message: json.message || 'Upload gagal' } }
          } catch (err: any) {
            return { data: null, error: { message: err.message || 'Upload gagal' } }
          }
        },
        getPublicUrl(path: string) {
          return { data: { publicUrl: path.startsWith('http') ? path : `/uploads/avatars/${path}` } }
        },
      }
    },
  },
}

// ── Helper: Detect Provider ──
export function detectVideoProvider(url: string): { provider: 'direct'; videoId: string } {
  return { provider: 'direct', videoId: url }
}

// ── Helper: Build direct video URL ──
export function getEmbedUrl(_provider: string, videoId: string): string {
  return videoId
}
