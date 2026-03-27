-- Enable automatic push notifications on every INSERT into `public.notifications`.
--
-- Requirements:
-- 1) Deploy the Edge Function:
--    supabase functions deploy send-push
-- 2) Set the Edge Function secret (Dashboard -> Edge Functions -> send-push -> Secrets):
--    SEND_PUSH_SECRET = <some strong secret>
-- 3) Store these secrets in Supabase Vault (run the two INSERT/UPSERT statements below):
--    - send_push_url: the public URL of the Edge Function
--    - send_push_secret: must match SEND_PUSH_SECRET
--
-- After this is installed, any new notification row will trigger a push to that user.

-- Extensions
create extension if not exists pg_net with schema extensions;
create extension if not exists vault with schema extensions;

-- ============
-- Vault secrets
-- ============
-- Set these values before running the trigger section.
-- Replace the URL project ref if needed.
select
  extensions.vault.create_secret(
    'send_push_url',
    'https://dizcuexznganwgddsrfo.functions.supabase.co/send-push'
  )
on conflict do nothing;

-- IMPORTANT: Replace <SEND_PUSH_SECRET> with the same value you set in Edge Function secrets.
-- If you re-run this migration, update the secret in the dashboard instead of committing it.
-- (You can also delete/recreate the secret in Vault.)
-- Example:
-- select extensions.vault.create_secret('send_push_secret', '<SEND_PUSH_SECRET>');

-- Minimal safe setup (run manually in SQL Editor, do NOT commit your secret):
-- select extensions.vault.create_secret('send_push_secret', '<PUT_YOUR_SEND_PUSH_SECRET_HERE>');

-- ======================
-- Trigger implementation
-- ======================
create or replace function public._get_vault_secret(secret_name text)
returns text
language sql
stable
as $$
  select (select decrypted_secret
          from extensions.vault.decrypted_secrets
          where name = secret_name
          limit 1);
$$;

create or replace function public.notify_send_push_on_notification_insert()
returns trigger
language plpgsql
security definer
as $$
declare
  url text;
  secret text;
  payload jsonb;
begin
  url := public._get_vault_secret('send_push_url');
  secret := public._get_vault_secret('send_push_secret');

  if url is null or secret is null then
    -- If not configured, do nothing (avoid breaking inserts).
    return new;
  end if;

  payload := jsonb_build_object(
    'userId', new.user_id,
    'title', new.title,
    'body', new.message,
    'data', coalesce(new.data, '{}'::jsonb)
  );

  perform extensions.net.http_post(
    url,
    payload,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'x-send-push-secret', secret
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_send_push on public.notifications;
create trigger trg_notify_send_push
after insert on public.notifications
for each row
execute function public.notify_send_push_on_notification_insert();


