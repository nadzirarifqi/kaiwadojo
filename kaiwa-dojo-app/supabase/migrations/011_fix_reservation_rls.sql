-- ============================================================
-- KaiwaDoJo -- Fix Class Reservation RLS & Schedules Policy
-- Migration: 011_fix_reservation_rls.sql
-- ============================================================

-- 1. CLASS SCHEDULES POLICIES: Allow authenticated users to insert/read schedules
DROP POLICY IF EXISTS "Allow public read schedules" ON class_schedules;
DROP POLICY IF EXISTS "Allow instructors write schedules" ON class_schedules;
DROP POLICY IF EXISTS "Allow authenticated read schedules" ON class_schedules;
DROP POLICY IF EXISTS "Allow authenticated insert schedules" ON class_schedules;
DROP POLICY IF EXISTS "Allow instructors write/update schedules" ON class_schedules;

CREATE POLICY "Allow authenticated read schedules" ON class_schedules
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert schedules" ON class_schedules
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow instructors write/update schedules" ON class_schedules
  FOR UPDATE USING (
    auth.uid() = instructor_id OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text IN ('pemateri', 'admin')
    )
  );

-- 2. CLASS RESERVATIONS POLICIES
DROP POLICY IF EXISTS "Allow users insert reservations" ON class_reservations;
DROP POLICY IF EXISTS "Allow users select reservations" ON class_reservations;
DROP POLICY IF EXISTS "Allow users delete reservations" ON class_reservations;
DROP POLICY IF EXISTS "Allow authenticated read reservations" ON class_reservations;
DROP POLICY IF EXISTS "Allow authenticated insert reservations" ON class_reservations;
DROP POLICY IF EXISTS "Allow authenticated delete reservations" ON class_reservations;

CREATE POLICY "Allow authenticated read reservations" ON class_reservations
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated insert reservations" ON class_reservations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated delete reservations" ON class_reservations
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM class_schedules s
      WHERE s.id = schedule_id
        AND (
          s.instructor_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role::text = 'admin'
          )
        )
    )
  );

-- 3. INDEXES FOR FAST REALTIME QUOTA LOOKUP
CREATE INDEX IF NOT EXISTS idx_class_reservations_schedule_id
  ON class_reservations(schedule_id);

CREATE INDEX IF NOT EXISTS idx_class_reservations_user_id
  ON class_reservations(user_id);
