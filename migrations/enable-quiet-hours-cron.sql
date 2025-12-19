-- Enable automatic quiet hours enforcement
-- by calling the `enforce-quiet-hours` Edge Function every 15 minutes via pg_cron + pg_net.
--
-- Requirements:
-- 1) Deploy the Edge Function:
--    supabase functions deploy enforce-quiet-hours
-- 2) Extensions must be enabled: pg_net and pg_cron

-- Extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Callable function for cron to trigger the Edge Function
CREATE OR REPLACE FUNCTION public.run_quiet_hours_enforcement()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- TODO: Replace <YOUR_PROJECT_REF> with your real project ref.
  -- You can find it in your Supabase Dashboard -> Settings -> API -> Project URL
  -- Example: https://abcdefghijklmnop.functions.supabase.co
  url TEXT := 'https://<YOUR_PROJECT_REF>.functions.supabase.co/enforce-quiet-hours';
BEGIN
  IF url IS NULL OR url = '' OR url LIKE '%<YOUR_PROJECT_REF>%' THEN
    -- Not configured; do nothing.
    RAISE NOTICE 'Quiet hours enforcement not configured. Please set the URL in run_quiet_hours_enforcement() function.';
    RETURN;
  END IF;

  PERFORM extensions.net.http_post(
    url,
    '{}'::jsonb,
    jsonb_build_object('Content-Type', 'application/json')
  );
END;
$$;

-- Schedule every 15 minutes
-- Format: minute hour day-of-month month day-of-week
-- '*/15 * * * *' means: every 15 minutes, every hour, every day
-- Note: If the job already exists, unschedule it first:
--   SELECT cron.unschedule('enforce_quiet_hours');
-- Then run the SELECT statement below again.

-- First, unschedule if it exists (no error if it doesn't exist)
SELECT cron.unschedule('enforce_quiet_hours') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'enforce_quiet_hours'
);

-- Schedule the job
SELECT cron.schedule(
  'enforce_quiet_hours',
  '*/15 * * * *',
  'SELECT public.run_quiet_hours_enforcement();'
);
