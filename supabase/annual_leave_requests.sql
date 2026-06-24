-- Phase 4: annual leave requests stored in Supabase with row-level security.
-- Run this in Supabase SQL Editor after supabase/profiles.sql.

create table if not exists public.annual_leave_requests (
  id text primary key,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'Submitted' check (status in ('Submitted', 'Approved', 'Rejected')),
  request jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.annual_leave_requests enable row level security;

drop policy if exists "annual_leave_requests_read_own_or_manager" on public.annual_leave_requests;
create policy "annual_leave_requests_read_own_or_manager"
on public.annual_leave_requests
for select
using (employee_id = auth.uid() or public.is_manager());

drop policy if exists "annual_leave_requests_insert_own_or_manager" on public.annual_leave_requests;
create policy "annual_leave_requests_insert_own_or_manager"
on public.annual_leave_requests
for insert
with check (employee_id = auth.uid() or public.is_manager());

drop policy if exists "annual_leave_requests_update_own_or_manager" on public.annual_leave_requests;
create policy "annual_leave_requests_update_own_or_manager"
on public.annual_leave_requests
for update
using (employee_id = auth.uid() or public.is_manager())
with check (employee_id = auth.uid() or public.is_manager());

drop policy if exists "annual_leave_requests_delete_own_or_manager" on public.annual_leave_requests;
create policy "annual_leave_requests_delete_own_or_manager"
on public.annual_leave_requests
for delete
using (employee_id = auth.uid() or public.is_manager());

