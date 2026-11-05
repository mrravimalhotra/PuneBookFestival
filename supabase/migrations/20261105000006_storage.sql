-- =============================================================================
-- 0006 · Storage buckets for partner logos and organiser photos
-- Public read (served via public URLs), admin-only write.
-- File type and size are also checked server-side before upload.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('partner-logos', 'partner-logos', true, 1048576,
   array['image/svg+xml', 'image/png', 'image/webp']),
  ('people-photos', 'people-photos', true, 2097152,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "pbf admin insert" on storage.objects;
create policy "pbf admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('partner-logos', 'people-photos') and (select public.is_admin()));

drop policy if exists "pbf admin update" on storage.objects;
create policy "pbf admin update" on storage.objects
  for update to authenticated
  using (bucket_id in ('partner-logos', 'people-photos') and (select public.is_admin()))
  with check (bucket_id in ('partner-logos', 'people-photos') and (select public.is_admin()));

drop policy if exists "pbf admin delete" on storage.objects;
create policy "pbf admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('partner-logos', 'people-photos') and (select public.is_admin()));

-- Admins can list objects (needed for upsert/replace). Public buckets serve
-- files by URL without any select policy, so anon gets no listing access.
drop policy if exists "pbf admin select" on storage.objects;
create policy "pbf admin select" on storage.objects
  for select to authenticated
  using (bucket_id in ('partner-logos', 'people-photos') and (select public.is_admin()));
