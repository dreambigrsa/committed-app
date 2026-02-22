-- ============================================
-- PROFILES + AUTH_TOKENS (custom verify/reset)
-- ============================================
-- Profiles: app-controlled email verification status (not Supabase Auth).
-- Auth tokens: single-use, hashed, for verify_email and reset_password emails.
-- ============================================

-- 1) PROFILES (id = auth.users.id)
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

-- Users can read their own profile only
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Only service role / Edge Functions can insert or update (verification)
DROP POLICY IF EXISTS "Service role full access profiles" ON public.profiles;
CREATE POLICY "Service role full access profiles" ON public.profiles
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Trigger: create profile row when auth user is created (keep in sync with users)
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_verified, verified_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    NEW.email_confirmed_at IS NOT NULL,
    NEW.email_confirmed_at
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile();

-- Backfill existing auth.users into profiles
INSERT INTO public.profiles (id, email, is_verified, verified_at)
SELECT id, email, (email_confirmed_at IS NOT NULL), email_confirmed_at
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  is_verified = EXCLUDED.is_verified,
  verified_at = EXCLUDED.verified_at,
  updated_at = now();

-- 2) AUTH_TOKENS (hashed tokens, single-use, expiry)
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
CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires_used ON public.auth_tokens(expires_at, used_at);

ALTER TABLE public.auth_tokens ENABLE ROW LEVEL SECURITY;

-- No client read: only service role can access auth_tokens
DROP POLICY IF EXISTS "No client access auth_tokens" ON public.auth_tokens;
CREATE POLICY "No client access auth_tokens" ON public.auth_tokens
  FOR ALL USING (false);

-- Service role can do everything (Edge Functions use service role)
DROP POLICY IF EXISTS "Service role auth_tokens" ON public.auth_tokens;
CREATE POLICY "Service role auth_tokens" ON public.auth_tokens
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Grant usage
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.auth_tokens TO service_role;
