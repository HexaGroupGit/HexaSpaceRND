-- Task board photos — private bucket, admins only (same posture as
-- event-insurance after phase 5). The board reads them through short-lived
-- signed URLs; nothing is publicly reachable.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-photos', 'task-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists admin_all_task_photos on storage.objects;
create policy admin_all_task_photos on storage.objects for all to authenticated
  using (bucket_id = 'task-photos' and (select public.is_admin()))
  with check (bucket_id = 'task-photos' and (select public.is_admin()));
