-- ============================================================
-- KaiwaDoJo — Class Schedules and Reservations Schema
-- Migration: 004_class_schedules_and_reservations.sql
-- ============================================================

-- 0. Update user_role Enum to include 'admin' (if needed)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';

-- 1. Create Enum for Class Type
DO $$ BEGIN
    CREATE TYPE class_type AS ENUM ('online', 'offline');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. CLASS SCHEDULES TABLE
CREATE TABLE IF NOT EXISTS class_schedules (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  type             class_type  NOT NULL DEFAULT 'online',
  title            TEXT        NOT NULL,
  subtitle_chapter TEXT        NOT NULL,
  instructor_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  instructor_name  TEXT        NOT NULL,
  date             DATE        NOT NULL,
  start_time       TIME        NOT NULL,
  end_time         TIME        NOT NULL,
  week_range_id    TEXT        NOT NULL, -- Format: YYYY-WW (e.g. 2026-W34)
  month_range_id   TEXT        NOT NULL, -- Format: YYYY-MM (e.g. 2026-08)
  meet_url         TEXT,       -- For online classes (e.g. Google Meet)
  location         TEXT,       -- For offline classes (e.g. Dojo Room A)
  max_quota        INT         NOT NULL DEFAULT 10,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. CLASS RESERVATIONS TABLE
CREATE TABLE IF NOT EXISTS class_reservations (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID        NOT NULL REFERENCES class_schedules(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_name   TEXT        NOT NULL,
  user_email  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_schedule UNIQUE (schedule_id, user_id)
);

-- RLS Policies
ALTER TABLE class_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_reservations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Allow public read schedules" ON class_schedules;
DROP POLICY IF EXISTS "Allow instructors write schedules" ON class_schedules;
DROP POLICY IF EXISTS "Allow users select reservations" ON class_reservations;
DROP POLICY IF EXISTS "Allow users insert reservations" ON class_reservations;
DROP POLICY IF EXISTS "Allow users delete reservations" ON class_reservations;

-- Allow public read access to class_schedules
CREATE POLICY "Allow public read schedules" ON class_schedules
  FOR SELECT USING (true);

-- Allow instructors and admins to create/update schedules (Using role::text cast for PostgreSQL enum safety)
CREATE POLICY "Allow instructors write schedules" ON class_schedules
  FOR ALL USING (auth.uid() = instructor_id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text IN ('pemateri', 'admin')
  ));

-- Allow users to manage their own reservations
CREATE POLICY "Allow users select reservations" ON class_reservations
  FOR SELECT USING (true);

CREATE POLICY "Allow users insert reservations" ON class_reservations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users delete reservations" ON class_reservations
  FOR DELETE USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM class_schedules s WHERE s.id = schedule_id AND s.instructor_id = auth.uid()
  ));
