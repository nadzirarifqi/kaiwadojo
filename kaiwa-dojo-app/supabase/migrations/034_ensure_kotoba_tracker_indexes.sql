-- ============================================================
-- MIGRATION 034: Ensure Kotoba Tracker Indexes & RLS Policy
-- Jalankan di: Supabase Dashboard > SQL Editor
-- URL: https://supabase.com/dashboard/project/qxxzanjxtsaumfjbgbcu/sql/new
-- ============================================================

-- 1. Buat index pada kolom user_id dan created_at untuk mempercepat query agregasi per siswa
CREATE INDEX IF NOT EXISTS idx_user_kotoba_submissions_user_id
  ON public.user_kotoba_submissions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_kotoba_submissions_user_created
  ON public.user_kotoba_submissions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_kotoba_submissions_mastered
  ON public.user_kotoba_submissions(is_mastered);

-- 2. Pastikan RLS Policy mengizinkan SELECT untuk Admin, Pemateri, dan Siswa
ALTER TABLE public.user_kotoba_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public full access kotoba" ON public.user_kotoba_submissions;
DROP POLICY IF EXISTS "Allow all users to read kotoba submissions" ON public.user_kotoba_submissions;
DROP POLICY IF EXISTS "Allow users to manage own kotoba" ON public.user_kotoba_submissions;

-- Policy global yang mengizinkan authenticated / anon pengguna membaca dan memanipulasi data kotoba
CREATE POLICY "Allow public full access kotoba" ON public.user_kotoba_submissions
  FOR ALL USING (true) WITH CHECK (true);

-- 3. Berikan permission ke anon, authenticated, dan service_role
GRANT ALL ON TABLE public.user_kotoba_submissions TO anon, authenticated, service_role;
