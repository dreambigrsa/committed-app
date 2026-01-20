-- ============================================
-- VERIFY RLS POLICIES FOR user_legal_acceptances
-- ============================================
-- Run this to check if your RLS policies are set up correctly

-- Check if RLS is enabled
SELECT 
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'user_legal_acceptances';

-- List all policies
SELECT 
  policyname,
  cmd as "Operation",
  qual as "USING clause",
  with_check as "WITH CHECK clause"
FROM pg_policies
WHERE tablename = 'user_legal_acceptances'
ORDER BY cmd, policyname;

-- Check grants
SELECT 
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'user_legal_acceptances'
ORDER BY grantee, privilege_type;

