-- Phase 4: expense claims stored in Supabase with row-level security.
-- Run this in Supabase SQL Editor after supabase/profiles.sql.

create table if not exists public.expense_claims (
  id text primary key,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  claim_month text not null,
  status text not null default 'Submitted' check (status in ('Draft', 'Submitted', 'Approved', 'Rejected', 'Paid')),
  claim jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, claim_month)
);

alter table public.expense_claims enable row level security;

drop policy if exists "expense_claims_read_own_or_manager" on public.expense_claims;
create policy "expense_claims_read_own_or_manager"
on public.expense_claims
for select
using (employee_id = auth.uid() or public.is_manager());

drop policy if exists "expense_claims_insert_own_or_manager" on public.expense_claims;
create policy "expense_claims_insert_own_or_manager"
on public.expense_claims
for insert
with check (employee_id = auth.uid() or public.is_manager());

drop policy if exists "expense_claims_update_own_or_manager" on public.expense_claims;
drop policy if exists "expense_claims_update_manager" on public.expense_claims;
create policy "expense_claims_update_manager"
on public.expense_claims
for update
using (public.is_manager() or (employee_id = auth.uid() and status in ('Draft', 'Submitted')))
with check (public.is_manager() or (employee_id = auth.uid() and status in ('Draft', 'Submitted')));

drop policy if exists "expense_claims_delete_own_or_manager" on public.expense_claims;
drop policy if exists "expense_claims_delete_manager" on public.expense_claims;
create policy "expense_claims_delete_manager"
on public.expense_claims
for delete
using (public.is_manager() or (employee_id = auth.uid() and status in ('Draft', 'Submitted')));
