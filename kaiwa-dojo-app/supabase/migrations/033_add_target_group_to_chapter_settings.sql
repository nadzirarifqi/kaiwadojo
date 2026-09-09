-- ============================================================
-- MIGRATION 033: Add target_group to chapter_settings
-- Menghubungkan fitur restriksi grup kursus ke database Supabase
--
-- Masalah sebelumnya:
-- Kolom 'target_group' belum ada pada tabel 'chapter_settings',
-- sehingga setiap kali admin memilih grup untuk suatu bab kursus,
-- PostgREST mengembalikan error (PGRST204) dan target_group tidak tersimpan.
-- Akibatnya, di sisi akun user/siswa, restriksi tidak berpengaruh apa-apa.
--
-- Jalankan di: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Tambahkan kolom target_group ke tabel public.chapter_settings jika belum ada
ALTER TABLE public.chapter_settings
ADD COLUMN IF NOT EXISTS target_group TEXT DEFAULT NULL;

-- 2. Pastikan RLS Policies mendukung SELECT dan UPDATE/INSERT untuk anon & authenticated
-- (Admin login lokal menggunakan role anon, sedangkan siswa login menggunakan authenticated)
ALTER TABLE public.chapter_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to chapter_settings" ON public.chapter_settings;
DROP POLICY IF EXISTS "Allow authenticated select chapter_settings" ON public.chapter_settings;
DROP POLICY IF EXISTS "Allow authenticated insert chapter_settings" ON public.chapter_settings;
DROP POLICY IF EXISTS "Allow authenticated update chapter_settings" ON public.chapter_settings;
DROP POLICY IF EXISTS "Allow all access to chapter_settings" ON public.chapter_settings;

-- Izinkan read untuk semua (siswa & pengunjung)
CREATE POLICY "Allow public read access to chapter_settings"
    ON public.chapter_settings
    FOR SELECT
    USING (true);

-- Izinkan insert/update untuk pengguna terautentikasi dan admin lokal (anon)
CREATE POLICY "Allow all access to chapter_settings"
    ON public.chapter_settings
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 3. Berikan permission akses tabel ke anon, authenticated, dan service_role
GRANT ALL ON TABLE public.chapter_settings TO anon, authenticated, service_role;

-- 4. Reload PostgREST schema cache agar kolom baru langsung dikenali tanpa restart
NOTIFY pgrst, 'reload schema';
