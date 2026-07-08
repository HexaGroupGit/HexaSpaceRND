-- Digital Directory boards (Level 4 / Level 2 lobby TVs)
-- Run this once in the Supabase SQL Editor.
--
-- Holds ONLY public lobby-board display text (suite -> shown business name, and
-- the Level 4 community list). No member/company/private data, so anon SELECT is
-- safe and does not reintroduce the IDOR surface fixed in the RLS remediation.
-- Anon is read-only (the TVs view the board without logging in); only an
-- authenticated admin can write.

drop table if exists directory_boards cascade;

create table directory_boards (
  id text primary key,            -- '4' or '2'
  data jsonb not null,
  updated_at timestamptz default now()
);

alter table directory_boards enable row level security;

-- TVs / public lobby screens: read-only, no auth required.
create policy "public read directory" on directory_boards
  for select to anon using (true);

-- Admins (authenticated): full read/write.
create policy "auth all directory" on directory_boards
  for all to authenticated using (true) with check (true);
