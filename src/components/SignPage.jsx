import { useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase.js'
import { sendEmail } from '../lib/sendEmail.js'
import SignatureCanvas from './SignatureCanvas.jsx'
import ContractTemplate from './ContractTemplate.jsx'

export default function SignPage({ token }) {
  const [state, setState] = useState('loading') // loading|ready|tenant_signed|fully_signed|invalid|error
  const [request, setRequest] = useState(null)
  const [lease, setLease] = useState(null)
  const [tenant, setTenant] = useState(null)
  const [space, setSpace] = useState(null)
  const [settings, setSettings] = useState(null)
  const [attachedTemplates, setAttachedTemplates] = useState([])
  const [signerName, setSignerName] = useState('')
  const [signerTitle, setSignerTitle] = useState('')
  const [signerDate, setSignerDate] = useState(format(new Date(), 'dd/MM/yyyy'))
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [view, setView] = useState('contract')
  const sigRef = useRef(null)

  useEffect(() => {
    async function load() {
      try {
        const { data: req, error } = await supabase
          .from('esign_requests').select('*').eq('token', token).single()

        if (error || !req) { setState('invalid'); return }

        setRequest(req)
        if (req.status === 'fully_signed') { setState('fully_signed'); return }
        if (req.status === 'tenant_signed') { setState('tenant_signed'); return }

        const [{ data: leaseRows }, { data: settRows }] = await Promise.all([
          supabase.from('leases').select('data').eq('id', req.lease_id),
          supabase.from('settings').select('data').eq('id', 'global'),
        ])

        const leaseData = leaseRows?.[0]?.data
        if (!leaseData) { setState('invalid'); return }
        setLease(leaseData)
        setSettings(settRows?.[0]?.data ?? null)

        const [{ data: tenantRows }, { data: spaceRows }, { data: tmplRows }] = await Promise.all([
          supabase.from('tenants').select('data').eq('id', leaseData.tenantId),
          supabase.from('spaces').select('data').eq('id', leaseData.spaceId),
          supabase.from('templates').select('id,data'),
        ])
        setTenant(tenantRows?.[0]?.data ?? null)
        setSpace(spaceRows?.[0]?.data ?? null)
        if (tenantRows?.[0]?.data?.contactName) setSignerName(tenantRows[0].data.contactName)

        const allTemplates = (tmplRows ?? []).map((r) => ({ id: r.id, ...r.data }))
        const contractTerms = leaseData.contractTerms ?? []
        const attached = contractTerms
          .map((ref) => allTemplates.find((t) => t.id === ref) ?? allTemplates.find((t) => `${t.name} - ${t.version}` === ref || t.name === ref))
          .filter(Boolean)
        setAttachedTemplates(attached)

        setState('ready')
      } catch (err) {
        console.error(err)
        setState('error')
      }
    }
    load()
  }, [token])

  async function handleSign() {
    if (!agreed) { alert('Please confirm you have read and agree to the agreement.'); return }
    if (!signerName.trim()) { alert('Please enter your full name.'); return }
    if (sigRef.current?.isEmpty()) { alert('Please draw your signature.'); return }

    setSubmitting(true)
    try {
      const signatureData = sigRef.current.toDataURL()
      const now = new Date().toISOString()

      await supabase.from('esign_requests').update({
        status: 'tenant_signed',
        licensee_signature_data: signatureData,
        licensee_signer_name: signerName,
        licensee_signed_at: now,
        licensee_title: signerTitle,
        licensee_date: signerDate,
      }).eq('token', token)

      // Update lease to show it's waiting for countersignature
      await supabase.from('leases').update({
        data: { ...lease, signatureStatus: 'out_for_signature', tenantSignedAt: now, tenantSignerName: signerName },
      }).eq('id', request.lease_id)

      const companyName = settings?.company?.name ?? 'HexaHub'
      const contractNum = lease.contractNumber ?? `CON-${lease.id?.slice(-3).toUpperCase()}`
      const portalUrl = `https://app.hexahub.com.au`

      // Notify admin to countersign
      const adminEmail = settings?.emails?.notificationEmail
      if (adminEmail) {
        await sendEmail({
          to: adminEmail,
          subject: `Action required: ${tenant?.businessName ?? 'Tenant'} has signed ${contractNum}`,
          html: adminCountersignHtml({ tenant, settings, signerName, contractNum, now, portalUrl }),
          settings,
        }).catch(() => {})
      }

      // Confirm to tenant
      if (tenant?.email) {
        await sendEmail({
          to: tenant.email,
          subject: `Signature received — ${contractNum}`,
          html: tenantConfirmHtml({ tenant, settings, signerName, contractNum, now, companyName }),
          settings,
        }).catch(() => {})
      }

      setState('tenant_signed')
    } catch (err) {
      console.error(err)
      alert('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Status screens ─────────────────────────────────────────────────────────
  if (state === 'loading') return <StatusScreen title="Loading contract…" subtitle="" />

  if (state === 'invalid') return (
    <StatusScreen
      icon="🔒"
      title="Invalid or expired link"
      subtitle="This signing link is invalid or has expired. Please contact HexaHub for a new link."
    />
  )

  if (state === 'error') return (
    <StatusScreen icon="⚠️" title="Something went wrong" subtitle="Please try again or contact HexaHub." />
  )

  if (state === 'tenant_signed') return (
    <StatusScreen
      icon="✅"
      title="Signature received"
      subtitle={`Thank you${request?.licensee_signer_name ? `, ${request.licensee_signer_name}` : ''}. Your signature has been received. HexaHub will countersign and send you a copy shortly.`}
    />
  )

  if (state === 'fully_signed') return (
    <StatusScreen
      icon="✅"
      title="Agreement fully signed"
      subtitle="This agreement has been signed by all parties. A copy has been sent to your email."
    />
  )

  const contractNum = lease?.contractNumber ?? `CON-${lease?.id?.slice(-3).toUpperCase()}`

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-black text-white px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <span className="font-black tracking-widest text-lg">HEXAHUB</span>
          <span className="text-gray-400 text-sm ml-3">Contract Signing</span>
        </div>
        <div className="text-sm text-gray-300">{contractNum}</div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-6 flex">
        {[['contract', 'Review Contract'], ['sign', 'Sign']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              view === key ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Contract view */}
      {view === 'contract' && (
        <div className="max-w-4xl mx-auto my-6 px-4">
          <div className="bg-white shadow-sm rounded-md overflow-hidden">
            <ContractTemplate lease={lease} tenant={tenant} space={space} settings={settings} />
          </div>
          {attachedTemplates.map((tmpl) => (
            <div key={tmpl.id} className="bg-white shadow-sm rounded-md overflow-hidden mt-4 px-12 py-10">
              <h2 className="text-base font-bold uppercase tracking-widest text-gray-900 mb-3">{tmpl.name}</h2>
              <hr className="border-gray-300 mb-6" />
              <div
                className="template-html-body"
                style={{ lineHeight: 1.6 }}
                dangerouslySetInnerHTML={{ __html: tmpl.content ?? '' }}
              />
            </div>
          ))}
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setView('sign')}
              className="bg-black text-white px-6 py-2.5 rounded-md text-sm font-semibold hover:bg-gray-800"
            >
              Proceed to Sign →
            </button>
          </div>
        </div>
      )}

      {/* Sign view */}
      {view === 'sign' && (
        <div className="max-w-xl mx-auto my-8 px-4">
          <div className="bg-white border border-gray-200 rounded-md p-8 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Sign as Licensee</h2>
            <p className="text-sm text-gray-500 mb-6">
              By signing below you confirm you have read and agree to the terms of <strong>{contractNum}</strong>.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Your full legal name"
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
              <input
                type="text"
                value={signerTitle}
                onChange={(e) => setSignerTitle(e.target.value)}
                placeholder="e.g. Director, CEO, Manager"
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div className="mb-5">
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input
                type="text"
                value={signerDate}
                onChange={(e) => setSignerDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div className="mb-5">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-600">Signature</label>
                <button onClick={() => sigRef.current?.clear()} className="text-xs text-gray-400 hover:text-gray-700 underline">Clear</button>
              </div>
              <SignatureCanvas ref={sigRef} height={140} />
              <p className="text-xs text-gray-400 mt-1">Draw your signature using mouse or finger</p>
            </div>

            <label className="flex items-start gap-3 mb-6 cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300" />
              <span className="text-sm text-gray-600">
                I have read and agree to the terms of this Licence Agreement and confirm that I am authorised to sign on behalf of the company.
              </span>
            </label>

            <div className="bg-gray-50 rounded-md p-4 text-xs text-gray-500 mb-6 space-y-1">
              <div><span className="font-medium text-gray-700">Company:</span> {tenant?.businessName}</div>
              <div><span className="font-medium text-gray-700">Contract:</span> {contractNum}</div>
              <div><span className="font-medium text-gray-700">Date:</span> {format(new Date(), 'dd MMM yyyy')}</div>
            </div>

            <button
              onClick={handleSign}
              disabled={submitting || !agreed}
              className="w-full bg-black text-white py-3 rounded-md text-sm font-bold hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              {submitting ? 'Submitting…' : 'Sign & Submit'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusScreen({ icon, title, subtitle }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm w-full">
        <div className="text-2xl font-black tracking-widest text-gray-900 mb-6">HEXAHUB</div>
        <div className="bg-white border border-gray-200 rounded-md p-8 shadow-sm">
          {icon && <div className="text-4xl mb-4">{icon}</div>}
          <h1 className="text-lg font-bold text-gray-900 mb-2">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}

function adminCountersignHtml({ tenant, settings, signerName, contractNum, now, portalUrl }) {
  const company = settings?.company?.name ?? 'HexaHub'
  const date = format(parseISO(now), 'dd MMM yyyy, h:mm a')
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#1a1a1a;background:#f5f5f5;margin:0;padding:0">
  <div style="max-width:560px;margin:32px auto;background:#fff;border:1px solid #e5e5e5;border-radius:6px;overflow:hidden">
    <div style="background:#000;padding:20px 32px"><span style="color:#fff;font-size:18px;font-weight:bold;letter-spacing:2px">${company.toUpperCase()}</span></div>
    <div style="padding:32px">
      <h2 style="margin:0 0 12px;font-size:16px">Action required: Countersign contract 🖊</h2>
      <p style="color:#555;font-size:14px;margin:0 0 20px"><strong>${tenant?.businessName ?? 'A tenant'}</strong> has signed <strong>${contractNum}</strong>. Please log in to the portal to review and countersign.</p>
      <div style="background:#f9f9f9;border:1px solid #e5e5e5;border-radius:4px;padding:16px;font-size:13px;color:#555;margin-bottom:20px">
        <div><strong>Signed by:</strong> ${signerName}</div>
        <div><strong>Date:</strong> ${date}</div>
        <div><strong>Contract:</strong> ${contractNum}</div>
      </div>
      <a href="${portalUrl}" style="background:#000;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:bold;font-size:14px;display:inline-block">Open Portal to Countersign →</a>
    </div>
  </div></body></html>`
}

function tenantConfirmHtml({ tenant, settings, signerName, contractNum, companyName }) {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#1a1a1a;background:#f5f5f5;margin:0;padding:0">
  <div style="max-width:560px;margin:32px auto;background:#fff;border:1px solid #e5e5e5;border-radius:6px;overflow:hidden">
    <div style="background:#000;padding:20px 32px"><span style="color:#fff;font-size:18px;font-weight:bold;letter-spacing:2px">${companyName.toUpperCase()}</span></div>
    <div style="padding:32px">
      <h2 style="margin:0 0 12px;font-size:16px">Signature received ✅</h2>
      <p style="color:#555;font-size:14px;margin:0 0 16px">Hi ${tenant?.contactName ?? ''},</p>
      <p style="color:#555;font-size:14px;margin:0 0 16px">Your signature for <strong>${contractNum}</strong> has been received. ${companyName} will countersign and send you a fully executed copy shortly.</p>
      <p style="font-size:12px;color:#888;margin-top:24px">If you have any questions, please contact us directly.</p>
    </div>
  </div></body></html>`
}
