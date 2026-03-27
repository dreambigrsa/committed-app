-- AI Improvement Loop for Committed AI
-- Adds:
-- - ai_prompt_versions: versioned system prompts + rollout %
-- - ai_prompt_suggestions: suggested prompt improvements (admin reviews)
-- - ai_message_feedback: thumbs up/down + optional comment per AI message
--
-- SECURITY MODEL:
-- - Any authenticated user can INSERT feedback for themselves.
-- - Only super_admin can manage prompts and suggestions.
--
-- NOTE: For best security, OpenAI calls should run server-side (Edge Function).

-- ================
-- Helper functions
-- ================
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

-- ==================
-- Prompt versions
-- ==================
create table if not exists public.ai_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'default',
  prompt text not null,
  model text not null default 'gpt-4o-mini',
  temperature numeric not null default 0.8,
  max_tokens integer not null default 600,
  rollout_percent integer not null default 100 check (rollout_percent >= 0 and rollout_percent <= 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null
);

alter table public.ai_prompt_versions enable row level security;

drop policy if exists "Super admins can manage prompt versions" on public.ai_prompt_versions;
create policy "Super admins can manage prompt versions"
on public.ai_prompt_versions
for all
using (public.is_super_admin())
with check (public.is_super_admin());

-- ==================
-- Prompt suggestions
-- ==================
create table if not exists public.ai_prompt_suggestions (
  id uuid primary key default gen_random_uuid(),
  base_prompt_version_id uuid references public.ai_prompt_versions(id) on delete set null,
  suggested_prompt text not null,
  rationale text,
  stats jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id) on delete set null
);

alter table public.ai_prompt_suggestions enable row level security;

drop policy if exists "Super admins can manage prompt suggestions" on public.ai_prompt_suggestions;
create policy "Super admins can manage prompt suggestions"
on public.ai_prompt_suggestions
for all
using (public.is_super_admin())
with check (public.is_super_admin());

-- ==================
-- Message feedback
-- ==================
create table if not exists public.ai_message_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  conversation_id uuid,
  message_id text,
  rating integer not null check (rating in (-1, 1)),
  comment text,
  prompt_version_id uuid references public.ai_prompt_versions(id) on delete set null,
  model text,
  created_at timestamptz not null default now(),
  unique (user_id, message_id)
);

alter table public.ai_message_feedback enable row level security;

drop policy if exists "Users can insert their own AI feedback" on public.ai_message_feedback;
create policy "Users can insert their own AI feedback"
on public.ai_message_feedback
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can read their own AI feedback" on public.ai_message_feedback;
create policy "Users can read their own AI feedback"
on public.ai_message_feedback
for select
using (auth.uid() = user_id or public.is_super_admin());

drop policy if exists "Super admins can update AI feedback" on public.ai_message_feedback;
create policy "Super admins can update AI feedback"
on public.ai_message_feedback
for update
using (public.is_super_admin())
with check (public.is_super_admin());


