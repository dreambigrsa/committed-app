-- ============================================
-- ULTRA SIMPLE FIX - COPY ALL AND RUN IN SUPABASE
-- ============================================
-- This fixes the RLS error immediately
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

-- Enable RLS
ALTER TABLE public.user_legal_acceptances ENABLE ROW LEVEL SECURITY;

-- Drop old policies (safe to run multiple times)
DROP POLICY IF EXISTS "Users can view own legal acceptances" ON public.user_legal_acceptances;
DROP POLICY IF EXISTS "Users can insert own legal acceptances" ON public.user_legal_acceptances;
DROP POLICY IF EXISTS "Users can update own legal acceptances" ON public.user_legal_acceptances;

-- Create policies (this is what fixes the error)
CREATE POLICY "Users can view own legal acceptances" 
ON public.user_legal_acceptances FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own legal acceptances" 
ON public.user_legal_acceptances FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own legal acceptances" 
ON public.user_legal_acceptances FOR UPDATE 
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.user_legal_acceptances TO authenticated;

-- Verify it worked (you should see 3 rows)
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'user_legal_acceptances';

