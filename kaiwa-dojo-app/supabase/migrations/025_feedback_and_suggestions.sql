-- Migration 025: Create feedback_suggestions table & RLS policies
CREATE TABLE IF NOT EXISTS feedback_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT 'Anonim',
  email TEXT,
  phone_number TEXT,
  role TEXT NOT NULL DEFAULT 'tamu',
  category TEXT NOT NULL DEFAULT 'saran_fitur', -- 'saran_fitur', 'laporan_bug', 'materi', 'desain_ui', 'lainnya'
  rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  message TEXT NOT NULL,
  page_url TEXT,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'in_progress', 'resolved', 'archived')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indices for faster querying & sorting
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback_suggestions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback_suggestions(category);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback_suggestions(user_id);

-- Enable RLS
ALTER TABLE feedback_suggestions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public and authenticated users can insert feedback" ON feedback_suggestions;
DROP POLICY IF EXISTS "Users can view own feedback or Admin can view all" ON feedback_suggestions;
DROP POLICY IF EXISTS "Admin can update feedback" ON feedback_suggestions;
DROP POLICY IF EXISTS "Admin can delete feedback" ON feedback_suggestions;

-- RLS Policies
-- 1. Anyone (public guests and logged-in users) can submit feedback
CREATE POLICY "Public and authenticated users can insert feedback"
  ON feedback_suggestions FOR INSERT
  WITH CHECK (true);

-- 2. Authenticated users can view their own feedbacks, while admins can view all feedbacks
CREATE POLICY "Users can view own feedback or Admin can view all"
  ON feedback_suggestions FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 3. Only admins can update feedback (status, admin_notes, etc.)
CREATE POLICY "Admin can update feedback"
  ON feedback_suggestions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 4. Only admins can delete feedback
CREATE POLICY "Admin can delete feedback"
  ON feedback_suggestions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
