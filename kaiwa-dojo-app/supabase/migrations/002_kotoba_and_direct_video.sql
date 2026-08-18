-- ============================================================
--  KaiwaDoJo — Migration 002: Kotoba & Direct Video Support
-- ============================================================

-- 1. Tambah tipe content 'kotoba' dan video provider 'direct'
ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'kotoba';
ALTER TYPE video_provider ADD VALUE IF NOT EXISTS 'direct';

-- 2. Tabel khusus Setoran Kosakata (Kotoba) per Bab/Lesson
CREATE TABLE IF NOT EXISTS lesson_kotoba (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id   UUID        NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  kanji_kana  TEXT        NOT NULL, -- Contoh: わたし (watashi)
  romaji      TEXT,                 -- Contoh: watashi
  meaning     TEXT        NOT NULL, -- Contoh: Saya
  order_index INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. RLS (Row Level Security) untuk lesson_kotoba
ALTER TABLE lesson_kotoba ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Siswa bisa membaca kotoba"
  ON lesson_kotoba FOR SELECT
  TO authenticated
  USING (true);

-- 4. Indexing untuk mempercepat query kosakata per bab
CREATE INDEX IF NOT EXISTS idx_lesson_kotoba_lesson_id ON lesson_kotoba(lesson_id);
