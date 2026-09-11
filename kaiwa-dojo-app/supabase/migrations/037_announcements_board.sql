-- ============================================================
-- Migration 037: Announcement Board & User Read Tracking
-- ============================================================
-- 1. Table: announcements (Official notices & updates from Admin)
-- 2. Table: user_announcement_reads (Tracks read receipts per user)
-- 3. RLS Policies and Realtime Replication
-- ============================================================

-- 1. Create announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'info' CHECK (category IN ('info', 'update', 'important', 'event', 'maintenance')),
  target_audience TEXT NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'pelajar', 'pemateri', 'admin')),
  target_group TEXT DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL DEFAULT 'Admin Dojo',
  action_url TEXT DEFAULT NULL,
  action_text TEXT DEFAULT NULL,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.announcements(is_active, is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_category ON public.announcements(category);
CREATE INDEX IF NOT EXISTS idx_announcements_target_audience ON public.announcements(target_audience);

-- 2. Create user_announcement_reads table
CREATE TABLE IF NOT EXISTS public.user_announcement_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, announcement_id)
);

-- Indices for read receipts
CREATE INDEX IF NOT EXISTS idx_user_announcement_reads_user ON public.user_announcement_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_user_announcement_reads_announcement ON public.user_announcement_reads(announcement_id);

-- 3. Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_announcement_reads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow full access announcements" ON public.announcements;
DROP POLICY IF EXISTS "Allow full access user_announcement_reads" ON public.user_announcement_reads;

-- Permissive policies for web client access (supports custom auth profile & admin)
CREATE POLICY "Allow full access announcements" ON public.announcements
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow full access user_announcement_reads" ON public.user_announcement_reads
  FOR ALL USING (true) WITH CHECK (true);

-- Permissions
GRANT ALL ON TABLE public.announcements TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_announcement_reads TO anon, authenticated, service_role;

-- 4. Enable Realtime if publication exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;
