// Adversarial RLS / access probe. Uses ONLY the public anon key (the one shipped
// in the browser bundle) and — if TEST_MEMBER_EMAIL/TEST_MEMBER_PASSWORD are set
// — a real member-level Supabase Auth JWT. Every probe asserts that an
// unauthorised action FAILS. A "hole" is any probe that unexpectedly SUCCEEDS.
//
//   node scripts/security-probe.mjs
//
// Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env.local, plus optional
// TEST_MEMBER_EMAIL / TEST_MEMBER_PASSWORD / VICTIM_TENANT_ID / VICTIM_COMPANY_ID.
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

function parseEnv(path) {
  if (!fs.existsSync(path)) return {};
  const out = {};
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const env = { ...parseEnv('.env.local'), ...process.env };
const URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const ANON = env.VITE_SUPABASE_ANON_KEY;
if (!URL || !ANON) { console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY'); process.exit(1); }

const anon = createClient(URL, ANON, { auth: { persistSession: false } });

const results = [];
// A probe FN returns { blocked: boolean, detail: string }. `expectBlocked`
// says whether a secure system should deny it. PASS = outcome matches expectation.
async function probe(name, expectBlocked, fn) {
  let blocked, detail;
  try {
    const r = await fn();
    blocked = r.blocked; detail = r.detail;
  } catch (e) {
    blocked = true; detail = `threw: ${e.message}`;
  }
  const pass = blocked === expectBlocked;
  results.push({ name, expectBlocked, blocked, pass, detail });
  const tag = pass ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${name} — ${blocked ? 'blocked' : 'ALLOWED'} (${detail})`);
}

// Read-leak probe: any row returned to anon from a private table is a leak.
// (0 rows is ambiguous — a locked table and an empty table both return 0 with
// no error — so reads are informational; the WRITE probe below is decisive.)
async function readProbe(client, table, sel = 'data') {
  const { data, error } = await client.from(table).select(sel).limit(3);
  if (error) return { blocked: true, detail: error.message };
  const n = data?.length ?? 0;
  return { blocked: n === 0, detail: n ? `LEAKED ${n} row(s)` : 'no rows returned' };
}

// Decisive policy probe: an insert of a throwaway row. RLS-denied → error;
// open policy → success (which we then delete so we leave no junk behind).
const probeIds = [];
async function insertProbe(client, table, extra = {}) {
  const id = `__probe_${table}_${probeIds.length}__`;
  const { error } = await client.from(table).insert({ id, data: { __probe: true, ...extra }, updated_at: new Date().toISOString() });
  if (error) return { blocked: true, detail: error.message };
  probeIds.push([client, table, id]);
  return { blocked: false, detail: 'INSERT accepted (policy is open)' };
}

// Write is "blocked" when it errors. A silent success (no error) = write allowed.
async function writeProbe(client, table, row) {
  const { error } = await client.from(table).upsert(row);
  if (error) return { blocked: true, detail: error.message };
  probeIds.push([client, table, row.id]);
  return { blocked: false, detail: 'upsert accepted' };
}

async function cleanupProbeRows() {
  for (const [client, table, id] of probeIds) {
    await client.from(table).delete().eq('id', id).then(() => {}, () => {});
  }
}

console.log(`\n=== ANON KEY PROBES (${URL}) ===`);
console.log('Every anon read/write of private data should be BLOCKED.\n');

// --- Anonymous reads of private tables (all must be blocked / return nothing) ---
const KV_TABLES = ['tenants', 'members', 'leases', 'invoices', 'fees', 'bookings',
                   'mail_items', 'food_orders', 'function_bookings', 'portal_messages',
                   'leads', 'settings', 'event_bookings', 'maintenance', 'discounts',
                   'referrers', 'audit_log', 'email_log', 'documents'];
for (const t of KV_TABLES) {
  await probe(`anon read ${t}`, true, () => readProbe(anon, t));
}
await probe('anon read esign_requests', true, () => readProbe(anon, 'esign_requests', 'token,tenant_id,licensee_signature_data'));

// --- Decisive: anon INSERT into every private table must be denied by RLS ---
for (const t of KV_TABLES) {
  await probe(`anon insert ${t}`, true, () => insertProbe(anon, t));
}

// --- Anonymous writes (all must be blocked) ---
await probe('anon write leases (tamper rent)', true, () =>
  writeProbe(anon, 'leases', { id: '__probe_lease__', data: { monthlyRent: 1 }, updated_at: new Date().toISOString() }));
await probe('anon write invoices (mark paid)', true, () =>
  writeProbe(anon, 'invoices', { id: '__probe_inv__', data: { status: 'paid' }, updated_at: new Date().toISOString() }));
await probe('anon write settings (steal config)', true, () =>
  writeProbe(anon, 'settings', { id: '__probe_settings__', data: { hacked: true }, updated_at: new Date().toISOString() }));
await probe('anon write members (inject member)', true, () =>
  writeProbe(anon, 'members', { id: '__probe_member__', data: { email: 'attacker@evil.com', companyId: 'x' }, updated_at: new Date().toISOString() }));

// --- Anonymous read of the settings secret subset ---
await probe('anon read settings.adminUsers/billing (secrets)', true, async () => {
  const { data, error } = await anon.from('settings').select('data').eq('id', 'global');
  if (error) return { blocked: true, detail: error.message };
  const d = data?.[0]?.data;
  const leaked = d && (d.adminUsers || d.billing || d.xero);
  return { blocked: !leaked, detail: leaked ? `leaked keys: ${Object.keys(d).join(',')}` : 'no secret payload' };
});

// --- Member-level JWT probes (only if a disposable test member is provided) ---
const mEmail = env.TEST_MEMBER_EMAIL, mPass = env.TEST_MEMBER_PASSWORD;
const victimTenant = env.VICTIM_TENANT_ID, victimCompany = env.VICTIM_COMPANY_ID;
if (mEmail && mPass) {
  console.log(`\n=== MEMBER JWT PROBES (${mEmail}) ===`);
  console.log('A member should read ONLY their own company; cross-tenant + admin data BLOCKED.\n');
  const member = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: authErr } = await member.auth.signInWithPassword({ email: mEmail, password: mPass });
  if (authErr) {
    console.error('Could not sign in test member:', authErr.message);
  } else {
    // Reading whole private tables should be blocked or scoped to own company only.
    await probe('member read ALL tenants', true, async () => {
      const { data, error } = await member.from('tenants').select('data');
      if (error) return { blocked: true, detail: error.message };
      const others = (data ?? []).filter((r) => r.data?.id && r.data.id !== victimCompany);
      return { blocked: others.length === 0, detail: `${data?.length ?? 0} rows, ${others.length} foreign` };
    });
    await probe('member read another company invoices', true, async () => {
      const { data, error } = await member.from('invoices').select('data');
      if (error) return { blocked: true, detail: error.message };
      const foreign = (data ?? []).filter((r) => r.data?.tenantId && r.data.tenantId !== victimCompany);
      return { blocked: foreign.length === 0, detail: `${foreign.length} foreign invoice(s)` };
    });
    await probe('member read another company leases', true, async () => {
      const { data, error } = await member.from('leases').select('data');
      if (error) return { blocked: true, detail: error.message };
      const foreign = (data ?? []).filter((r) => r.data?.tenantId && r.data.tenantId !== victimCompany);
      return { blocked: foreign.length === 0, detail: `${foreign.length} foreign lease(s)` };
    });
    await probe('member read all members (directory)', true, async () => {
      const { data, error } = await member.from('members').select('data');
      if (error) return { blocked: true, detail: error.message };
      const foreign = (data ?? []).filter((r) => r.data?.companyId && r.data.companyId !== victimCompany);
      return { blocked: foreign.length === 0, detail: `${foreign.length} foreign member(s)` };
    });
    await probe('member read mail_items (other company)', true, async () => {
      const { data, error } = await member.from('mail_items').select('data');
      if (error) return { blocked: true, detail: error.message };
      const foreign = (data ?? []).filter((r) => r.data?.companyId && r.data.companyId !== victimCompany);
      return { blocked: foreign.length === 0, detail: `${foreign.length} foreign mail item(s)` };
    });
    await probe('member read settings secrets', true, async () => {
      const { data, error } = await member.from('settings').select('data').eq('id', 'global');
      if (error) return { blocked: true, detail: error.message };
      const d = data?.[0]?.data;
      const leaked = d && (d.adminUsers || d.billing);
      return { blocked: !leaked, detail: leaked ? 'adminUsers/billing visible' : 'blocked' };
    });
    await probe('member write another tenant lease', true, () =>
      writeProbe(member, 'leases', { id: '__probe_member_lease__', data: { tenantId: victimTenant || 'someone', monthlyRent: 1 }, updated_at: new Date().toISOString() }));
    await probe('member write settings', true, () =>
      writeProbe(member, 'settings', { id: '__probe_member_settings__', data: { hacked: true }, updated_at: new Date().toISOString() }));

    // Positive control: the member MUST still read their own company row.
    if (victimCompany) {
      await probe('member read OWN company (should succeed)', false, async () => {
        const { data, error } = await member.from('tenants').select('data').eq('id', victimCompany);
        if (error) return { blocked: true, detail: error.message };
        return { blocked: (data?.length ?? 0) === 0, detail: `${data?.length ?? 0} own row(s)` };
      });
    }
    await member.auth.signOut();
  }
} else {
  console.log('\n(skipping member-JWT probes — set TEST_MEMBER_EMAIL/TEST_MEMBER_PASSWORD)');
}

await cleanupProbeRows();

const failed = results.filter((r) => !r.pass);
console.log(`\n=== SUMMARY: ${results.length - failed.length}/${results.length} passed ===`);
if (failed.length) {
  console.log('HOLES (probes that did not behave securely):');
  for (const f of failed) console.log(`  - ${f.name}: ${f.blocked ? 'blocked' : 'ALLOWED'} (${f.detail})`);
}
process.exit(failed.length ? 1 : 0);
