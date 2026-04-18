import { useState } from 'react'
import { BADGES } from '../lib/constants'

// ── Single badge with tooltip ────────────────────────────────
function Badge({ badgeKey, size = 'md' }) {
  const [showTip, setShowTip] = useState(false)
  const config = BADGES[badgeKey]
  if (!config) return null

  const sizeClass = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-base'

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={e => { e.stopPropagation(); e.preventDefault(); setShowTip(v => !v) }}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        className={`${sizeClass} leading-none select-none`}
        aria-label={`${config.label} — ${config.description}`}
      >
        {config.emoji}
      </button>

      {showTip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 w-44 bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 shadow-xl text-center pointer-events-none">
          <p className="font-semibold text-white">{config.label}</p>
          <p className="text-gray-300 mt-0.5 leading-snug">{config.description}</p>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  )
}

// ── Badge list ───────────────────────────────────────────────
export function BadgeList({ badges, size = 'md', className = '' }) {
  if (!badges?.length) return null
  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {badges.map(b => <Badge key={b} badgeKey={b} size={size} />)}
    </div>
  )
}

export default BadgeList
