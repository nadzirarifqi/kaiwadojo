-- Migration 020: Fix handle_new_user trigger enum casting and add exception safety

-- 1. Ensure required columns exist on profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS institution TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS group_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- 2. Update handle_new_user trigger function with safe enum casting and exception handlers
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_role user_role := 'pelajar';
  v_institution TEXT := COALESCE(NEW.raw_user_meta_data->>'institution', NULL);
  v_group TEXT := NULL;
BEGIN
  -- Safely parse role enum
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    BEGIN
      v_user_role := (NEW.raw_user_meta_data->>'role')::user_role;
    EXCEPTION WHEN OTHERS THEN
      v_user_role := 'pelajar'::user_role;
    END;
  END IF;

  -- Extract group name from institution (e.g. "VIVA Legacy | STAI DT" -> "viva legacy")
  IF v_institution IS NOT NULL AND v_institution <> '' THEN
    v_group := LOWER(TRIM(SPLIT_PART(v_institution, '|', 1)));
  END IF;

  BEGIN
    INSERT INTO profiles (
      id,
      full_name,
      username,
      email,
      phone_number,
      role,
      status,
      institution,
      group_name
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'phone_number', NULL),
      v_user_role,
      COALESCE(NEW.raw_user_meta_data->>'status', 'pending'),
      v_institution,
      v_group
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      username = EXCLUDED.username,
      email = EXCLUDED.email,
      phone_number = EXCLUDED.phone_number,
      role = EXCLUDED.role,
      status = EXCLUDED.status,
      institution = EXCLUDED.institution,
      group_name = EXCLUDED.group_name;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback insertion if optional columns/constraints fail
    BEGIN
      INSERT INTO profiles (id, full_name, username, email, phone_number, role, status)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'phone_number', NULL),
        v_user_role,
        COALESCE(NEW.raw_user_meta_data->>'status', 'pending')
      )
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        username = EXCLUDED.username,
        email = EXCLUDED.email,
        phone_number = EXCLUDED.phone_number,
        role = EXCLUDED.role,
        status = EXCLUDED.status;
    EXCEPTION WHEN OTHERS THEN
      -- Log warning and return NEW so auth.users insertion succeeds even if profiles trigger has issue
      RAISE WARNING 'handle_new_user trigger exception for user %: %', NEW.id, SQLERRM;
    END;
  END;

  RETURN NEW;
END;
$$;

-- 3. Bind trigger function to auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
