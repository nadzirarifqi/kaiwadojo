-- ============================================================
-- KaiwaDoJo — Add Multi-Day Support for Offline Classes (3 Hari 2 Malam)
-- Migration: 016_add_multi_day_schedules.sql
-- ============================================================

ALTER TABLE public.class_schedules
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Backfill existing rows with date
UPDATE public.class_schedules
SET start_date = date
WHERE start_date IS NULL;

UPDATE public.class_schedules
SET end_date = date
WHERE end_date IS NULL;
