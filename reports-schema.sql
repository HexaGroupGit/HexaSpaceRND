-- Run in Supabase SQL Editor

-- Email activity log
create table if not exists email_log (
  id text primary key,
  data jsonb not null default '{}',
  updated_at timestamptz default now()
);
alter table email_log enable row level security;
create policy "anon all email_log" on email_log for all to anon using (true) with check (true);
create policy "auth all email_log" on email_log for all to authenticated using (true) with check (true);

-- Audit log
create table if not exists audit_log (
  id text primary key,
  data jsonb not null default '{}',
  updated_at timestamptz default now()
);
alter table audit_log enable row level security;
create policy "anon all audit_log" on audit_log for all to anon using (true) with check (true);
create policy "auth all audit_log" on audit_log for all to authenticated using (true) with check (true);

-- Documents
create table if not exists documents (
  id text primary key,
  data jsonb not null default '{}',
  updated_at timestamptz default now()
);
alter table documents enable row level security;
create policy "anon all documents" on documents for all to anon using (true) with check (true);
create policy "auth all documents" on documents for all to authenticated using (true) with check (true);
