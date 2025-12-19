-- Enable automatic professional session timeout checking
-- by calling the `check-session-timeouts` Edge Function every 5 minutes via pg_cron + pg_net.
--
-- Requirements:
-- 1) Deploy the Edge Function:
--    supabase functions deploy check-session-timeouts
-- 2) (Recommended) Set an Edge Function secret in Supabase Dashboard:
--    SESSION_TIMEOUT_SECRET = <some strong secret>
--
-- Notes:
-- - This uses extensions.net.http_post (pg_net) from a scheduled job (pg_cron).
-- - This version intentionally DOES NOT depend on Supabase Vault because some Postgres installations
--   do not ship the `vault` extension (you'll see: extension "vault" is not available).
-- - Do NOT commit your real secret values.
-- - Replace <YOUR_PROJECT_REF> with your actual Supabase project reference.

-- Extensions (if not already enabled)
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

-- Callable function for cron to trigger the Edge Function
create or replace function public.run_session_timeout_check()
returns void
language plpgsql
security definer
as $$
declare
  -- TODO: Replace <YOUR_PROJECT_REF> with your real project ref.
  -- You can find it in your Supabase Dashboard -> Settings -> API -> Project URL
  -- Example: https://abcdefghijklmnop.functions.supabase.co
  url text := 'https://<YOUR_PROJECT_REF>.functions.supabase.co/check-session-timeouts';
  -- OPTIONAL: If you set SESSION_TIMEOUT_SECRET in the Edge Function, put the same value here.
  -- Leave NULL to call without the header.
  secret text := null;
begin
  if url is null or url = '' or url like '%<YOUR_PROJECT_REF>%' then
    -- Not configured; do nothing.
    raise notice 'Session timeout check not configured. Please set the URL in run_session_timeout_check() function.';
    return;
  end if;

  perform extensions.net.http_post(
    url,
    '{}'::jsonb,
    case
      when secret is null then jsonb_build_object('Content-Type', 'application/json')
      else jsonb_build_object('Content-Type', 'application/json', 'x-session-timeout-secret', secret)
    end
  );
end;
$$;

-- Schedule every 5 minutes
-- Format: minute hour day-of-month month day-of-week
-- '*/5 * * * *' means: every 5 minutes, every hour, every day
-- Note: If the job already exists, unschedule it first:
--   SELECT cron.unschedule('check_session_timeouts');
-- Then run the SELECT statement below again.

-- First, unschedule if it exists (no error if it doesn't exist)
SELECT cron.unschedule('check_session_timeouts') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check_session_timeouts'
);

-- Schedule the job
SELECT cron.schedule(
  'check_session_timeouts',
  '*/5 * * * *',
  'SELECT public.run_session_timeout_check();'
);

-- Alternative: If you want to run it every minute (more aggressive):
-- First unschedule the existing job:
-- SELECT cron.unschedule('check_session_timeouts') WHERE EXISTS (
--   SELECT 1 FROM cron.job WHERE jobname = 'check_session_timeouts'
-- );
-- Then schedule with every minute:
-- SELECT cron.schedule(
--   'check_session_timeouts',
--   '* * * * *',
--   'SELECT public.run_session_timeout_check();'
-- );

comment on function public.run_session_timeout_check() is 
  'Triggers the check-session-timeouts Edge Function to check for timed-out professional sessions. Called by pg_cron every 5 minutes.';

