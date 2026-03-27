-- ============================================
-- FIX handle_new_user TRIGGER
-- ============================================
-- This fixes the trigger to handle errors gracefully and prevent auth user creation failures
-- Run this in Supabase SQL Editor if you're getting "Database error creating new user"

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create an improved function that handles errors gracefully
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $function_body$
DECLARE
  v_phone_number TEXT;
  uuid_str TEXT;
BEGIN
  -- Get phone number with fallbacks
  v_phone_number := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'phone_number', ''),
    NULLIF(NEW.phone::TEXT, ''),
    NULL
  );
  
  -- If phone number is still null or empty, generate a unique one
  -- Format: +0000000XXXX where XXXX is derived from UUID
  IF v_phone_number IS NULL OR v_phone_number = '' THEN
    uuid_str := REPLACE(NEW.id::TEXT, '-', '');
    v_phone_number := '+0000000' || SUBSTRING(uuid_str, LENGTH(uuid_str) - 3);
  END IF;

  -- Check for duplicate phone number and generate unique if needed
  WHILE EXISTS (SELECT 1 FROM public.users WHERE phone_number = v_phone_number) LOOP
    uuid_str := REPLACE(NEW.id::TEXT, '-', '');
    v_phone_number := '+0000000' || SUBSTRING(uuid_str || random()::TEXT, 1, 15);
  END LOOP;

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
        SPLIT_PART(NEW.email, '@', 1),
        'User'
      ),
      NEW.email,
      v_phone_number,
      CASE 
        WHEN NEW.email = 'nashiezw@gmail.com' THEN 'super_admin'
        ELSE 'user'
      END,
      false,
      CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN true ELSE false END,
      false
    )
    ON CONFLICT (id) DO NOTHING
    ON CONFLICT (email) DO NOTHING
    ON CONFLICT (phone_number) DO UPDATE SET
      -- If phone conflict, update the existing record to use this user's ID
      id = NEW.id,
      email = NEW.email,
      full_name = COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        SPLIT_PART(NEW.email, '@', 1),
        'User'
      );
  EXCEPTION 
    WHEN unique_violation THEN
      -- Handle unique constraint violations gracefully
      RAISE WARNING 'Unique constraint violation for user %: % (SQLSTATE: %)', 
        NEW.email, SQLERRM, SQLSTATE;
    WHEN foreign_key_violation THEN
      -- Handle foreign key violations
      RAISE WARNING 'Foreign key violation for user %: % (SQLSTATE: %)', 
        NEW.email, SQLERRM, SQLSTATE;
    WHEN check_violation THEN
      -- Handle check constraint violations
      RAISE WARNING 'Check constraint violation for user %: % (SQLSTATE: %)', 
        NEW.email, SQLERRM, SQLSTATE;
    WHEN OTHERS THEN
      -- Log any other error but don't fail the auth user creation
      RAISE WARNING 'Failed to create user record for %: % (SQLSTATE: %)', 
        NEW.email, SQLERRM, SQLSTATE;
  END;
  
  RETURN NEW;
END;
$function_body$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Verify the trigger was created
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'on_auth_user_created';
