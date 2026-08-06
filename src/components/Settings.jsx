import { useState, useEffect } from 'react'
import { authHeaders } from '../lib/apiFetch.js'
import { useOutletContext } from 'react-router-dom'
import { Plus, Trash2, Check, Download, ExternalLink, Laptop, Smartphone } from 'lucide-react'
import { XERO_ACCOUNTS, DEFAULT_XERO_ACCOUNTS } from './spaces/shared.jsx'
import { xeroStatus, connectXero, disconnectXero, xeroSync } from '../lib/xero.js'
import { PERK_TIER_DEFAULTS, PERK_TIER_ORDER, AFTER_HOURS_DEFAULTS } from '../lib/credits.js'
import { tourConfig, TOUR_DEFAULTS } from '../lib/tourInvite.js'

const MENU = [
  {
    section: 'Account Details',
    items: [
      { key: 'company-billing', label: 'Company & Billing' },
      { key: 'admin-users', label: 'Admin Users' },
      { key: 'emails', label: 'Emails & Notifications' },
    ],
  },
  {
    section: 'Operations',
    items: [
      { key: 'contracts', label: 'Contracts' },
      { key: 'room-perks', label: 'Room Perks' },
      { key: 'after-hours', label: 'After-hours' },
      { key: 'tours', label: 'Tours' },
      { key: 'email-templates', label: 'Email Templates' },
    ],
  },
  {
    section: 'Billing',
    items: [
      { key: 'billing-rules', label: 'Billing Rules' },
      { key: 'invoicing', label: 'Invoicing' },
    ],
  },
  {
    section: 'Integrations',
    items: [
      { key: 'xero', label: 'Xero' },
      { key: 'stripe', label: 'Stripe' },
      { key: 'papercut', label: 'PaperCut' },
      { key: 'door-access', label: 'Door Access' },
    ],
  },
]

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? 'bg-blue-600' : 'bg-muted'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

function FormRow({ label, description, children }) {
  return (
    <div className="flex items-start justify-between py-4 border-b border-border last:border-0">
      <div className="flex-1 mr-8 min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description && <div className="text-xs text-muted-foreground mt-0.5">{description}</div>}
      </div>
      <div className="w-72 shrink-0">{children}</div>
    </div>
  )
}

function TabBar({ tabs, active, onSelect }) {
  return (
    <div className="flex border-b border-border mb-6">
      {tabs.map(([key, label]) => (
        <button
          key={key}
          onClick={() => onSelect(key)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            active === key
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function SaveButton({ onClick, saved }) {
  return (
    <div className="mt-6 pt-4 border-t border-border flex items-center gap-3">
      <button
        onClick={onClick}
        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md font-medium hover:bg-blue-700"
      >
        Save Changes
      </button>
      {saved && (
        <span className="flex items-center gap-1.5 text-sm text-green-600">
          <Check size={14} /> Saved
        </span>
      )}
    </div>
  )
}

function TextInput({ value, onChange, type = 'text', placeholder = '', mono = false }) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${mono ? 'font-mono' : ''}`}
    />
  )
}

// ── Company & Billing ─────────────────────────────────────────────────────────
function CompanyBillingSection({ settings, updateSettings }) {
  const [tab, setTab] = useState('company')
  const [companyForm, setCompanyForm] = useState(() => ({ ...settings.company }))
  const [billingForm, setBillingForm] = useState(() => ({ ...settings.billing }))
  const [saved, setSaved] = useState(false)

  function save() {
    updateSettings({ company: companyForm, billing: billingForm })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function setC(f) { return (v) => setCompanyForm((p) => ({ ...p, [f]: v })) }
  function setB(f) { return (v) => setBillingForm((p) => ({ ...p, [f]: v })) }

  return (
    <div>
      <h1 className="text-xl font-bold text-foreground mb-1">Company & Billing</h1>
      <p className="text-sm text-muted-foreground mb-6">Manage your company details and billing information used on invoices and contracts.</p>

      <TabBar
        tabs={[['company', 'Company Info'], ['billing', 'Billing Details']]}
        active={tab}
        onSelect={setTab}
      />

      {tab === 'company' && (
        <>
          <FormRow label="Company Name" description="Trading name shown across the system">
            <TextInput value={companyForm.name} onChange={setC('name')} />
          </FormRow>
          <FormRow label="Company Email" description="Primary contact email for the company">
            <TextInput type="email" value={companyForm.email} onChange={setC('email')} />
          </FormRow>
          <FormRow label="Website" description="Shown in invoice footers">
            <TextInput value={companyForm.website} onChange={setC('website')} />
          </FormRow>
          <FormRow label="Company Logo" description="Upload a logo for invoices and contracts (PNG, JPG)">
            {companyForm.logo ? (
              <div className="flex items-center gap-3">
                <img src={companyForm.logo} alt="Logo" className="h-10 max-w-[140px] object-contain border border-border rounded px-1" />
                <button
                  onClick={() => setCompanyForm((p) => ({ ...p, logo: '' }))}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="cursor-pointer">
                <div className="border border-dashed border-input rounded-md px-4 py-2.5 text-sm text-muted-foreground hover:border-blue-400 hover:text-blue-500 transition-colors text-center">
                  Click to upload logo
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = (ev) => setCompanyForm((p) => ({ ...p, logo: ev.target.result }))
                    reader.readAsDataURL(file)
                  }}
                />
              </label>
            )}
          </FormRow>
        </>
      )}

      {tab === 'billing' && (
        <>
          <FormRow label="Business Name" description="Legal entity name on invoices and contracts">
            <TextInput value={billingForm.businessName} onChange={setB('businessName')} />
          </FormRow>
          <FormRow label="ABN (Registration Number)" description="Australian Business Number">
            <TextInput value={billingForm.abn} onChange={setB('abn')} />
          </FormRow>
          <FormRow label="GST Registered" description="Include GST (10%) on all invoices by default">
            <Toggle
              checked={billingForm.gstRegistered ?? true}
              onChange={(v) => setBillingForm((p) => ({ ...p, gstRegistered: v }))}
            />
          </FormRow>
          <FormRow label="Accountable Person" description="Person responsible for billing queries">
            <TextInput value={billingForm.accountablePerson} onChange={setB('accountablePerson')} />
          </FormRow>
          <FormRow label="Bank Name" description="Name of your financial institution">
            <TextInput value={billingForm.bankName} onChange={setB('bankName')} />
          </FormRow>
          <FormRow label="BSB" description="Bank-State-Branch number (e.g. 063-000)">
            <TextInput value={billingForm.bsb} onChange={setB('bsb')} placeholder="063-000" />
          </FormRow>
          <FormRow label="ACC (Account Number)" description="Bank account number">
            <TextInput value={billingForm.acc} onChange={setB('acc')} placeholder="00000000" />
          </FormRow>
          <FormRow label="Billing Address" description="Address shown on invoices and contracts">
            <TextInput value={billingForm.address} onChange={setB('address')} />
          </FormRow>
        </>
      )}

      <SaveButton onClick={save} saved={saved} />
    </div>
  )
}

// Copy for the admin set-password email — both add paths send it, so a new
// admin always receives a login link (their email in adminUsers is what routes
// them to the management app on sign-in).
const ADMIN_INVITE_COPY = (name) => ({
  subject: "You've been added as a Hexa Space admin",
  heading: 'Welcome to the Hexa Space team',
  intro: `Hi ${name || 'there'} — you've been given admin access to the Hexa Space management system: companies, members, billing, bookings, function hire and more. Set your password below, then sign in at portal.hexaspace.com.au — your email routes you straight to the admin dashboard.`,
  ctaLabel: 'Set my password',
})

function AddExistingUserForm({ users, updateSettings }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'Admin' })
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [warn, setWarn] = useState('')

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.email.trim()) return
    setSaving(true); setWarn('')
    const newUser = {
      id: `u_${Date.now()}`,
      name: form.name.trim() || form.email.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role,
      access: form.role === 'Super Admin' ? 'Full Access' : 'Standard Access',
    }
    // Send their set-password login email — an admin listed without an auth
    // account can never actually sign in.
    try {
      const res = await fetch('/api/auth/invite', {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ email: newUser.email, ...ADMIN_INVITE_COPY(form.name.trim().split(' ')[0]) }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Invite email failed')
    } catch (err) {
      setWarn(`Added, but the login email failed (${err.message}) — use "Invite" to resend.`)
    }
    updateSettings({ adminUsers: [...users, newUser] })
    setForm({ name: '', email: '', role: 'Admin' })
    setSaving(false)
    setDone(true)
    setTimeout(() => setDone(false), 4000)
  }

  return (
    <form onSubmit={handleAdd} className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Name</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Full name" className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Email *</label>
          <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="user@hexaspace.com.au" className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Role</label>
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 bg-card">
            <option value="Admin">Admin</option>
            <option value="Super Admin">Super Admin</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-md font-medium hover:bg-primary/90 disabled:opacity-40">
          {saving ? 'Adding…' : 'Add User'}
        </button>
        {done && !warn && <span className="text-sm text-green-600">✓ Added — login email sent</span>}
        {warn && <span className="text-sm text-amber-600">{warn}</span>}
      </div>
    </form>
  )
}

// ── Admin Users ───────────────────────────────────────────────────────────────
function AdminUsersSection({ settings, updateSettings }) {
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('Admin')
  const [status, setStatus] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  const users = settings.adminUsers ?? []

  function updateUserRole(id, role) {
    const updated = users.map(u => u.id === id ? { ...u, role } : u)
    updateSettings({ adminUsers: updated })
  }

  function removeUser(id) {
    if (!window.confirm('Remove this user from the admin list?')) return
    updateSettings({ adminUsers: users.filter(u => u.id !== id) })
  }

  async function handleInvite(e) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setStatus('sending')
    setErrorMsg('')
    try {
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ email: inviteEmail.trim(), ...ADMIN_INVITE_COPY(inviteName.trim().split(' ')[0]) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Invite failed')
      // Add to adminUsers list
      const newUser = {
        id: `u_${Date.now()}`,
        name: inviteName.trim() || inviteEmail.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
        access: inviteRole === 'Super Admin' ? 'Full Access' : 'Standard Access',
      }
      updateSettings({ adminUsers: [...users, newUser] })
      setStatus('sent')
      setInviteEmail('')
      setInviteName('')
      setInviteRole('Admin')
      setTimeout(() => setStatus(null), 4000)
    } catch (err) {
      setErrorMsg(err.message)
      setStatus('error')
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-foreground mb-1">Admin Users</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Manage who has access to Hexa Space and their permission level.
      </p>

      {/* Current users table */}
      {users.length > 0 && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-border bg-muted/50">
            <span className="text-sm font-semibold text-foreground">Current Users</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-muted/50">
                  <td className="px-5 py-3 font-medium text-foreground">{u.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-5 py-3">
                    <select
                      value={u.role}
                      onChange={e => updateUserRole(u.id, e.target.value)}
                      className="border border-input rounded px-2 py-1 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 bg-card"
                    >
                      <option value="Admin">Admin</option>
                      <option value="Super Admin">Super Admin</option>
                    </select>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => removeUser(u.id)} className="text-xs text-muted-foreground hover:text-red-500">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Role explanation */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-5 mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-3">Role Permissions</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-3">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-900 text-white shrink-0">Super Admin</span>
            <span className="text-muted-foreground">Full access — including permanently deleting invoices from the system.</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-300 shrink-0">Admin</span>
            <span className="text-muted-foreground">Standard access — can manage everything except permanent invoice deletion.</span>
          </div>
        </div>
      </div>

      {/* Add existing user (no invite email) */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-6 mb-4">
        <h2 className="text-sm font-semibold text-foreground mb-1">Add existing user</h2>
        <p className="text-xs text-muted-foreground mb-4">Already have a Supabase login? Add them to the admin list without sending an email.</p>
        <AddExistingUserForm users={users} updateSettings={updateSettings} />
      </div>

      {/* Invite form */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-1">Invite a new team member</h2>
        <p className="text-xs text-muted-foreground mb-4">Creates a Supabase account and sends them a setup email.</p>
        <form onSubmit={handleInvite} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Name</label>
              <input
                type="text"
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                placeholder="Full name"
                className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Role</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 bg-card"
              >
                <option value="Admin">Admin</option>
                <option value="Super Admin">Super Admin</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs text-muted-foreground mb-1">Email address *</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="teammate@hexaspace.com.au"
                required
                className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
            <button
              type="submit"
              disabled={status === 'sending'}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap"
            >
              <Plus size={14} />
              {status === 'sending' ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        </form>

        {status === 'sent' && (
          <div className="mt-3 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
            <Check size={14} /> Invite sent — they'll receive an email to set their password.
          </div>
        )}
        {status === 'error' && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Emails & Notifications ────────────────────────────────────────────────────
function EmailsSection({ settings, updateSettings }) {
  const [form, setForm] = useState(() => ({ ...settings.emails }))
  const [saved, setSaved] = useState(false)

  function save() {
    updateSettings({ emails: form })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function set(f) { return (v) => setForm((p) => ({ ...p, [f]: v })) }

  return (
    <div>
      <h1 className="text-xl font-bold text-foreground mb-1">Emails & Notifications</h1>
      <p className="text-sm text-muted-foreground mb-6">Configure email addresses for invoices, contracts, and system notifications.</p>

      {/* Safe mode — global outbound-email block */}
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-amber-900">Safe mode — block outbound email</div>
            <div className="text-xs text-amber-700 mt-0.5">When ON, every email (invoices, confirmations, reminders, invites…) is redirected to the single test address below — no client, member or lead receives anything until you turn this off.</div>
          </div>
          <Toggle checked={form.safeMode !== false} onChange={(v) => setForm((p) => ({ ...p, safeMode: v }))} />
        </div>
        <div className="mt-3">
          <label className="block text-xs font-medium text-amber-900 mb-1">Test recipient (receives all email while safe mode is on)</label>
          <TextInput type="email" value={form.safeRecipient ?? 'eric@hexaspace.com.au'} onChange={set('safeRecipient')} placeholder="eric@hexaspace.com.au" />
        </div>
        <div className="mt-2 text-xs font-medium">
          {form.safeMode !== false
            ? <span className="text-amber-800">● Blocking — only {form.safeRecipient || 'eric@hexaspace.com.au'} will receive email. Remember to Save.</span>
            : <span className="text-green-700">● Live — emails send to real recipients.</span>}
        </div>
      </div>

      <FormRow
        label="Unsubscribed addresses"
        description="One email per line. These addresses are never emailed by the platform — every send (invoices, reminders, announcements, invites) silently drops them, including as cc/bcc. Use for members who ask to stop receiving emails."
      >
        <textarea
          rows={4}
          value={(form.suppressed ?? []).join('\n')}
          onChange={(e) => set('suppressed')(e.target.value.split('\n').map((a) => a.trim().toLowerCase()).filter(Boolean))}
          placeholder={'someone@example.com'}
          className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </FormRow>

      <FormRow label="Notification Email" description="Receive system notifications at this address">
        <TextInput type="email" value={form.notificationEmail} onChange={set('notificationEmail')} />
      </FormRow>
      <FormRow label="Reply To" description="Tenants will reply to this address">
        <TextInput type="email" value={form.replyTo} onChange={set('replyTo')} />
      </FormRow>
      <FormRow label="CC" description="Carbon copy all outbound emails">
        <TextInput type="email" value={form.cc} onChange={set('cc')} placeholder="Optional" />
      </FormRow>
      <FormRow label="BCC" description="Blind copy all outbound emails">
        <TextInput type="email" value={form.bcc} onChange={set('bcc')} placeholder="Optional" />
      </FormRow>

      <div className="pt-4 pb-2 mt-2">
        <div className="text-sm font-semibold text-foreground">Sender Details</div>
        <p className="text-xs text-muted-foreground mt-0.5">Used as the From address when emails are sent to tenants.</p>
      </div>

      <FormRow label="From Name" description="Display name on outbound emails">
        <TextInput value={form.fromName} onChange={set('fromName')} />
      </FormRow>
      <FormRow label="From Email" description="Email address invoices and contracts are sent from">
        <div className="space-y-2">
          <TextInput type="email" value={form.fromEmail} onChange={set('fromEmail')} />
          <div className={`flex items-center justify-between gap-1.5 text-xs px-2.5 py-1.5 rounded border ${
            form.dnsVerified
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-orange-50 text-orange-700 border-orange-200'
          }`}>
            <span>{form.dnsVerified ? '✓ DNS Verified' : '⚠ DNS not verified — emails may land in spam'}</span>
            {!form.dnsVerified && (
              <button
                onClick={() => setForm((p) => ({ ...p, dnsVerified: true }))}
                className="underline text-xs shrink-0"
              >
                Mark Verified
              </button>
            )}
          </div>
        </div>
      </FormRow>

      <SaveButton onClick={save} saved={saved} />

      <PortalMigrationInvites safeMode={form.safeMode !== false} safeRecipient={form.safeRecipient || 'eric@hexaspace.com.au'} />
    </div>
  )
}

// ── Portal migration bulk invite ──────────────────────────────────────────────
// Sends the "we're moving to a new portal" announcement + password-setup link
// to every active member and active-company contact, in batches.
function PortalMigrationInvites({ safeMode, safeRecipient }) {
  const [preview, setPreview] = useState(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(null) // { sent, failed, remaining }
  const [error, setError] = useState(null)

  async function call(body) {
    const { authHeaders } = await import('../lib/apiFetch.js')
    const r = await fetch('/api/portal/bulk-invite', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(body),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(data.error ?? 'Request failed')
    return data
  }

  async function loadPreview() {
    setError(null)
    try { setPreview(await call({ dryRun: true })) } catch (e) { setError(e.message) }
  }

  async function sendAll() {
    if (!window.confirm(safeMode
      ? `Safe mode is ON — all invites will redirect to ${safeRecipient}. Run the send as a test?`
      : 'Safe mode is OFF — this emails a password-setup invite to EVERY active member and company contact. Send now?')) return
    setRunning(true); setError(null)
    let sent = 0, failed = 0, remaining = Infinity
    try {
      while (remaining > 0) {
        const r = await call({ limit: 20 })
        sent += r.sent.length
        failed += r.failed.length
        remaining = r.remaining
        setProgress({ sent, failed, remaining })
        if (r.sent.length === 0 && r.failed.length > 0) break // avoid a failure loop
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(false)
      loadPreview()
    }
  }

  return (
    <div className="mt-8 rounded-lg border border-border bg-card p-4">
      <div className="text-sm font-semibold text-foreground">Portal migration invites</div>
      <p className="text-xs text-muted-foreground mt-0.5 mb-3">
        Emails the "we're moving to a new member portal" announcement with a personal password-setup
        link to every active member and active-company contact. Already-invited people are skipped,
        so it's safe to run again after adding members.
      </p>
      {safeMode && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 mb-3">
          Safe mode is ON — running this now is a rehearsal: every invite goes to {safeRecipient}.
        </p>
      )}
      <div className="flex items-center gap-3">
        <button onClick={loadPreview} className="px-3 py-1.5 text-xs border border-input rounded-md font-medium hover:bg-muted/50">
          Preview recipients
        </button>
        <button
          onClick={sendAll}
          disabled={running || (preview && preview.toSend === 0)}
          className="px-4 py-1.5 text-xs bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {running ? 'Sending…' : 'Send invites to all active members'}
        </button>
      </div>
      {preview && (
        <div className="mt-3 text-xs text-muted-foreground">
          {preview.totalRecipients} recipients total · {preview.alreadyInvited} already invited · <strong className="text-foreground">{preview.toSend} to send</strong>
          {preview.sample?.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {preview.sample.map((s) => <div key={s.email}>{s.email} — {s.company}</div>)}
              {preview.toSend > preview.sample.length && <div>…and {preview.toSend - preview.sample.length} more</div>}
            </div>
          )}
        </div>
      )}
      {progress && (
        <div className="mt-3 text-xs font-medium text-foreground">
          Sent {progress.sent}{progress.failed ? ` · ${progress.failed} failed` : ''} · {progress.remaining} remaining
        </div>
      )}
      {error && <div className="mt-3 text-xs text-red-600">{error}</div>}
    </div>
  )
}

// ── Contracts (Operations) ────────────────────────────────────────────────────
function ContractsSection({ settings, updateSettings }) {
  const [tab, setTab] = useState('general')
  const [form, setForm] = useState(() => ({ ...settings.contracts }))
  const [reasons, setReasons] = useState(() => [...(settings.contracts?.terminationReasons ?? [])])
  const [newReason, setNewReason] = useState('')
  const [saved, setSaved] = useState(false)

  function save() {
    updateSettings({ contracts: { ...form, terminationReasons: reasons } })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function set(f) { return (v) => setForm((p) => ({ ...p, [f]: v })) }

  const numPreview = (form.numberTemplate ?? 'CON-{{number}}').replace('{{number}}', '001')

  return (
    <div>
      <h1 className="text-xl font-bold text-foreground mb-1">Contracts</h1>
      <p className="text-sm text-muted-foreground mb-6">Configure contract numbering, eSignature sender, and termination reasons.</p>

      <TabBar
        tabs={[['general', 'General'], ['esign', 'eSignatures'], ['termination', 'Termination Reasons']]}
        active={tab}
        onSelect={setTab}
      />

      {tab === 'general' && (
        <>
          <FormRow label="Contract Number Template" description="Use {{number}} as the auto-increment placeholder">
            <div className="space-y-1">
              <TextInput value={form.numberTemplate} onChange={set('numberTemplate')} mono />
              <div className="text-xs text-muted-foreground">Preview: {numPreview}</div>
            </div>
          </FormRow>
          <FormRow label="Approval Required" description="Require manager approval before contracts can be sent">
            <Toggle checked={form.approvalRequired ?? false} onChange={set('approvalRequired')} />
          </FormRow>
        </>
      )}

      {tab === 'esign' && (
        <>
          <FormRow label="Signing Email" description="Email address used as the eSign sender">
            <TextInput type="email" value={form.eSignEmail} onChange={set('eSignEmail')} />
          </FormRow>
          <FormRow label="Signing Display Name" description="Name shown on eSign request emails">
            <TextInput value={form.eSignName} onChange={set('eSignName')} />
          </FormRow>
          <FormRow label="eSign Platform" description="Signing service used for electronic signatures">
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 border border-border">
              Hexa eSign (Built-in)
            </div>
          </FormRow>
        </>
      )}

      {tab === 'termination' && (
        <>
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              These reasons appear in the <strong>Terminate Contract</strong> dropdown. Edit or add your own.
            </p>
          </div>
          <div className="space-y-2 mb-4">
            {reasons.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={r}
                  onChange={(e) => {
                    const updated = [...reasons]
                    updated[i] = e.target.value
                    setReasons(updated)
                  }}
                  className="flex-1 border border-input rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => setReasons((prev) => prev.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-red-500 shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newReason.trim()) {
                  setReasons((prev) => [...prev, newReason.trim()])
                  setNewReason('')
                }
              }}
              placeholder="Add new termination reason…"
              className="flex-1 border border-input rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => {
                if (newReason.trim()) {
                  setReasons((prev) => [...prev, newReason.trim()])
                  setNewReason('')
                }
              }}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded font-medium hover:bg-primary/90"
            >
              <Plus size={14} />
            </button>
          </div>
        </>
      )}

      <SaveButton onClick={save} saved={saved} />
    </div>
  )
}

// ── Billing Rules ─────────────────────────────────────────────────────────────
function BillingRulesSection({ settings, updateSettings }) {
  const [form, setForm] = useState(() => ({ ...settings.billingRules }))
  const [saved, setSaved] = useState(false)

  function save() {
    updateSettings({ billingRules: form })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function set(f) { return (v) => setForm((p) => ({ ...p, [f]: v })) }

  return (
    <div>
      <h1 className="text-xl font-bold text-foreground mb-1">Billing Rules</h1>
      <p className="text-sm text-muted-foreground mb-6">Configure billing periods, taxes, and multi-location billing.</p>

      <FormRow label="Billing Period Start Day" description="Day of month when billing periods start (1 = 1st of month)">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={28}
            value={form.billingPeriodStartDay ?? 1}
            onChange={(e) => setForm((p) => ({ ...p, billingPeriodStartDay: Math.min(28, Math.max(1, Number(e.target.value))) }))}
            className="w-20 border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
          />
          <span className="text-xs text-muted-foreground">of the month</span>
        </div>
      </FormRow>
      <FormRow label="Tax (GST)" description="Apply GST to all invoices by default">
        <Toggle checked={form.taxEnabled ?? true} onChange={set('taxEnabled')} />
      </FormRow>
      <FormRow
        label="Suspend door access when overdue"
        description="After the grace period below, every member of a company with overdue invoices has their Salto access blocked (licence clause 7(d)). Reminder emails warn them first; access auto-restores on payment. Requires the Salto block/unblock zaps."
      >
        <Toggle checked={form.blockOverdueAccess === true} onChange={set('blockOverdueAccess')} />
      </FormRow>
      <FormRow label="Access suspension grace period" description="Days past the invoice due date before door access is suspended">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={3}
            max={60}
            value={form.blockGraceDays ?? 14}
            onChange={(e) => setForm((p) => ({ ...p, blockGraceDays: Math.min(60, Math.max(3, Number(e.target.value))) }))}
            className="w-20 border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
          />
          <span className="text-xs text-muted-foreground">days after due date</span>
        </div>
      </FormRow>
      <FormRow
        label="Overdue cancellation workflow (admin approval required)"
        description="Warnings are emailed from 2 months overdue (admins bcc'd); at the cut-off below the client gets a FINAL NOTICE and the account goes to 'awaiting approval' — NOTHING is cancelled until an admin clicks Approve cancellation on the company profile. Paying off at any point clears the process. Exempt a company via its profile."
      >
        <Toggle checked={form.autoCancelOverdue === true} onChange={set('autoCancelOverdue')} />
      </FormRow>
      {form.autoCancelOverdue === true && (
        <FormRow label="Cancellation cut-off" description="Days past the oldest invoice's due date before the membership is auto-cancelled">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={30}
              max={365}
              value={form.autoCancelDays ?? 90}
              onChange={(e) => setForm((p) => ({ ...p, autoCancelDays: Math.min(365, Math.max(30, Number(e.target.value))) }))}
              className="w-20 border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
            />
            <span className="text-xs text-muted-foreground">days overdue (warnings at 30 / 14 / 3 days before)</span>
          </div>
        </FormRow>
      )}
      <FormRow
        label="Renewal / CPI increase (%)"
        description="Applied automatically when a renewal contract is generated (Renew action) — the new contract's pricing is the old pricing plus this percentage. The same number fills the {{cpiPct}} placeholder in the licence agreement's Annual CPI Adjustment clause, so the signed terms and the actual increase always match. Default 4."
      >
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={50}
            step={0.1}
            value={form.renewalCpiPct ?? 4}
            onChange={(e) => set('renewalCpiPct')(e.target.value === '' ? null : Number(e.target.value))}
            className="w-24 border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">% increase on renewal</span>
        </div>
      </FormRow>
      <FormRow
        label="Auto-approve renewals (no notice = auto-renew)"
        description="When a term ends and no non-renewal notice was given, the membership rolls forward on its PREVIOUS terms automatically — no manual 'Approve renewal' step — and the tenant gets a renewal-confirmation email. Runs server-side daily, so it renews even if nobody opens the admin app. Off = renewals still roll forward but wait in Renewals for a one-click approval."
      >
        <Toggle checked={form.autoApproveRenewals === true} onChange={set('autoApproveRenewals')} />
      </FormRow>
      <FormRow label="Tax Rate (%)" description="GST rate applied to taxable line items">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={100}
            value={form.taxRate ?? 10}
            onChange={(e) => setForm((p) => ({ ...p, taxRate: Number(e.target.value) }))}
            className="w-20 border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      </FormRow>
      <FormRow label="Multi-Location Billing" description="Enable billing across multiple locations on a single invoice">
        <Toggle checked={form.multiLocationBilling ?? false} onChange={set('multiLocationBilling')} />
      </FormRow>

      <SaveButton onClick={save} saved={saved} />
    </div>
  )
}

// ── Room Perks ────────────────────────────────────────────────────────────────
function RoomPerksSection({ settings, updateSettings }) {
  const cur = settings.officePerks?.tiers ?? {}
  const [form, setForm] = useState(() => {
    const f = {}
    for (const type of PERK_TIER_ORDER) {
      const t = cur[type] ?? PERK_TIER_DEFAULTS[type]
      f[type] = {
        rooms: (t.rooms ?? PERK_TIER_DEFAULTS[type].rooms).join(', '),
        maxHoursPerBooking: t.maxHoursPerBooking ?? PERK_TIER_DEFAULTS[type].maxHoursPerBooking,
        maxHoursPerDay: t.maxHoursPerDay ?? PERK_TIER_DEFAULTS[type].maxHoursPerDay,
      }
    }
    return f
  })
  const [saved, setSaved] = useState(false)

  function setTier(type, key, val) {
    setForm((p) => ({ ...p, [type]: { ...p[type], [key]: val } }))
  }

  function save() {
    const tiers = {}
    for (const type of PERK_TIER_ORDER) {
      const t = form[type]
      tiers[type] = {
        rooms: String(t.rooms).split(',').map((s) => s.trim()).filter(Boolean),
        maxHoursPerBooking: Math.max(0.5, Number(t.maxHoursPerBooking) || PERK_TIER_DEFAULTS[type].maxHoursPerBooking),
        maxHoursPerDay: Math.max(0.5, Number(t.maxHoursPerDay) || PERK_TIER_DEFAULTS[type].maxHoursPerDay),
      }
    }
    updateSettings({ officePerks: { tiers } })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-foreground mb-1">Room Perks</h1>
      <p className="text-sm text-muted-foreground mb-6">Free meeting rooms by membership — no credits — with caps so no one books all day. Caps are per company (shared by the team). Applies to the member portal and app. Leave a tier's rooms blank to give it no free rooms.</p>

      {PERK_TIER_ORDER.map((type) => (
        <div key={type} className="mb-6 border border-border rounded-md p-4">
          <div className="text-sm font-semibold text-foreground mb-3">{type}</div>
          <FormRow label="Free rooms" description="Comma-separated room names (must match the room's name exactly).">
            <input
              value={form[type].rooms}
              onChange={(e) => setTier(type, 'rooms', e.target.value)}
              placeholder="Sky, Earth"
              className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </FormRow>
          <FormRow label="Max hours per booking" description="Longest single booking in these rooms">
            <div className="flex items-center gap-2">
              <input
                type="number" min={0.5} max={8} step={0.5}
                value={form[type].maxHoursPerBooking}
                onChange={(e) => setTier(type, 'maxHoursPerBooking', e.target.value)}
                className="w-20 border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
              />
              <span className="text-xs text-muted-foreground">hours</span>
            </div>
          </FormRow>
          <FormRow label="Max hours per day (per company)" description="Total free hours a company can book across these rooms each day">
            <div className="flex items-center gap-2">
              <input
                type="number" min={0.5} max={12} step={0.5}
                value={form[type].maxHoursPerDay}
                onChange={(e) => setTier(type, 'maxHoursPerDay', e.target.value)}
                className="w-20 border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
              />
              <span className="text-xs text-muted-foreground">hours / day</span>
            </div>
          </FormRow>
        </div>
      ))}

      <SaveButton onClick={save} saved={saved} />
    </div>
  )
}

// ── After-hours booking (Operations) ──────────────────────────────────────────
// Everyone can book the business-hours band; only the chosen memberships (those
// with 24/7 building access) can reach the wider window. Same pricing as daytime.
function AfterHoursSection({ settings, updateSettings }) {
  const d = AFTER_HOURS_DEFAULTS
  const cur = settings.afterHours ?? {}
  const [form, setForm] = useState({
    coreStart: cur.coreStart ?? d.coreStart,
    coreEnd: cur.coreEnd ?? d.coreEnd,
    extendedStart: cur.extendedStart ?? d.extendedStart,
    extendedEnd: cur.extendedEnd ?? d.extendedEnd,
    eligibleTiers: cur.eligibleTiers ?? d.eligibleTiers,
  })
  const [saved, setSaved] = useState(false)
  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }))
  const toggleTier = (t) => setForm((p) => ({
    ...p,
    eligibleTiers: p.eligibleTiers.includes(t) ? p.eligibleTiers.filter((x) => x !== t) : [...p.eligibleTiers, t],
  }))
  const clampHour = (v, fb) => Math.max(0, Math.min(24, Number(v) || fb))
  const label12 = (h) => `${(h % 12) || 12}${h >= 12 ? 'pm' : 'am'}`

  function save() {
    updateSettings({ afterHours: {
      coreStart: clampHour(form.coreStart, d.coreStart),
      coreEnd: clampHour(form.coreEnd, d.coreEnd),
      extendedStart: clampHour(form.extendedStart, d.extendedStart),
      extendedEnd: clampHour(form.extendedEnd, d.extendedEnd),
      eligibleTiers: form.eligibleTiers,
    } })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const HourInput = ({ k }) => (
    <div className="flex items-center gap-2">
      <input type="number" min={0} max={24} step={1} value={form[k]}
        onChange={(e) => set(k)(e.target.value)}
        className="w-20 border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center" />
      <span className="text-xs text-muted-foreground">{label12(clampHour(form[k], 0))}</span>
    </div>
  )

  return (
    <div>
      <h1 className="text-xl font-bold text-foreground mb-1">After-hours booking</h1>
      <p className="text-sm text-muted-foreground mb-6">Any member can book meeting rooms during business hours. Members whose membership includes 24/7 access can also book the wider after-hours window (evenings &amp; early mornings) — at the same price as daytime. Hours are 24-hour, Melbourne local. Applies to the member portal and app.</p>

      <div className="mb-6 border border-border rounded-md p-4">
        <div className="text-sm font-semibold text-foreground mb-3">Business hours (everyone)</div>
        <FormRow label="Open from" description="Earliest any member can book"><HourInput k="coreStart" /></FormRow>
        <FormRow label="Open until" description="Latest any member can book"><HourInput k="coreEnd" /></FormRow>
      </div>

      <div className="mb-6 border border-border rounded-md p-4">
        <div className="text-sm font-semibold text-foreground mb-3">After-hours window (24/7 members)</div>
        <FormRow label="Extended from" description="Earliest a 24/7 member can book"><HourInput k="extendedStart" /></FormRow>
        <FormRow label="Extended until" description="Latest a 24/7 member can book"><HourInput k="extendedEnd" /></FormRow>
        <FormRow label="24/7 memberships" description="Which memberships may book after hours (they already have 24/7 building access)">
          <div className="space-y-2">
            {PERK_TIER_ORDER.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input type="checkbox" checked={form.eligibleTiers.includes(t)} onChange={() => toggleTier(t)} className="accent-blue-600" />
                {t}
              </label>
            ))}
          </div>
        </FormRow>
      </div>

      <SaveButton onClick={save} saved={saved} />
    </div>
  )
}

// ── Tours ─────────────────────────────────────────────────────────────────────
// The arrival details that go out on every confirmed tour — the email body and
// the LOCATION/DESCRIPTION on the calendar invitation both read from here.
function ToursSection({ settings, updateSettings }) {
  const cur = tourConfig(settings)
  const [form, setForm] = useState({
    address: cur.address,
    arrival: cur.arrival,
    parking: cur.parking.join('\n'),
    durationMinutes: cur.durationMinutes,
  })
  const [saved, setSaved] = useState(false)
  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }))

  function save() {
    updateSettings({ tours: {
      address: form.address.trim() || TOUR_DEFAULTS.address,
      arrival: form.arrival.trim(),
      parking: form.parking.split('\n').map((s) => s.trim()).filter(Boolean),
      durationMinutes: Math.max(5, Math.min(480, Number(form.durationMinutes) || TOUR_DEFAULTS.durationMinutes)),
    } })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-foreground mb-1">Tours</h1>
      <p className="text-sm text-muted-foreground mb-6">
        What a prospect is told when a tour is booked through CRM → <strong>Book a Tour</strong>. This copy appears in
        their confirmation email and on the calendar invitation they receive. The wording around it is editable under
        Templates → Emails → "Tour — Booking confirmed".
      </p>

      <div className="mb-6 border border-border rounded-md p-4">
        <FormRow label="Address" description="Shown in the email and used as the invitation's location">
          <TextInput value={form.address} onChange={set('address')} placeholder={TOUR_DEFAULTS.address} />
        </FormRow>
        <FormRow label="On arrival" description="What to do when they get to the building">
          <textarea value={form.arrival} onChange={(e) => set('arrival')(e.target.value)} rows={2}
            placeholder={TOUR_DEFAULTS.arrival}
            className="w-full border border-input rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </FormRow>
        <FormRow label="Parking options" description="One per line — listed in the email, best option first">
          <textarea value={form.parking} onChange={(e) => set('parking')(e.target.value)} rows={4}
            placeholder={TOUR_DEFAULTS.parking.join('\n')}
            className="w-full border border-input rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </FormRow>
        <FormRow label="Default duration" description="How long a tour is blocked out for (minutes)">
          <TextInput type="number" value={form.durationMinutes} onChange={set('durationMinutes')} />
        </FormRow>
      </div>

      <SaveButton onClick={save} saved={saved} />
    </div>
  )
}

// ── Invoicing ─────────────────────────────────────────────────────────────────
function InvoicingSection({ settings, updateSettings }) {
  const [form, setForm] = useState(() => ({ ...settings.invoicing }))
  const [saved, setSaved] = useState(false)

  function save() {
    updateSettings({ invoicing: form })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function set(f) { return (v) => setForm((p) => ({ ...p, [f]: v })) }

  const invPreview = (form.invoiceNumberTemplate ?? 'INV-{{number}}').replace('{{number}}', '0001')

  return (
    <div>
      <h1 className="text-xl font-bold text-foreground mb-1">Invoicing</h1>
      <p className="text-sm text-muted-foreground mb-6">Configure invoice generation, numbering, due dates, and sending rules.</p>

      <FormRow label="Invoice Number Template" description="Use {{number}} as the auto-increment placeholder">
        <div className="space-y-1">
          <TextInput value={form.invoiceNumberTemplate} onChange={set('invoiceNumberTemplate')} mono />
          <div className="text-xs text-muted-foreground">Preview: {invPreview}</div>
        </div>
      </FormRow>
      <FormRow label="Due Date" description="Number of days after invoice issue date that payment is due">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={90}
            value={form.dueDateDays ?? 14}
            onChange={(e) => setForm((p) => ({ ...p, dueDateDays: Number(e.target.value) }))}
            className="w-20 border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
          />
          <span className="text-xs text-muted-foreground">days after issue</span>
        </div>
      </FormRow>
      <FormRow label="Proration" description="Prorate first month's invoice when a tenant starts mid-month">
        <Toggle checked={form.proration ?? true} onChange={set('proration')} />
      </FormRow>
      <FormRow label="Auto-Generate Invoices" description="Automatically generate invoices at the start of each billing period">
        <Toggle checked={form.autoGenerate ?? true} onChange={set('autoGenerate')} />
      </FormRow>
      <FormRow label="Auto-Send Invoices" description="Automatically email invoices to tenants upon generation">
        <Toggle checked={form.autoSend ?? false} onChange={set('autoSend')} />
      </FormRow>
      <FormRow label="Overdue Reminder" description="Send a reminder this many days after a payment is overdue">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={60}
            value={form.overdueReminderDays ?? 7}
            onChange={(e) => setForm((p) => ({ ...p, overdueReminderDays: Number(e.target.value) }))}
            className="w-20 border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
          />
          <span className="text-xs text-muted-foreground">days past due</span>
        </div>
      </FormRow>

      <SaveButton onClick={save} saved={saved} />
    </div>
  )
}

// ── Email Templates ───────────────────────────────────────────────────────────
const EMAIL_TEMPLATE_DEFS = [
  { key: 'invoice',  label: 'Invoice Email',          vars: '{{number}}, {{company}}, {{dueDate}}' },
  { key: 'reminder', label: 'Overdue Reminder',        vars: '{{number}}, {{amount}}, {{dueDate}}' },
  { key: 'receipt',  label: 'Payment Receipt',         vars: '{{number}}, {{amount}}' },
  { key: 'renewal',  label: 'Renewal Notice',          vars: '{{contract}}, {{expiryDate}}' },
  { key: 'esign',    label: 'eSign Invitation',        vars: '{{contract}}, {{company}}' },
  { key: 'onboarding', label: 'Onboarding / Welcome',  vars: '{{company}}, {{unit}}, {{startDate}}, {{contract}}, {{tenantName}}' },
  { key: 'bondRefund', label: 'Bond Refund',           vars: '{{company}}, {{amount}}, {{unit}}, {{number}}, {{tenantName}}' },
]

// Fallback copy so newly-added templates are readable/editable even on installs
// whose saved settings predate them (e.g. Onboarding).
const EMAIL_TEMPLATE_FALLBACKS = {
  onboarding: {
    subject: 'Welcome to {{company}} — your space is ready',
    intro: 'Your agreement is signed and settled. Welcome aboard — here is everything you need to get started.',
  },
  bondRefund: {
    subject: 'Bond refund approved — {{number}}',
    intro: 'Good news — your security deposit refund of {{amount}} for {{unit}} has been approved and a credit note ({{number}}) has been issued.',
  },
}

function EmailTemplatesSection({ settings, updateSettings }) {
  const defaults = settings.emailTemplates ?? {}
  const [form, setForm] = useState(() => {
    const f = {}
    EMAIL_TEMPLATE_DEFS.forEach(({ key }) => {
      const fb = EMAIL_TEMPLATE_FALLBACKS[key] ?? { subject: '', intro: '' }
      f[key] = {
        subject: defaults[key]?.subject ?? fb.subject,
        intro: defaults[key]?.intro ?? fb.intro,
      }
    })
    return f
  })
  const [saved, setSaved] = useState(false)

  function save() {
    updateSettings({ emailTemplates: form })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const input = 'w-full border border-input rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <div>
      <div className="px-6 py-5 border-b border-border">
        <h2 className="text-base font-semibold text-foreground">Email Templates</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Customise the subject and opening paragraph for each email type. Use placeholders shown below each field.
        </p>
      </div>
      <div className="px-6 py-4 space-y-8">
        {EMAIL_TEMPLATE_DEFS.map(({ key, label, vars }) => (
          <div key={key} className="border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">{label}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Subject line</label>
                <input
                  value={form[key]?.subject ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: { ...f[key], subject: e.target.value } }))}
                  className={input}
                />
                <p className="text-xs text-muted-foreground mt-1">Available: {vars}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Opening paragraph</label>
                <textarea
                  rows={3}
                  value={form[key]?.intro ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: { ...f[key], intro: e.target.value } }))}
                  className={`${input} resize-none`}
                />
                <p className="text-xs text-muted-foreground mt-1">Available: {vars}</p>
              </div>
            </div>
          </div>
        ))}
        <div className="flex justify-end pt-2">
          <button onClick={save}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90">
            {saved ? <><Check size={14} /> Saved</> : 'Save Email Templates'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Xero Integration ──────────────────────────────────────────────────────────
function XeroConnectionTab({ settings, updateSettings }) {
  const xs = settings.xero ?? {}
  const [st, setSt] = useState(null) // null = loading
  const [banner, setBanner] = useState(null)
  const [busy, setBusy] = useState(null) // 'dry' | 'push' | 'pull' | 'disconnect'
  const [result, setResult] = useState(null)
  const [err, setErr] = useState(null)
  const [syncForm, setSyncForm] = useState({
    syncEnabled: xs.syncEnabled === true,
    pullEnabled: xs.pullEnabled === true,
    syncFrom: xs.syncFrom ?? '2026-09-01',
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => { xeroStatus().then(setSt) }, [])

  // Surface the OAuth redirect result (?xero=connected|error), then clean the URL.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const flag = q.get('xero')
    if (flag) {
      setBanner(flag === 'connected' ? 'ok' : 'error')
      q.delete('xero'); q.delete('section')
      window.history.replaceState({}, '', window.location.pathname + (q.toString() ? `?${q}` : ''))
    }
  }, [])

  function saveSync() {
    updateSettings({ xero: { ...(settings.xero ?? {}), ...syncForm } })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function run(kind) {
    setBusy(kind); setErr(null); setResult(null)
    try {
      if (kind === 'disconnect') {
        await disconnectXero()
        setSt(await xeroStatus())
      } else {
        const r = await xeroSync(kind === 'pull' ? 'pull' : 'push', { dryRun: kind === 'dry' })
        setResult(r)
        if (kind !== 'dry') setSt(await xeroStatus())
      }
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(null)
    }
  }

  const syncOn = xs.syncEnabled === true
  const fmtDT = (iso) => iso ? new Date(iso).toLocaleString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div>
      {banner === 'ok' && (
        <div className="mb-4 px-4 py-3 rounded-md bg-green-50 border border-green-200 text-sm text-green-700">
          Xero connected successfully.
        </div>
      )}
      {banner === 'error' && (
        <div className="mb-4 px-4 py-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
          Xero connection failed — check the app credentials and try again.
        </div>
      )}

      {/* Connection card */}
      <div className="border border-border rounded-md p-5 mb-6">
        {st === null ? (
          <div className="text-sm text-muted-foreground">Checking connection…</div>
        ) : !st.configured ? (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Not configured.</span> Set{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">XERO_CLIENT_ID</code> and{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">XERO_CLIENT_SECRET</code> in Vercel,
            with redirect URI <code className="text-xs bg-muted px-1 py-0.5 rounded">https://&lt;domain&gt;/api/xero/callback</code>{' '}
            registered at developer.xero.com.
          </div>
        ) : st.connected ? (
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-foreground">Connected to {st.tenantName ?? 'Xero'}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1.5 space-y-0.5">
                <div>Connected {fmtDT(st.connectedAt)}</div>
                <div>Last push: {fmtDT(st.lastPush)} · Last payment pull: {fmtDT(st.lastPull)}</div>
              </div>
            </div>
            <button
              onClick={() => run('disconnect')}
              disabled={!!busy}
              className="px-3 py-1.5 text-sm border border-input rounded-md text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              <span className="inline-block w-2 h-2 rounded-full bg-gray-300 mr-2" />
              Not connected
            </div>
            <button
              onClick={connectXero}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md font-medium hover:bg-blue-700"
            >
              Connect to Xero
            </button>
          </div>
        )}
      </div>

      {/* Sync gate */}
      <FormRow
        label="Enable Xero sync"
        description={`Master switch. While OFF nothing is pushed or pulled — connect and dry-run safely. Planned go-live: 1 September 2026, after the migration and invoices are verified.`}
      >
        <div className="flex justify-end">
          <Toggle checked={syncForm.syncEnabled} onChange={(v) => setSyncForm((p) => ({ ...p, syncEnabled: v }))} />
        </div>
      </FormRow>
      <FormRow
        label="Pull payments only (before go-live)"
        description="Lets payment status flow BACK from Xero ahead of the push go-live: invoices reconciled in Xero are marked paid here automatically (checked every 6 hours). Only affects invoices that are already linked to Xero — it never pushes anything."
      >
        <div className="flex justify-end">
          <Toggle checked={syncForm.pullEnabled} onChange={(v) => setSyncForm((p) => ({ ...p, pullEnabled: v }))} />
        </div>
      </FormRow>
      <FormRow label="Sync from" description="Only invoices with a billing period starting on/after this date are ever pushed. Keeps migrated history out of Xero.">
        <TextInput type="date" value={syncForm.syncFrom} onChange={(v) => setSyncForm((p) => ({ ...p, syncFrom: v }))} />
      </FormRow>
      <SaveButton onClick={saveSync} saved={saved} />

      {/* Actions */}
      {st?.connected && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-foreground mb-3">Sync actions</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => run('dry')}
              disabled={!!busy}
              className="px-4 py-2 border border-input text-sm rounded-md font-medium hover:bg-muted disabled:opacity-50"
            >
              {busy === 'dry' ? 'Previewing…' : 'Preview push (dry run)'}
            </button>
            <button
              onClick={() => run('push')}
              disabled={!!busy || !syncOn}
              title={syncOn ? '' : 'Turn on "Enable Xero sync" and save first'}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {busy === 'push' ? 'Pushing…' : 'Push invoices to Xero'}
            </button>
            <button
              onClick={() => run('pull')}
              disabled={!!busy || (!syncOn && xs.pullEnabled !== true)}
              title={syncOn || xs.pullEnabled === true ? '' : 'Turn on "Enable Xero sync" or "Pull payments only" and save first'}
              className="px-4 py-2 border border-input text-sm rounded-md font-medium hover:bg-muted disabled:opacity-50"
            >
              {busy === 'pull' ? 'Pulling…' : 'Pull payments from Xero'}
            </button>
          </div>
          {!syncOn && (
            <p className="text-xs text-muted-foreground mt-2">
              Sync is off — live push/pull are locked. Dry run is always available.
            </p>
          )}

          {err && (
            <div className="mt-4 px-4 py-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">{err}</div>
          )}

          {result && (
            <div className="mt-4 border border-border rounded-md p-4 text-sm">
              {result.dryRun && result.wouldPush && (
                <>
                  <div className="font-medium text-foreground mb-2">
                    Dry run — {result.wouldPush.length} invoice{result.wouldPush.length !== 1 ? 's' : ''} would be pushed (from {result.syncFrom})
                  </div>
                  {result.wouldPush.length > 0 && (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b border-border">
                          <th className="py-1.5 pr-3">Invoice</th><th className="py-1.5 pr-3">Tenant</th>
                          <th className="py-1.5 pr-3 text-right">Total (ex GST)</th><th className="py-1.5">Accounts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.wouldPush.map((w) => (
                          <tr key={w.number} className="border-b border-border/50 last:border-0">
                            <td className="py-1.5 pr-3 font-mono">{w.number}</td>
                            <td className="py-1.5 pr-3">{w.tenant}</td>
                            <td className="py-1.5 pr-3 text-right">${Number(w.total).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                            <td className="py-1.5 font-mono">{(w.accounts ?? []).join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
              {!result.dryRun && result.pushed && (
                <div className="font-medium text-foreground">
                  Pushed {result.pushed.length} invoice{result.pushed.length !== 1 ? 's' : ''} to Xero.
                </div>
              )}
              {result.paidMarked && (
                <div className="font-medium text-foreground">
                  Checked {result.checked} — marked {result.paidMarked.length} paid
                  {result.partial?.length ? `, ${result.partial.length} partially paid (left pending)` : ''}
                  {result.voidedInXero?.length ? `, ${result.voidedInXero.length} voided in Xero (review manually)` : ''}.
                </div>
              )}
              {result.skipped?.length > 0 && (
                <div className="text-xs text-muted-foreground mt-2">
                  Skipped: {result.skipped.map((s) => `${s.number} (${s.reason})`).join(', ')}
                </div>
              )}
              {result.errors?.length > 0 && (
                <div className="mt-2 text-xs text-red-600">
                  {result.errors.map((e, i) => <div key={i}>{e.number}: {e.error}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function XeroSection({ settings, updateSettings }) {
  const [tab, setTab] = useState('connection')
  const [form, setForm] = useState(() => ({ ...DEFAULT_XERO_ACCOUNTS, ...(settings.xero?.revenueAccounts ?? {}) }))
  const [saved, setSaved] = useState(false)

  function save() {
    updateSettings({ xero: { ...(settings.xero ?? {}), revenueAccounts: form } })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }
  function set(f) { return (v) => setForm((p) => ({ ...p, [f]: v })) }

  const ACCOUNT_ROWS = [
    ['deposits',      'Deposits',              'System account for refundable deposits'],
    ['membershipL45', 'Membership Fees',       'Default account for membership fees (Level 4 & 5)'],
    ['oneOffL45',     'One-off Fees',          'Default account for one-off fees (Level 4 & 5)'],
    ['bookingL45',    'Booking Fees',          'Meeting rooms, event space & media studios'],
    ['orderL45',      'Order Fees',            'Default account for order fees'],
    ['membershipL2',  'Level 2 Membership Fees', 'Revenue / income for Level 2 members'],
    ['parkingL2',     'Level 2 Parking Fees',  'Parking space & other for Level 2'],
  ]

  return (
    <div>
      <h1 className="text-xl font-bold text-foreground mb-1">Xero</h1>
      <p className="text-sm text-muted-foreground mb-6">Connect your Xero organisation, map revenue accounts, and control when invoices start syncing.</p>

      <TabBar
        tabs={[['connection', 'Connection & Sync'], ['revenue', 'Revenue Accounts'], ['payment', 'Payment Accounts'], ['tax', 'Tax Rates']]}
        active={tab}
        onSelect={setTab}
      />

      {tab === 'connection' && <XeroConnectionTab settings={settings} updateSettings={updateSettings} />}

      {tab === 'revenue' && (
        <>
          {ACCOUNT_ROWS.map(([key, label, desc]) => (
            <FormRow key={key} label={label} description={desc}>
              <select
                value={form[key] ?? ''}
                onChange={(e) => set(key)(e.target.value)}
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {XERO_ACCOUNTS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </FormRow>
          ))}
          <SaveButton onClick={save} saved={saved} />
        </>
      )}

      {(tab === 'payment' || tab === 'tax') && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {tab === 'payment' ? 'Payment account mapping' : 'Tax rate mapping'} — coming with the live Xero connection.
        </div>
      )}
    </div>
  )
}

// ── Stripe Integration ────────────────────────────────────────────────────────
function StripeSection({ settings, updateSettings }) {
  const [st, setSt] = useState(null)
  const [enabled, setEnabled] = useState(settings.stripe?.paymentsEnabled === true)
  const [autoCharge, setAutoCharge] = useState(settings.stripe?.autoChargeOverdue === true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/stripe/status').then((r) => r.json()).then(setSt).catch(() => setSt({ configured: false }))
  }, [])

  function save() {
    updateSettings({ stripe: { ...(settings.stripe ?? {}), paymentsEnabled: enabled, autoChargeOverdue: autoCharge } })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const ready = st?.configured && st?.webhookConfigured

  return (
    <div>
      <h1 className="text-xl font-bold text-foreground mb-1">Stripe</h1>
      <p className="text-sm text-muted-foreground mb-6">Online invoice payments — members see a Pay button on pending invoices in the portal; payments mark the invoice paid automatically.</p>

      <div className="border border-border rounded-md p-5 mb-6 text-sm">
        {st === null ? (
          <span className="text-muted-foreground">Checking configuration…</span>
        ) : (
          <div className="space-y-1.5">
            {[
              ['Secret key (STRIPE_SECRET_KEY)', st.configured],
              ['Webhook secret (STRIPE_WEBHOOK_SECRET)', st.webhookConfigured],
            ].map(([label, ok]) => (
              <div key={label} className="flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-green-500' : 'bg-red-400'}`} />
                <span className={ok ? 'text-foreground' : 'text-muted-foreground'}>{label} {ok ? 'set' : 'missing'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <FormRow
        label="Enable online payments"
        description="Master switch. While OFF the Pay button politely refuses and members pay by bank transfer as usual."
      >
        <div className="flex justify-end">
          <Toggle checked={enabled} onChange={setEnabled} />
        </div>
      </FormRow>
      <FormRow
        label="Auto-charge overdue invoices to card on file"
        description="The daily overdue run charges a tenant's verified saved card once an invoice is 7+ days past its due date (per clause 7(i) of the T&C) and emails them a receipt. Cards are captured during signing for Virtual Office and desk memberships. One attempt per invoice per day; failures fall back to the reminder email."
      >
        <div className="flex justify-end">
          <Toggle checked={autoCharge} onChange={setAutoCharge} />
        </div>
      </FormRow>
      {!ready && st !== null && (
        <p className="text-xs text-amber-600 mt-2">Both keys must be set in Vercel before enabling — payments will fail otherwise.</p>
      )}
      <SaveButton onClick={save} saved={saved} />
    </div>
  )
}

// ── PaperCut Integration ──────────────────────────────────────────────────────
// Which desktop OS is this browser on? Drives which installer we lead with —
// same detection the member portal uses on its Printer Setup guide.
const IS_MAC = /Mac/i.test(navigator.platform || navigator.userAgent)

function PaperCutSection() {
  const [tab, setTab] = useState('status')
  const [st, setSt] = useState(null)
  const [roster, setRoster] = useState(null)   // per-member print set-up (admin-only)
  const [q, setQ] = useState('')
  const [shown, setShown] = useState({})       // emails whose PIN is revealed
  useEffect(() => {
    fetch('/api/papercut/status').then((r) => r.json()).then(setSt).catch(() => setSt({ configured: false }))
    ;(async () => {
      try {
        const r = await fetch('/api/papercut/member-status', { headers: await authHeaders() })
        const d = await r.json()
        setRoster(r.ok ? d : { error: d.error ?? 'Could not load member print status.' })
      } catch {
        setRoster({ error: 'Could not load member print status.' })
      }
    })()
  }, [])

  const fmt = (iso) => {
    if (!iso) return 'never'
    const d = new Date(iso)
    return isNaN(d) ? String(iso) : d.toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  const money = (n) => `A$${(Number(n) || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`

  const linked = !!st?.configured
  const pinsOk = (st?.pinsSynced ?? 0) > 0

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-xl font-bold text-foreground">PaperCut</h1>
        {st && (
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${linked ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${linked ? 'bg-green-500' : 'bg-gray-400'}`} />
            {linked ? 'Linked & synced' : 'Not linked'}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Print billing and member accounts. Members are provisioned into PaperCut, their PIN shows in the app &amp; portal, and monthly print overage above the $30 allowance is billed onto their invoice.
      </p>

      <TabBar
        tabs={[['status', 'Status & Members'], ['download', 'Printer Download']]}
        active={tab}
        onSelect={setTab}
      />

      {tab === 'download' ? <PrinterDownload /> : <PaperCutStatusTab {...{ st, linked, pinsOk, fmt, money, roster, q, setQ, shown, setShown }} />}
    </div>
  )
}

// Status + member roster — the original PaperCut panel, now behind its own tab.
function PaperCutStatusTab({ st, linked, pinsOk, fmt, money, roster, q, setQ, shown, setShown }) {
  return (
    <>
      {/* Status card */}
      <div className="border border-border rounded-md p-5 mb-6 text-sm">
        {st === null ? (
          <span className="text-muted-foreground">Checking status…</span>
        ) : (
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <Stat label="Connection" value={linked ? 'Sync token set' : 'Sync token missing'} ok={linked} />
            <Stat label="Active members" value={st.activeMembers ?? '—'} />
            <Stat label="PINs synced" value={st.pinsSynced ?? 0} ok={pinsOk} sub={`last sync ${fmt(st.lastPinSync)}`} />
            <Stat label="Print fees this month" value={st.feesThisMonth ?? 0} sub={`${money(st.feesThisMonthTotal)} · last ${fmt(st.lastFeeSync)}`} />
          </div>
        )}
      </div>

      {st && !linked && (
        <p className="text-xs text-amber-600 mb-4">Set <code>PAPERCUT_SYNC_TOKEN</code> in Vercel (and the on-prem connector) to link the integration.</p>
      )}
      {st && linked && !pinsOk && (
        <p className="text-xs text-amber-600 mb-4">Linked, but no PINs synced yet — run <code>provision-members.mjs</code> on the PaperCut server to allocate and push member PINs.</p>
      )}

      {/* Per-member print set-up: portal password (their Mobility Print sign-in)
          + the PIN they release with at the copier. Admin-only endpoint. */}
      <MemberPrintSetup roster={roster} q={q} setQ={setQ} shown={shown} setShown={setShown} />

      <div className="border border-border rounded-md p-5 text-sm text-muted-foreground space-y-2">
        <p className="font-medium text-foreground">How it works</p>
        <p>An on-prem connector on the PaperCut server (Box Hill LAN) provisions active members into PaperCut, allocates each one a PIN and pushes it straight back for display, and at month-end reads each member's negative balance (print above their $30 allowance) and posts it as a fee that the bill run folds onto their invoice.</p>
        <p>A member signs in to PaperCut Mobility Print with their <strong>Hexa portal email and password</strong> — so anyone without a portal password can't sign in to the print client (card release at the copier still works). At the copier they type the PIN above.</p>
        <p>Runs on the LAN because PaperCut's API isn't reachable from the cloud. The connector authenticates to PaperCut with its own token and to Hexa with the shared sync token.</p>
      </div>
    </>
  )
}

// Printer Download — the same installers members get on the portal
// (Guides → Printer Setup), so staff can set up their own laptop without
// digging through the member portal. Files are the ones in public/downloads.
function PrinterDownload() {
  const mac = { href: '/downloads/hexa-printer-mac.dmg', label: 'Download for Mac', sub: 'hexa-printer-mac.dmg · macOS' }
  const win = { href: '/downloads/hexa-printer-windows.exe', label: 'Download for Windows', sub: 'hexa-printer-windows.exe · Windows 10/11' }
  const [primary, secondary] = IS_MAC ? [mac, win] : [win, mac]

  return (
    <div>
      {/* Laptop / desktop — lead with the installer for the OS we detect */}
      <div className="border border-border rounded-md p-5 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Laptop size={16} className="text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Print from your laptop</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          PaperCut Mobility Print · adds the “Hexa-Secure” printers · {IS_MAC ? 'Mac detected' : 'Windows detected'}
        </p>

        <div className="flex flex-wrap gap-3 mb-5">
          <a
            href={primary.href}
            download
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-md font-medium hover:bg-blue-700"
          >
            <Download size={14} /> {primary.label}
          </a>
          <a
            href={secondary.href}
            download
            className="inline-flex items-center gap-2 px-4 py-2 border border-input text-foreground text-sm rounded-md font-medium hover:bg-muted/50"
          >
            <Download size={14} /> {secondary.label}
          </a>
        </div>
        <p className="text-xs text-muted-foreground mb-5">{primary.sub} · {secondary.sub}</p>

        <NumberedSteps items={[
          'Connect to the “Hexa Spaces” Wi-Fi — the print server only answers on the Box Hill LAN.',
          'Download and run the installer above, then follow the prompts.',
          'The “Hexa-Secure” printer is added automatically — print to it like any other printer.',
          'The first time you print, sign in with your Hexa portal email and password (just once).',
          'Release the job at any printer by keying in your ID (print PIN) on the keypad.',
        ]} />

        <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border">
          Sign-in is the portal password, not a separate PaperCut one. Staff print from their own member record —
          check yours appears under <strong className="text-foreground">Status &amp; Members</strong> with a password and a PIN before installing.
        </p>
      </div>

      {/* Phone / tablet — same links the portal serves members */}
      <div className="border border-border rounded-md p-5 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Smartphone size={16} className="text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Print from your phone or tablet</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">iPhone, iPad &amp; Android</p>
        <div className="flex flex-wrap gap-3">
          <a
            href="/downloads/hexa-printer-ios.mobileconfig"
            download
            className="inline-flex items-center gap-2 px-4 py-2 border border-input text-foreground text-sm rounded-md font-medium hover:bg-muted/50"
          >
            <Download size={14} /> iPhone / iPad printer profile
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=com.papercut.projectbanksia&referrer=server=172.16.200.14"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 border border-input text-foreground text-sm rounded-md font-medium hover:bg-muted/50"
          >
            <ExternalLink size={14} /> Android print app
          </a>
        </div>
      </div>

      <div className="border border-border rounded-md p-5 text-sm text-muted-foreground space-y-2">
        <p className="font-medium text-foreground">Sending this to a member</p>
        <p>
          Members get the same installers on the portal under Guides → Printer Setup, with their own PIN and balance on the Printing tab.
          Direct links you can paste into a ticket or email:{' '}
          <code className="text-foreground">portal.hexaspace.com.au/downloads/hexa-printer-windows.exe</code> and{' '}
          <code className="text-foreground">portal.hexaspace.com.au/downloads/hexa-printer-mac.dmg</code>.
        </p>
        <p>
          The Level 2 Canon printers are a separate system (uniFlow Online) with its own PIN and driver — that guide lives on the member portal.
        </p>
      </div>
    </div>
  )
}

function NumberedSteps({ items }) {
  return (
    <ol className="space-y-2.5">
      {items.map((step, i) => (
        <li key={i} className="flex gap-3 text-sm text-muted-foreground">
          <span className="shrink-0 w-5 h-5 rounded-full bg-muted text-foreground text-[11px] font-semibold grid place-items-center mt-0.5">{i + 1}</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  )
}

// Who is actually set up to print. "Ready" = has a portal password (Mobility
// Print sign-in) AND a PIN (copier release). PINs are credentials, so they're
// masked until revealed — the endpoint behind this is admin-gated.
function MemberPrintSetup({ roster, q, setQ, shown, setShown }) {
  if (roster?.error) {
    return <div className="border border-border rounded-md p-5 mb-6 text-sm text-muted-foreground">{roster.error}</div>
  }
  const rows = roster?.members ?? []
  const s = roster?.summary
  const needle = q.trim().toLowerCase()
  const filtered = needle
    ? rows.filter((m) => `${m.name} ${m.email} ${m.companyName}`.toLowerCase().includes(needle))
    : rows
  const pwUnknown = roster?.passwordCheck === 'unavailable'

  return (
    <div className="border border-border rounded-md mb-6">
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between gap-4 mb-1">
          <h2 className="font-semibold text-foreground">Member print set-up</h2>
          {s && (
            <span className="text-xs text-muted-foreground">
              {s.ready}/{s.total} ready · {s.withPin} with a PIN · {s.withPassword} with a portal password
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          A member is ready when they have a portal password (their Mobility Print login) and a PIN (copier release).
          {pwUnknown && ' Password status unavailable — run papercut-has-password-schema.sql in Supabase.'}
        </p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search members…"
          className="w-full max-w-xs border border-input rounded-md px-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </div>

      {roster === null ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">Loading members…</p>
      ) : filtered.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">{rows.length === 0 ? 'No active members.' : 'No members match that search.'}</p>
      ) : (
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="text-xs text-muted-foreground uppercase tracking-wide border-y border-border">
                <th className="text-left font-medium px-5 py-2">Member</th>
                <th className="text-left font-medium px-3 py-2">Company</th>
                <th className="text-left font-medium px-3 py-2">Portal password</th>
                <th className="text-left font-medium px-3 py-2">PIN</th>
                <th className="text-right font-medium px-5 py-2">Print balance</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.email} className="border-b border-border last:border-0">
                  <td className="px-5 py-2">
                    <div className="text-foreground">{m.name}</div>
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{m.companyName || '—'}</td>
                  <td className="px-3 py-2">
                    {m.hasPassword === null ? <span className="text-muted-foreground">—</span>
                      : m.hasPassword
                        ? <span className="text-xs font-semibold text-green-700">● Set</span>
                        : <span className="text-xs font-semibold text-amber-600">● Not set</span>}
                  </td>
                  <td className="px-3 py-2">
                    {!m.pin ? <span className="text-xs text-amber-600">Not allocated</span>
                      : shown[m.email]
                        ? <span className="font-mono text-foreground">{m.pin}</span>
                        : (
                          <button
                            onClick={() => setShown((p) => ({ ...p, [m.email]: true }))}
                            className="font-mono text-muted-foreground hover:text-foreground"
                          >
                            •••• <span className="font-sans text-xs underline">show</span>
                          </button>
                        )}
                  </td>
                  <td className="px-5 py-2 text-right tabular-nums">
                    {m.balance == null ? <span className="text-muted-foreground">—</span>
                      : <span className={m.balance < 0 ? 'text-red-600' : 'text-foreground'}>A${Number(m.balance).toFixed(2)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, ok, sub }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
      <div className="flex items-center gap-2">
        {ok !== undefined && <span className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-green-500' : 'bg-red-400'}`} />}
        <span className="text-base font-semibold text-foreground">{value}</span>
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  )
}

// ── Main Settings ─────────────────────────────────────────────────────────────
// ── Remote unlock (member app "My key") ──────────────────────────────────────
// Three door kinds, all authorized server-side (api/salto/open.js): a member's
// OWN office door (active lease → lock map below), BUILDING ENTRY doors scoped to
// their floor, and MEETING ROOMS during a booking (rooms use the roomLocks map,
// set on the Spaces / meeting-room tab). Every unlock is audit-logged (Access Log).
// Requires the SALTO_REMOTE_OPEN_WEBHOOK zap (mock until set).
const ENTRY_FLOORS = [2, 4, 5]
function RemoteUnlockSection({ settings, updateSettings, spaces }) {
  const cur = settings.salto?.remoteOpen ?? {}
  const [enabled, setEnabled] = useState(cur.enabled === true)
  // A space's lock value is a string (single door) or an array of { lockId, label }
  // for a dual/combined office — expand each into its own editable row.
  const [rows, setRows] = useState(() =>
    Object.entries(cur.locks ?? {}).flatMap(([spaceId, val]) =>
      Array.isArray(val)
        ? val.map((v) => ({ spaceId, lockId: String(v?.lockId ?? ''), label: v?.label ?? '' }))
        : [{ spaceId, lockId: String(val), label: '' }]))
  const [entryRows, setEntryRows] = useState(() =>
    (Array.isArray(cur.entryDoors) ? cur.entryDoors : []).map((e) => ({
      label: e.label ?? '', lockId: String(e.lockId ?? ''),
      floors: Array.isArray(e.floors) ? e.floors.map(Number) : [],
    })))
  const [saved, setSaved] = useState(false)

  const lockable = [...spaces].sort((a, b) => (a.unitNumber || '').localeCompare(b.unitNumber || ''))
  const upd = (i, patch) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  const updEntry = (i, patch) => setEntryRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  const toggleFloor = (i, f) => updEntry(i, {
    floors: entryRows[i].floors.includes(f)
      ? entryRows[i].floors.filter((x) => x !== f)
      : [...entryRows[i].floors, f].sort((a, b) => a - b),
  })

  function save() {
    // Group rows by space: one plain lock → string; multiple (or a labelled)
    // lock → array of { lockId, label } so dual offices round-trip intact.
    const bySpace = {}
    for (const r of rows) {
      if (!r.spaceId || !r.lockId.trim()) continue
      ;(bySpace[r.spaceId] ??= []).push({ lockId: r.lockId.trim(), label: (r.label ?? '').trim() })
    }
    const locks = {}
    for (const [spaceId, arr] of Object.entries(bySpace)) {
      locks[spaceId] = (arr.length === 1 && !arr[0].label)
        ? arr[0].lockId
        : arr.map((a) => ({ lockId: a.lockId, label: a.label }))
    }
    const entryDoors = entryRows
      .filter((e) => e.lockId.trim() && e.floors.length)
      .map((e) => ({ label: e.label.trim() || 'Entry', lockId: e.lockId.trim(), floors: e.floors }))
    updateSettings({
      salto: {
        ...(settings.salto ?? {}),
        remoteOpen: { ...cur, enabled, locks, entryDoors },
      },
    })
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-foreground mb-1">Door Access — remote unlock</h3>
      <p className="text-sm text-muted-foreground mb-6">
        Lets members unlock doors from the Hexa app: their <strong>own office</strong> (active contract),
        the <strong>building entry for their floor</strong>, and a <strong>meeting room they’ve booked</strong>
        (during its window — set room locks on the meeting-room tab). Every unlock is audit-logged to the
        Access Log; unlocks are unlimited. Requires the <code>SALTO_REMOTE_OPEN_WEBHOOK</code> zap (mock until set).
      </p>

      <FormRow label="Enable remote unlock" description="Master switch for the app's Unlock buttons">
        <Toggle checked={enabled} onChange={setEnabled} />
      </FormRow>

      <div className="mt-6 mb-2 text-sm font-medium text-foreground">Office → Salto lock mapping</div>
      <p className="text-xs text-muted-foreground mb-3">
        Only mapped spaces get an office Unlock button. Find the lock ID in the Salto KS portal (Locks → the door on that suite).
        For a <strong>dual office</strong> (e.g. Suite 15 + 16), add one row per door with the same space and a label each.
      </p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <select value={r.spaceId} onChange={(e) => upd(i, { spaceId: e.target.value })}
              className="border border-input rounded-md px-2 py-2 text-sm bg-card flex-1">
              <option value="">Select space…</option>
              {lockable.map((s) => <option key={s.id} value={s.id}>{s.unitNumber}</option>)}
            </select>
            <input value={r.lockId} onChange={(e) => upd(i, { lockId: e.target.value })}
              placeholder="Salto lock ID" className="border border-input rounded-md px-3 py-2 text-sm flex-1" />
            <input value={r.label ?? ''} onChange={(e) => upd(i, { label: e.target.value })}
              placeholder="Label (dual only)" className="border border-input rounded-md px-3 py-2 text-sm w-36" />
            <button type="button" onClick={() => setRows((rows2) => rows2.filter((_, idx) => idx !== i))}
              className="text-muted-foreground hover:text-red-500 text-sm px-1">✕</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setRows((r) => [...r, { spaceId: '', lockId: '', label: '' }])}
        className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium">+ Add mapping</button>

      <div className="mt-8 mb-2 text-sm font-medium text-foreground">Building entry doors (by floor)</div>
      <p className="text-xs text-muted-foreground mb-3">
        Each entry door shows in the app for members whose floor is ticked. A member’s floor comes from their
        active-lease space. E.g. a Level 4/5 reception door → tick L4 + L5.
      </p>
      <div className="space-y-2">
        {entryRows.map((e, i) => (
          <div key={i} className="flex items-center gap-2 flex-wrap">
            <input value={e.label} onChange={(ev) => updEntry(i, { label: ev.target.value })}
              placeholder="Label (e.g. L4/5 Reception)" className="border border-input rounded-md px-3 py-2 text-sm flex-1 min-w-[160px]" />
            <input value={e.lockId} onChange={(ev) => updEntry(i, { lockId: ev.target.value })}
              placeholder="Salto lock ID" className="border border-input rounded-md px-3 py-2 text-sm flex-1 min-w-[160px]" />
            <div className="flex items-center gap-1">
              {ENTRY_FLOORS.map((f) => (
                <button key={f} type="button" onClick={() => toggleFloor(i, f)}
                  className={`px-2.5 py-2 rounded-md text-xs font-medium border ${
                    e.floors.includes(f) ? 'bg-foreground text-background border-foreground' : 'bg-card text-muted-foreground border-input'}`}>
                  L{f}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setEntryRows((r2) => r2.filter((_, idx) => idx !== i))}
              className="text-muted-foreground hover:text-red-500 text-sm px-1">✕</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setEntryRows((r) => [...r, { label: '', lockId: '', floors: [] }])}
        className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium">+ Add entry door</button>

      <SaveButton onClick={save} saved={saved} />
    </div>
  )
}

export default function Settings() {
  const { settings, updateSettings, spaces = [] } = useOutletContext()
  // ?section=xero deep-links here (used by the Xero OAuth callback redirect)
  const [selectedKey, setSelectedKey] = useState(() => {
    const section = new URLSearchParams(window.location.search).get('section')
    return section && MENU.some((m) => m.items.some((i) => i.key === section)) ? section : 'company-billing'
  })

  const SECTIONS = {
    'company-billing': <CompanyBillingSection settings={settings} updateSettings={updateSettings} />,
    'admin-users': <AdminUsersSection settings={settings} updateSettings={updateSettings} />,
    'emails': <EmailsSection settings={settings} updateSettings={updateSettings} />,
    'contracts': <ContractsSection settings={settings} updateSettings={updateSettings} />,
    'room-perks': <RoomPerksSection settings={settings} updateSettings={updateSettings} />,
    'after-hours': <AfterHoursSection settings={settings} updateSettings={updateSettings} />,
    'tours': <ToursSection settings={settings} updateSettings={updateSettings} />,
    'billing-rules': <BillingRulesSection settings={settings} updateSettings={updateSettings} />,
    'invoicing': <InvoicingSection settings={settings} updateSettings={updateSettings} />,
    'email-templates': <EmailTemplatesSection settings={settings} updateSettings={updateSettings} />,
    'xero': <XeroSection settings={settings} updateSettings={updateSettings} />,
    'stripe': <StripeSection settings={settings} updateSettings={updateSettings} />,
    'papercut': <PaperCutSection />,
    'door-access': <RemoteUnlockSection settings={settings} updateSettings={updateSettings} spaces={spaces} />,
  }

  return (
    <div className="flex h-full bg-muted/50">
      {/* Left sidebar */}
      <aside className="w-56 shrink-0 border-r border-border bg-card h-full overflow-y-auto">
        <div className="px-5 py-5 border-b border-border">
          <h2 className="text-base font-bold text-foreground">Settings</h2>
        </div>
        <nav className="py-3">
          {MENU.map(({ section, items }) => (
            <div key={section} className="mb-2">
              <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {section}
              </div>
              {items.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSelectedKey(key)}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    selectedKey === key
                      ? 'bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-600'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl">
          {SECTIONS[selectedKey]}
        </div>
      </main>
    </div>
  )
}
