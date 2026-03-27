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

-- Step 4: Clean up duplicates and create unique constraint (for upsert logic)
DO $$
BEGIN
  -- First, remove duplicate records, keeping only the most recent one for each (user_id, document_id) pair
  DELETE FROM public.user_legal_acceptances
  WHERE id IN (
    SELECT id
    FROM (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY user_id, document_id ORDER BY created_at DESC, accepted_at DESC NULLS LAST) as rn
      FROM public.user_legal_acceptances
    ) t
    WHERE t.rn > 1
  );

  -- Drop existing index/constraint if it exists
  DROP INDEX IF EXISTS user_legal_acceptances_user_id_document_id_key;
  
  -- Create unique index (now safe since duplicates are removed)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'user_legal_acceptances_user_id_document_id_key'
    AND tablename = 'user_legal_acceptances'
  ) THEN
    CREATE UNIQUE INDEX user_legal_acceptances_user_id_document_id_key 
    ON public.user_legal_acceptances(user_id, document_id);
  END IF;
END $$;

-- Step 5: Create SECURITY DEFINER function to insert legal acceptances
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
  v_existing_id UUID;
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

  -- Check if acceptance already exists
  SELECT id INTO v_existing_id
  FROM public.user_legal_acceptances
  WHERE user_id = p_user_id AND document_id = p_document_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Update existing acceptance
    UPDATE public.user_legal_acceptances
    SET
      document_version = p_document_version,
      context = p_context::TEXT,
      accepted_at = NOW()
    WHERE id = v_existing_id
    RETURNING id INTO v_acceptance_id;
  ELSE
    -- Insert new acceptance (this bypasses RLS because function is SECURITY DEFINER)
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
    RETURNING id INTO v_acceptance_id;
  END IF;

  RETURN v_acceptance_id;
END;
$$;

-- Step 6: Create SELECT policy (users can view their own)
CREATE POLICY "Users can view own legal acceptances" 
ON public.user_legal_acceptances 
FOR SELECT 
USING (auth.uid() = user_id);

-- Step 7: Create INSERT policy (allows direct inserts AND signup case)
-- The function handles signup cases, but we also allow direct inserts
CREATE POLICY "Users can insert own legal acceptances" 
ON public.user_legal_acceptances 
FOR INSERT 
WITH CHECK (
  -- Standard case: authenticated user inserting their own record
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  OR
  -- Signup case: user_id exists in public.users (everyone can view this table)
  (user_id IN (SELECT id FROM public.users))
);

-- Step 8: Create UPDATE policy
CREATE POLICY "Users can update own legal acceptances" 
ON public.user_legal_acceptances 
FOR UPDATE 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Step 9: Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.user_legal_acceptances TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_user_legal_acceptance(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_user_legal_acceptance(UUID, UUID, TEXT, TEXT) TO anon;

-- Step 10: Verify it worked
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

