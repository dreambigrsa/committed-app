-- ============================================
-- QUICK FIX: LEGAL ACCEPTANCES RLS POLICIES
-- ============================================
-- This is a simplified version to quickly fix the RLS error
-- Run this if the full migration doesn't work
--
-- COPY AND PASTE ALL OF THIS INTO SUPABASE SQL EDITOR AND RUN

-- Step 1: Enable RLS (if not already enabled)
ALTER TABLE IF EXISTS public.user_legal_acceptances ENABLE ROW LEVEL SECURITY;

-- Step 2: Remove any existing policies that might be blocking
DROP POLICY IF EXISTS "Users can view own legal acceptances" ON public.user_legal_acceptances;
DROP POLICY IF EXISTS "Users can insert own legal acceptances" ON public.user_legal_acceptances;
DROP POLICY IF EXISTS "Users can update own legal acceptances" ON public.user_legal_acceptances;
DROP POLICY IF EXISTS "Authenticated users can insert" ON public.user_legal_acceptances;
DROP POLICY IF EXISTS "Users can manage own acceptances" ON public.user_legal_acceptances;

-- Step 3: Create the policies
CREATE POLICY "Users can view own legal acceptances" 
ON public.user_legal_acceptances 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own legal acceptances" 
ON public.user_legal_acceptances 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own legal acceptances" 
ON public.user_legal_acceptances 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Step 4: Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.user_legal_acceptances TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_legal_acceptances TO anon;

-- Step 5: Verify - You should see 3 policies listed
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_legal_acceptances';

