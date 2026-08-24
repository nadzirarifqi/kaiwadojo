-- Migration 012: Add Status Column to Profiles and Allow Admin Verification RLS Updates

-- 1. Add status, phone_number, and email columns to profiles if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'status'
    ) THEN
        ALTER TABLE profiles ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'phone_number'
    ) THEN
        ALTER TABLE profiles ADD COLUMN phone_number TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'email'
    ) THEN
        ALTER TABLE profiles ADD COLUMN email TEXT;
    END IF;
END $$;

-- 2. Update handle_new_user function to include status, email, phone_number
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, username, email, phone_number, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone_number', NULL),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'pelajar'),
    COALESCE(NEW.raw_user_meta_data->>'status', 'pending')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    username = EXCLUDED.username,
    email = EXCLUDED.email,
    phone_number = EXCLUDED.phone_number,
    role = EXCLUDED.role,
    status = EXCLUDED.status;
  RETURN NEW;
END;
$$;

-- 3. Row Level Security Policies for Profiles Update & Insert
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_all" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_all" ON profiles;

-- Allow users to update their own profile
CREATE POLICY "profiles_update_own" ON profiles 
  FOR UPDATE USING (auth.uid() = id);

-- Allow profile updates for admin actions / account status verifications
CREATE POLICY "profiles_update_all" ON profiles 
  FOR UPDATE USING (true);

-- Allow profile creation for registration & user management
CREATE POLICY "profiles_insert_all" ON profiles 
  FOR INSERT WITH CHECK (true);
