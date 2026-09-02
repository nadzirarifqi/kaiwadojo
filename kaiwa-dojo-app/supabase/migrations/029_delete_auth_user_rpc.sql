-- ============================================================
-- MIGRATION 029: RPC untuk menghapus user dari auth.users
-- Saat admin hapus akun user, email harus bersih dari auth.users
-- agar user bisa mendaftar ulang dengan email yang sama.
-- Jalankan di: Supabase Dashboard > SQL Editor
-- ============================================================

-- Buat fungsi RPC dengan SECURITY DEFINER (berjalan sebagai service_role)
CREATE OR REPLACE FUNCTION delete_auth_user(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  -- Hapus dari auth.users (ini otomatis menghapus profiles via CASCADE)
  DELETE FROM auth.users WHERE id = user_id;
  RETURN FOUND;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'delete_auth_user error for %: %', user_id, SQLERRM;
  RETURN FALSE;
END;
$$;

-- Hanya service_role dan authenticated (admin panel) yang bisa menjalankan ini
REVOKE ALL ON FUNCTION delete_auth_user(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_auth_user(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION delete_auth_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_auth_user(UUID) TO service_role;
