-- ============================================================
-- MIGRATION 026: Fix lesson_progress schema & full cross-device synchronization
-- Jalankan di: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Ensure lesson_progress table exists with text lesson_id and nullable course_id
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id             UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id              TEXT        NOT NULL,
  course_id              UUID        REFERENCES public.courses(id) ON DELETE SET NULL,
  is_completed           BOOLEAN     NOT NULL DEFAULT FALSE,
  last_watched_at        TIMESTAMPTZ DEFAULT now(),
  watch_duration_seconds INT         NOT NULL DEFAULT 0,
  replay_count           INT         NOT NULL DEFAULT 0,
  UNIQUE(student_id, lesson_id)
);

-- 2. Modify existing lesson_progress table schema safely if previously created with restrictive foreign keys
DO $$
BEGIN
  -- Drop foreign key constraints on lesson_id and course_id if they exist
  ALTER TABLE public.lesson_progress DROP CONSTRAINT IF EXISTS lesson_progress_lesson_id_fkey;
  ALTER TABLE public.lesson_progress DROP CONSTRAINT IF EXISTS lesson_progress_course_id_fkey;
  
  -- Drop NOT NULL on course_id if present
  ALTER TABLE public.lesson_progress ALTER COLUMN course_id DROP NOT NULL;
  
  -- Alter lesson_id column type to TEXT to support dynamic IDs (e.g. 'lesson_bab_1_1', 'user_kotoba_...')
  ALTER TABLE public.lesson_progress ALTER COLUMN lesson_id TYPE TEXT;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 3. Ensure unique constraint exists on (student_id, lesson_id) for upsert compatibility
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lesson_progress_student_lesson_unique'
  ) THEN
    ALTER TABLE public.lesson_progress DROP CONSTRAINT IF EXISTS lesson_progress_student_id_lesson_id_key;
    ALTER TABLE public.lesson_progress ADD CONSTRAINT lesson_progress_student_lesson_unique UNIQUE (student_id, lesson_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 4. Enable RLS and permissive cross-device access policies
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lesson_progress_own" ON public.lesson_progress;
DROP POLICY IF EXISTS "Allow full access lesson_progress" ON public.lesson_progress;
DROP POLICY IF EXISTS "Users can manage their own lesson progress" ON public.lesson_progress;

CREATE POLICY "Allow full access lesson_progress" ON public.lesson_progress
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Grant permissions to anon, authenticated, and service_role
GRANT ALL ON TABLE public.lesson_progress TO anon, authenticated, service_role;

-- 6. Indices for fast lookups per student
CREATE INDEX IF NOT EXISTS idx_lesson_progress_student_id ON public.lesson_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson_id ON public.lesson_progress(lesson_id);
