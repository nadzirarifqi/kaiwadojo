-- ============================================================
-- MIGRATION 031: Rename grup VLI2608 -> VIVA LEGACY 02
-- Jalankan di: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Hapus grup lama VLI2608 dan daftarkan VIVA LEGACY 02
DELETE FROM public.kaiwa_groups WHERE LOWER(name) = 'vli2608';

INSERT INTO public.kaiwa_groups (name, keywords, description)
VALUES (
  'VIVA LEGACY 02',
  'viva legacy, vli2608, vli 2608, viva, vli',
  'Grup Resmi Pelajar VIVA Legacy 02'
)
ON CONFLICT (name) DO UPDATE SET
  keywords = EXCLUDED.keywords,
  description = EXCLUDED.description,
  updated_at = now();

-- 2. Update semua profil user yang masih di grup VLI2608
UPDATE public.profiles
SET group_name = 'VIVA LEGACY 02'
WHERE LOWER(group_name) = 'vli2608'
   OR LOWER(group_name) = 'vli 2608';

-- 3. Update jadwal kelas yang masih pakai nama lama
UPDATE public.class_schedules
SET target_group = 'VIVA LEGACY 02'
WHERE LOWER(target_group) IN ('vli2608', 'vli 2608', 'viva legacy');

-- 4. Update trigger handle_new_user (fallback VLI2608 -> VIVA LEGACY 02)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $`$
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

      -- Fallback: jika belum ada di tabel kaiwa_groups, cek keyword viva legacy
      IF v_matched_group IS NULL AND (
        LOWER(v_raw_inst) LIKE '%viva legacy%' OR
        LOWER(v_raw_inst) LIKE '%vli2608%' OR
        LOWER(v_raw_inst) LIKE '%vli 2608%'
      ) THEN
        v_matched_group := 'VIVA LEGACY 02';
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
$`$;

-- Verifikasi hasil
SELECT name, keywords FROM public.kaiwa_groups ORDER BY name;
