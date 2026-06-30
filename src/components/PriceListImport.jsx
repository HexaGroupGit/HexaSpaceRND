import { useState } from 'react'
import { X, Upload, Loader2, FileText, CheckCircle2, AlertCircle, Plus, RefreshCw } from 'lucide-react'
import { parsePriceList } from '../lib/pricelist.js'
import { publishListing } from '../lib/sanity.js'

const STATUS_PILL = {
  vacant: 'bg-green-50 text-green-700', occupied: 'bg-gray-100 text-gray-600', reserved: 'bg-orange-50 text-orange-700',
}
const norm = (s) => String(s ?? '').trim().toUpperCase()
// Storage units have no Lot code in the PDF — match them by the "NN/NN" address token.
const addrKey = (a) => { const m = String(a ?? '').match(/(\d+)\s*\/\s*(\d+)/); return m ? `${m[1]}/${m[2]}` : '' }
const COMPARE = ['monthlyRate', 'status', 'size', 'cars', 'attributes']

export default function PriceListImport({ store, onClose }) {
  const { spaces = [], addSpace, updateSpace } = store
  const [stage, setStage] = useState('upload') // upload | review | done
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])         // [{ kind, unit, existing, changes }]
  const [markMissing, setMarkMissing] = useState(false)
  const [publishNew, setPublishNew] = useState(true)
  const [missing, setMissing] = useState([])
  const [result, setResult] = useState(null)

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.type !== 'application/pdf') { setError('Please choose a PDF.'); return }
    setLoading(true); setError('')
    try {
      const units = await parsePriceList(file)
      reconcile(units)
      setStage('review')
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  function reconcile(units) {
    const byNum = new Map(spaces.map((s) => [norm(s.unitNumber), s]))
    const byAddr = new Map(spaces.filter((s) => addrKey(s.address)).map((s) => [addrKey(s.address), s]))
    const seenIds = new Set()
    const next = units.map((u) => {
      // Warehouses match by Lot; storage falls back to the address token.
      const existing = byNum.get(norm(u.unitNumber)) || (addrKey(u.address) && byAddr.get(addrKey(u.address)))
      if (!existing) return { kind: 'new', unit: u }
      seenIds.add(existing.id)
      const changes = {}
      for (const f of COMPARE) {
        if (u[f] != null && u[f] !== '' && String(u[f]) !== String(existing[f] ?? '')) changes[f] = u[f]
      }
      return { kind: Object.keys(changes).length ? 'updated' : 'unchanged', unit: u, existing, changes }
    })
    setRows(next)
    setMissing(spaces.filter((s) => !seenIds.has(s.id) && s.status !== 'occupied'))
  }

  function apply() {
    let added = 0, updated = 0, marked = 0, published = 0
    for (const r of rows) {
      if (r.kind === 'new') {
        const created = addSpace({
          unitNumber: r.unit.unitNumber, type: r.unit.type || 'warehouse', size: r.unit.size || '',
          monthlyRate: Number(r.unit.monthlyRate) || 0, status: r.unit.status || 'vacant',
          location: 'huntingdale', address: r.unit.address || '', cars: Number(r.unit.cars) || 0,
          attributes: r.unit.attributes || '',
        })
        added++
        // Auto-publish new available units to the website (data only — add photos in Sanity later).
        if (publishNew && created.status !== 'occupied') {
          published++
          publishListing(created)
            .then(() => updateSpace(created.id, { publishedToWeb: true, webSyncedAt: new Date().toISOString() }))
            .catch((e) => console.error('Auto-publish:', e))
        }
      } else if (r.kind === 'updated') {
        updateSpace(r.existing.id, r.changes)
        updated++
        // If this unit is published on the website, re-push so the live listing updates.
        const merged = { ...r.existing, ...r.changes }
        if (merged.publishedToWeb) publishListing(merged).catch((e) => console.error('Listing re-sync:', e))
      }
    }
    if (markMissing) {
      for (const s of missing) {
        updateSpace(s.id, { status: 'occupied' }); marked++
        if (s.publishedToWeb) publishListing({ ...s, status: 'occupied' }).catch((e) => console.error('Listing re-sync:', e))
      }
    }
    setResult({ added, updated, marked, published })
    setStage('done')
  }

  const newCount = rows.filter((r) => r.kind === 'new' && r.unit.status !== 'occupied').length

  const counts = rows.reduce((c, r) => ({ ...c, [r.kind]: (c[r.kind] || 0) + 1 }), {})

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-md w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><FileText size={16} /> Import lease price list</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 text-xs text-red-700 flex gap-2"><AlertCircle size={14} className="shrink-0 mt-0.5" /> {error}</div>}

          {stage === 'upload' && (
            <div className="text-center py-10">
              <FileText size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500 mb-1">Upload the weekly Found Huntingdale lease price list (PDF).</p>
              <p className="text-xs text-gray-400 mb-5">Claude reads it and shows you exactly what will change before anything is saved.</p>
              <label className="inline-flex items-center gap-2 bg-black text-white px-4 py-2.5 rounded-md text-sm font-semibold hover:bg-gray-800 cursor-pointer">
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} {loading ? 'Reading…' : 'Choose PDF'}
                <input type="file" accept="application/pdf" onChange={onFile} disabled={loading} className="hidden" />
              </label>
            </div>
          )}

          {stage === 'review' && (
            <div>
              <div className="flex flex-wrap gap-2 mb-4 text-xs">
                <Badge cls="bg-green-50 text-green-700">{counts.new || 0} new</Badge>
                <Badge cls="bg-blue-50 text-blue-700">{counts.updated || 0} updated</Badge>
                <Badge cls="bg-gray-100 text-gray-500">{counts.unchanged || 0} unchanged</Badge>
                {missing.length > 0 && <Badge cls="bg-amber-50 text-amber-700">{missing.length} not in this list</Badge>}
              </div>

              <div className="border border-gray-200 rounded-md overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-3 py-2 font-medium">Unit</th><th className="px-3 py-2 font-medium">Size</th>
                    <th className="px-3 py-2 font-medium">Rate /mo</th><th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium text-right">Change</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.filter((r) => r.kind !== 'unchanged').map((r, i) => (
                      <tr key={i} className={r.kind === 'new' ? 'bg-green-50/30' : r.kind === 'updated' ? 'bg-blue-50/30' : ''}>
                        <td className="px-3 py-2 font-medium text-gray-900">{r.unit.unitNumber}<div className="text-xs text-gray-400 capitalize">{r.unit.type}</div></td>
                        <td className="px-3 py-2 text-gray-600">{r.unit.size || '—'}</td>
                        <td className="px-3 py-2 text-gray-600">
                          {r.kind === 'updated' && r.changes.monthlyRate != null
                            ? <span><span className="line-through text-gray-300">${Number(r.existing.monthlyRate).toLocaleString('en-AU')}</span> ${Number(r.unit.monthlyRate).toLocaleString('en-AU')}</span>
                            : `$${Number(r.unit.monthlyRate || 0).toLocaleString('en-AU')}`}
                        </td>
                        <td className="px-3 py-2">
                          {r.kind === 'updated' && r.changes.status
                            ? <span className="text-xs"><span className={`px-1.5 py-0.5 rounded line-through opacity-50 ${STATUS_PILL[r.existing.status] ?? ''}`}>{r.existing.status}</span> → <span className={`px-1.5 py-0.5 rounded ${STATUS_PILL[r.unit.status] ?? ''}`}>{r.unit.status}</span></span>
                            : <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${STATUS_PILL[r.unit.status] ?? 'bg-gray-100 text-gray-600'}`}>{r.unit.status}</span>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.kind === 'new' ? <span className="text-xs text-green-700 flex items-center justify-end gap-1"><Plus size={11} /> New</span>
                            : <span className="text-xs text-blue-700 flex items-center justify-end gap-1"><RefreshCw size={11} /> {Object.keys(r.changes).join(', ')}</span>}
                        </td>
                      </tr>
                    ))}
                    {rows.filter((r) => r.kind !== 'unchanged').length === 0 && (
                      <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400 text-sm">Everything already matches — no changes.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2 mb-4">
                {newCount > 0 && (
                  <label className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={publishNew} onChange={(e) => setPublishNew(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300" />
                    <span>Publish the <strong>{newCount}</strong> new available unit{newCount === 1 ? '' : 's'} to the website now (data only — add photos in Sanity afterwards).</span>
                  </label>
                )}
                {missing.length > 0 && (
                  <label className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={markMissing} onChange={(e) => setMarkMissing(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300" />
                    <span>Mark the <strong>{missing.length}</strong> unit{missing.length === 1 ? '' : 's'} not on this list ({missing.map((s) => s.unitNumber).join(', ')}) as <strong>occupied</strong> (they may have been leased).</span>
                  </label>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={() => setStage('upload')} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50">Choose another</button>
                <button onClick={apply} className="px-4 py-2 text-sm bg-black text-white rounded-md hover:bg-gray-800 font-medium">
                  Apply {((counts.new || 0) + (counts.updated || 0)) || 0} change{((counts.new || 0) + (counts.updated || 0)) === 1 ? '' : 's'}
                </button>
              </div>
            </div>
          )}

          {stage === 'done' && (
            <div className="text-center py-10">
              <CheckCircle2 size={32} className="mx-auto text-green-500 mb-3" />
              <p className="text-sm text-gray-800 font-medium mb-1">Spaces updated.</p>
              <p className="text-xs text-gray-500">{result.added} added · {result.updated} updated{result.marked ? ` · ${result.marked} marked occupied` : ''}{result.published ? ` · ${result.published} published to website` : ''}.</p>
              <p className="text-xs text-gray-400 mt-3">Published units now reflect on the website. Add photos to any new ones in Sanity Studio.</p>
              <button onClick={onClose} className="mt-5 px-4 py-2 text-sm bg-black text-white rounded-md hover:bg-gray-800 font-medium">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Badge({ cls, children }) { return <span className={`px-2 py-0.5 rounded ${cls}`}>{children}</span> }
