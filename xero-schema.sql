-- Xero integration: server-side credential store.
-- Run this in the Supabase SQL editor before connecting Xero.
--
-- Unlike the other tables, `integrations` has NO anon policy: OAuth tokens are
-- only ever read/written by the Vercel API routes using the service-role key
-- (which bypasses RLS). The browser can never see them.

create table if not exists integrations (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table integrations enable row level security;
-- deliberately no "allow all to anon" policy
