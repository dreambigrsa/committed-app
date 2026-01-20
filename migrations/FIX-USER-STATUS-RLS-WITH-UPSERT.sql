-- ============================================
-- FIX USER_STATUS RLS POLICY WITH UPSERT SUPPORT
-- ============================================
-- This migration ensures users can insert/update (upsert) their own user_status records
-- without RLS policy violations
-- This fixes the 403 Forbidden errors when creating user_status

-- Enable RLS if not already enabled
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can insert own status" ON user_status;
DROP POLICY IF EXISTS "Users can view own status" ON user_status;
DROP POLICY IF EXISTS "Users can update own status" ON user_status;
DROP POLICY IF EXISTS "Users can view statuses" ON user_status;
DROP POLICY IF EXISTS "Users can upsert own status" ON user_status;
DROP POLICY IF EXISTS "Users can delete own status" ON user_status;

-- 1. INSERT POLICY: Users can insert their own status
CREATE POLICY "Users can insert own status" ON user_status
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND 
    auth.uid() = user_id
  );

-- 2. SELECT POLICY: Users can view their own status
CREATE POLICY "Users can view own status" ON user_status
  FOR SELECT
  USING (auth.uid() = user_id);

-- 3. SELECT POLICY: Users can view other users' statuses based on visibility
CREATE POLICY "Users can view statuses" ON user_status
  FOR SELECT
  USING (
    -- Can always see own status
    auth.uid() = user_id
    OR
    -- Can see if status_visibility allows it
    (
      status_visibility = 'everyone'
      OR
      (status_visibility = 'contacts' AND EXISTS (
        SELECT 1 FROM follows
        WHERE (follower_id = auth.uid() AND following_id = user_status.user_id)
        OR (follower_id = user_status.user_id AND following_id = auth.uid())
      ))
      OR
      (status_visibility = 'friends' AND EXISTS (
        SELECT 1 FROM follows
        WHERE (follower_id = auth.uid() AND following_id = user_status.user_id)
        AND (follower_id = user_status.user_id AND following_id = auth.uid())
      ))
    )
  );

-- 4. UPDATE POLICY: Users can update their own status
-- This is critical for UPSERT operations - both USING and WITH CHECK must allow it
CREATE POLICY "Users can update own status" ON user_status
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. DELETE POLICY: Users can delete their own status (if needed)
CREATE POLICY "Users can delete own status" ON user_status
  FOR DELETE
  USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_status TO authenticated;
GRANT USAGE ON SEQUENCE user_status_id_seq TO authenticated;

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_status'
ORDER BY policyname;

