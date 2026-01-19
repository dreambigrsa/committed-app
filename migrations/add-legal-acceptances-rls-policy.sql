-- ============================================
-- ADD LEGAL ACCEPTANCES RLS POLICIES
-- ============================================
-- This migration adds RLS policies for the user_legal_acceptances table
-- to allow users to insert, update, and view their own legal acceptances

-- Enable RLS on the table if not already enabled
ALTER TABLE user_legal_acceptances ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to allow re-running this migration)
DROP POLICY IF EXISTS "Users can view own legal acceptances" ON user_legal_acceptances;
DROP POLICY IF EXISTS "Users can insert own legal acceptances" ON user_legal_acceptances;
DROP POLICY IF EXISTS "Users can update own legal acceptances" ON user_legal_acceptances;

-- Users can view their own legal acceptances
CREATE POLICY "Users can view own legal acceptances" ON user_legal_acceptances FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own legal acceptances (for signup, relationship registration, etc.)
CREATE POLICY "Users can insert own legal acceptances" ON user_legal_acceptances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own legal acceptances (for re-acceptance when documents are updated)
CREATE POLICY "Users can update own legal acceptances" ON user_legal_acceptances FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Grant necessary permissions to authenticated role
GRANT SELECT, INSERT, UPDATE ON user_legal_acceptances TO authenticated;

-- ============================================
-- VERIFY POLICIES
-- ============================================
-- Check that policies were created successfully
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
WHERE tablename = 'user_legal_acceptances'
ORDER BY policyname;

