import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: window.sessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    // Kurangi frekuensi heartbeat realtime channel — default 30s → 60s
    // Mengurangi beban koneksi WebSocket saat banyak user aktif sekaligus
    params: {
      eventsPerSecond: 5,
    },
    heartbeatIntervalMs: 60000,
    reconnectAfterMs: (tries: number) => Math.min(tries * 1500, 30000),
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-app-version': '1.0.0',
    },
  },
})

// ── Helper: Detect Provider ──────────────────────────────────
export function detectVideoProvider(url: string): { provider: 'direct'; videoId: string } {
  return { provider: 'direct', videoId: url }
}

// ── Helper: Build direct video URL ─────────────────────────
export function getEmbedUrl(_provider: string, videoId: string): string {
  return videoId
}
