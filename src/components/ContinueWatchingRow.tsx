import { useState, useEffect } from 'react';
import { useWatchHistory } from '../hooks/useWatchHistory';
import { getWatchUrl } from '../lib/routing';
import AnimeCard from './AnimeCard';
import { playerStore } from '../store/player';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

export default function ContinueWatchingRow() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { history, isLoading } = useWatchHistory();

  if (!mounted) return null;

  if (isLoading) {
    return (
      <SkeletonTheme baseColor="var(--md-sys-color-surface-container-high)" highlightColor="var(--md-sys-color-surface-variant)">
        <div className="mb-6">
          <h2 className="text-[22px] font-black mb-4 px-2 text-[var(--md-sys-color-on-surface)] tracking-wide">
            CONTINUE WATCHING
          </h2>
          <div className="flex gap-4 overflow-x-hidden px-2 pb-4">
            {[...Array(8)].map((_, i) => (
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

  const latestPerAnime = history.filter((entry, index, self) => 
    index === self.findIndex((e) => e.animeId === entry.animeId)
  ).slice(0, 8); // Limit to 8 cards

  if (latestPerAnime.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-[22px] font-black mb-4 px-2 text-[var(--md-sys-color-on-surface)] tracking-wide">
        CONTINUE WATCHING
      </h2>
      <div className="flex gap-4 overflow-x-auto px-2 pb-4 scrollbar-hide snap-x">
        {latestPerAnime.map(entry => {
          const progress = Math.min((entry.currentTime ?? entry.progressSeconds ?? 0) / (entry.duration || 1440) * 100, 100);
            
          return (
            <div key={`${entry.animeId}-${entry.episode}`} className="flex-none w-[140px] md:w-[160px] snap-start">
              <AnimeCard
                id={entry.animeId}
                name={entry.animeName}
                thumbnail={entry.thumbnail}
                onClick={async () => {
                  const state = playerStore.get();
                  if (state.isOpen && state.animeId !== entry.animeId) {
                    playerStore.setKey('isOpen', false);
                  }
                  const { navigate } = await import('astro:transitions/client');
                  navigate(getWatchUrl(entry.animeId, entry.episode, entry.animeName));
                }}
                progressPercent={progress}
                episodeText={`Ep. ${entry.episode}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
