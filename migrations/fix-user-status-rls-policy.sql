-- ============================================
-- FIX USER_STATUS RLS POLICY FOR INSERT
-- ============================================
-- This migration ensures users can insert their own user_status records
-- without RLS policy violations

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
-- Also allow inserts where user_id matches the authenticated user
CREATE POLICY "Users can insert own status" ON user_status
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND 
    (auth.uid() = user_id OR auth.uid()::text = user_id::text)
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
      (status_visibility = 'friends' AND EXISTS (
        SELECT 1 FROM follows
        WHERE (follower_id = auth.uid() AND following_id = user_status.user_id)
        OR (follower_id = user_status.user_id AND following_id = auth.uid())
      ))
    )
  );

-- 4. UPDATE POLICY: Users can update their own status
CREATE POLICY "Users can update own status" ON user_status
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. DELETE POLICY: Users can delete their own status (if needed)
CREATE POLICY "Users can delete own status" ON user_status
  FOR DELETE
  USING (auth.uid() = user_id);

-- Note: We don't use a "FOR ALL" policy as it can conflict with specific policies
-- The separate INSERT, SELECT, UPDATE, DELETE policies above should handle all cases

