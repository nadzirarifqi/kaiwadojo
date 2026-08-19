-- Migration 007: Create learning_streaks table for tracking daily learning streaks
CREATE TABLE IF NOT EXISTS public.learning_streaks (
    id TEXT PRIMARY KEY,
    student_id UUID NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_student_streak UNIQUE(student_id, date)
);

-- Enable RLS
ALTER TABLE public.learning_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select learning_streaks"
    ON public.learning_streaks FOR SELECT
    USING (true);

CREATE POLICY "Allow authenticated users to manage learning_streaks"
    ON public.learning_streaks FOR ALL
    USING (true);
