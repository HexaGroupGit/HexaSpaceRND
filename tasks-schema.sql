-- Assistant tasks — the admin to-do list behind /assistant.
--
-- Run this whole file in the Supabase SQL editor. Safe to re-run.
--
-- These are INTERNAL staff tasks ("chase Azlan about the shared card", "push
-- INV-3576 to Xero"). Admin-only: no anon access at all, and authenticated
-- members cannot read them either — only emails on the admins allow-list.
-- Mirrors the sops-schema posture; is_admin() comes from
-- migrations/phase4_admin_auth.sql.

create table if not exists public.tasks (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz default now()
);

alter table public.tasks enable row level security;

-- Supabase's default grants would otherwise let the publishable (anon) key hit
-- the table — revoke explicitly, same as the other locked-down tables.
revoke all on public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;

-- Admins only, for everything. (select ...) wrapper per the phase7 perf convention.
drop policy if exists tasks_admin_all on public.tasks;
create policy tasks_admin_all on public.tasks for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- The board filters on status and orders by due date; both are jsonb lookups.
create index if not exists tasks_status_idx on public.tasks ((data->>'status'));
create index if not exists tasks_due_idx    on public.tasks ((data->>'dueDate'));
