-- Migration 013: Allow Profile Deletion RLS Policy for Admin Actions

-- Drop existing delete policy if present
DROP POLICY IF EXISTS "profiles_delete_all" ON profiles;

-- Create policy allowing profile deletion (e.g. admin deleting student/instructor profiles)
CREATE POLICY "profiles_delete_all" ON profiles 
  FOR DELETE USING (true);
