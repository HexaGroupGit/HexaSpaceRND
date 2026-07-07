-- Security Phase 5 — lock down the event-insurance storage bucket.
--
-- Today the bucket is PUBLIC (public_read for anon) so uploaded insurance
-- certificates (third-party PII) are reachable by URL, and any authenticated
-- user can read/write it. After this: bucket is private, only admins touch it
-- from the browser, and all reads are time-limited signed URLs. The public
-- sign-page + admin flows upload via the service role (api/event-bookings/upload)
-- and generate signed URLs, so they are unaffected.
--
-- CUTOVER-GATED: apply AFTER the new frontend is deployed — the old bundle still
-- uploads to / getPublicUrl's this bucket with the anon/any-authenticated policies.

-- Private bucket: no more anonymous public reads.
update storage.buckets set public = false where id = 'event-insurance';

-- Drop the anon upload + public read + any-authenticated policies.
drop policy if exists anon_upload_event_insurance on storage.objects;
drop policy if exists public_read_event_insurance on storage.objects;
drop policy if exists authenticated_all_event_insurance on storage.objects;

-- Only admins may read/write the bucket from a browser session. (Service-role
-- endpoints bypass RLS for the public sign-page upload path.)
drop policy if exists admin_all_event_insurance on storage.objects;
create policy admin_all_event_insurance on storage.objects for all to authenticated
  using (bucket_id = 'event-insurance' and public.is_admin())
  with check (bucket_id = 'event-insurance' and public.is_admin());
