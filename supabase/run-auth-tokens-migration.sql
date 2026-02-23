-- Run this in Supabase Dashboard → SQL Editor
-- Creates auth_tokens table (and profiles if missing) for password reset & verification emails

-- 1) PROFILES (if not exists)
-- Sync existing auth.users into profiles so password reset can find user_id
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  is_verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_is_verified ON public.profiles(is_verified);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Service role full access profiles" ON public.profiles;
CREATE POLICY "Service role full access profiles" ON public.profiles
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Sync auth.users into profiles (for users created before this migration)
INSERT INTO public.profiles (id, email, is_verified, verified_at)
SELECT id, email, false, NULL
FROM auth.users
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();

-- 2) AUTH_TOKENS
CREATE TABLE IF NOT EXISTS public.auth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  token_hash text NOT NULL,
  type text NOT NULL CHECK (type IN ('verify_email', 'reset_password')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  request_ip text,
  user_agent text
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_tokens_token_hash ON public.auth_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_email_type_created ON public.auth_tokens(email, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON public.auth_tokens(user_id);
ALTER TABLE public.auth_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No client access auth_tokens" ON public.auth_tokens;
CREATE POLICY "No client access auth_tokens" ON public.auth_tokens
  FOR ALL USING (false);
DROP POLICY IF EXISTS "Service role auth_tokens" ON public.auth_tokens;
CREATE POLICY "Service role auth_tokens" ON public.auth_tokens
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.auth_tokens TO service_role;
