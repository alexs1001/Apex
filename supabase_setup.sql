-- ============================================================
-- Supabase migration: create app_state table
-- Run this in: Supabase dashboard → SQL Editor → New query
-- ============================================================

-- The table holds one row per logical "namespace" of app data.
-- key examples: 'goals', 'health', 'gym', 'finance'
create table if not exists public.app_state (
  key        text        primary key,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Index on updated_at so we can cheaply query recent changes
create index if not exists app_state_updated_at_idx on public.app_state (updated_at desc);

-- Enable Row Level Security (all writes go through the service-role key
-- in our /api/sync serverless function, so RLS is effectively bypassed
-- server-side — but we enable it here so direct anon requests are blocked).
alter table public.app_state enable row level security;

-- Allow the service role to do anything (used by /api/sync)
create policy "service_role_all" on public.app_state
  for all
  using     (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- No anon / authenticated reads or writes directly from the browser —
-- all access goes through our serverless proxy which uses the service key.
-- If you later add Supabase Auth, you can add a per-user policy here.
