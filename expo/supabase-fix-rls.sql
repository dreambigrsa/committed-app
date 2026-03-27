-- Fix RLS policy for user insertion
-- This allows authenticated users to insert their own profile

-- Drop existing policy
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

-- Create new policy that allows authenticated users to insert their profile
CREATE POLICY "Users can insert own profile" ON users FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Also ensure users can read their own profile
DROP POLICY IF EXISTS "Users can view all users" ON users;

CREATE POLICY "Users can view all users" ON users FOR SELECT 
  USING (true);

-- Ensure users can update their own profile  
DROP POLICY IF EXISTS "Users can update own profile" ON users;

CREATE POLICY "Users can update own profile" ON users FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create a function to auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $
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
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone_number', NEW.phone, ''),
    CASE 
      WHEN NEW.email = 'nashiezw@gmail.com' THEN 'super_admin'
      ELSE 'user'
    END,
    false,
    CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN true ELSE false END,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to auto-create user profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Manually create user records for existing auth users without profile
INSERT INTO public.users (id, full_name, email, phone_number, role, phone_verified, email_verified, id_verified)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', SPLIT_PART(au.email, '@', 1), 'User'),
  au.email,
  COALESCE(au.raw_user_meta_data->>'phone_number', au.phone, ''),
  CASE 
    WHEN au.email = 'nashiezw@gmail.com' THEN 'super_admin'
    ELSE 'user'
  END,
  false,
  CASE WHEN au.email_confirmed_at IS NOT NULL THEN true ELSE false END,
  false
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;
