-- Email campaign tracking: avoid sending same campaign twice to same user within cooldown
CREATE TABLE IF NOT EXISTS public.email_sent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type text NOT NULL, -- 'subscription_follow_up', 'subscription_due', 'subscription_expired'
  sent_at timestamptz NOT NULL DEFAULT now()
);

-- Simpler: one row per (user_id, email_type) with last_sent - allows re-send after cooldown
-- Drop the unique constraint above if we want multiple sends; use a check instead
CREATE INDEX IF NOT EXISTS idx_email_sent_log_user_type ON public.email_sent_log(user_id, email_type);
CREATE INDEX IF NOT EXISTS idx_email_sent_log_sent_at ON public.email_sent_log(sent_at DESC);

ALTER TABLE public.email_sent_log ENABLE ROW LEVEL SECURITY;
-- No client access; service role only
CREATE POLICY "Service role email_sent_log" ON public.email_sent_log
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
GRANT ALL ON public.email_sent_log TO service_role;
