-- ============================================================
-- MIGRATION 027: Fix Feedback & Suggestions RLS & Enable Realtime
-- Jalankan query ini di: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Pastikan tabel feedback_suggestions ada
CREATE TABLE IF NOT EXISTS public.feedback_suggestions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  name         TEXT        NOT NULL DEFAULT 'Anonim',
  email        TEXT,
  phone_number TEXT,
  role         TEXT        NOT NULL DEFAULT 'tamu',
  category     TEXT        NOT NULL DEFAULT 'saran_fitur',
  rating       INTEGER     DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  title        TEXT,
  message      TEXT        NOT NULL,
  page_url     TEXT,
  status       TEXT        NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'in_progress', 'resolved', 'archived')),
  admin_notes  TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- 2. Aktifkan Row Level Security (RLS)
ALTER TABLE public.feedback_suggestions ENABLE ROW LEVEL SECURITY;

-- 3. Hapus policy lama yang membatasi SELECT
DROP POLICY IF EXISTS "Public and authenticated users can insert feedback" ON public.feedback_suggestions;
DROP POLICY IF EXISTS "Users can view own feedback or Admin can view all" ON public.feedback_suggestions;
DROP POLICY IF EXISTS "Admin can update feedback" ON public.feedback_suggestions;
DROP POLICY IF EXISTS "Admin can delete feedback" ON public.feedback_suggestions;
DROP POLICY IF EXISTS "Allow full access feedback" ON public.feedback_suggestions;

-- 4. Buat policy Full Access (SELECT, INSERT, UPDATE, DELETE) untuk anon & authenticated
CREATE POLICY "Allow full access feedback" ON public.feedback_suggestions
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Berikan hak akses ke anon, authenticated, dan service_role
GRANT ALL ON TABLE public.feedback_suggestions TO anon, authenticated, service_role;

-- 6. Tambahkan ke Realtime Publication (agar admin page update live secara otomatis)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_suggestions;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
