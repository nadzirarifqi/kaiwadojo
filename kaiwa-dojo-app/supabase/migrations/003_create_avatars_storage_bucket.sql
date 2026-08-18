-- ============================================================
--  KaiwaDoJo — Migration 003: Storage Bucket for Avatars
-- ============================================================

-- 1. Buat Storage Bucket 'avatars' (Public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- Maksimal 5MB (5 * 1024 * 1024 bytes)
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Kebijakan RLS (Row Level Security) untuk Storage Bucket 'avatars'

-- A. Publik/Siapa saja dapat membaca/melihat foto avatar
DROP POLICY IF EXISTS "Public Access for Avatars" ON storage.objects;
CREATE POLICY "Public Access for Avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- B. Pengguna terotentikasi dapat mengunggah foto ke bucket avatars
DROP POLICY IF EXISTS "Authenticated Users can Upload Avatars" ON storage.objects;
CREATE POLICY "Authenticated Users can Upload Avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');

-- C. Pengguna terotentikasi dapat memperbarui foto di bucket avatars
DROP POLICY IF EXISTS "Authenticated Users can Update Avatars" ON storage.objects;
CREATE POLICY "Authenticated Users can Update Avatars"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars');

-- D. Pengguna terotentikasi dapat menghapus foto di bucket avatars
DROP POLICY IF EXISTS "Authenticated Users can Delete Avatars" ON storage.objects;
CREATE POLICY "Authenticated Users can Delete Avatars"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars');
