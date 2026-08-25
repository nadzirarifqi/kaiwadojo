-- ============================================================
-- KaiwaDoJo -- Fix chapter_settings column types & RLS
-- Migration: 015_fix_chapter_settings_schema_and_rls.sql
-- ============================================================

-- 1. Alter duration columns to TEXT to support string formatted durations like '15.30' or '3.44'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chapter_settings' AND column_name = 'duration_s1'
    ) THEN
        ALTER TABLE public.chapter_settings ALTER COLUMN duration_s1 TYPE TEXT USING duration_s1::text;
        ALTER TABLE public.chapter_settings ALTER COLUMN duration_s2 TYPE TEXT USING duration_s2::text;
        ALTER TABLE public.chapter_settings ALTER COLUMN duration_s3 TYPE TEXT USING duration_s3::text;
    END IF;
END $$;

-- 2. Ensure custom_video columns exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chapter_settings' AND column_name = 'custom_video_s1') THEN
        ALTER TABLE public.chapter_settings ADD COLUMN custom_video_s1 TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chapter_settings' AND column_name = 'custom_video_s2') THEN
        ALTER TABLE public.chapter_settings ADD COLUMN custom_video_s2 TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chapter_settings' AND column_name = 'custom_video_s3') THEN
        ALTER TABLE public.chapter_settings ADD COLUMN custom_video_s3 TEXT;
    END IF;
END $$;

-- 3. RLS Policies for chapter_settings
ALTER TABLE public.chapter_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to chapter_settings" ON public.chapter_settings;
DROP POLICY IF EXISTS "Allow authenticated users to manage chapter_settings" ON public.chapter_settings;
DROP POLICY IF EXISTS "Allow authenticated select chapter_settings" ON public.chapter_settings;
DROP POLICY IF EXISTS "Allow authenticated insert chapter_settings" ON public.chapter_settings;
DROP POLICY IF EXISTS "Allow authenticated update chapter_settings" ON public.chapter_settings;

CREATE POLICY "Allow authenticated select chapter_settings" ON public.chapter_settings
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert chapter_settings" ON public.chapter_settings
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update chapter_settings" ON public.chapter_settings
    FOR UPDATE USING (true);
