-- Member PaperCut print PINs — run in Supabase SQL Editor (safe to re-run).
--
-- SECURITY: unlike the other tables in this project, member_pins holds CREDENTIALS
-- (each member's printer PIN). It therefore has RLS enabled and DELIBERATELY NO
-- anon/authenticated policy — with RLS on and no matching policy, the anon and
-- authenticated roles (i.e. anything using the public key in the browser) are
-- DENIED all access. Only the service role (used by api/papercut/pins.js to write
-- and api/portal/print-pin.js to read) bypasses RLS. Do NOT add an "anon all"
-- policy here like the other tables — that would expose every member's PIN to the
-- browser, since the app/portal fetch whole tables client-side.

create table if not exists member_pins (
  email text primary key,          -- lowercased member email
  pin text not null,               -- PaperCut login PIN (primary-card-number)
  updated_at timestamptz default now()
);

-- The member's PaperCut personal-account balance ($30 allowance counting down;
-- negative = print overage owing), pushed by sync-pins.mjs and shown to them in
-- the app/portal and to staff on the member profile. Added after the initial
-- table, so these run as idempotent alters.
alter table member_pins add column if not exists balance numeric;
alter table member_pins add column if not exists balance_updated_at timestamptz;

alter table member_pins enable row level security;

-- No policies for anon/authenticated on purpose (see note above). If you ever ran
-- a permissive policy here by mistake, drop it:
drop policy if exists "anon all member_pins" on member_pins;
drop policy if exists "auth all member_pins" on member_pins;
