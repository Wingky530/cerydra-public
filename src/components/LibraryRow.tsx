import { useState, useEffect } from 'react';
import { useLibrary } from '../hooks/useLibrary';
import AnimeCard from './AnimeCard';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { useQuery } from '@tanstack/react-query';
import { getAnimeUrl } from '../lib/routing';

export default function LibraryRow() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { entries } = useLibrary();

  // Ambil maksimal 8 library terbaru
  const latestEntries = [...entries].reverse().slice(0, 8);
  const entryIds = latestEntries.map(b => b.animeId);

  const { data: liveData, isPending } = useQuery({
    queryKey: ['library-live-status', entryIds],
    queryFn: async () => {
      if (entryIds.length === 0) return {};
      
      const query = `
        query($idIn: [Int]) {
          Page(page: 1, perPage: 8) {
            media(id_in: $idIn, type: ANIME) {
              id
              status
              episodes
            }
          }
        }
      `;
      
      const res = await fetch('/api/anime/ani-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { idIn: entryIds.map(Number) }
        }),
      });
      if (!res.ok) return {};
      const json = await res.json();
      
      // Map id to status/episodes
      const statusMap: Record<string, { status: string, episodes: number }> = {};
      json.data?.Page?.media?.forEach((m: any) => {
        statusMap[m.id.toString()] = {
          status: m.status,
          episodes: m.episodes
        };
      });
      return statusMap;
    },
    enabled: mounted && entryIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  if (!mounted || entries.length === 0) return null;

  if (isPending) {
    return (
      <SkeletonTheme baseColor="var(--md-sys-color-surface-container-high)" highlightColor="var(--md-sys-color-surface-variant)">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-[22px] font-black text-[var(--md-sys-color-on-surface)] tracking-wide">
              LIBRARY
            </h2>
          </div>
          <div className="flex gap-4 overflow-x-hidden px-2 pb-4">
            {[...Array(Math.min(entries.length, 8))].map((_, i) => (
              <div key={i} className="flex-none w-[140px] md:w-[160px]">
                <Skeleton className="aspect-[2/3] !rounded-[var(--md-sys-shape-corner-medium)]" />
                <div className="mt-2">
                  <Skeleton width="80%" />
                  <Skeleton width="50%" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </SkeletonTheme>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4 px-2">
        <h2 className="text-[22px] font-black text-[var(--md-sys-color-on-surface)] tracking-wide">
          LIBRARY
        </h2>
        {entries.length > 5 && (
          <a 
            href="/library" 
            className="text-sm font-bold text-[var(--md-sys-color-primary)] hover:bg-white/5 px-3 py-1.5 rounded-full transition-colors uppercase tracking-wider"
          >
            GO TO LIBRARY ➔
          </a>
        )}
      </div>
      <div className="flex gap-4 overflow-x-auto px-2 pb-4 scrollbar-hide snap-x">
        {/* We reverse the library array so the newest added are shown first */}
        {latestEntries.map(entry => {
          const liveInfo = liveData?.[entry.animeId];
          let episodeText: string | undefined;
          if (liveInfo) {
            if (liveInfo.episodes) {
              episodeText = `${liveInfo.episodes} Episode`;
            }
          }
          
          return (
            <div key={entry.animeId} className="flex-none w-[140px] md:w-[160px] snap-start">
              <AnimeCard
                id={entry.animeId}
                name={entry.englishName || entry.animeName}
                thumbnail={entry.thumbnail}
                href={getAnimeUrl(entry.anilistId || entry.animeId, entry.englishName || entry.animeName)}
                episodeText={episodeText}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
