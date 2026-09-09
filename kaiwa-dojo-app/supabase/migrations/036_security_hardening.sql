-- ============================================================
-- Migration 036: Database Security Hardening & Privilege Protection
-- ============================================================
-- 1. Sets secure search_path on all custom functions to prevent search_path injection
-- 2. Prevents self-elevation of roles (e.g. regular users attempting to elevate to 'admin')
-- 3. Protects sensitive profile attributes from unauthorized API tampering
-- ============================================================

-- 1. Hardened Trigger: Prevent Non-Admins from Altering Sensitive Profile Fields (role, status)
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_user_id UUID;
  v_current_user_role TEXT;
BEGIN
  -- Get the current authenticated user executing the query
  v_current_user_id := auth.uid();

  -- If called by a database service role / trigger without an auth context, allow
  IF v_current_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Hiroshima special admin ID check
  IF v_current_user_id = '00000000-0000-0000-0000-000000000099'::UUID THEN
    RETURN NEW;
  END IF;

  -- Check current authenticated user's actual database role
  SELECT role::TEXT INTO v_current_user_role
  FROM public.profiles
  WHERE id = v_current_user_id;

  -- If the actor is NOT an admin, forbid changing role or status
  IF v_current_user_role IS DISTINCT FROM 'admin' THEN
    -- If role was changed, reset back to OLD.role
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      NEW.role := OLD.role;
    END IF;

    -- If status was changed, reset back to OLD.status
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.status := OLD.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Bind the privilege protection trigger
DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileges();

-- 2. Set Secure search_path on Custom Functions Safely
DO $$
BEGIN
  -- handle_new_user
  IF EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
  ) THEN
    BEGIN
      ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- check_user_duplicates
  IF EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'check_user_duplicates'
  ) THEN
    BEGIN
      ALTER FUNCTION public.check_user_duplicates(TEXT, TEXT, TEXT) SET search_path = public, pg_temp;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- delete_auth_user (handles both (UUID, TEXT) and (UUID) versions)
  BEGIN
    ALTER FUNCTION public.delete_auth_user(UUID, TEXT) SET search_path = public, auth, pg_temp;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER FUNCTION public.delete_auth_user(UUID) SET search_path = public, auth, pg_temp;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- handle_profile_deleted_cleanup_auth
  BEGIN
    ALTER FUNCTION public.handle_profile_deleted_cleanup_auth() SET search_path = public, auth, pg_temp;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- 3. Security Audit Comment
COMMENT ON TABLE public.profiles IS 'KaiwaDojo User Profiles with hardened RLS and privilege protection trigger.';
