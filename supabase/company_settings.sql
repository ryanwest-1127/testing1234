-- Company-wide portal settings.
-- Run this in Supabase SQL Editor after supabase/profiles.sql.

create table if not exists public.company_settings (
  id text primary key default 'default',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_settings enable row level security;

drop policy if exists "company_settings_read_own_or_manager" on public.company_settings;
create policy "company_settings_read_own_or_manager"
on public.company_settings
for select
using (auth.uid() is not null);

drop policy if exists "company_settings_update_manager" on public.company_settings;
create policy "company_settings_update_manager"
on public.company_settings
for update
using (public.is_manager())
with check (public.is_manager());

drop policy if exists "company_settings_insert_manager" on public.company_settings;
create policy "company_settings_insert_manager"
on public.company_settings
for insert
with check (public.is_manager());

insert into public.company_settings (id, settings)
values ('default', '{"fiscalYearStart":"01-01"}'::jsonb)
on conflict (id) do nothing;
