-- ============================================
-- VERIFY LEGAL ACCEPTANCES RLS POLICIES
-- ============================================
-- Run this to check if RLS policies are correctly set up

-- Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE tablename = 'user_legal_acceptances';

-- Check existing policies
SELECT 
  policyname,
  cmd as "Command",
  CASE 
    WHEN qual IS NOT NULL THEN 'Yes' 
    ELSE 'No' 
  END as "Has USING Clause",
  CASE 
    WHEN with_check IS NOT NULL THEN 'Yes' 
    ELSE 'No' 
  END as "Has WITH CHECK Clause",
  qual as "USING Condition",
  with_check as "WITH CHECK Condition"
FROM pg_policies
WHERE tablename = 'user_legal_acceptances'
ORDER BY policyname;

-- Check table permissions
SELECT 
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'user_legal_acceptances'
ORDER BY grantee, privilege_type;

