-- Migration 017: Add Institution / Perguruan Tinggi Column to Profiles Table and Update handle_new_user Trigger

-- 1. Add institution column to profiles if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'institution'
    ) THEN
        ALTER TABLE profiles ADD COLUMN institution TEXT;
    END IF;
END $$;

-- 2. Update handle_new_user trigger function to include institution
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, username, email, phone_number, role, status, institution)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone_number', NULL),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'pelajar'),
    COALESCE(NEW.raw_user_meta_data->>'status', 'pending'),
    COALESCE(NEW.raw_user_meta_data->>'institution', NULL)
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    username = EXCLUDED.username,
    email = EXCLUDED.email,
    phone_number = EXCLUDED.phone_number,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    institution = EXCLUDED.institution;
  RETURN NEW;
END;
$$;
