-- HexaHub Database Schema
-- Run this in Supabase SQL Editor

create table if not exists tenants (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists spaces (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists leases (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists templates (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists invoices (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists discounts (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists settings (
  id text primary key default 'global',
  data jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists meta (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

-- Enable Row Level Security but allow all for anon key (internal tool)
alter table tenants enable row level security;
alter table spaces enable row level security;
alter table leases enable row level security;
alter table templates enable row level security;
alter table invoices enable row level security;
alter table discounts enable row level security;
alter table settings enable row level security;
alter table meta enable row level security;

-- Allow full access for anon key (portal is protected by login)
create policy "allow all" on tenants for all to anon using (true) with check (true);
create policy "allow all" on spaces for all to anon using (true) with check (true);
create policy "allow all" on leases for all to anon using (true) with check (true);
create policy "allow all" on templates for all to anon using (true) with check (true);
create policy "allow all" on invoices for all to anon using (true) with check (true);
create policy "allow all" on discounts for all to anon using (true) with check (true);
create policy "allow all" on settings for all to anon using (true) with check (true);
create policy "allow all" on meta for all to anon using (true) with check (true);
