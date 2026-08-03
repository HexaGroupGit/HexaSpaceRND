-- Training / SOPs — internal standard operating procedures.
--
-- Run this whole file in the Supabase SQL editor. Safe to re-run.
--
-- These are INTERNAL staff documents (escalation rules, overdue handling, access
-- procedures). They are admin-only: no anon access at all, and authenticated
-- members cannot read them either — only emails on the admins allow-list.
-- Mirrors the phase4/phase6 posture; is_admin() comes from
-- migrations/phase4_admin_auth.sql.

create table if not exists public.sops (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz default now()
);

alter table public.sops enable row level security;

-- Supabase's default grants would otherwise let the publishable (anon) key hit
-- the table — revoke explicitly, same as the other locked-down tables.
revoke all on public.sops from anon;
grant select, insert, update, delete on public.sops to authenticated;

-- Admins only, for everything. (select ...) wrapper per the phase7 perf convention.
drop policy if exists sops_admin_all on public.sops;
create policy sops_admin_all on public.sops for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Acknowledgements — who has read which SOP, at which version.
--
-- Version-stamped on purpose: republishing an SOP (bumping its version) re-opens
-- everyone's acknowledgement instead of leaving a stale sign-off in place. This
-- is what makes the register answer "who has read the CURRENT procedure".
create table if not exists public.sop_acks (
  id         text primary key,   -- <sopId>:<personEmail>:<version>
  data       jsonb not null,     -- { sopId, sopSlug, version, personEmail, personName, ackedAt }
  updated_at timestamptz default now()
);

alter table public.sop_acks enable row level security;
revoke all on public.sop_acks from anon;
grant select, insert, update, delete on public.sop_acks to authenticated;

-- Admins see and manage the whole register; a signed-in staff member may record
-- (and read back) their OWN acknowledgement.
drop policy if exists sop_acks_admin_all on public.sop_acks;
create policy sop_acks_admin_all on public.sop_acks for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists sop_acks_self_sel on public.sop_acks;
create policy sop_acks_self_sel on public.sop_acks for select to authenticated
  using (lower(data->>'personEmail') = (select public.current_email()));

drop policy if exists sop_acks_self_ins on public.sop_acks;
create policy sop_acks_self_ins on public.sop_acks for insert to authenticated
  with check (lower(data->>'personEmail') = (select public.current_email()));

create index if not exists sop_acks_sop_idx on public.sop_acks ((data->>'sopId'));
