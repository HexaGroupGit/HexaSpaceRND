-- Security Phase 3b — multi-company member scoping.
--
-- WHY: a person can belong to more than one company (e.g. the same director
-- renting under two entities). phase3_member_scoping.sql resolved a SINGLE
-- company via current_company() (LIMIT 1), so the portal only ever showed one.
-- This replaces the per-table member policies with a SET-based check so a member
-- sees EVERY company their email is attached to, and the portal can switch
-- between them. Access is still derived solely from the caller's own verified
-- JWT email — no cross-tenant leakage.
--
-- Safe to re-run (drop-and-create). current_company() is kept (still returns the
-- first, used by any policy not migrated here, e.g. fobs.sql).

-- ── Identity: ALL companies for the logged-in email ─────────────────────────
-- SECURITY DEFINER so it resolves email→companies without being subject to the
-- RLS it powers (no recursion). Returns tenants the caller is a member of, plus
-- any tenant whose own primary-contact email matches.
create or replace function public.current_companies() returns setof text
  language sql stable security definer set search_path = public
  as $$
    select m.data->>'companyId' from members m
      where lower(m.data->>'email') = public.current_email()
        and coalesce(m.data->>'companyId','') <> ''
    union
    select t.id from tenants t
      where lower(t.data->>'email') = public.current_email()
  $$;

grant execute on function public.current_companies() to authenticated;

-- ── Per-table member policies (set-based) ───────────────────────────────────
drop policy if exists mem_sel_tenants on public.tenants;
create policy mem_sel_tenants on public.tenants for select to authenticated
  using (id in (select public.current_companies()));
drop policy if exists mem_upd_tenants on public.tenants;
create policy mem_upd_tenants on public.tenants for update to authenticated
  using (id in (select public.current_companies()))
  with check (id in (select public.current_companies()));

drop policy if exists mem_sel_members on public.members;
create policy mem_sel_members on public.members for select to authenticated
  using (data->>'companyId' in (select public.current_companies()));
drop policy if exists mem_ins_members on public.members;
create policy mem_ins_members on public.members for insert to authenticated
  with check (data->>'companyId' in (select public.current_companies()));
drop policy if exists mem_upd_members on public.members;
create policy mem_upd_members on public.members for update to authenticated
  using (data->>'companyId' in (select public.current_companies()))
  with check (data->>'companyId' in (select public.current_companies()));

drop policy if exists mem_sel_leases on public.leases;
create policy mem_sel_leases on public.leases for select to authenticated
  using (data->>'tenantId' in (select public.current_companies()));

drop policy if exists mem_sel_invoices on public.invoices;
create policy mem_sel_invoices on public.invoices for select to authenticated
  using (data->>'tenantId' in (select public.current_companies()));

drop policy if exists mem_sel_mail on public.mail_items;
create policy mem_sel_mail on public.mail_items for select to authenticated
  using (data->>'companyId' in (select public.current_companies()));

drop policy if exists mem_sel_fees on public.fees;
create policy mem_sel_fees on public.fees for select to authenticated
  using (data->>'companyId' in (select public.current_companies()));
drop policy if exists mem_ins_fees on public.fees;
create policy mem_ins_fees on public.fees for insert to authenticated
  with check (data->>'companyId' in (select public.current_companies()));

drop policy if exists mem_sel_bookings on public.bookings;
create policy mem_sel_bookings on public.bookings for select to authenticated
  using (data->>'companyId' in (select public.current_companies()));
drop policy if exists mem_ins_bookings on public.bookings;
create policy mem_ins_bookings on public.bookings for insert to authenticated
  with check (data->>'companyId' in (select public.current_companies()));
drop policy if exists mem_upd_bookings on public.bookings;
create policy mem_upd_bookings on public.bookings for update to authenticated
  using (data->>'companyId' in (select public.current_companies()))
  with check (data->>'companyId' in (select public.current_companies()));

drop policy if exists mem_sel_food on public.food_orders;
create policy mem_sel_food on public.food_orders for select to authenticated
  using (data->>'companyId' in (select public.current_companies()));
drop policy if exists mem_ins_food on public.food_orders;
create policy mem_ins_food on public.food_orders for insert to authenticated
  with check (data->>'companyId' in (select public.current_companies()));

drop policy if exists mem_sel_fnbk on public.function_bookings;
create policy mem_sel_fnbk on public.function_bookings for select to authenticated
  using (data->>'companyId' in (select public.current_companies()));
drop policy if exists mem_ins_fnbk on public.function_bookings;
create policy mem_ins_fnbk on public.function_bookings for insert to authenticated
  with check (data->>'companyId' in (select public.current_companies()));
drop policy if exists mem_upd_fnbk on public.function_bookings;
create policy mem_upd_fnbk on public.function_bookings for update to authenticated
  using (data->>'companyId' in (select public.current_companies()))
  with check (data->>'companyId' in (select public.current_companies()));

drop policy if exists mem_sel_msgs on public.portal_messages;
create policy mem_sel_msgs on public.portal_messages for select to authenticated
  using (data->>'tenantId' in (select public.current_companies()));
drop policy if exists mem_ins_msgs on public.portal_messages;
create policy mem_ins_msgs on public.portal_messages for insert to authenticated
  with check (data->>'tenantId' in (select public.current_companies()));
drop policy if exists mem_upd_msgs on public.portal_messages;
create policy mem_upd_msgs on public.portal_messages for update to authenticated
  using (data->>'tenantId' in (select public.current_companies()))
  with check (data->>'tenantId' in (select public.current_companies()));
