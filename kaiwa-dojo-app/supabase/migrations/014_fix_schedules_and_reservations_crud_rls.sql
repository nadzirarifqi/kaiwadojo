-- ============================================================
-- KaiwaDoJo -- Fix Class Schedules & Reservations CRUD RLS
-- Migration: 014_fix_schedules_and_reservations_crud_rls.sql
-- ============================================================

-- 1. CLASS SCHEDULES POLICIES
DROP POLICY IF EXISTS "Allow public read schedules" ON class_schedules;
DROP POLICY IF EXISTS "Allow instructors write schedules" ON class_schedules;
DROP POLICY IF EXISTS "Allow authenticated read schedules" ON class_schedules;
DROP POLICY IF EXISTS "Allow authenticated insert schedules" ON class_schedules;
DROP POLICY IF EXISTS "Allow instructors write/update schedules" ON class_schedules;
DROP POLICY IF EXISTS "Allow instructors update schedules" ON class_schedules;
DROP POLICY IF EXISTS "Allow instructors delete schedules" ON class_schedules;
DROP POLICY IF EXISTS "Allow authenticated update schedules" ON class_schedules;
DROP POLICY IF EXISTS "Allow authenticated delete schedules" ON class_schedules;

-- Read: Anyone authenticated or public can read schedules
CREATE POLICY "Allow authenticated read schedules" ON class_schedules
  FOR SELECT USING (true);

-- Insert: Anyone authenticated can create schedules
CREATE POLICY "Allow authenticated insert schedules" ON class_schedules
  FOR INSERT WITH CHECK (true);

-- Update: Anyone authenticated can update schedules
CREATE POLICY "Allow authenticated update schedules" ON class_schedules
  FOR UPDATE USING (true);

-- Delete: Anyone authenticated can delete schedules
CREATE POLICY "Allow authenticated delete schedules" ON class_schedules
  FOR DELETE USING (true);

-- 2. CLASS RESERVATIONS POLICIES
DROP POLICY IF EXISTS "Allow users insert reservations" ON class_reservations;
DROP POLICY IF EXISTS "Allow users select reservations" ON class_reservations;
DROP POLICY IF EXISTS "Allow users delete reservations" ON class_reservations;
DROP POLICY IF EXISTS "Allow authenticated read reservations" ON class_reservations;
DROP POLICY IF EXISTS "Allow authenticated insert reservations" ON class_reservations;
DROP POLICY IF EXISTS "Allow authenticated delete reservations" ON class_reservations;

CREATE POLICY "Allow authenticated read reservations" ON class_reservations
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert reservations" ON class_reservations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated delete reservations" ON class_reservations
  FOR DELETE USING (true);
