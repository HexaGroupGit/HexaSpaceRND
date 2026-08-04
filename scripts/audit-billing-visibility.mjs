// Audit: which portal/app users could see their company's invoices without
// being its billing authority?
//
// canViewBilling(member) = !member || member.billingPerson || member.contactPerson
// Until 4 Aug 2026 the portal DASHBOARD ignored that rule, so any member with
// portal access saw their company's recent invoices, amounts and next due.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('C:/Hexa-Space-RND/.env.local','utf8').split('\n').filter(l=>l&&!l.trimStart().startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} })

const [M,T,I] = await Promise.all(['members','tenants','invoices'].map(t=>sb.from(t).select('data').then(r=>r.data.map(x=>x.data))))
const { data: { users } } = await sb.auth.admin.listUsers({ perPage: 2000 })
const signedIn = new Map(users.filter(u=>u.last_sign_in_at).map(u=>[u.email.toLowerCase(), u.last_sign_in_at]))
const coName = new Map(T.map(t=>[t.id, t.businessName]))
const invCount = {}
for (const i of I) invCount[i.tenantId] = (invCount[i.tenantId] ?? 0) + 1

const exposed = M
  .filter(m => m.email && m.portalAccess && !m.billingPerson && !m.contactPerson)
  .filter(m => (invCount[m.companyId] ?? 0) > 0)
  .map(m => ({ ...m, lastSignIn: signedIn.get(m.email.toLowerCase()) ?? null }))
  .sort((a,b) => String(b.lastSignIn ?? '').localeCompare(String(a.lastSignIn ?? '')))

console.log(`${M.filter(m=>m.portalAccess).length} members with portal access; ${exposed.length} are NOT a billing/contact person at a company that has invoices.\n`)
console.log('── have actually signed in (could have seen invoices) ──')
const seen = exposed.filter(m => m.lastSignIn)
for (const m of seen) console.log(`  ${(m.name||'').padEnd(24)} ${m.email.padEnd(38)} ${coName.get(m.companyId) ?? m.companyId} · ${invCount[m.companyId]} invoices · last sign-in ${m.lastSignIn.slice(0,10)}`)
console.log(`\n  → ${seen.length} people`)
const never = exposed.length - seen.length
console.log(`\n── never signed in: ${never} (exposed in principle only) ──`)

// Cross-check: anyone who IS a billing authority is unaffected.
const authority = M.filter(m => m.email && m.portalAccess && (m.billingPerson || m.contactPerson))
console.log(`\nFor contrast, ${authority.length} members ARE a billing/contact person and are meant to see invoices.`)
