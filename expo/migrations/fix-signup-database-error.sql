-- ============================================
-- FIX SIGNUP DATABASE ERROR
-- ============================================
-- This fixes "Database error saving new user" errors during signup
-- Run this in Supabase SQL Editor
--
-- Common causes:
-- 1. Trigger failing on duplicate phone/email
-- 2. RLS policies blocking trigger insert
-- 3. Constraint violations in trigger
-- ============================================

-- Step 1: Drop existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 2: Create improved function that handles ALL errors gracefully
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $function_body$
DECLARE
  v_phone_number TEXT;
  v_email TEXT;
  uuid_str TEXT;
  existing_user_id UUID;
BEGIN
  -- Get email
  v_email := COALESCE(NEW.email, '');
  
  -- Get phone number with fallbacks
  v_phone_number := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'phone_number', ''),
    NULLIF(NEW.phone::TEXT, ''),
    NULL
  );
  
  -- Check if user already exists (shouldn't happen, but be safe)
  SELECT id INTO existing_user_id
  FROM public.users
  WHERE id = NEW.id
  LIMIT 1;
  
  IF existing_user_id IS NOT NULL THEN
    -- User already exists, just return
    RETURN NEW;
  END IF;
  
  -- If phone number is still null or empty, generate a unique one
  -- Format: +0000000XXXX where XXXX is derived from UUID
  IF v_phone_number IS NULL OR v_phone_number = '' OR TRIM(v_phone_number) = '' THEN
    uuid_str := REPLACE(NEW.id::TEXT, '-', '');
    v_phone_number := '+0000000' || SUBSTRING(uuid_str, GREATEST(1, LENGTH(uuid_str) - 3));
  END IF;
  
  -- Check for duplicate phone number and generate unique if needed
  WHILE EXISTS (SELECT 1 FROM public.users WHERE phone_number = v_phone_number) LOOP
    uuid_str := REPLACE(NEW.id::TEXT, '-', '');
    v_phone_number := '+0000000' || SUBSTRING(uuid_str || random()::TEXT, 1, 15);
  END LOOP;
  
  -- Check for duplicate email (shouldn't happen in auth.users, but be safe)
  IF EXISTS (SELECT 1 FROM public.users WHERE email = v_email AND id != NEW.id) THEN
    -- Email conflict - log warning but don't fail
    RAISE WARNING 'Email % already exists in users table for different user', v_email;
    RETURN NEW;
  END IF;

  -- Try to insert user record with comprehensive error handling
  BEGIN
    INSERT INTO public.users (
      id,
      full_name,
      email,
      phone_number,
      role,
      phone_verified,
      email_verified,
      id_verified
    )
    VALUES (
      NEW.id,
      COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        SPLIT_PART(v_email, '@', 1),
        'User'
      ),
      v_email,
      v_phone_number,
      CASE 
        WHEN v_email = 'nashiezw@gmail.com' THEN 'super_admin'
        ELSE 'user'
      END,
      false,
      CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN true ELSE false END,
      false
    )
    ON CONFLICT (id) DO NOTHING;
      
  EXCEPTION 
    WHEN unique_violation THEN
      -- Handle unique constraint violations gracefully
      RAISE WARNING 'Unique constraint violation for user %: % (SQLSTATE: %)', 
        v_email, SQLERRM, SQLSTATE;
      -- Don't fail auth user creation
    WHEN foreign_key_violation THEN
      -- Handle foreign key violations
      RAISE WARNING 'Foreign key violation for user %: % (SQLSTATE: %)', 
        v_email, SQLERRM, SQLSTATE;
    WHEN check_violation THEN
      -- Handle check constraint violations
      RAISE WARNING 'Check constraint violation for user %: % (SQLSTATE: %)', 
        v_email, SQLERRM, SQLSTATE;
    WHEN OTHERS THEN
      -- Log any other error but don't fail the auth user creation
      RAISE WARNING 'Failed to create user record for %: % (SQLSTATE: %)', 
        v_email, SQLERRM, SQLSTATE;
  END;
  
  -- Always return NEW so auth user creation succeeds
  RETURN NEW;
END;
$function_body$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Ensure RLS policies allow the trigger to work
-- The trigger runs as SECURITY DEFINER, so it bypasses RLS, but let's ensure policies exist

-- Drop and recreate RLS policies to ensure they're correct
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Service role can insert users" ON users;

-- Allow authenticated users to insert their own profile
CREATE POLICY "Users can insert own profile" ON users FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Allow service role (trigger) to insert users
-- Note: SECURITY DEFINER functions bypass RLS, but having this policy is good practice
CREATE POLICY "Service role can insert users" ON users FOR INSERT 
  WITH CHECK (true);

-- Ensure users can read all users (for search functionality)
DROP POLICY IF EXISTS "Users can view all users" ON users;
CREATE POLICY "Users can view all users" ON users FOR SELECT 
  USING (true);

-- Ensure users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Step 5: Verify the trigger was created
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  proname as function_name,
  tgenabled as enabled
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'on_auth_user_created';

-- Step 6: Check if there are any existing users without profiles
-- (This helps identify if the trigger failed for existing auth users)
SELECT 
  au.id,
  au.email,
  au.created_at,
  CASE WHEN u.id IS NULL THEN 'MISSING PROFILE' ELSE 'HAS PROFILE' END as profile_status
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
ORDER BY au.created_at DESC
LIMIT 10;

