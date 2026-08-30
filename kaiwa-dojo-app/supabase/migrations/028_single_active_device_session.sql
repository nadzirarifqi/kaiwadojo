-- ============================================================
-- MIGRATION 028: Single Active Device Session & Multi-Device Takeover
-- Jalankan di: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Tambahkan kolom sesi perangkat pada tabel profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_session_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_device_info TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_session_at TIMESTAMPTZ DEFAULT now();

-- 2. Pastikan tabel profiles terdaftar di supabase_realtime publication
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 3. Pastikan permission ke tabel profiles lengkap
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;
