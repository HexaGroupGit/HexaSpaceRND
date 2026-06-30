import { useState } from 'react'
import { X, Upload, Loader2, Trash2, ImageIcon } from 'lucide-react'
import { uploadListingImage } from '../lib/sanity.js'

// Mirrors the website's unit schema feature list exactly.
const FEATURES = [
  'Roller door access', 'Tilt door access', '24/7 secure access', '3-phase power',
  'Single-phase power', 'Mezzanine office', 'Balcony', 'Full floor office', 'Kitchenette',
  'Private bathroom', 'LED high-bay lighting', 'Polished concrete floors', 'NBN provision',
  '24hr CCTV', 'Drive through', 'Street frontage', 'The Hub access', 'Wireless keypad',
  'Split system A/C', 'District views',
]

export default function ListingEditor({ space, store, onClose }) {
  const { updateSpace } = store
  const [form, setForm] = useState(() => ({
    block: space.block ?? '',
    groundFloorM2: space.groundFloorM2 ?? '',
    firstFloorM2: space.firstFloorM2 ?? '',
    secondFloorM2: space.secondFloorM2 ?? '',
    powerSupply: space.powerSupply ?? '3-phase',
    accessHours: space.accessHours ?? '24/7',
    minimumTerm: space.minimumTerm ?? '12 months',
    bondAmount: space.bondAmount ?? '',
    features: space.features ?? [],
    description: space.description ?? '',
    photos: space.photos ?? [],
  }))
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  function toggleFeature(f) {
    setForm((p) => ({
      ...p,
      features: p.features.includes(f) ? p.features.filter((x) => x !== f) : [...p.features, f],
    }))
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    setUploading(true); setError('')
    try {
      for (const file of files) {
        const { assetId, url } = await uploadListingImage(file)
        setForm((p) => ({ ...p, photos: [...p.photos, { assetId, url, alt: '' }] }))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  function setAlt(i, alt) {
    setForm((p) => ({ ...p, photos: p.photos.map((ph, idx) => idx === i ? { ...ph, alt } : ph) }))
  }
  function removePhoto(i) {
    setForm((p) => ({ ...p, photos: p.photos.filter((_, idx) => idx !== i) }))
  }

  function handleSave() {
    const patch = {
      ...form,
      groundFloorM2: numOrNull(form.groundFloorM2),
      firstFloorM2: numOrNull(form.firstFloorM2),
      secondFloorM2: numOrNull(form.secondFloorM2),
      bondAmount: numOrNull(form.bondAmount),
    }
    updateSpace(space.id, patch)
    onClose()
  }

  const input = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-md w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-semibold text-gray-900">Listing details — {space.unitNumber}</h2>
            <p className="text-xs text-gray-500">Fills the public page on hexahub.com.au. Core specs (size, rate, parking, address) come from the unit itself.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Photos */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Photos</label>
              <label className="flex items-center gap-1.5 text-xs font-medium text-white bg-black px-3 py-1.5 rounded-md cursor-pointer hover:bg-gray-800">
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                {uploading ? 'Uploading…' : 'Upload images'}
                <input type="file" accept="image/*" multiple onChange={handleFiles} disabled={uploading} className="hidden" />
              </label>
            </div>
            {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
            {form.photos.length === 0 ? (
              <div className="border border-dashed border-gray-300 rounded-md p-6 text-center text-xs text-gray-400">
                <ImageIcon size={20} className="mx-auto mb-1.5 text-gray-300" />
                No photos yet. Images are resized and pushed to Sanity on upload.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {form.photos.map((p, i) => (
                  <div key={p.assetId} className="border border-gray-200 rounded-md overflow-hidden">
                    <img src={p.url} alt={p.alt} className="w-full h-24 object-cover" />
                    <div className="p-1.5 flex items-center gap-1">
                      <input value={p.alt} onChange={(e) => setAlt(i, e.target.value)} placeholder="Alt text"
                        className="flex-1 min-w-0 text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-black" />
                      <button onClick={() => removePhoto(i)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Floor breakdown + specs */}
          <section className="grid grid-cols-3 gap-4">
            <Field label="Block"><input value={form.block} onChange={(e) => setForm({ ...form, block: e.target.value })} placeholder="e.g. Block G" className={input} /></Field>
            <Field label="Ground floor (m²)"><input type="number" value={form.groundFloorM2} onChange={(e) => setForm({ ...form, groundFloorM2: e.target.value })} className={input} /></Field>
            <Field label="Mezzanine / 1st (m²)"><input type="number" value={form.firstFloorM2} onChange={(e) => setForm({ ...form, firstFloorM2: e.target.value })} className={input} /></Field>
            <Field label="Second floor (m²)"><input type="number" value={form.secondFloorM2} onChange={(e) => setForm({ ...form, secondFloorM2: e.target.value })} className={input} /></Field>
            <Field label="Power supply"><input value={form.powerSupply} onChange={(e) => setForm({ ...form, powerSupply: e.target.value })} placeholder="e.g. 3-phase" className={input} /></Field>
            <Field label="Access hours"><input value={form.accessHours} onChange={(e) => setForm({ ...form, accessHours: e.target.value })} className={input} /></Field>
            <Field label="Minimum term"><input value={form.minimumTerm} onChange={(e) => setForm({ ...form, minimumTerm: e.target.value })} className={input} /></Field>
            <Field label="Bond amount ($)"><input type="number" value={form.bondAmount} onChange={(e) => setForm({ ...form, bondAmount: e.target.value })} className={input} /></Field>
          </section>

          {/* Features */}
          <section>
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide block mb-2">Features</label>
            <div className="grid grid-cols-2 gap-1.5">
              {FEATURES.map((f) => (
                <label key={f} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={form.features.includes(f)} onChange={() => toggleFeature(f)} className="h-3.5 w-3.5 rounded border-gray-300" />
                  {f}
                </label>
              ))}
            </div>
          </section>

          {/* Description */}
          <section>
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide block mb-2">Description</label>
            <textarea value={form.description} rows={4} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Selling description shown on the listing page. One paragraph per line." className={`${input} resize-none`} />
          </section>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={uploading}
            className="px-4 py-2 text-sm bg-black text-white rounded-md hover:bg-gray-800 font-medium disabled:opacity-40">
            Save details
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

function numOrNull(v) {
  if (v === '' || v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
