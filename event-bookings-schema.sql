-- Run this in the Supabase SQL editor
CREATE TABLE IF NOT EXISTS event_bookings (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE event_bookings ENABLE ROW LEVEL SECURITY;

-- Admins (authenticated users) have full access
CREATE POLICY "authenticated_all_event_bookings"
  ON event_bookings FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- Public can read (sign page loads booking by token, no login)
CREATE POLICY "anon_select_event_bookings"
  ON event_bookings FOR SELECT
  TO anon
  USING (true);

-- Public can update (organiser signs without being logged in)
CREATE POLICY "anon_update_event_bookings"
  ON event_bookings FOR UPDATE
  TO anon
  USING (true) WITH CHECK (true);
