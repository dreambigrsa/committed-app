-- Fix RLS policies to ensure professional matching works for all users
-- This migration ensures that all authenticated users can properly query
-- professional data needed for matching, regardless of verification status

-- The existing policies should already allow this, but let's make sure
-- they're correct and there are no conflicts

-- Professional roles: Ensure anyone authenticated can view active roles
DROP POLICY IF EXISTS "Anyone can view active professional roles" ON professional_roles;
CREATE POLICY "Anyone can view active professional roles" ON professional_roles
  FOR SELECT 
  USING (is_active = true);

-- Professional profiles: Ensure anyone authenticated can view approved profiles
DROP POLICY IF EXISTS "Anyone can view approved professional profiles" ON professional_profiles;
CREATE POLICY "Anyone can view approved professional profiles" ON professional_profiles
  FOR SELECT 
  USING (approval_status = 'approved' AND is_active = true);

-- Professional status: Ensure anyone authenticated can view status
DROP POLICY IF EXISTS "Anyone can view professional status" ON professional_status;
CREATE POLICY "Anyone can view professional status" ON professional_status
  FOR SELECT 
  USING (true);

