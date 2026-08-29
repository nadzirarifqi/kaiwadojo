-- ============================================================
-- MIGRATION 023: Unlimited Kotoba Submissions & Full Permissive RLS
-- Jalankan di: Supabase Dashboard > SQL Editor
-- URL: https://supabase.com/dashboard/project/qxxzanjxtsaumfjbgbcu/sql/new
-- ============================================================

-- 1. Pastikan tabel user_kotoba_submissions ada dan kolom lengkap
CREATE TABLE IF NOT EXISTS public.user_kotoba_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  japanese TEXT NOT NULL,
  romaji TEXT NOT NULL,
  meaning TEXT NOT NULL,
  image_url TEXT,
  is_mastered BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pastikan kolom tidak bernilai NOT NULL kaku pada user_id jika user guest/fallback
ALTER TABLE public.user_kotoba_submissions ALTER COLUMN user_id DROP NOT NULL;

-- 2. Aktifkan RLS & buat Policy Full Access (SELECT, INSERT, UPDATE, DELETE)
ALTER TABLE public.user_kotoba_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own kotoba submissions" ON public.user_kotoba_submissions;
DROP POLICY IF EXISTS "Users can insert their own kotoba submissions" ON public.user_kotoba_submissions;
DROP POLICY IF EXISTS "Users can update their own kotoba submissions" ON public.user_kotoba_submissions;
DROP POLICY IF EXISTS "Users can delete their own kotoba submissions" ON public.user_kotoba_submissions;
DROP POLICY IF EXISTS "Allow public full access kotoba" ON public.user_kotoba_submissions;

CREATE POLICY "Allow public full access kotoba" ON public.user_kotoba_submissions
  FOR ALL USING (true) WITH CHECK (true);

-- 3. Berikan permission ke anon, authenticated, and service_role
GRANT ALL ON TABLE public.user_kotoba_submissions TO anon, authenticated, service_role;
