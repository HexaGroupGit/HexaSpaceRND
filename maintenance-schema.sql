-- Run in Supabase SQL Editor to create the maintenance table

create table if not exists maintenance (
  id text primary key,
  data jsonb not null default '{}',
  updated_at timestamptz default now()
);

alter table maintenance enable row level security;

drop policy if exists "public all maintenance" on maintenance;
drop policy if exists "auth all maintenance" on maintenance;

create policy "public all maintenance" on maintenance for all to anon using (true) with check (true);
create policy "auth all maintenance" on maintenance for all to authenticated using (true) with check (true);
