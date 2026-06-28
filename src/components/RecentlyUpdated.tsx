import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import AnimeCard from './AnimeCard'
import { getAnimeUrl } from '../lib/routing'

interface RecentEntry {
  id: string
  title: string
  thumbnail: string | null
  episode: number | null
  updatedAt: number | null
  score: number | null
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() / 1000) - ts)
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function RecentlyUpdated() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { data: entries, isPending } = useQuery<RecentEntry[]>({
    queryKey: ['recently-updated'],
    queryFn: async () => {
      const res = await fetch('/api/anime/recent-updates')
      if (!res.ok) return []
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  if (!mounted) return null
  if (!isPending && (!entries || entries.length === 0)) return null

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4 px-2">
        <h2 className="text-[22px] font-black text-[var(--md-sys-color-on-surface)] tracking-wide">
          RECENTLY UPDATED
        </h2>
      </div>

      <div className="flex gap-4 overflow-x-auto px-2 pb-4 scrollbar-hide snap-x">
        {isPending
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-none w-[140px] md:w-[160px] animate-pulse">
                <div className="w-full aspect-[2/3] rounded-xl bg-[var(--md-sys-color-surface-container-high)]" />
              </div>
            ))
          : entries?.map(entry => (
              <div key={entry.id} className="flex-none w-[140px] md:w-[160px] snap-start">
                <AnimeCard
                  id={entry.id}
                  name={entry.title}
                  thumbnail={entry.thumbnail || ''}
                  episodeText={entry.episode ? `Ep ${entry.episode}` : undefined}
                  showEpisode={!!entry.episode}
                  showRating={false}
                  showPopularity={false}
                  statusLabel={entry.updatedAt ? timeAgo(entry.updatedAt) : undefined}
                  href={getAnimeUrl(entry.id, entry.title)}
                />
              </div>
            ))
        }
      </div>
    </div>
  )
}
