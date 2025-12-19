-- Enable automatic status lifecycle cleanup (archive expired statuses + delete old statuses)
-- by calling the `status-lifecycle` Edge Function hourly via pg_cron + pg_net.
--
-- Requirements:
-- 1) Deploy the Edge Function:
--    supabase functions deploy status-lifecycle
-- 2) (Recommended) Set an Edge Function secret in Supabase Dashboard:
--    STATUS_LIFECYCLE_SECRET = <some strong secret>
--
-- Notes:
-- - This uses extensions.net.http_post (pg_net) from a scheduled job (pg_cron).
-- - This version intentionally DOES NOT depend on Supabase Vault because some Postgres installations
--   do not ship the `vault` extension (you'll see: extension "vault" is not available).
-- - Do NOT commit your real secret values.

-- Extensions
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

-- Callable function for cron to trigger the Edge Function
create or replace function public.run_status_lifecycle_job()
returns void
language plpgsql
security definer
as $$
declare
  -- TODO: Replace with your real project ref.
  url text := 'https://<YOUR_PROJECT_REF>.functions.supabase.co/status-lifecycle';
  -- OPTIONAL: If you set STATUS_LIFECYCLE_SECRET in the Edge Function, put the same value here.
  -- Leave NULL to call without the header.
  secret text := null;
begin
  if url is null or url = '' then
    -- Not configured; do nothing.
    return;
  end if;

  perform extensions.net.http_post(
    url,
    '{}'::jsonb,
    case
      when secret is null then jsonb_build_object('Content-Type', 'application/json')
      else jsonb_build_object('Content-Type', 'application/json', 'x-status-lifecycle-secret', secret)
    end
  );
end;
$$;

-- Schedule hourly (at minute 0). Adjust as desired.
select
  cron.schedule(
    'status_lifecycle_hourly',
    '0 * * * *',
    $$select public.run_status_lifecycle_job();$$
  )
;


