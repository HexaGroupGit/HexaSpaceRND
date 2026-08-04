-- Phase 9 — invoices are the BILLING AUTHORITY's, not every teammate's.
--
-- Phase 3/3b/7 scoped member reads to their company, which is right for spaces,
-- bookings and members — but `invoices` is narrower than that. The app rule
-- (src/lib/billingAccess.js canViewBilling, api/_auth.js isBillingAuthority) is:
-- only the company's billing person, its contact person, or a company-email
-- login with no member row of its own may see what the company is billed.
--
-- Until this runs, that rule lives only in the UI and in the api/ gates: any
-- signed-in teammate could still read their company's invoices with a direct
-- PostgREST query. This closes it at the database.
--
-- Run in the Supabase SQL editor. Mirrors the phase7 policy shape, so
-- current_company() stays the tenant scope and this only ANDs a second gate.

create or replace function public.is_billing_authority() returns boolean
  language sql stable security definer set search_path = public
  as $$
    select
      -- Company / owner login that has no member row at all.
      not exists (
        select 1 from members m
        where lower(m.data->>'email') = public.current_email()
      )
      -- …or any of their member rows marks them billing or contact person.
      or exists (
        select 1 from members m
        where lower(m.data->>'email') = public.current_email()
          and (coalesce(m.data->>'billingPerson', 'false')::boolean
            or coalesce(m.data->>'contactPerson', 'false')::boolean)
      );
  $$;

grant execute on function public.is_billing_authority() to authenticated;

-- NB: the LIVE policy uses current_companies() (plural — phase3b multi-company),
-- not the current_company() shown in phase7. Keep the plural or a member who
-- acts for two companies loses one of them. This only ANDs the second gate on.
drop policy if exists mem_sel_invoices on public.invoices;
create policy mem_sel_invoices on public.invoices for select to authenticated
  using (
    data->>'tenantId' in (select public.current_companies())
    and (select public.is_billing_authority())
  );

-- Verify without touching auth — impersonate the JWT claim the policy reads:
--   begin;
--   select set_config('request.jwt.claims','{"email":"someone@x.com","role":"authenticated"}',true);
--   set local role authenticated;
--   select count(*) from invoices;
--   rollback;
-- Expect: >0 for a billing/contact person or a company login, 0 for a teammate.
--
-- Rollback:
--   drop policy if exists mem_sel_invoices on public.invoices;
--   create policy mem_sel_invoices on public.invoices for select to authenticated
--     using (data->>'tenantId' in (select public.current_companies()));
