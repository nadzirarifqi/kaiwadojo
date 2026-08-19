-- Migration 005: Create chapter_settings table for custom titles and visibility toggle
CREATE TABLE IF NOT EXISTS public.chapter_settings (
    bab_number INT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL DEFAULT '',
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    custom_video_s1 TEXT,
    custom_video_s2 TEXT,
    custom_video_s3 TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.chapter_settings ENABLE ROW LEVEL SECURITY;

-- Everyone (students and instructors) can read chapter settings
CREATE POLICY "Allow public read access to chapter_settings"
    ON public.chapter_settings
    FOR SELECT
    USING (true);

-- Authenticated users (instructors/admins) can insert/update chapter settings
CREATE POLICY "Allow authenticated users to manage chapter_settings"
    ON public.chapter_settings
    FOR ALL
    USING (auth.role() = 'authenticated');
