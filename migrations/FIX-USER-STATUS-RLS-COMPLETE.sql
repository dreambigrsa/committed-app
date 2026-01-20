-- ============================================
-- FIX USER_STATUS RLS POLICY - COMPLETE VERSION
-- ============================================
-- This migration ensures users can insert/update (upsert) their own user_status records
-- Run this in Supabase SQL Editor to fix 403/406 errors

-- Step 1: Enable RLS
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies (including any conflicting ones)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'user_status') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON user_status';
    END LOOP;
END $$;

-- Step 3: Create INSERT policy (for new records)
CREATE POLICY "Users can insert own status" ON user_status
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND 
    auth.uid() = user_id
  );

-- Step 4: Create SELECT policy (single policy for all SELECT operations)
CREATE POLICY "Users can select statuses" ON user_status
  FOR SELECT
  USING (
    -- Can always see own status
    auth.uid() = user_id
    OR
    -- Can see others based on visibility
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

-- Step 5: Create UPDATE policy (critical for UPSERT)
CREATE POLICY "Users can update own status" ON user_status
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Step 6: Create DELETE policy
CREATE POLICY "Users can delete own status" ON user_status
  FOR DELETE
  USING (auth.uid() = user_id);

-- Step 7: Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_status TO authenticated;

-- Step 8: Verify policies were created
SELECT 
  policyname,
  cmd as operation,
  CASE 
    WHEN qual IS NOT NULL THEN 'USING: ' || qual
    ELSE 'No USING clause'
  END as using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check
    ELSE 'No WITH CHECK clause'
  END as with_check_clause
FROM pg_policies
WHERE tablename = 'user_status'
ORDER BY policyname;

-- Expected output: 4 policies
-- 1. "Users can delete own status" - DELETE
-- 2. "Users can insert own status" - INSERT  
-- 3. "Users can select statuses" - SELECT
-- 4. "Users can update own status" - UPDATE

