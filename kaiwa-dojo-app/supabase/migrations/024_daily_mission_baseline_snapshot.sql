-- ============================================================
-- MIGRATION 024: Add baseline_snapshot to daily_missions table
-- Jalankan di: Supabase Dashboard > SQL Editor
-- URL: https://supabase.com/dashboard/project/qxxzanjxtsaumfjbgbcu/sql/new
-- ============================================================

-- Tambah kolom baseline_snapshot pada tabel daily_missions jika belum ada
ALTER TABLE public.daily_missions
  ADD COLUMN IF NOT EXISTS baseline_snapshot JSONB DEFAULT '{}'::jsonb;

-- Pastikan RLS tetap full access untuk user
DROP POLICY IF EXISTS "Allow public select daily_missions" ON public.daily_missions;
DROP POLICY IF EXISTS "Allow authenticated users to manage daily_missions" ON public.daily_missions;
DROP POLICY IF EXISTS "Allow all daily_missions" ON public.daily_missions;

CREATE POLICY "Allow all daily_missions"
  ON public.daily_missions
  FOR ALL
  USING (true)
  WITH CHECK (true);


GRANT ALL ON TABLE public.daily_missions TO anon, authenticated, service_role;
