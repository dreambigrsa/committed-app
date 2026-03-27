-- ============================================
-- CREATE SUPER ADMIN ACCOUNT
-- ============================================
-- This script creates the super admin account in Supabase
-- Email: nashiezw@gmail.com
-- Password: @12345678

-- Note: This script must be run in Supabase SQL Editor
-- It requires service_role privileges

-- Step 1: Create the auth user (if not exists)
-- This uses Supabase's admin API to create a user
-- You'll need to do this via the Supabase Dashboard Auth section OR
-- use this SQL query to check if user exists first

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Check if auth user exists
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'nashiezw@gmail.com';

  -- If user exists, ensure profile exists
  IF v_user_id IS NOT NULL THEN
    RAISE NOTICE 'Auth user exists with ID: %', v_user_id;
    
    -- Create or update the profile
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
      v_user_id,
      'Super Admin',
      'nashiezw@gmail.com',
      '+0000000000',
      'super_admin',
      true,
      true,
      true
    )
    ON CONFLICT (id) DO UPDATE
    SET
      role = 'super_admin',
      full_name = 'Super Admin',
      phone_verified = true,
      email_verified = true,
      id_verified = true;
    
    RAISE NOTICE 'Super admin profile created/updated successfully';
  ELSE
    RAISE NOTICE 'Auth user does not exist. Please create it first.';
    RAISE NOTICE 'Go to: Authentication → Users → Add user';
    RAISE NOTICE 'Email: nashiezw@gmail.com';
    RAISE NOTICE 'Password: @12345678';
    RAISE NOTICE 'Then run this script again.';
  END IF;
END $$;

-- Alternative: If you have service_role access, you can use this extension
-- CREATE EXTENSION IF NOT EXISTS "http";

-- ============================================
-- MANUAL INSTRUCTIONS (If the above doesn't work)
-- ============================================
-- 
-- If the SQL script cannot create the auth user, follow these steps:
--
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Click "Add user" button
-- 3. Fill in:
--    - Email: nashiezw@gmail.com
--    - Password: @12345678
--    - Confirm Password: @12345678
--    - Check "Auto Confirm User"
-- 4. Click "Create user"
-- 5. The trigger will automatically create the super_admin profile
-- 
-- If you need to manually set role to super_admin, run:
-- 
-- UPDATE public.users 
-- SET role = 'super_admin',
--     phone_verified = true,
--     email_verified = true,
--     id_verified = true
-- WHERE email = 'nashiezw@gmail.com';
--
-- ============================================
