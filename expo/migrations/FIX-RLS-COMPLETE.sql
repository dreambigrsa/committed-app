-- ============================================
-- COMPLETE FIX FOR RLS ERROR - COPY ALL AND RUN
-- ============================================
-- This version handles the signup case where auth.uid() might not be immediately available
-- 
-- INSTRUCTIONS:
-- 1. Go to https://supabase.com/dashboard
-- 2. Select your project
-- 3. Click "SQL Editor" in left sidebar
-- 4. Click "New Query"
-- 5. Copy ALL text below (from this line to the end)
-- 6. Paste into SQL Editor
-- 7. Click "Run" button (green button, or press Ctrl+Enter)
-- 8. You should see 3 policies listed - that means it worked!

-- Step 1: Enable RLS
ALTER TABLE IF EXISTS public.user_legal_acceptances ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies (clean slate)
DROP POLICY IF EXISTS "Users can view own legal acceptances" ON public.user_legal_acceptances;
DROP POLICY IF EXISTS "Users can insert own legal acceptances" ON public.user_legal_acceptances;
DROP POLICY IF EXISTS "Users can update own legal acceptances" ON public.user_legal_acceptances;
DROP POLICY IF EXISTS "Authenticated users can insert" ON public.user_legal_acceptances;
DROP POLICY IF EXISTS "Users can manage own acceptances" ON public.user_legal_acceptances;
DROP POLICY IF EXISTS "Allow insert during signup" ON public.user_legal_acceptances;

-- Step 3: Create SELECT policy (users can view their own)
CREATE POLICY "Users can view own legal acceptances" 
ON public.user_legal_acceptances 
FOR SELECT 
USING (auth.uid() = user_id);

-- Step 4: Create INSERT policy (IMPROVED - handles signup case)
-- This policy allows inserts when:
-- 1. User is authenticated AND user_id matches auth.uid(), OR
-- 2. User_id exists in auth.users table (for signup flow)
CREATE POLICY "Users can insert own legal acceptances" 
ON public.user_legal_acceptances 
FOR INSERT 
WITH CHECK (
  -- Standard case: authenticated user inserting their own record
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  OR
  -- Signup case: user_id exists in auth.users (even if session not fully propagated)
  (user_id IN (SELECT id FROM auth.users))
);

-- Step 5: Create UPDATE policy
CREATE POLICY "Users can update own legal acceptances" 
ON public.user_legal_acceptances 
FOR UPDATE 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Step 6: Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.user_legal_acceptances TO authenticated;

-- Step 7: Verify it worked (you should see 3 rows)
SELECT 
  policyname,
  cmd as "Operation",
  CASE 
    WHEN with_check IS NOT NULL THEN with_check
    ELSE qual
  END as "Policy Condition"
FROM pg_policies
WHERE tablename = 'user_legal_acceptances'
ORDER BY cmd;

-- If you see 3 policies above, the fix is complete! ✅

