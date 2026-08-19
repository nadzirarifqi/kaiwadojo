-- Migration 006: Create daily_missions table for persistent study plans
CREATE TABLE IF NOT EXISTS public.daily_missions (
    id TEXT PRIMARY KEY,
    student_id UUID NOT NULL,
    date DATE NOT NULL,
    selected_videos JSONB NOT NULL DEFAULT '[]'::jsonb,
    target_replay_count INT NOT NULL DEFAULT 3,
    target_quiz_count INT NOT NULL DEFAULT 1,
    target_kotoba_count INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_student_date UNIQUE(student_id, date)
);

-- Enable RLS
ALTER TABLE public.daily_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select daily_missions"
    ON public.daily_missions FOR SELECT
    USING (true);

CREATE POLICY "Allow authenticated users to manage daily_missions"
    ON public.daily_missions FOR ALL
    USING (true);
