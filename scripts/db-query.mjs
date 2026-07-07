// Runs an arbitrary read-only SQL query against the Supabase project via the
// Management API and prints the JSON result. Usage:
//   node scripts/db-query.mjs "select * from pg_policies"
//   echo "select ..." | node scripts/db-query.mjs -
import fs from 'fs';

const REF = 'ihvhnsdsvjwpyquvetzz';

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

const env = parseEnv('.env.local');
const token = env.SUPABASE_ACCESS_TOKEN;
if (!token || !token.startsWith('sbp_')) {
  console.error('ERROR: no valid SUPABASE_ACCESS_TOKEN (sbp_...) in .env.local');
  process.exit(1);
}

let sql = process.argv[2];
if (sql === '-' || !sql) sql = fs.readFileSync(0, 'utf8');

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
const text = await res.text();
if (!res.ok) {
  console.error('HTTP', res.status, text.slice(0, 2000));
  process.exit(1);
}
console.log(text);
