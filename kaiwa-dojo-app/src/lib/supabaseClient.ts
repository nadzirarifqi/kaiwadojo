import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Helper: Detect Provider ──────────────────────────────────
export function detectVideoProvider(url: string): { provider: 'direct'; videoId: string } {
  return { provider: 'direct', videoId: url }
}

// ── Helper: Build direct video URL ─────────────────────────
export function getEmbedUrl(provider: string, videoId: string): string {
  return videoId
}
