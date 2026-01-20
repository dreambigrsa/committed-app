-- ============================================
-- DEFINITIVE FIX: Use SECURITY DEFINER function for inserts
-- ============================================
-- This creates a function that does the insert, bypassing RLS entirely
-- This is the most reliable solution for signup flows
-- 
-- INSTRUCTIONS:
-- 1. Go to https://supabase.com/dashboard
-- 2. Select your project
-- 3. Click "SQL Editor" in left sidebar
-- 4. Click "New Query"
-- 5. Copy ALL text below (from this line to the end)
-- 6. Paste into SQL Editor
-- 7. Click "Run" button (green button, or press Ctrl+Enter)
-- 8. You should see success messages and 3 policies listed

-- Step 1: Enable RLS
ALTER TABLE IF EXISTS public.user_legal_acceptances ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies (clean slate)
DROP POLICY IF EXISTS "Users can view own legal acceptances" ON public.user_legal_acceptances;
DROP POLICY IF EXISTS "Users can insert own legal acceptances" ON public.user_legal_acceptances;
DROP POLICY IF EXISTS "Users can update own legal acceptances" ON public.user_legal_acceptances;
DROP POLICY IF EXISTS "Authenticated users can insert" ON public.user_legal_acceptances;
DROP POLICY IF EXISTS "Users can manage own acceptances" ON public.user_legal_acceptances;
DROP POLICY IF EXISTS "Allow insert during signup" ON public.user_legal_acceptances;

-- Step 3: Drop old helper functions if they exist
DROP FUNCTION IF EXISTS public.user_exists_in_auth(UUID);
DROP FUNCTION IF EXISTS public.insert_user_legal_acceptance(UUID, UUID, TEXT, TEXT);

-- Step 4: Create SECURITY DEFINER function to insert legal acceptances
-- This function bypasses RLS and can be called during signup
CREATE OR REPLACE FUNCTION public.insert_user_legal_acceptance(
  p_user_id UUID,
  p_document_id UUID,
  p_document_version TEXT,
  p_context TEXT DEFAULT 'signup'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acceptance_id UUID;
BEGIN
  -- Verify that the user_id matches the authenticated user (if session exists)
  -- OR that the user exists in auth.users (for signup case)
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'User ID mismatch. Cannot insert acceptance for another user.';
  END IF;

  -- Check if user exists (either authenticated or in auth.users)
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = p_user_id
  ) THEN
    RAISE EXCEPTION 'User does not exist.';
  END IF;

  -- Insert the acceptance (this bypasses RLS because function is SECURITY DEFINER)
  INSERT INTO public.user_legal_acceptances (
    user_id,
    document_id,
    document_version,
    context
  ) VALUES (
    p_user_id,
    p_document_id,
    p_document_version,
    p_context::TEXT
  )
  ON CONFLICT (user_id, document_id) 
  DO UPDATE SET
    document_version = EXCLUDED.document_version,
    context = EXCLUDED.context,
    accepted_at = NOW()
  RETURNING id INTO v_acceptance_id;

  RETURN v_acceptance_id;
END;
$$;

-- Step 5: Create SELECT policy (users can view their own)
CREATE POLICY "Users can view own legal acceptances" 
ON public.user_legal_acceptances 
FOR SELECT 
USING (auth.uid() = user_id);

-- Step 6: Create INSERT policy (allows direct inserts for authenticated users)
-- The function handles signup cases, but we also allow direct inserts
CREATE POLICY "Users can insert own legal acceptances" 
ON public.user_legal_acceptances 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);

-- Step 7: Create UPDATE policy
CREATE POLICY "Users can update own legal acceptances" 
ON public.user_legal_acceptances 
FOR UPDATE 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Step 8: Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.user_legal_acceptances TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_user_legal_acceptance(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_user_legal_acceptance(UUID, UUID, TEXT, TEXT) TO anon;

-- Step 9: Verify it worked
SELECT 
  policyname,
  cmd as "Operation"
FROM pg_policies
WHERE tablename = 'user_legal_acceptances'
ORDER BY cmd;

-- Verify function was created
SELECT 
  proname as function_name,
  prosecdef as is_security_definer
FROM pg_proc
WHERE proname = 'insert_user_legal_acceptance';

-- If you see 3 policies and the function above, the fix is complete! ✅

