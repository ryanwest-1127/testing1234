-- Phase 4: private receipt proof storage.
-- Run this in Supabase SQL Editor after supabase/profiles.sql.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipt-proofs',
  'receipt-proofs',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "receipt_proofs_read_own_or_manager" on storage.objects;
create policy "receipt_proofs_read_own_or_manager"
on storage.objects
for select
using (
  bucket_id = 'receipt-proofs'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_manager())
);

drop policy if exists "receipt_proofs_insert_own_or_manager" on storage.objects;
create policy "receipt_proofs_insert_own_or_manager"
on storage.objects
for insert
with check (
  bucket_id = 'receipt-proofs'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_manager())
);

drop policy if exists "receipt_proofs_update_own_or_manager" on storage.objects;
drop policy if exists "receipt_proofs_update_manager" on storage.objects;
create policy "receipt_proofs_update_manager"
on storage.objects
for update
using (bucket_id = 'receipt-proofs' and public.is_manager())
with check (bucket_id = 'receipt-proofs' and public.is_manager());

drop policy if exists "receipt_proofs_delete_own_or_manager" on storage.objects;
drop policy if exists "receipt_proofs_delete_manager" on storage.objects;
create policy "receipt_proofs_delete_manager"
on storage.objects
for delete
using (bucket_id = 'receipt-proofs' and public.is_manager());
