-- Security Phase 7 — RLS performance fix (URGENT, applied right after cutover).
--
-- The Phase 3/4 policies called current_company()/current_email()/is_admin()
-- directly, which Postgres re-evaluates PER ROW under RLS — a member's invoice
-- load (1800+ rows) timed out at 8s. Wrapping each call in a scalar subquery
-- `(select ...)` forces a single evaluation per statement (the documented
-- Supabase pattern). We also add btree indexes on the JSONB scoping expressions
-- so the scoped reads use an index scan instead of a full seq scan.

-- ── Indexes on scoping expressions (speed the .eq filters + RLS predicates) ──
create index if not exists idx_invoices_tenant   on public.invoices          ((data->>'tenantId'));
create index if not exists idx_leases_tenant      on public.leases            ((data->>'tenantId'));
create index if not exists idx_members_company    on public.members           ((data->>'companyId'));
create index if not exists idx_members_email       on public.members           (lower(data->>'email'));
create index if not exists idx_tenants_email        on public.tenants           (lower(data->>'email'));
create index if not exists idx_bookings_company    on public.bookings          ((data->>'companyId'));
create index if not exists idx_fees_company        on public.fees              ((data->>'companyId'));
create index if not exists idx_mail_company        on public.mail_items        ((data->>'companyId'));
create index if not exists idx_food_company        on public.food_orders       ((data->>'companyId'));
create index if not exists idx_fnbk_company        on public.function_bookings ((data->>'companyId'));
create index if not exists idx_msgs_tenant         on public.portal_messages   ((data->>'tenantId'));

-- ── Recreate member policies with the (select ...) single-eval wrap ──────────
drop policy if exists mem_sel_tenants on public.tenants;
create policy mem_sel_tenants on public.tenants for select to authenticated
  using (id = (select public.current_company()));
drop policy if exists mem_upd_tenants on public.tenants;
create policy mem_upd_tenants on public.tenants for update to authenticated
  using (id = (select public.current_company())) with check (id = (select public.current_company()));

drop policy if exists mem_sel_members on public.members;
create policy mem_sel_members on public.members for select to authenticated
  using (data->>'companyId' = (select public.current_company()));
drop policy if exists mem_ins_members on public.members;
create policy mem_ins_members on public.members for insert to authenticated
  with check (data->>'companyId' = (select public.current_company()));
drop policy if exists mem_upd_members on public.members;
create policy mem_upd_members on public.members for update to authenticated
  using (data->>'companyId' = (select public.current_company()))
  with check (data->>'companyId' = (select public.current_company()));

drop policy if exists mem_sel_leases on public.leases;
create policy mem_sel_leases on public.leases for select to authenticated
  using (data->>'tenantId' = (select public.current_company()));

drop policy if exists mem_sel_invoices on public.invoices;
create policy mem_sel_invoices on public.invoices for select to authenticated
  using (data->>'tenantId' = (select public.current_company()));

drop policy if exists mem_sel_mail on public.mail_items;
create policy mem_sel_mail on public.mail_items for select to authenticated
  using (data->>'companyId' = (select public.current_company()));

drop policy if exists mem_sel_fees on public.fees;
create policy mem_sel_fees on public.fees for select to authenticated
  using (data->>'companyId' = (select public.current_company()));
drop policy if exists mem_ins_fees on public.fees;
create policy mem_ins_fees on public.fees for insert to authenticated
  with check (data->>'companyId' = (select public.current_company()));

drop policy if exists mem_sel_bookings on public.bookings;
create policy mem_sel_bookings on public.bookings for select to authenticated
  using (data->>'companyId' = (select public.current_company()));
drop policy if exists mem_ins_bookings on public.bookings;
create policy mem_ins_bookings on public.bookings for insert to authenticated
  with check (data->>'companyId' = (select public.current_company()));
drop policy if exists mem_upd_bookings on public.bookings;
create policy mem_upd_bookings on public.bookings for update to authenticated
  using (data->>'companyId' = (select public.current_company()))
  with check (data->>'companyId' = (select public.current_company()));

drop policy if exists mem_sel_food on public.food_orders;
create policy mem_sel_food on public.food_orders for select to authenticated
  using (data->>'companyId' = (select public.current_company()));
drop policy if exists mem_ins_food on public.food_orders;
create policy mem_ins_food on public.food_orders for insert to authenticated
  with check (data->>'companyId' = (select public.current_company()));

drop policy if exists mem_sel_fnbk on public.function_bookings;
create policy mem_sel_fnbk on public.function_bookings for select to authenticated
  using (data->>'companyId' = (select public.current_company()));
drop policy if exists mem_ins_fnbk on public.function_bookings;
create policy mem_ins_fnbk on public.function_bookings for insert to authenticated
  with check (data->>'companyId' = (select public.current_company()));
drop policy if exists mem_upd_fnbk on public.function_bookings;
create policy mem_upd_fnbk on public.function_bookings for update to authenticated
  using (data->>'companyId' = (select public.current_company()))
  with check (data->>'companyId' = (select public.current_company()));

drop policy if exists mem_sel_msgs on public.portal_messages;
create policy mem_sel_msgs on public.portal_messages for select to authenticated
  using (data->>'tenantId' = (select public.current_company()));
drop policy if exists mem_ins_msgs on public.portal_messages;
create policy mem_ins_msgs on public.portal_messages for insert to authenticated
  with check (data->>'tenantId' = (select public.current_company()));
drop policy if exists mem_upd_msgs on public.portal_messages;
create policy mem_upd_msgs on public.portal_messages for update to authenticated
  using (data->>'tenantId' = (select public.current_company()))
  with check (data->>'tenantId' = (select public.current_company()));

-- ── Recreate admin policies with the wrap ───────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'tenants','spaces','leases','templates','invoices','discounts','maintenance',
    'settings','meta','leads','lead_pipeline_stages','referrers','members','fees',
    'bookings','portal_messages','esign_requests','documents','function_bookings',
    'event_bookings','food_orders','food_menu_items','mail_items','portal_events',
    'email_log','audit_log'
  ] loop
    execute format('drop policy if exists adm_all_%I on public.%I', t, t);
    execute format('create policy adm_all_%I on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t, t);
  end loop;
end $$;

-- ── admins table policies with the wrap ─────────────────────────────────────
drop policy if exists admins_self_read on public.admins;
create policy admins_self_read on public.admins for select to authenticated
  using (lower(email) = (select public.current_email()));
drop policy if exists admins_admin_read on public.admins;
create policy admins_admin_read on public.admins for select to authenticated
  using ((select public.is_admin()));
drop policy if exists admins_admin_write on public.admins;
create policy admins_admin_write on public.admins for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
