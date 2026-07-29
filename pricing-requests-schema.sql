-- Pricing Requests — run once in the Supabase SQL editor.
-- Same { id, data (jsonb), updated_at } shape as every other table in the app.
--
-- Staff raise a request to let a space at below the list rate; a pricing manager
-- records an approve/decline decision WITH reasoning. Admin-only: there is no
-- member-facing surface, so anon gets nothing.
create table if not exists public.pricing_requests (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.pricing_requests enable row level security;

-- Authenticated admins: full access. (The admin console is the only client;
-- members never read this table.)
drop policy if exists "pricing_requests admin all" on public.pricing_requests;
create policy "pricing_requests admin all"
  on public.pricing_requests for all
  to authenticated
  using (true) with check (true);

-- Anonymous: no access at all.
revoke all on public.pricing_requests from anon;

create index if not exists pricing_requests_status_idx
  on public.pricing_requests ((data->>'status'));
