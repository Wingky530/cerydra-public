import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import AnimeCard from './AnimeCard';
import AnimeGridSkeleton from './AnimeGridSkeleton';

export default function SeasonalAnime() {
  const month = new Date().getMonth();
  let currentSeason = 'WINTER';
  if (month >= 3 && month <= 5) currentSeason = 'SPRING';
  else if (month >= 6 && month <= 8) currentSeason = 'SUMMER';
  else if (month >= 9 && month <= 11) currentSeason = 'FALL';
  
  const currentYear = new Date().getFullYear();

  const { data, isPending, isError } = useQuery<any[]>({
    queryKey: [`${currentSeason}-${currentYear}-anilist`],
    queryFn: async ({ signal }) => {
      const query = `
        query ($season: MediaSeason, $seasonYear: Int) {
          Page(page: 1, perPage: 12) {
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
            }
          }
        }
      `;
      const res = await fetch('/api/anime/ani-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { season: currentSeason, seasonYear: currentYear } }),
        signal,
      });
      if (!res.ok) throw new Error('Failed to fetch from AniList');
      const json = await res.json();
      const mediaList = json?.data?.Page?.media || [];
      const uniqueMedia = Array.from(new Map(mediaList.map((m: any) => [m.idMal || m.id, m])).values());

      return uniqueMedia.map((m: any) => {
        let episodeText: string | undefined;
        if (m.episodes) {
          episodeText = `${m.episodes} Episode`;
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
        };
      });
    },
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (mounted && isError && (!data || data.length === 0)) {
    return (
      <div className="mb-8 px-2">
        <h2 className="text-[22px] font-black mb-4 text-[var(--md-sys-color-on-surface)] tracking-wide uppercase">{currentSeason} {currentYear}</h2>
        <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm">Couldn't load seasonal anime.</p>
      </div>
    );
  }

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
          VIEW ALL ➔
        </a>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 px-2">
        {(isPending || !mounted) ? (
          <div className="col-span-full">
            <AnimeGridSkeleton count={12} />
          </div>
        ) : data?.map((anime: any) => (
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
      </div>
    </div>
  );
}
