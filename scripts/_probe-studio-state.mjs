// Read-only probe of everything the studio go-live touches, BEFORE any change.
import { sql } from './_sql.mjs'

const j = (v) => JSON.stringify(v, null, 2)

console.log('── podcast spaces ──')
const spaces = await sql(`
  select id,
         data->>'unitNumber' as unit,
         data->>'type'       as type,
         data->>'hourlyRate' as hourly_rate,
         data->>'rate'       as rate,
         data->>'monthlyRate' as monthly_rate,
         data->>'size'       as size
  from spaces
  where data->>'type' in ('podcast','studio')
  order by data->>'type', data->>'unitNumber';`)
console.log(j(spaces))

console.log('\n── phase10 trigger present? ──')
console.log(j(await sql(`
  select tgname from pg_trigger
  where tgname = 'trg_studio_request_gate' and not tgisinternal;`)))

console.log('\n── gate helper functions present? ──')
console.log(j(await sql(`
  select proname from pg_proc
  where proname in ('studio_request_gate','studio_request_gated','enforce_studio_request_gate','is_admin','current_company')
  order by proname;`)))

console.log('\n── email safe mode (settings.global) ──')
console.log(j(await sql(`
  select data->'emails'->>'safeMode'      as safe_mode,
         data->'emails'->>'safeRecipient' as safe_recipient
  from settings where id = 'global';`)))

console.log('\n── existing studio bookings (should be none yet) ──')
console.log(j(await sql(`
  select count(*)::int as n,
         count(*) filter (where b.data->>'status' = 'Pending')::int   as pending,
         count(*) filter (where b.data->>'status' = 'Confirmed')::int as confirmed
  from bookings b
  join spaces s on s.id = b.data->>'resourceId'
  where s.data->>'type' = 'podcast';`)))
