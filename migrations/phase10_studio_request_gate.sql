-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 10 — SECURITY: the podcast studio cannot be self-confirmed.
--
-- WHY THIS EXISTS
-- The podcast studio is staff-operated: a session needs an operator rostered,
-- a pre-session questionnaire and a policy acceptance, so it is request-to-book.
-- The app enforces that in five places (portal booking + amend, mobile app
-- create + amend, and api/bookings/pay-and-book.js).
--
-- All of that is COSMETIC on its own. The member RLS policies on `bookings`
-- (phase3 → phase3b → phase7) constrain only the row's companyId:
--
--     with check (data->>'companyId' = (select public.current_company()))
--
-- Nothing constrains `data->>'status'`. A member holds the portal's anon key and
-- their own JWT, so they can POST straight to PostgREST with
-- {resourceId: <podcast space>, companyId: <their own>, status: 'Confirmed'},
-- and RLS passes. api/salto/room-access.js grants physical door access to any
-- Confirmed booking (isConfirmed is a plain status check), and that endpoint is
-- member-callable — so the result is unauthorised access to the studio with no
-- staff involvement, no questionnaire and no charge.
--
-- This migration moves the invariant into the database, where a hand-crafted
-- request cannot route around it.
--
-- WHAT IT ALLOWS
--   · Admins (public.is_admin()) — anything. The admin app IS the approval UI.
--   · The service role — anything. Server endpoints already do their own checks
--     and the cron/Salto sweep must be able to stamp rows.
--   · Members — may create and amend their own studio sessions freely, but only
--     ever at status 'Pending' or 'Cancelled'. Requesting and withdrawing are
--     theirs; approving is not.
--
-- Non-gated resources (meeting rooms, media studios) are untouched: instant
-- booking still writes 'Confirmed' exactly as before.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- Space types that are staff-operated / request-to-book. Keep in step with
-- REQUEST_GATED_TYPES in src/lib/studio.js.
create or replace function public.studio_request_gated(space_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (s.data->>'type') in ('podcast') from public.spaces s where s.id = space_id),
    false
  );
$$;

grant execute on function public.studio_request_gated(text) to authenticated, anon;

create or replace function public.enforce_studio_request_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_status text := new.data->>'status';
  resource_id text := new.data->>'resourceId';
begin
  -- The service role bypasses this entirely: server-side endpoints run their own
  -- authorisation, and the Salto sweep has to stamp access fields on confirmed
  -- rows. auth.role() is 'service_role' for the service key, and NULL for a
  -- direct psql/SQL-editor session, which we also let through.
  if coalesce(auth.role(), 'service_role') = 'service_role' then
    return new;
  end if;

  -- Staff approve. That is the whole point of the workflow.
  if public.is_admin() then
    return new;
  end if;

  if resource_id is null or not public.studio_request_gated(resource_id) then
    return new; -- ordinary room: unchanged behaviour
  end if;

  if new_status is distinct from 'Pending' and new_status is distinct from 'Cancelled' then
    raise exception
      'The podcast studio is booked by request: a session must be created as Pending and can only be confirmed by the Hexa Space team.'
      using errcode = 'check_violation';
  end if;

  -- Block the other half of the same trick: taking an already-approved session
  -- and editing it. Members withdraw (Cancelled) or ask us to move it.
  if tg_op = 'UPDATE' and (old.data->>'status') = 'Confirmed' and new_status <> 'Cancelled' then
    raise exception
      'This studio session is already confirmed — please contact the studio team to change it.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_studio_request_gate on public.bookings;
create trigger trg_studio_request_gate
  before insert or update on public.bookings
  for each row execute function public.enforce_studio_request_gate();
