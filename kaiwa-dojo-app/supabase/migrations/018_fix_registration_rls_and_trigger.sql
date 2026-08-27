-- Migration 018: Fix RLS policies and handle_new_user trigger for profiles table

-- 1. Ensure required columns exist on profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS institution TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS group_name TEXT;

-- 2. Grant RLS permissions for public registration
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert to profiles for registration" ON profiles;
CREATE POLICY "Allow public insert to profiles for registration" ON profiles
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update to profiles for registration" ON profiles;
CREATE POLICY "Allow public update to profiles for registration" ON profiles
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public select on profiles" ON profiles;
CREATE POLICY "Allow public select on profiles" ON profiles
  FOR SELECT USING (true);

-- 3. Update handle_new_user trigger function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, username, email, phone_number, role, status, institution, group_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone_number', NULL),
    'pelajar',
    COALESCE(NEW.raw_user_meta_data->>'status', 'pending'),
    COALESCE(NEW.raw_user_meta_data->>'institution', NULL),
    LOWER(TRIM(SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'institution', ''), '|', 1)))
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    username = EXCLUDED.username,
    email = EXCLUDED.email,
    phone_number = EXCLUDED.phone_number,
    status = EXCLUDED.status,
    institution = EXCLUDED.institution,
    group_name = EXCLUDED.group_name;
  RETURN NEW;
END;
$$;
