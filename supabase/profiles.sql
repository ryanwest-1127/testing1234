-- Phase 2: user profiles and role-based portal access.
-- Run this in Supabase SQL Editor after creating the first auth user.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null default 'employee' check (role in ('manager', 'employee')),
  department text not null default 'Production',
  start_date date,
  weekly_hours numeric(5, 2) not null default 37.50,
  daily_hours numeric(4, 2) not null default 7.50,
  annual_leave_allowance numeric(5, 2) not null default 28.00,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_manager()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'manager'
      and active = true
  );
$$;

drop policy if exists "profiles_read_own_or_manager" on public.profiles;
create policy "profiles_read_own_or_manager"
on public.profiles
for select
using (id = auth.uid() or public.is_manager());

drop policy if exists "profiles_update_manager" on public.profiles;
create policy "profiles_update_manager"
on public.profiles
for update
using (public.is_manager())
with check (public.is_manager());

drop policy if exists "profiles_insert_manager" on public.profiles;
create policy "profiles_insert_manager"
on public.profiles
for insert
with check (public.is_manager());

insert into public.profiles (
  id,
  email,
  full_name,
  role,
  department,
  weekly_hours,
  daily_hours,
  annual_leave_allowance,
  active
)
select
  id,
  email,
  'Ryan Hei',
  'manager',
  'Management',
  37.50,
  7.50,
  28.00,
  true
from auth.users
where lower(email) = 'ryan@sazmedia.co.uk'
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  department = excluded.department,
  weekly_hours = excluded.weekly_hours,
  daily_hours = excluded.daily_hours,
  annual_leave_allowance = excluded.annual_leave_allowance,
  active = excluded.active,
  updated_at = now();
