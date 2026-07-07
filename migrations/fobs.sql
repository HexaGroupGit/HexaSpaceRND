-- Fob & Remote tracker — device inventory, assignments (issue/return/deposit)
-- and portal requests. Follows the app's {id, data jsonb, updated_at} convention.
--
-- Tables are born with a permissive authenticated policy (parity with the current
-- pre-cutover tables) PLUS additive admin/member-scoped policies matching the rest
-- of the security remediation. The additive blocks are guarded on the helper
-- functions (is_admin / current_company) so this file applies cleanly whatever
-- phase the DB is on.

create table if not exists public.fobs (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);
create table if not exists public.fob_assignments (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);
create table if not exists public.fob_requests (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

alter table public.fobs            enable row level security;
alter table public.fob_assignments enable row level security;
alter table public.fob_requests    enable row level security;

grant select, insert, update, delete on public.fobs to authenticated;
grant select, insert, update, delete on public.fob_assignments to authenticated;
grant select, insert, update, delete on public.fob_requests to authenticated;

-- ── Permissive base (pre-cutover parity) ─────────────────────────────────────
drop policy if exists all_auth_fobs on public.fobs;
create policy all_auth_fobs on public.fobs for all to authenticated using (true) with check (true);
drop policy if exists all_auth_fob_assignments on public.fob_assignments;
create policy all_auth_fob_assignments on public.fob_assignments for all to authenticated using (true) with check (true);
drop policy if exists all_auth_fob_requests on public.fob_requests;
create policy all_auth_fob_requests on public.fob_requests for all to authenticated using (true) with check (true);

-- ── Additive: admin full access (Phase 4 model) ──────────────────────────────
do $$
begin
  if exists (select 1 from pg_proc where proname = 'is_admin') then
    execute 'drop policy if exists adm_all_fobs on public.fobs';
    execute 'create policy adm_all_fobs on public.fobs for all to authenticated using (public.is_admin()) with check (public.is_admin())';
    execute 'drop policy if exists adm_all_fob_assignments on public.fob_assignments';
    execute 'create policy adm_all_fob_assignments on public.fob_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin())';
    execute 'drop policy if exists adm_all_fob_requests on public.fob_requests';
    execute 'create policy adm_all_fob_requests on public.fob_requests for all to authenticated using (public.is_admin()) with check (public.is_admin())';
  end if;
end $$;

-- ── Additive: member scoping (Phase 3 model) ─────────────────────────────────
-- Members read their own device assignments; read + create their own requests.
-- The fobs inventory stays admin-only — serials are echoed onto the assignment /
-- request rows the member can already see, so they never need the inventory table.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'current_company') then
    execute 'drop policy if exists mem_sel_fob_assignments on public.fob_assignments';
    execute 'create policy mem_sel_fob_assignments on public.fob_assignments for select to authenticated using (data->>''companyId'' = public.current_company())';
    execute 'drop policy if exists mem_sel_fob_requests on public.fob_requests';
    execute 'create policy mem_sel_fob_requests on public.fob_requests for select to authenticated using (data->>''companyId'' = public.current_company())';
    execute 'drop policy if exists mem_ins_fob_requests on public.fob_requests';
    execute 'create policy mem_ins_fob_requests on public.fob_requests for insert to authenticated with check (data->>''companyId'' = public.current_company())';
  end if;
end $$;
