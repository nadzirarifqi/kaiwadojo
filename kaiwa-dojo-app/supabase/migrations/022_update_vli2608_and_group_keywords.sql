-- ============================================================
-- MIGRATION 022: Update Group 'VLI2608', Keywords Support & Regular Student Rule
-- Jalankan di: Supabase Dashboard > SQL Editor
-- URL: https://supabase.com/dashboard/project/qxxzanjxtsaumfjbgbcu/sql/new
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- BAGIAN 1: Pastikan Tabel kaiwa_groups Memiliki Kolom Keywords & Description
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kaiwa_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  keywords TEXT DEFAULT '',
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.kaiwa_groups ADD COLUMN IF NOT EXISTS keywords TEXT DEFAULT '';
ALTER TABLE public.kaiwa_groups ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.kaiwa_groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- RLS untuk kaiwa_groups
ALTER TABLE public.kaiwa_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view groups" ON public.kaiwa_groups;
DROP POLICY IF EXISTS "Authenticated can manage groups" ON public.kaiwa_groups;
DROP POLICY IF EXISTS "Allow public full access to groups" ON public.kaiwa_groups;

CREATE POLICY "Allow public full access to groups" ON public.kaiwa_groups
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.kaiwa_groups TO anon, authenticated, service_role;

-- ────────────────────────────────────────────────────────────
-- BAGIAN 2: Daftarkan & Update Grup 'VLI2608' dengan Keywords
-- ────────────────────────────────────────────────────────────
-- Hapus entri 'viva legacy' lama jika ada
DELETE FROM public.kaiwa_groups WHERE LOWER(name) IN ('viva legacy', 'viva_legacy', 'viva');

-- Daftarkan / Upsert Grup VLI2608 dengan keywords
INSERT INTO public.kaiwa_groups (name, keywords, description)
VALUES (
  'VLI2608',
  'viva legacy, vli2608, vli 2608, viva, vli',
  'Grup Resmi Pelajar VIVA Legacy (VLI2608)'
)
ON CONFLICT (name) DO UPDATE SET
  keywords = EXCLUDED.keywords,
  description = EXCLUDED.description,
  updated_at = now();

-- ────────────────────────────────────────────────────────────
-- BAGIAN 3: Update Profile User yang Mengandung Keyword Viva Legacy / VLI -> 'VLI2608'
-- ────────────────────────────────────────────────────────────
UPDATE public.profiles
SET group_name = 'VLI2608'
WHERE
  institution ILIKE '%viva legacy%'
  OR institution ILIKE '%vli2608%'
  OR institution ILIKE '%vli 2608%'
  OR group_name ILIKE '%viva legacy%'
  OR group_name ILIKE '%vli2608%';

-- ────────────────────────────────────────────────────────────
-- BAGIAN 4: Update Jadwal Kelas (class_schedules) Target Group 'VIVA Legacy' -> 'VLI2608'
-- ────────────────────────────────────────────────────────────
UPDATE public.class_schedules
SET target_group = 'VLI2608'
WHERE
  target_group ILIKE '%viva legacy%'
  OR target_group ILIKE '%vli%';

-- ────────────────────────────────────────────────────────────
-- BAGIAN 5: Fallback Siswa Biasa (Di Luar Grup yang Terdaftar oleh Admin)
-- Semua profil dengan group_name yang TIDAK ADA di kaiwa_groups di-reset ke NULL (Siswa Biasa)
-- ────────────────────────────────────────────────────────────
UPDATE public.profiles
SET group_name = NULL
WHERE
  group_name IS NOT NULL
  AND group_name <> ''
  AND LOWER(TRIM(group_name)) NOT IN (
    SELECT LOWER(TRIM(name)) FROM public.kaiwa_groups
  );

-- ────────────────────────────────────────────────────────────
-- BAGIAN 6: Update Trigger handle_new_user dengan Pencocokan VLI2608 / Siswa Biasa
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw_inst TEXT;
  v_matched_group TEXT := NULL;
  v_grp RECORD;
  v_kw TEXT;
  v_kw_array TEXT[];
BEGIN
  -- 1. Insert initial profile
  BEGIN
    INSERT INTO public.profiles (
      id,
      full_name,
      username,
      email,
      phone_number,
      role,
      status
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
        SPLIT_PART(NEW.email, '@', 1)
      ),
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'phone_number', NULL),
      'pelajar'::user_role,
      COALESCE(NEW.raw_user_meta_data->>'status', 'pending')
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name    = EXCLUDED.full_name,
      username     = EXCLUDED.username,
      email        = EXCLUDED.email,
      phone_number = EXCLUDED.phone_number,
      status       = EXCLUDED.status;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user insert profile error (user: %): %', NEW.id, SQLERRM;
  END;

  -- 2. Evaluasi grup berdasarkan keyword instansi terhadap tabel kaiwa_groups
  BEGIN
    v_raw_inst := COALESCE(NULLIF(NEW.raw_user_meta_data->>'institution', ''), '');

    IF v_raw_inst <> '' THEN
      -- Cek apakah cocok dengan salah satu grup di kaiwa_groups
      FOR v_grp IN SELECT name, keywords FROM public.kaiwa_groups LOOP
        -- Cek nama grup langsung
        IF LOWER(v_raw_inst) LIKE '%' || LOWER(TRIM(v_grp.name)) || '%' THEN
          v_matched_group := v_grp.name;
          EXIT;
        END IF;

        -- Cek kata kunci yang dipisahkan koma
        IF v_grp.keywords IS NOT NULL AND v_grp.keywords <> '' THEN
          v_kw_array := string_to_array(v_grp.keywords, ',');
          FOREACH v_kw IN ARRAY v_kw_array LOOP
            v_kw := LOWER(TRIM(v_kw));
            IF v_kw <> '' AND LOWER(v_raw_inst) LIKE '%' || v_kw || '%' THEN
              v_matched_group := v_grp.name;
              EXIT;
            END IF;
          END LOOP;
        END IF;

        IF v_matched_group IS NOT NULL THEN
          EXIT;
        END IF;
      END LOOP;

      -- Fallback khusus VLI2608 jika belum ada di tabel kaiwa_groups
      IF v_matched_group IS NULL AND LOWER(v_raw_inst) LIKE '%viva legacy%' THEN
        v_matched_group := 'VLI2608';
      END IF;
    END IF;

    UPDATE public.profiles
    SET
      institution = NULLIF(v_raw_inst, ''),
      group_name  = v_matched_group
    WHERE id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user update institution/group error (user: %): %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Verifikasi hasil
SELECT id, full_name, username, institution, group_name
FROM public.profiles
ORDER BY group_name NULLS LAST, full_name;
