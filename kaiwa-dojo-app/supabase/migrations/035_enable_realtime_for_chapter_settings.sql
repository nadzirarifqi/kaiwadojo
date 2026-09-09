-- ============================================================
-- MIGRATION 035: Enable Realtime Publication for Chapter Settings, Kotoba, and Schedules
-- Mengaktifkan pengiriman event WebSocket Realtime Supabase untuk tabel chapter_settings
-- Jalankan di: Supabase Dashboard > SQL Editor
-- URL: https://supabase.com/dashboard/project/qxxzanjxtsaumfjbgbcu/sql/new
-- ============================================================

-- 1. Daftarkan tabel ke dalam supabase_realtime publication
DO $$
BEGIN
  -- chapter_settings
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chapter_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chapter_settings;
  END IF;

  -- user_kotoba_submissions
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_kotoba_submissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_kotoba_submissions;
  END IF;

  -- class_schedules
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'class_schedules'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_schedules;
  END IF;

  -- class_reservations
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'class_reservations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_reservations;
  END IF;
END $$;

-- 2. Set REPLICA IDENTITY FULL agar update/delete mengirimkan seluruh kolom baris ke realtime payload
ALTER TABLE public.chapter_settings REPLICA IDENTITY FULL;
ALTER TABLE public.user_kotoba_submissions REPLICA IDENTITY FULL;
ALTER TABLE public.class_schedules REPLICA IDENTITY FULL;
ALTER TABLE public.class_reservations REPLICA IDENTITY FULL;

-- 3. Pastikan RLS Policy tabel chapter_settings terbuka penuh untuk SELECT
ALTER TABLE public.chapter_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to chapter_settings" ON public.chapter_settings;
DROP POLICY IF EXISTS "Allow all access to chapter_settings" ON public.chapter_settings;

CREATE POLICY "Allow public read access to chapter_settings"
  ON public.chapter_settings
  FOR SELECT
  USING (true);

CREATE POLICY "Allow all access to chapter_settings"
  ON public.chapter_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT ALL ON TABLE public.chapter_settings TO anon, authenticated, service_role;

-- 4. Reload schema cache
NOTIFY pgrst, 'reload schema';
