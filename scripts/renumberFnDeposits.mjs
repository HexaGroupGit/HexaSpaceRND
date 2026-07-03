// One-off: fix duplicate invoice numbers caused by the old 1000-row-capped
// numbering. Renumbers the 3 function deposit invoices that collided on INV-3240
// to the next free numbers (max+1…), leaving the original office INV-3240 intact.
//
//   node scripts/renumberFnDeposits.mjs           # dry run
//   node scripts/renumberFnDeposits.mjs --apply    # perform
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const TARGET_IDS = ['inv1783047835636oho4', 'inv1783050498000y546', 'inv17830505304925x76'] // FN-936318, FN-330513, FN-175120
const TEMPLATE = 'INV-{{number}}'
const APPLY = process.argv.includes('--apply')
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const now = new Date().toISOString()

async function allInvoices() {
  const size = 1000; let from = 0; const all = []
  for (;;) { const { data, error } = await sb.from('invoices').select('data').order('id', { ascending: true }).range(from, from + size - 1); if (error || !data?.length) break; all.push(...data); if (data.length < size) break; from += size }
  return all.map((r) => r.data)
}

async function main() {
  const invs = await allInvoices()
  const nums = invs.map((i) => parseInt(String(i.number || '').replace(/\D/g, '') || '0', 10)).filter((n) => !isNaN(n))
  let next = Math.max(...nums) + 1
  for (const id of TARGET_IDS) {
    const inv = invs.find((i) => i.id === id)
    if (!inv) { console.log('skip (not found):', id); continue }
    const newNumber = TEMPLATE.replace('{{number}}', String(next++).padStart(4, '0'))
    console.log(`${APPLY ? '[APPLY]' : '[dry-run]'} ${id} (${inv.functionRef}) : ${inv.number} → ${newNumber}`)
    if (APPLY) await sb.from('invoices').upsert({ id, data: { ...inv, number: newNumber }, updated_at: now })
  }
  console.log(APPLY ? 'DONE' : 'Dry run — re-run with --apply.')
}
main()
