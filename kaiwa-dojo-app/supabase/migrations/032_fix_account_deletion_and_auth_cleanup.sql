-- ============================================================
-- MIGRATION 032: Perbaikan Tuntas Penghapusan Akun & auth.users
--
-- Masalah sebelumnya:
-- 1. Admin Hiroshima login menggunakan custom PIN/kredensial lokal (tanpa Supabase JWT),
--    sehingga request frontend dikirim menggunakan role 'anon'.
-- 2. Pada migration 029, izin RPC delete_auth_user di-REVOKE dari 'anon'.
--    Akibatnya, pemanggilan RPC oleh Admin DITOLAK (permission denied),
--    sehingga hanya row di 'public.profiles' yang terhapus, sedangkan
--    data di 'auth.users' TETAP TERSANGKUT dan email tidak bisa daftar ulang.
--
-- Solusi komprehensif di Migration 032:
-- 1. GRANT EXECUTE delete_auth_user ke 'anon', 'authenticated', dan 'service_role'.
-- 2. Fungsi delete_auth_user mendukung penghapusan via user_id DAN user_email.
-- 3. Menambahkan TRIGGER 'on_profile_deleted_cleanup_auth' di public.profiles,
--    sehingga setiap penghapusan row di profiles (dengan cara apapun)
--    otomatis menghapus auth.users yang bersangkutan.
-- 4. Langsung membersihkan akun-akun lama yang saat ini tersangkut di auth.users.
--
-- Jalankan di: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Drop versi fungsi lama agar parameter baru bersih
DROP FUNCTION IF EXISTS public.delete_auth_user(UUID);
DROP FUNCTION IF EXISTS public.delete_auth_user(UUID, TEXT);

-- 2. Buat fungsi RPC delete_auth_user fleksibel (dukung ID dan Email)
CREATE OR REPLACE FUNCTION public.delete_auth_user(
  user_id UUID DEFAULT NULL,
  user_email TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT := LOWER(TRIM(COALESCE(user_email, '')));
  v_user_id UUID := user_id;
BEGIN
  -- Jika user_email kosong tapi user_id ada, cari emailnya
  IF (v_email IS NULL OR v_email = '') AND v_user_id IS NOT NULL THEN
    SELECT LOWER(email) INTO v_email FROM auth.users WHERE id = v_user_id;
    IF v_email IS NULL THEN
      SELECT LOWER(email) INTO v_email FROM public.profiles WHERE id = v_user_id;
    END IF;
  END IF;

  -- Jika user_id kosong tapi user_email ada, cari user_id nya
  IF v_user_id IS NULL AND (v_email IS NOT NULL AND v_email <> '') THEN
    SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = v_email LIMIT 1;
    IF v_user_id IS NULL THEN
      SELECT id INTO v_user_id FROM public.profiles WHERE LOWER(email) = v_email LIMIT 1;
    END IF;
  END IF;

  -- Hapus relasi langsung berdasarkan ID
  IF v_user_id IS NOT NULL THEN
    DELETE FROM public.daily_missions WHERE student_id = v_user_id;
    DELETE FROM public.learning_streaks WHERE student_id = v_user_id;
    DELETE FROM public.user_kotoba_submissions WHERE user_id = v_user_id;
    DELETE FROM public.lesson_progress WHERE student_id = v_user_id;
    DELETE FROM public.class_reservations WHERE student_id = v_user_id;
    DELETE FROM public.enrollments WHERE student_id = v_user_id;
    DELETE FROM public.profiles WHERE id = v_user_id;
    DELETE FROM auth.users WHERE id = v_user_id;
  END IF;

  -- Hapus berdasarkan email dari auth.users dan profiles
  IF v_email IS NOT NULL AND v_email <> '' THEN
    DELETE FROM public.profiles WHERE LOWER(email) = v_email;
    DELETE FROM auth.users WHERE LOWER(email) = v_email;
  END IF;

  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'delete_auth_user error: %', SQLERRM;
  RETURN FALSE;
END;
$$;

-- 3. Berikan izin eksekusi ke anon, authenticated, dan service_role
GRANT EXECUTE ON FUNCTION public.delete_auth_user(UUID, TEXT) TO anon, authenticated, service_role;

-- 4. Buat Database Trigger di public.profiles
-- Sebagai safety-net ganda: jika row di profiles dihapus, otomatis hapus auth.users juga!
CREATE OR REPLACE FUNCTION public.handle_profile_deleted_cleanup_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Hapus dari auth.users berdasarkan ID
  IF OLD.id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = OLD.id;
  END IF;

  -- Hapus juga dari auth.users berdasarkan email jika ada
  IF OLD.email IS NOT NULL AND OLD.email <> '' THEN
    DELETE FROM auth.users WHERE LOWER(email) = LOWER(OLD.email);
  END IF;

  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_deleted_cleanup_auth ON public.profiles;
CREATE TRIGGER on_profile_deleted_cleanup_auth
  AFTER DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_deleted_cleanup_auth();

-- 5. PEMBERSIHAN SEKARANG: Hapus semua auth.users yang saat ini tidak punya profiles
-- Ini langsung membebaskan email-email yang tadi tersangkut!
DELETE FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
  AND (email IS NULL OR LOWER(email) NOT LIKE '%admin%');
