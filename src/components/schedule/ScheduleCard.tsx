import { useState } from 'react'
import type { ScheduleEntry } from '../../lib/schedule/types'
import { getAnimeUrl } from '../../lib/routing'
import { formatWatchers } from '../../lib/schedule/normalizeSchedule'

const STATUS_CONFIG = {
  aired:   { label: 'Already Aired',       color: 'text-green-400',  dot: 'bg-green-400', bar: 'bg-green-400' },
  waiting: { label: 'Waiting for Update',   color: 'text-[var(--md-sys-color-on-surface-variant)]', dot: 'bg-[var(--md-sys-color-on-surface-variant)]', bar: 'bg-[var(--md-sys-color-on-surface-variant)]' },
  delayed: { label: 'Delayed / On Break / Ended', color: 'text-red-400', dot: 'bg-red-400', bar: 'bg-red-400' },
}

interface Props {
  entry: ScheduleEntry
}

export function ScheduleCard({ entry }: Props) {
  const [navigating, setNavigating] = useState(false)
  const cfg = STATUS_CONFIG[entry.status]

  const displayTime = entry.airing_timestamp
    ? new Date(entry.airing_timestamp * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
    : entry.air_time_jst ?? '--:--'

  const handleClick = async () => {
    if (navigating) return
    setNavigating(true)
    try {
      const { navigate } = await import('astro:transitions/client')
      navigate(getAnimeUrl(entry.anime_id, entry.title))
    } catch {
      // Fallback on network error
      const { navigate } = await import('astro:transitions/client')
      navigate(`/search?q=${encodeURIComponent(entry.title)}`)
    } finally {
      setNavigating(false)
    }
  }

  return (
    <div
      onClick={handleClick}
      className={`relative flex items-center gap-3 bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)] rounded-xl p-3 transition-all cursor-pointer overflow-hidden transform-gpu ${navigating ? 'opacity-50 pointer-events-none' : 'active:scale-[0.98]'}`}
    >
      {/* Status color bar — left edge */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${cfg.bar}`} />

      <div className="w-14 text-center shrink-0">
        <span className="text-sm font-semibold text-[var(--md-sys-color-on-background)] whitespace-nowrap">
          {displayTime}
        </span>
      </div>

      <div className="w-14 h-20 rounded-lg overflow-hidden shrink-0 bg-[var(--md-sys-color-background)]">
        {entry.cover_url ? (
          <img src={entry.cover_url} alt={entry.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-[var(--md-sys-color-surface-variant)]" />
        )}
      </div>

      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--md-sys-color-on-background)] truncate">
          {entry.title}
        </p>
        {entry.episode && (
          <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">Episode {entry.episode}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-[var(--md-sys-color-on-surface-variant)]">
          {entry.watchers && (
            <span className="flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              {formatWatchers(entry.watchers)}
            </span>
          )}
          {entry.score && (
            <span className="flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--md-sys-color-star)" stroke="var(--md-sys-color-star)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              {entry.score.toFixed(2)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
          <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
        </div>
      </div>
    </div>
  )
}
