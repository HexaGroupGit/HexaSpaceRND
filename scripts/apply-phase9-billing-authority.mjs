// Applies migrations/phase9_billing_authority.sql and verifies it, by
// impersonating the JWT claim the policies read — no auth session is created
// and nobody's last_sign_in is touched.
//
//   node scripts/apply-phase9-billing-authority.mjs           # check only
//   node scripts/apply-phase9-billing-authority.mjs --apply
import { readFileSync } from 'node:fs'
import { sql } from './_sql.mjs'

const APPLY = process.argv.includes('--apply')

// A teammate who must LOSE access, and billing authorities who must KEEP it.
const CASES = [
  { email: 'rachel@grantready.com.au', label: 'teammate (GrantGuru)', expect: 'none' },
  { email: 'verification@idoicity.com', label: 'billing person (I Do International)', expect: 'some' },
  { email: 'daniel@simplestacks.com.au', label: 'billing person (Simple Stacks)', expect: 'some' },
]

async function visible(email) {
  const rows = await sql(`
    begin;
    select set_config('request.jwt.claims', '${JSON.stringify({ email, role: 'authenticated' }).replace(/'/g, "''")}', true);
    set local role authenticated;
    select (select count(*) from invoices) as n;
    rollback;`)
  return Number(rows[0].n)
}

async function report(when) {
  console.log(`\n── invoices visible ${when} ──`)
  const out = []
  for (const c of CASES) {
    const n = await visible(c.email)
    const ok = c.expect === 'none' ? n === 0 : n > 0
    out.push({ ...c, n, ok })
    console.log(`  ${String(n).padStart(3)}  ${c.email.padEnd(34)} ${c.label}`)
  }
  return out
}

await report('BEFORE')

if (!APPLY) {
  console.log('\nDRY RUN — migration not applied. Re-run with --apply.')
} else {
  await sql(readFileSync('C:/Hexa-Space-RND/migrations/phase9_billing_authority.sql', 'utf8'))
  console.log('\nmigration applied')
  const after = await report('AFTER')
  const bad = after.filter((r) => !r.ok)
  if (bad.length) {
    console.log('\n!! UNEXPECTED — rolling back to the company-scoped policy')
    await sql(`
      drop policy if exists mem_sel_invoices on public.invoices;
      create policy mem_sel_invoices on public.invoices for select to authenticated
        using (data->>'tenantId' in (select public.current_companies()));`)
    console.log('rolled back. Investigate before retrying.')
    process.exit(1)
  }
  console.log('\nAll cases as expected: teammates 0, billing authorities unchanged.')
}
