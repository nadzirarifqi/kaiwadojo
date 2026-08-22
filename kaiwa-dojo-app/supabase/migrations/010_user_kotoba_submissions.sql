-- Create user_kotoba_submissions table
CREATE TABLE IF NOT EXISTS user_kotoba_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  japanese TEXT NOT NULL,
  romaji TEXT NOT NULL,
  meaning TEXT NOT NULL,
  image_url TEXT,
  is_mastered BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_kotoba_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own kotoba submissions"
  ON user_kotoba_submissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own kotoba submissions"
  ON user_kotoba_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own kotoba submissions"
  ON user_kotoba_submissions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own kotoba submissions"
  ON user_kotoba_submissions FOR DELETE
  USING (auth.uid() = user_id);
