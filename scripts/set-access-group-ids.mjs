// One-off: load the KS access-group IDs into settings.salto.accessGroupIds so
// the platform sends the right group id on every grant — lock-centric room
// access (Add/Remove a Lock to an access group) and member provisioning.
// IDs from the KS export Downloads/IDS/Access Group (ID)-2026-07-13.csv, keyed
// to match resolveAccessGroup() output ("Office 11", "Suite 30", "Meeting Room"…).
//
// Preview:  node scripts/set-access-group-ids.mjs --dry
// Apply:    node scripts/set-access-group-ids.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const DRY = process.argv.includes('--dry')
const env = Object.fromEntries(
  readFileSync('C:/Hexa-Space-RND/.env.local', 'utf8')
    .split('\n').filter((l) => l && !l.trimStart().startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// name (as resolveAccessGroup returns it) → KS access group id. Duplicates in
// the export resolved to the first id; office/suite normalised to Title Case.
const GROUPS = {
  'All Doors': '650f9b47-f1ef-4481-be66-19f69cd1117c',
  'Dedicated Desk': '0873ed3e-9e00-48bd-9f30-f7d5d40caebe',
  'Enterprise Suite': '46a2cdae-2d82-4ec2-84a4-29609833bc31',
  'Flexible Access': '6abf37d4-94f7-491c-9eb1-98b71a0cb477',
  'Level2 Boardroom': '0980a56f-2184-4944-8e33-9649753f6376',
  'Level2 ENTRY': '7271792e-447c-4e8a-8932-31be4bf84910',
  'Media studio': '451b84c8-c838-478c-8366-803cbb27233d',
  'Media Studios': '9b0ecde1-ee86-4c8b-828a-90e7ffbd3002',
  'Meeting Room': '33cb0211-54ee-43d9-88af-53c46f7d4d5f',
  'Office 1': '5e4a1095-bb40-473c-8c73-eb063dd6f9e7',
  'Office 3': '737822f1-dc24-4f10-a1ad-f0eef60291bc',
  'Office 4': '3326d55d-4b71-4fd3-8c45-90c7ff30ee1c',
  'Office 5': '8097937b-e6c5-4669-bf92-6bfc7029db12',
  'Office 6': 'f18ccd73-3c41-42f5-981b-1d72aac0f2d0',
  'Office 7': '876a4102-5c7a-4639-80f6-04a6e24abe58',
  'Office 8': '01ab1567-dc4f-4cdb-b494-d9626714b044',
  'Office 9': '4a326876-bae6-4734-8b12-15f4fca11ca3',
  'Office 10': 'da543443-9222-4871-8ca9-0fc236bfe227',
  'Office 11': '3a90de77-0258-4c92-8089-f496747af188',
  'Office 12': 'e535d53a-13cf-4560-af32-ebf1634d07b4',
  'Office 13': '8576a37f-736c-437c-877c-2918e240dffd',
  'Office 14': '9dce49c9-89e2-4d2c-9eb1-ab386514a93e',
  'Office 15': '451a33ff-ee46-43e4-a54a-482c649ac7f8',
  'Phone 1': '33f4bea8-f137-4acf-8322-93d6fff48264',
  'Private Offices': '46fc8363-6a2e-46f1-91ba-57c8e9748e6d',
  'Quiet Room 1': '513af69e-e9c7-42b3-b53f-6cf3c2947e32',
  'Seven AM Photography': '71130c9d-575a-4bee-9552-de294c67a96f',
  'Suite 1': '38026eb3-fe60-4bb4-80ed-7b87cbd0cfba',
  'Suite 2': '30a5cf8c-534a-454a-a016-24f0e0d7987b',
  'Suite 3': 'c4035306-0ac4-4252-9b1b-488b102f38bc',
  'Suite 4': '313e9329-d373-498e-b1d6-25f11d37ba06',
  'Suite 5': 'e915938e-de4e-4bd9-ba24-911126c2f757',
  'Suite 6': 'c408ff1c-d660-4c5d-9dfc-e6cc634023c5',
  'Suite 7': '5c0b233a-63f6-460d-9e6a-704283b081e7',
  'Suite 8': '5c9dc035-54c4-4e39-ba24-f9e02ccae386',
  'Suite 9': 'fcd4187a-e695-45cf-8299-e9fb7af69951',
  'Suite 10': 'f4fe494d-82e2-4e0d-9e9a-d60c786a1af2',
  'Suite 11': '1f5c9e7d-5140-4194-b0fa-f7cc40787cb6',
  'Suite 12': '4189b5a8-f7a0-4878-b89a-ab2e3ebec761',
  'Suite 13': 'fdeaadf0-5246-4d70-8691-6fcb421a3fe3',
  'Suite 14': '12cd2f5a-3c9a-49da-820f-e82473905de7',
  'Suite 15': '69883a02-af8f-4309-99e0-76a089f9ffbe',
  'Suite 17': '8b8a5c3d-87b1-41ed-9717-eb26d1b17702',
  'Suite 18': 'd2a7dcf1-258b-4db3-92db-6f4590cc9298',
  'Suite 19': '6ea6d09c-750c-499d-9e5b-3bcc82e04b86',
  'Suite 20': 'ede69dee-e85d-4bc0-a31c-55d0d715a738',
  'Suite 21': '80f5a4ca-eb32-4dd8-8414-0f0407cb6c41',
  'Suite 22': '2c87230d-19b3-45cc-a3b2-aedb02046fcd',
  'Suite 23': 'b19e14a4-b9b0-4f0b-b725-4ae4d48d5604',
  'Suite 24': '989bae1e-4b3e-4811-92ca-30d4a7bb8b72',
  'Suite 25': '56d18f0d-81b0-4921-b408-ccfbddcd9ddb',
  'Suite 26': '816dfcf0-e3aa-442c-8252-08d2c65042d6',
  'Suite 27': '6c3241cc-f559-4464-a438-dd21f6f12cfd',
  'Suite 29': 'a71b5479-aca9-4f51-8161-db18cb0aaae8',
  'Suite 30': '9b2c83f0-7dc3-448a-9065-a69b077e31d3',
  'Virtual Office': '5bdd41c7-7266-44c1-906e-04fe47259822',
}

const nowIso = new Date().toISOString()
const { data: settRow, error } = await sb.from('settings').select('data').eq('id', 'global').single()
if (error) { console.error('Fetch settings failed:', error.message); process.exit(1) }
const settings = settRow?.data ?? {}
const salto = settings.salto ?? {}
const existing = salto.accessGroupIds ?? {}
const merged = { ...existing, ...GROUPS }

let added = 0, changed = 0
for (const [k, v] of Object.entries(GROUPS)) {
  if (existing[k] === v) continue
  console.log(`${existing[k] ? 'update' : 'add   '} ${k.padEnd(22)} ${existing[k] ? existing[k] + ' → ' : ''}${v}`)
  existing[k] ? changed++ : added++
}

if (!DRY) {
  const next = { ...settings, salto: { ...salto, accessGroupIds: merged } }
  const { error: upErr } = await sb.from('settings').update({ data: next, updated_at: nowIso }).eq('id', 'global')
  if (upErr) { console.error('Update failed:', upErr.message); process.exit(1) }
}

console.log(`\n${Object.keys(GROUPS).length} groups · ${added} added · ${changed} changed${DRY ? ' (dry run — re-run without --dry to apply)' : ' — saved'}`)
