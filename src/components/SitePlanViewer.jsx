import { useState, useRef } from 'react'
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'

const PLANS = [
  {
    id: 'warehouses',
    label: 'Warehouses — Ground Level',
    src: '/floorplan-warehouses.png',
    description: 'Assembly Circuit · Foundry Court · Depot Court · Distribution Circuit',
  },
  {
    id: 'storage',
    label: 'Storage — 18 Logistic Court',
    src: '/floorplan-storage.png',
    description: '18 Logistic Court internal units · Logistic Court warehouse units',
  },
]

const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 2.5, 3]

export default function SitePlanViewer() {
  const [activePlan, setActivePlan] = useState('warehouses')
  const [zoom, setZoom] = useState(1)
  const [imgError, setImgError] = useState({})
  const scrollRef = useRef(null)

  const plan = PLANS.find((p) => p.id === activePlan)

  function zoomIn() {
    setZoom((z) => {
      const idx = ZOOM_STEPS.indexOf(z)
      return idx < ZOOM_STEPS.length - 1 ? ZOOM_STEPS[idx + 1] : z
    })
  }

  function zoomOut() {
    setZoom((z) => {
      const idx = ZOOM_STEPS.indexOf(z)
      return idx > 0 ? ZOOM_STEPS[idx - 1] : z
    })
  }

  function fitToView() {
    setZoom(1)
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, left: 0 })
    }
  }

  function handlePlanChange(id) {
    setActivePlan(id)
    setZoom(1)
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, left: 0 })
    }
  }

  return (
    <div>
      {/* Tabs + zoom controls */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {PLANS.map((p) => (
          <button
            key={p.id}
            onClick={() => handlePlanChange(p.id)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activePlan === p.id
                ? 'bg-black text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p.label}
          </button>
        ))}

        {/* Zoom controls */}
        <div className="ml-auto flex items-center gap-1 border border-gray-200 rounded-md overflow-hidden">
          <button
            onClick={zoomOut}
            disabled={zoom === ZOOM_STEPS[0]}
            className="px-2.5 py-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-xs text-gray-600 px-2 min-w-[42px] text-center font-medium">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={zoom === ZOOM_STEPS[ZOOM_STEPS.length - 1]}
            className="px-2.5 py-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={fitToView}
            className="px-2.5 py-1.5 hover:bg-gray-100 border-l border-gray-200 transition-colors"
            title="Fit to view"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* Description */}
      {plan && (
        <p className="text-xs text-gray-400 mb-3">{plan.description}</p>
      )}

      {/* Image container — scrollable */}
      <div
        ref={scrollRef}
        className="border border-gray-200 rounded-md overflow-auto bg-gray-100"
        style={{ maxHeight: '72vh' }}
      >
        {imgError[activePlan] ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="text-gray-400 mb-3">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="m9 9 6 6M15 9l-6 6" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">Floor plan image not found</p>
            <p className="text-xs text-gray-400 mt-2 max-w-sm">
              Save the image as{' '}
              <code className="bg-white border border-gray-200 px-1.5 py-0.5 rounded text-gray-800">
                public\{activePlan === 'warehouses' ? 'floorplan-warehouses.png' : 'floorplan-storage.png'}
              </code>{' '}
              in your project folder.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Full path:{' '}
              <code className="bg-white border border-gray-200 px-1.5 py-0.5 rounded text-gray-800">
                c:\Hexa-HubRND\public\{activePlan === 'warehouses' ? 'floorplan-warehouses.png' : 'floorplan-storage.png'}
              </code>
            </p>
          </div>
        ) : (
          <div
            style={{
              transformOrigin: 'top left',
              transform: `scale(${zoom})`,
              width: `${100 / zoom}%`,
              transition: 'transform 0.15s ease',
            }}
          >
            <img
              key={activePlan}
              src={plan?.src}
              alt={plan?.label}
              className="w-full h-auto block"
              onError={() => setImgError((prev) => ({ ...prev, [activePlan]: true }))}
              onLoad={() => setImgError((prev) => ({ ...prev, [activePlan]: false }))}
              draggable={false}
            />
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-2">
        Found Huntingdale Siteplan · 17-31 Franklyn Street, Huntingdale VIC 3166
      </p>
    </div>
  )
}
