import { useState, useEffect } from 'react'
import {
  Plus, X, Loader2, Sparkles, Search, Calculator, Save, Trash2, Copy, Check,
  ArrowRight, ArrowLeft, Rocket, Tag, Users, DollarSign, Target, ChevronDown, ChevronRight,
  AlertCircle, Megaphone, Plug, Send, CheckCircle2, BarChart2,
} from 'lucide-react'
import { generateAdResearch, generateAdCampaign } from '../lib/ads.js'
import { computeAdsMath } from '../lib/adsMath.js'
import { googleAdsStatus, connectGoogleAds, pushToGoogleAds } from '../lib/googleAds.js'
import KeywordResearch from './KeywordResearch.jsx'
import AccountData from './AccountData.jsx'

const OBJECTIVES = [
  { v: 'leads', label: 'Lead generation' },
  { v: 'traffic', label: 'Traffic' },
  { v: 'awareness', label: 'Awareness' },
]
const PLATFORMS = [
  { v: 'both', label: 'Google + Meta' },
  { v: 'google', label: 'Google Ads' },
  { v: 'meta', label: 'Meta Ads' },
]
const STEPS = ['Brief', 'Research', 'Campaign', 'Math', 'Save']

const input = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black'
const fmt$ = (n) => '$' + Number(n || 0).toLocaleString('en-AU', { maximumFractionDigits: 2 })

export default function AdsWorkbench({ store }) {
  const { spaces = [], settings = {}, addCampaign } = store
  const [view, setView] = useState('list') // 'list' | 'wizard' | 'keywords'

  if (view === 'wizard') return <Wizard store={store} spaces={spaces} settings={settings} addCampaign={addCampaign} onDone={() => setView('list')} />
  if (view === 'keywords') return <KeywordResearch store={store} onBack={() => setView('list')} />
  if (view === 'data') return <AccountData store={store} onBack={() => setView('list')} />
  return <CampaignList store={store} onNew={() => setView('wizard')} onKeywords={() => setView('keywords')} onData={() => setView('data')} />
}

// ── Saved campaigns list ──────────────────────────────────────────────────────
function CampaignList({ store, onNew, onKeywords, onData }) {
  const { campaigns = [], spaces = [], settings = {}, updateCampaign, deleteCampaign, updateSettings } = store
  const [openId, setOpenId] = useState(null)
  const [gads, setGads] = useState({ connected: false, configured: true })
  const [pushingId, setPushingId] = useState(null)
  const [pushMsg, setPushMsg] = useState(null) // { id, ok, text }

  const ga = settings.googleAds ?? {}
  useEffect(() => { googleAdsStatus().then(setGads) }, [])
  // Surface the OAuth redirect result (?ads=google_connected|google_error).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('ads')
    if (p === 'google_connected') { setGads((g) => ({ ...g, connected: true })); cleanUrl() }
    else if (p === 'google_error') { setPushMsg({ id: '_', ok: false, text: 'Google connection failed — check your OAuth setup.' }); cleanUrl() }
  }, [])
  function cleanUrl() { window.history.replaceState({}, '', window.location.pathname) }

  function setGa(patch) { updateSettings({ googleAds: { ...ga, ...patch } }) }

  async function handlePush(c) {
    if (!ga.customerId) { setPushMsg({ id: c.id, ok: false, text: 'Enter your Google Ads customer ID first.' }); return }
    setPushingId(c.id); setPushMsg(null)
    try {
      const space = spaces.find((s) => s.id === c.spaceId)
      const finalUrl = space?.publishedToWeb ? 'https://www.hexahub.com.au/units' : 'https://www.hexahub.com.au'
      const r = await pushToGoogleAds({ campaignId: c.id, customerId: ga.customerId, loginCustomerId: ga.loginCustomerId, finalUrl })
      updateCampaign(c.id, { googleAds: { pushedAt: new Date().toISOString(), customerId: ga.customerId, resourceName: r.campaignResourceName, status: 'paused' } })
      setPushMsg({ id: c.id, ok: true, text: `Pushed (paused): ${r.adGroups} ad groups, ${r.adsCreated} ads, ${r.keywordsCreated} keywords.` })
    } catch (e) {
      setPushMsg({ id: c.id, ok: false, text: e.message })
    } finally {
      setPushingId(null)
    }
  }

  const STATUS = {
    draft: 'bg-gray-100 text-gray-600', active: 'bg-green-50 text-green-700',
    paused: 'bg-amber-50 text-amber-700', ended: 'bg-gray-100 text-gray-400',
  }
  return (
    <div>
      {/* Google Ads connection bar */}
      <div className="bg-white border border-gray-200 rounded-md p-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${gads.connected ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-sm font-medium text-gray-800">Google Ads</span>
          <span className="text-xs text-gray-400">{gads.connected ? 'Connected' : gads.configured ? 'Not connected' : 'Not configured'}</span>
        </div>
        {gads.connected && (
          <div className="flex items-center gap-2">
            <input value={ga.customerId ?? ''} onChange={(e) => setGa({ customerId: e.target.value })}
              placeholder="Customer ID 123-456-7890" className="border border-gray-200 rounded px-2 py-1 text-xs w-44 focus:outline-none focus:ring-1 focus:ring-black" />
            <input value={ga.loginCustomerId ?? ''} onChange={(e) => setGa({ loginCustomerId: e.target.value })}
              placeholder="Manager ID (optional)" className="border border-gray-200 rounded px-2 py-1 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-black" />
          </div>
        )}
        <div className="ml-auto">
          {gads.connected ? (
            <button onClick={connectGoogleAds} className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1"><Plug size={12} /> Reconnect</button>
          ) : (
            <button onClick={connectGoogleAds} disabled={!gads.configured}
              className="flex items-center gap-1.5 text-xs font-medium bg-black text-white px-3 py-1.5 rounded-md hover:bg-gray-800 disabled:opacity-40">
              <Plug size={12} /> Connect Google Ads
            </button>
          )}
        </div>
        {!gads.configured && (
          <p className="w-full text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            Server credentials missing — set GOOGLE_OAUTH_CLIENT_ID / SECRET and GOOGLE_ADS_DEVELOPER_TOKEN in Vercel.
          </p>
        )}
        {pushMsg?.id === '_' && (
          <p className="w-full text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{pushMsg.text}</p>
        )}
      </div>

      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{campaigns.length} campaign{campaigns.length === 1 ? '' : 's'}</p>
        <div className="flex items-center gap-2">
          {gads.connected && (
            <button onClick={onData} className="flex items-center gap-2 border border-gray-300 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50">
              <BarChart2 size={15} /> Account data
            </button>
          )}
          <button onClick={onKeywords} className="flex items-center gap-2 border border-gray-300 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50">
            <Search size={15} /> Keyword research
          </button>
          <button onClick={onNew} className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800">
            <Plus size={15} /> New Campaign
          </button>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-md p-12 text-center">
          <Rocket size={26} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">No campaigns yet. Generate your first Meta or Google campaign.</p>
          <button onClick={onNew} className="mt-4 text-sm font-medium text-black underline">Create a campaign →</button>
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => {
            const open = openId === c.id
            const cpl = c.leads > 0 ? c.spend / c.leads : 0
            return (
              <div key={c.id} className="bg-white border border-gray-200 rounded-md overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => setOpenId(open ? null : c.id)} className="text-gray-400">
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{c.name}</div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 capitalize">{c.platform}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 capitalize">{c.objective}</span>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500">
                    <span>Spend <input type="number" value={c.spend ?? 0} onChange={(e) => updateCampaign(c.id, { spend: Number(e.target.value) })}
                      className="w-20 border border-gray-200 rounded px-1.5 py-0.5 ml-1" /></span>
                    <span>Leads <input type="number" value={c.leads ?? 0} onChange={(e) => updateCampaign(c.id, { leads: Number(e.target.value) })}
                      className="w-14 border border-gray-200 rounded px-1.5 py-0.5 ml-1" /></span>
                    <span className="font-medium text-gray-700">{cpl > 0 ? `${fmt$(cpl)}/lead` : '—'}</span>
                  </div>
                  {gads.connected && (
                    c.googleAds?.pushedAt ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 font-medium" title={`Pushed ${new Date(c.googleAds.pushedAt).toLocaleDateString('en-AU')}`}>
                        <CheckCircle2 size={12} /> In Google (paused)
                      </span>
                    ) : (
                      <button onClick={() => handlePush(c)} disabled={pushingId === c.id}
                        className="flex items-center gap-1 text-xs font-medium border border-gray-200 px-2.5 py-1.5 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                        {pushingId === c.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Push
                      </button>
                    )
                  )}
                  <select value={c.status ?? 'draft'} onChange={(e) => updateCampaign(c.id, { status: e.target.value })}
                    className={`text-xs rounded px-2 py-1 capitalize border-0 ${STATUS[c.status] ?? STATUS.draft}`}>
                    {['draft', 'active', 'paused', 'ended'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => { if (window.confirm('Delete this campaign?')) deleteCampaign(c.id) }}
                    className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
                {pushMsg?.id === c.id && (
                  <div className={`px-4 pb-3 text-xs ${pushMsg.ok ? 'text-green-700' : 'text-red-700'}`}>{pushMsg.text}</div>
                )}
                {open && c.campaign && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50/50">
                    <CampaignView campaign={c.campaign} research={c.research} math={c.math} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── New-campaign wizard ───────────────────────────────────────────────────────
function Wizard({ spaces, settings, addCampaign, onDone }) {
  const [step, setStep] = useState(0)
  const vacant = spaces.filter((s) => s.status === 'vacant')
  const [brief, setBrief] = useState({ objective: 'leads', platform: 'both', spaceId: '', monthlyBudget: 1500, targetCpa: '', audienceNotes: '' })
  const [research, setResearch] = useState('')
  const [campaign, setCampaign] = useState(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const space = spaces.find((s) => s.id === brief.spaceId) ?? null
  const [math, setMath] = useState({ cpc: 3.5, convRate: 4, closeRate: 20, leaseValue: 0, leaseMonths: 12 })

  const payload = () => ({
    platform: brief.platform, objective: brief.objective, monthlyBudget: brief.monthlyBudget,
    targetCpa: brief.targetCpa || undefined, space, company: settings.company, audienceNotes: brief.audienceNotes,
  })

  async function run(fn, after) {
    setLoading(true); setError('')
    try { await fn() ; after?.() } catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  const doResearch = () => run(async () => setResearch(await generateAdResearch(payload())), () => setStep(1))
  const doCampaign = () => run(async () => {
    const c = await generateAdCampaign({ ...payload(), research })
    setCampaign(c); setName(c.campaignName || `${space?.unitNumber ?? 'HexaHub'} campaign`)
  }, () => setStep(2))

  function goMath() {
    setMath((m) => ({ ...m, leaseValue: space?.monthlyRate ?? m.leaseValue }))
    setStep(3)
  }
  const results = computeAdsMath({ monthlyBudget: brief.monthlyBudget, ...math })

  function save() {
    addCampaign({
      name: name || 'Untitled campaign', platform: brief.platform, objective: brief.objective,
      monthlyBudget: Number(brief.monthlyBudget) || 0, targetCpa: brief.targetCpa || null,
      spaceId: brief.spaceId || null, research, campaign, math: { inputs: math, results },
    })
    onDone()
  }

  return (
    <div>
      {/* Stepper */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 text-xs font-medium ${i === step ? 'text-black' : i < step ? 'text-gray-500' : 'text-gray-300'}`}>
                <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${i === step ? 'bg-black text-white' : i < step ? 'bg-gray-200 text-gray-600' : 'bg-gray-100 text-gray-400'}`}>
                  {i < step ? <Check size={11} /> : i + 1}
                </span>
                {s}
              </div>
              {i < STEPS.length - 1 && <div className="w-6 h-px bg-gray-200" />}
            </div>
          ))}
        </div>
        <button onClick={onDone} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 text-xs text-red-700 flex gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* Step 0 — Brief */}
      {step === 0 && (
        <div className="bg-white border border-gray-200 rounded-md p-6 max-w-2xl">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Target size={16} /> Campaign brief</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Objective">
              <select value={brief.objective} onChange={(e) => setBrief({ ...brief, objective: e.target.value })} className={input}>
                {OBJECTIVES.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Platform">
              <select value={brief.platform} onChange={(e) => setBrief({ ...brief, platform: e.target.value })} className={input}>
                {PLATFORMS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Space to promote">
              <select value={brief.spaceId} onChange={(e) => setBrief({ ...brief, spaceId: e.target.value })} className={input}>
                <option value="">— General / available spaces —</option>
                {vacant.map((s) => <option key={s.id} value={s.id}>{s.unitNumber} — {s.address ?? s.type}</option>)}
              </select>
            </Field>
            <Field label="Monthly budget ($)">
              <input type="number" value={brief.monthlyBudget} onChange={(e) => setBrief({ ...brief, monthlyBudget: e.target.value })} className={input} />
            </Field>
            <Field label="Target cost/lead ($, optional)">
              <input type="number" value={brief.targetCpa} onChange={(e) => setBrief({ ...brief, targetCpa: e.target.value })} className={input} />
            </Field>
            <div className="col-span-2">
              <Field label="Audience notes (optional)">
                <textarea rows={2} value={brief.audienceNotes} onChange={(e) => setBrief({ ...brief, audienceNotes: e.target.value })}
                  placeholder="e.g. target e-commerce & 3PL operators needing fulfilment space" className={`${input} resize-none`} />
              </Field>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={doResearch} disabled={loading}
              className="flex items-center gap-2 bg-black text-white px-4 py-2.5 rounded-md text-sm font-semibold hover:bg-gray-800 disabled:opacity-40">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Generate research
            </button>
            <button onClick={doCampaign} disabled={loading}
              className="flex items-center gap-2 border border-gray-300 px-4 py-2.5 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-40">
              <Sparkles size={15} /> Skip to campaign
            </button>
          </div>
        </div>
      )}

      {/* Step 1 — Research */}
      {step === 1 && (
        <div className="bg-white border border-gray-200 rounded-md p-6">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Search size={16} /> Research <span className="text-xs font-normal text-gray-400">(editable — tweak before generating the campaign)</span></h3>
          <textarea value={research} onChange={(e) => setResearch(e.target.value)} rows={16}
            className="w-full border border-gray-200 rounded-md p-4 text-sm text-gray-800 font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-black" />
          <StepNav onBack={() => setStep(0)} loading={loading}
            onNext={doCampaign} nextLabel="Generate campaign" nextIcon={Sparkles}
            secondary={<button onClick={doResearch} disabled={loading} className="text-xs text-gray-500 hover:text-black flex items-center gap-1"><Search size={12} /> Regenerate research</button>} />
        </div>
      )}

      {/* Step 2 — Campaign */}
      {step === 2 && campaign && (
        <div>
          <CampaignView campaign={campaign} />
          <div className="bg-white border border-gray-200 rounded-md p-4 mt-3">
            <StepNav onBack={() => setStep(1)} loading={loading}
              onNext={goMath} nextLabel="Projections & math" nextIcon={Calculator}
              secondary={<button onClick={doCampaign} disabled={loading} className="text-xs text-gray-500 hover:text-black flex items-center gap-1">{loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Regenerate campaign</button>} />
          </div>
        </div>
      )}

      {/* Step 3 — Math */}
      {step === 3 && (
        <div className="bg-white border border-gray-200 rounded-md p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Calculator size={16} /> Projections</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Avg cost per click ($)"><input type="number" step="0.1" value={math.cpc} onChange={(e) => setMath({ ...math, cpc: e.target.value })} className={input} /></Field>
              <Field label="Lead conv. rate (%)"><input type="number" value={math.convRate} onChange={(e) => setMath({ ...math, convRate: e.target.value })} className={input} /></Field>
              <Field label="Lead → lease close (%)"><input type="number" value={math.closeRate} onChange={(e) => setMath({ ...math, closeRate: e.target.value })} className={input} /></Field>
              <Field label="Monthly rent ($)"><input type="number" value={math.leaseValue} onChange={(e) => setMath({ ...math, leaseValue: e.target.value })} className={input} /></Field>
              <Field label="Lease length (months)"><input type="number" value={math.leaseMonths} onChange={(e) => setMath({ ...math, leaseMonths: e.target.value })} className={input} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Est. clicks / mo" value={results.clicks} />
              <Metric label="Est. leads / mo" value={results.leads} />
              <Metric label="Cost / lead" value={fmt$(results.cpl)} highlight />
              <Metric label="Cost / signed lease" value={fmt$(results.cpa)} />
              <Metric label="Lease value (LTV)" value={fmt$(results.ltv)} />
              <Metric label="ROAS" value={`${results.roas}×`} highlight />
              <Metric label="LTV : CAC" value={`${results.ltvCac}:1`} />
              <Metric label="Break-even wins" value={results.breakEvenWins} />
            </div>
          </div>
          <StepNav onBack={() => setStep(2)} onNext={() => setStep(4)} nextLabel="Review & save" nextIcon={Save} />
        </div>
      )}

      {/* Step 4 — Save */}
      {step === 4 && (
        <div className="bg-white border border-gray-200 rounded-md p-6 max-w-xl">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Save size={16} /> Save campaign</h3>
          <Field label="Campaign name">
            <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
          </Field>
          <div className="mt-4 text-sm text-gray-500 space-y-1">
            <div>Platform: <span className="text-gray-800 capitalize">{brief.platform}</span> · Objective: <span className="text-gray-800 capitalize">{brief.objective}</span></div>
            <div>Budget: <span className="text-gray-800">{fmt$(brief.monthlyBudget)}/mo</span> · Projected: <span className="text-gray-800">{results.leads} leads/mo at {fmt$(results.cpl)}/lead</span></div>
          </div>
          <StepNav onBack={() => setStep(3)} onNext={save} nextLabel="Save campaign" nextIcon={Save} />
        </div>
      )}
    </div>
  )
}

// ── Shared bits ───────────────────────────────────────────────────────────────
function Field({ label, children }) {
  return <div><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>{children}</div>
}
function Metric({ label, value, highlight }) {
  return (
    <div className={`rounded-md p-3 border ${highlight ? 'bg-black text-white border-black' : 'bg-gray-50 border-gray-200'}`}>
      <div className={`text-xs ${highlight ? 'text-gray-300' : 'text-gray-500'}`}>{label}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
    </div>
  )
}
function StepNav({ onBack, onNext, nextLabel, nextIcon: Icon, loading, secondary }) {
  return (
    <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-black"><ArrowLeft size={14} /> Back</button>
      <div className="flex items-center gap-4">
        {secondary}
        <button onClick={onNext} disabled={loading}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-gray-800 disabled:opacity-40">
          {loading ? <Loader2 size={15} className="animate-spin" /> : Icon ? <Icon size={15} /> : null} {nextLabel} <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Structured campaign renderer (the showpiece) ──────────────────────────────
function CampaignView({ campaign, research }) {
  const [copiedKey, setCopiedKey] = useState(null)
  function copyAd(key, ad) {
    const text = [ad.headline, ad.longHeadline, ad.description, ad.primaryText, ad.cta && `CTA: ${ad.cta}`].filter(Boolean).join('\n')
    navigator.clipboard.writeText(text).then(() => { setCopiedKey(key); setTimeout(() => setCopiedKey(null), 1500) })
  }
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-md p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{campaign.campaignName}</h3>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <Badge icon={Megaphone}>{campaign.platform}</Badge>
              <Badge icon={Target}>{campaign.objective}</Badge>
              <Badge icon={DollarSign}>{fmt$(campaign.recommendedDailyBudget)}/day</Badge>
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-3"><span className="font-medium text-gray-800">Bidding:</span> {campaign.biddingStrategy}</p>
        {campaign.trackingNotes && <p className="text-xs text-gray-500 mt-1"><span className="font-medium">Tracking:</span> {campaign.trackingNotes}</p>}
      </div>

      {/* Audiences */}
      {campaign.audiences?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-md p-5">
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Users size={13} /> Audiences</h4>
          <div className="grid sm:grid-cols-2 gap-2">
            {campaign.audiences.map((a, i) => (
              <div key={i} className="border border-gray-100 rounded-md p-3 bg-gray-50/50">
                <div className="text-sm font-semibold text-gray-900">{a.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{a.targeting}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ad groups */}
      {campaign.adGroups?.map((g, gi) => (
        <div key={gi} className="bg-white border border-gray-200 rounded-md p-5">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-bold text-gray-900">{g.name}</h4>
            <span className="text-xs text-gray-400">{g.ads?.length ?? 0} ads</span>
          </div>
          {g.theme && <p className="text-xs text-gray-500 mb-3">{g.theme}</p>}
          {g.keywords?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {g.keywords.map((k, ki) => (
                <span key={ki} className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 flex items-center gap-1"><Tag size={10} /> {k}</span>
              ))}
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-3">
            {g.ads?.map((ad, ai) => {
              const key = `${gi}-${ai}`
              return (
                <div key={ai} className="border border-gray-200 rounded-md p-3 relative group">
                  <button onClick={() => copyAd(key, ad)} className="absolute top-2 right-2 text-gray-300 hover:text-black">
                    {copiedKey === key ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                  <div className="text-sm font-semibold text-gray-900 pr-6">{ad.headline}</div>
                  {ad.longHeadline && <div className="text-xs text-gray-600 mt-0.5">{ad.longHeadline}</div>}
                  {ad.primaryText && <p className="text-xs text-gray-600 mt-2">{ad.primaryText}</p>}
                  {ad.description && <p className="text-xs text-gray-500 mt-2">{ad.description}</p>}
                  {ad.cta && <span className="inline-block mt-2 text-xs font-semibold bg-gray-900 text-white px-2.5 py-1 rounded">{ad.cta}</span>}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {research && (
        <details className="bg-white border border-gray-200 rounded-md p-4">
          <summary className="text-xs font-semibold text-gray-600 cursor-pointer">View research</summary>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono mt-3">{research}</pre>
        </details>
      )}
    </div>
  )
}

function Badge({ icon: Icon, children }) {
  return <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 capitalize flex items-center gap-1"><Icon size={11} /> {children}</span>
}
