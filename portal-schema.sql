-- Portal messages: tenant <-> admin thread
create table if not exists portal_messages (
  id text primary key,
  data jsonb not null
);
alter table portal_messages enable row level security;
create policy "anon all portal_messages" on portal_messages
  for all to anon using (true) with check (true);
create policy "auth all portal_messages" on portal_messages
  for all to authenticated using (true) with check (true);

-- Portal events: admin-managed events shown to members
create table if not exists portal_events (
  id text primary key,
  data jsonb not null
);
alter table portal_events enable row level security;
create policy "anon all portal_events" on portal_events
  for all to anon using (true) with check (true);
create policy "auth all portal_events" on portal_events
  for all to authenticated using (true) with check (true);
