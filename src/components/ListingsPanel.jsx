import { useState } from 'react'
import { Globe, Check, Loader2, Trash2, RefreshCw, AlertCircle, Image as ImageIcon, Pencil, Images } from 'lucide-react'
import { publishListing, deleteListing } from '../lib/sanity.js'
import ListingEditor from './ListingEditor.jsx'
import BulkPhotos from './BulkPhotos.jsx'

const STATUS_BADGE = {
  vacant:   'bg-green-50 text-green-700 border-green-200',
  occupied: 'bg-gray-100 text-gray-600 border-gray-200',
  reserved: 'bg-orange-50 text-orange-700 border-orange-200',
}

export default function ListingsPanel({ store }) {
  const { spaces = [], updateSpace } = store
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [editSpace, setEditSpace] = useState(null)
  const [bulk, setBulk] = useState(false)
  const [syncAll, setSyncAll] = useState(null) // { done, total } while running

  // Push every unit's current data/status to the website in one go.
  async function handleSyncAll() {
    if (!window.confirm(`Sync all ${spaces.length} units to the website? Available units show; occupied ones drop off.`)) return
    setError(''); setSyncAll({ done: 0, total: spaces.length })
    let done = 0
    for (const space of spaces) {
      try {
        await publishListing(space)
        if (space.status !== 'occupied' && !space.publishedToWeb) {
          updateSpace(space.id, { publishedToWeb: true, webSyncedAt: new Date().toISOString() })
        }
      } catch (e) {
        setError(`${space.unitNumber}: ${e.message}`)
      }
      done++; setSyncAll({ done, total: spaces.length })
    }
    setSyncAll(null)
  }

  async function handlePublish(space) {
    setBusyId(space.id); setError('')
    try {
      await publishListing(space)
      updateSpace(space.id, { publishedToWeb: true, webSyncedAt: new Date().toISOString() })
    } catch (e) {
      setError(`${space.unitNumber}: ${e.message}`)
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemove(space) {
    if (!window.confirm(`Remove ${space.unitNumber} from the website entirely? This deletes its listing (including any photos added in Sanity).`)) return
    setBusyId(space.id); setError('')
    try {
      await deleteListing(space)
      updateSpace(space.id, { publishedToWeb: false, webSyncedAt: null })
    } catch (e) {
      setError(`${space.unitNumber}: ${e.message}`)
    } finally {
      setBusyId(null)
    }
  }

  const sorted = [...spaces].sort((a, b) => (a.unitNumber ?? '').localeCompare(b.unitNumber ?? ''))

  return (
    <div>
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-5 text-xs text-blue-800 flex gap-2">
        <Globe size={15} className="shrink-0 mt-0.5" />
        <div>
          Publishing pushes a unit to <strong>hexahub.com.au</strong>. When a published unit is leased it
          automatically flips to <strong>Leased</strong> on the website. Photos &amp; descriptions are managed in Sanity and never overwritten.
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 text-xs text-red-700 flex gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <div className="flex justify-end gap-2 mb-3">
        <button onClick={() => setBulk(true)}
          className="flex items-center gap-2 border border-gray-300 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50">
          <Images size={15} /> Bulk add photos
        </button>
        <button onClick={handleSyncAll} disabled={!!syncAll}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
          {syncAll ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          {syncAll ? `Syncing ${syncAll.done}/${syncAll.total}…` : 'Sync all to website'}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-2.5 font-medium">Unit</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Rate</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Listing</th>
              <th className="px-4 py-2.5 font-medium">Website</th>
              <th className="px-4 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((space) => {
              const busy = busyId === space.id
              const published = !!space.publishedToWeb
              const photoCount = space.photos?.length ?? 0
              const featureCount = space.features?.length ?? 0
              return (
                <tr key={space.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{space.unitNumber}</div>
                    <div className="text-xs text-gray-400">{space.address ?? ''}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{space.type}</td>
                  <td className="px-4 py-3 text-gray-600">${space.monthlyRate?.toLocaleString('en-AU')}/mo</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded border capitalize ${STATUS_BADGE[space.status] ?? STATUS_BADGE.occupied}`}>
                      {space.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className={`flex items-center gap-1 ${photoCount ? 'text-gray-700' : 'text-gray-300'}`}><ImageIcon size={12} /> {photoCount}</span>
                      <span className={featureCount ? 'text-gray-700' : 'text-gray-300'}>· {featureCount} features</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {published ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><Check size={13} /> Published</span>
                    ) : (
                      <span className="text-xs text-gray-400">Not published</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditSpace(space)}
                        className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        onClick={() => handlePublish(space)} disabled={busy}
                        className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md bg-black text-white hover:bg-gray-800 disabled:opacity-40">
                        {busy ? <Loader2 size={12} className="animate-spin" /> : published ? <RefreshCw size={12} /> : <Globe size={12} />}
                        {published ? 'Update' : 'Publish'}
                      </button>
                      {published && (
                        <button
                          onClick={() => handleRemove(space)} disabled={busy}
                          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 disabled:opacity-40">
                          <Trash2 size={12} /> Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editSpace && (
        <ListingEditor space={editSpace} store={store} onClose={() => setEditSpace(null)} />
      )}
      {bulk && <BulkPhotos store={store} onClose={() => setBulk(false)} />}
    </div>
  )
}
