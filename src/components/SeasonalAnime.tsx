import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import AnimeCard from './AnimeCard';
import AnimeGridSkeleton from './AnimeGridSkeleton';

export default function SeasonalAnime() {
  const [page, setPage] = useState(1);

  const month = new Date().getMonth();
  let currentSeason = 'WINTER';
  if (month >= 3 && month <= 5) currentSeason = 'SPRING';
  else if (month >= 6 && month <= 8) currentSeason = 'SUMMER';
  else if (month >= 9 && month <= 11) currentSeason = 'FALL';
  
  const currentYear = new Date().getFullYear();

  const { data, isPending, isError } = useQuery<any[]>({
    queryKey: [`${currentSeason}-${currentYear}-anilist`, page],
    queryFn: async ({ signal }) => {
      const query = `
        query ($page: Int, $season: MediaSeason, $seasonYear: Int) {
          Page(page: $page, perPage: 12) {
            media(season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC, type: ANIME, isAdult: false, status_in: [RELEASING, FINISHED]) {
              id
              idMal
              title { english romaji native }
              coverImage { extraLarge }
              averageScore
              popularity
              genres
              episodes
              status
              nextAiringEpisode { episode }
            }
          }
        }
      `;
      const res = await fetch('/api/anime/ani-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { page, season: currentSeason, seasonYear: currentYear } }),
        signal,
      });
      if (!res.ok) throw new Error('Failed to fetch from AniList');
      const json = await res.json();
      const mediaList = json?.data?.Page?.media || [];
      const uniqueMedia = Array.from(new Map(mediaList.map((m: any) => [m.idMal || m.id, m])).values());

      const mapped = uniqueMedia.map((m: any) => {
        let episodeText: string | undefined;
        if (m.nextAiringEpisode) {
          const current = m.nextAiringEpisode.episode - 1;
          if (current > 0) {
            episodeText = `Ep ${current}`;
          } else {
            episodeText = 'Airing';
          }
        } else if (m.status === 'RELEASING') {
          episodeText = 'Ongoing';
        } else if (m.status === 'FINISHED') {
          episodeText = m.episodes ? `${m.episodes} Episode` : 'Completed';
        }

        return {
          anilist_id: m.id,
          mal_id: m.idMal || m.id,
          title: m.title.english || m.title.romaji,
          romajiTitle: m.title.romaji,
          nativeTitle: m.title.native,
          images: { webp: { large_image_url: m.coverImage.extraLarge } },
          score: m.averageScore ? (m.averageScore / 10).toFixed(2) : null,
          episodes: m.episodes,
          genres: m.genres ? m.genres.map((g: string) => ({ name: g })) : [],
          episodeText,
          statusLabel: m.status === 'RELEASING' ? 'Ongoing' : m.status === 'FINISHED' ? 'Completed' : undefined,
          statusSort: m.status === 'RELEASING' ? 0 : 1,
        };
      });

      return mapped;
    },
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  const [allAnime, setAllAnime] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);

  if (data && data.length > 0) {
    const newIds = new Set(data.map(d => d.mal_id));
    const currentIds = new Set(allAnime.map(d => d.mal_id));
    const isNewData = Array.from(newIds).some(id => !currentIds.has(id));
    
    if (isNewData) {
      setAllAnime(prev => {
        const combined = [...prev, ...data];
        return Array.from(new Map(combined.map(item => [item.mal_id, item])).values());
      });
    }
  }

  if (data && data.length === 0) {
    if (hasMore) setHasMore(false);
  }

  const displayList = allAnime.length > 0 ? allAnime : (data || []);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const showSkeleton = isPending || !mounted;

  if (mounted && isError && displayList.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4 px-2">
        <h2 className="text-[22px] font-black text-[var(--md-sys-color-on-surface)] tracking-wide uppercase">
          {currentSeason} {currentYear}
        </h2>
        <a 
          href="/seasonal" 
          className="text-sm font-bold text-[var(--md-sys-color-primary)] hover:bg-white/5 px-3 py-1.5 rounded-full transition-colors uppercase tracking-wider"
        >
          SEASONAL ➔
        </a>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 px-2">
        {displayList.map((anime: any, idx: number) => (
          <AnimeCard
            key={anime.anilist_id}
            id={anime.anilist_id.toString()}
            name={anime.title}
            romajiTitle={anime.romajiTitle}
            nativeTitle={anime.nativeTitle}
            thumbnail={anime.images?.webp?.large_image_url || ''}
            episodeCount={anime.episodes}
            score={anime.score}
            episodeText={anime.episodeText}
            statusLabel={anime.statusLabel}
          />
        ))}
        {showSkeleton && (
          <div className="col-span-full">
            <AnimeGridSkeleton count={12} />
          </div>
        )}
      </div>

      {displayList.length > 0 && hasMore && (
        <div className="flex justify-center mt-8">
          <button 
            onClick={() => setPage(p => p + 1)} 
            disabled={showSkeleton}
            className={`group flex items-center gap-2 transition-colors font-bold text-sm tracking-wide ${showSkeleton ? 'text-[var(--md-sys-color-on-surface-variant)]/50 cursor-not-allowed' : 'text-[var(--md-sys-color-primary)] hover:text-[var(--md-sys-color-primary)]/80'}`}
          >
            {showSkeleton ? 'LOADING...' : 'LOAD MORE'}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300 group-hover:translate-y-1"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
        </div>
      )}
    </div>
  );
}
