-- Run this entire file in Supabase SQL editor.
-- It creates the bucket AND the policies in one go. Safe to re-run.

-- Step 1: Create the bucket (safe to re-run — does nothing if it already exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-insurance', 'event-insurance', true)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Policies (safe to re-run — drops existing ones first)

DROP POLICY IF EXISTS "anon_upload_event_insurance" ON storage.objects;
DROP POLICY IF EXISTS "public_read_event_insurance" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_all_event_insurance" ON storage.objects;

CREATE POLICY "anon_upload_event_insurance"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'event-insurance');

CREATE POLICY "public_read_event_insurance"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'event-insurance');

CREATE POLICY "authenticated_all_event_insurance"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'event-insurance')
WITH CHECK (bucket_id = 'event-insurance');
