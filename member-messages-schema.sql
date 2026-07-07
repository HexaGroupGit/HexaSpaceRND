-- Member-to-member direct messages — run in the Supabase SQL editor (safe to re-run).
--
-- IMPORTANT: unlike the legacy open-read tables, this one is PARTICIPANT-SCOPED.
-- Only the two members in a conversation can read or write its messages, enforced
-- by RLS against the caller's authenticated email (auth.jwt() ->> 'email'). There
-- is intentionally NO anon policy — DMs must never be world-readable.

create table if not exists member_messages (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

alter table member_messages enable row level security;

-- Scoping matches the phase3/phase7 remediation convention: wrap the helper in
-- (select ...) so it evaluates once per statement (not per row), and compare
-- lowercased emails. current_email() is the SECURITY DEFINER helper from phase4.

-- Read: only if you are the sender or the recipient.
drop policy if exists mem_dm_sel on member_messages;
create policy mem_dm_sel on member_messages
  for select to authenticated
  using (
    lower(data->>'fromEmail') = (select lower(public.current_email()))
    or lower(data->>'toEmail') = (select lower(public.current_email()))
  );

-- Insert: only as yourself (you can't forge a message from someone else).
drop policy if exists mem_dm_ins on member_messages;
create policy mem_dm_ins on member_messages
  for insert to authenticated
  with check ( lower(data->>'fromEmail') = (select lower(public.current_email())) );

-- Update: either participant (used to flag messages read).
drop policy if exists mem_dm_upd on member_messages;
create policy mem_dm_upd on member_messages
  for update to authenticated
  using (
    lower(data->>'fromEmail') = (select lower(public.current_email()))
    or lower(data->>'toEmail') = (select lower(public.current_email()))
  );

-- Helps the "my conversations" / thread lookups.
create index if not exists member_messages_convo_idx on member_messages ((data->>'convoId'));
create index if not exists member_messages_to_idx on member_messages ((data->>'toEmail'));
create index if not exists member_messages_from_idx on member_messages ((data->>'fromEmail'));
