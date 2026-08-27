-- ============================================================
-- JALANKAN SQL INI DI SUPABASE DASHBOARD > SQL EDITOR
-- URL: https://supabase.com/dashboard/project/qxxzanjxtsaumfjbgbcu/sql
-- ============================================================

-- Pastikan kolom yang diperlukan ada
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS institution TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS group_name TEXT;

-- Buat ulang fungsi trigger dengan exception handler paling aman
-- PENTING: EXCEPTION WHEN OTHERS di level terluar agar 500 error tidak muncul
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    -- Jangan propagate error ke auth.users agar signup tidak gagal 500
    RAISE WARNING 'handle_new_user error (user: %): %', NEW.id, SQLERRM;
  END;

  -- Update kolom tambahan setelah insert berhasil (opsional, tidak menyebabkan 500)
  BEGIN
    UPDATE public.profiles
    SET
      institution = COALESCE(NEW.raw_user_meta_data->>'institution', NULL),
      group_name  = LOWER(TRIM(SPLIT_PART(
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'institution', ''), ''),
        '|', 1
      )))
    WHERE id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user UPDATE institution error (user: %): %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Bind trigger ke auth.users (hapus dulu jika sudah ada)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
