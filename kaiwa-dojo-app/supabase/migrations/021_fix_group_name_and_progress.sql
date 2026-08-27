-- ============================================================
-- MIGRATION 021: Fix Group Normalization ('VIVA Legacy') & Progress
-- Jalankan di: Supabase Dashboard > SQL Editor
-- URL: https://supabase.com/dashboard/project/qxxzanjxtsaumfjbgbcu/sql/new
-- ============================================================

-- ────────────────────────────────────────────────
-- BAGIAN 1: Update semua profile yang memiliki keyword "viva legacy" (case-insensitive)
-- agar group_name menjadi 'VIVA Legacy'
-- ────────────────────────────────────────────────
UPDATE public.profiles
SET group_name = 'VIVA Legacy'
WHERE
  institution ILIKE '%viva legacy%'
  OR group_name ILIKE '%viva legacy%';

-- ────────────────────────────────────────────────
-- BAGIAN 2: Clean up tabel kaiwa_groups
-- Hapus entri 'viva legacy' lama & daftarkan 'VIVA Legacy'
-- ────────────────────────────────────────────────
DELETE FROM public.kaiwa_groups WHERE LOWER(name) = 'viva legacy';

INSERT INTO public.kaiwa_groups (name)
VALUES ('VIVA Legacy')
ON CONFLICT (name) DO NOTHING;

-- ────────────────────────────────────────────────
-- BAGIAN 3: Update sisa profile lainnya yang memasukkan nama lembaga/grup
-- (Mengambil teks sebelum tanda '|' jika ada, atau seluruh teks institution)
-- ────────────────────────────────────────────────
UPDATE public.profiles
SET group_name = LOWER(TRIM(SPLIT_PART(institution, '|', 1)))
WHERE
  institution IS NOT NULL
  AND institution <> ''
  AND (group_name IS NULL OR group_name = '');

-- Verifikasi hasil update grup
SELECT id, full_name, username, institution, group_name
FROM public.profiles
WHERE institution IS NOT NULL AND institution <> ''
ORDER BY group_name, full_name;

-- ────────────────────────────────────────────────
-- BAGIAN 4: Cek akun baru yang memiliki progress video yang bocor dari session lama
-- ────────────────────────────────────────────────
SELECT p.id, p.full_name, p.username, p.created_at, COUNT(lp.lesson_id) as total_progress
FROM public.profiles p
JOIN public.lesson_progress lp ON lp.student_id = p.id
WHERE p.created_at >= NOW() - INTERVAL '3 days'
GROUP BY p.id, p.full_name, p.username, p.created_at
ORDER BY p.created_at DESC;

-- Jika ingin MERESET/MENGHAPUS progress bocor dari akun baru (ganti UUID sesuai kebutuhan):
-- DELETE FROM public.lesson_progress WHERE student_id = 'MASUKKAN_UUID_USER_DI_SINI';
