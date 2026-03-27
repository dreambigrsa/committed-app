-- Store application-wide settings (including secrets like OpenAI API key).
-- NOTE: Any key stored client-side is inherently exposable in a mobile app. This table
-- is meant for admin convenience. For strongest security, move OpenAI calls server-side.

create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz default now()
);

alter table public.app_settings enable row level security;

-- Helper: true if current auth user is a super_admin in public.users
create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'super_admin'
  );
$$;

drop policy if exists "Super admins can manage app settings" on public.app_settings;
create policy "Super admins can manage app settings"
on public.app_settings
for all
using (public.is_super_admin())
with check (public.is_super_admin());


