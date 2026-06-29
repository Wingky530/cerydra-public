import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import AnimeCard from './AnimeCard';
import AnimeGridSkeleton from './AnimeGridSkeleton';

export default function UpcomingSeason() {
  const month = new Date().getMonth();
  let currentSeason = 'WINTER';
  if (month >= 3 && month <= 5) currentSeason = 'SPRING';
  else if (month >= 6 && month <= 8) currentSeason = 'SUMMER';
  else if (month >= 9 && month <= 11) currentSeason = 'FALL';

  const currentYear = new Date().getFullYear();
  const seasonOrder = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
  const currentIdx = seasonOrder.indexOf(currentSeason);
  const nextSeason = seasonOrder[(currentIdx + 1) % 4];
  const nextYear = nextSeason === 'WINTER' && currentIdx === 3 ? currentYear + 1 : currentYear;

  const { data, isPending, isError } = useQuery<any[]>({
    queryKey: [`upcoming-${nextSeason}-${nextYear}`],
    queryFn: async ({ signal }) => {
      const query = `
        query ($season: MediaSeason, $seasonYear: Int) {
          Page(page: 1, perPage: 12) {
            media(season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC, type: ANIME, isAdult: false, status: NOT_YET_RELEASED) {
              id
              idMal
              title { english romaji }
              coverImage { extraLarge }
              averageScore
              episodes
              genres
            }
          }
        }
      `;
      const res = await fetch('/api/anime/ani-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { season: nextSeason, seasonYear: nextYear } }),
        signal,
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      return (json?.data?.Page?.media || []).map((m: any) => ({
        anilist_id: m.id,
        mal_id: m.idMal || m.id,
        title: m.title.english || m.title.romaji,
        romajiTitle: m.title.romaji,
        images: { webp: { large_image_url: m.coverImage.extraLarge } },
        score: m.averageScore ? (m.averageScore / 10).toFixed(2) : null,
        episodes: m.episodes,
        genres: m.genres ? m.genres.slice(0, 3) : [],
        statusLabel: 'Upcoming',
      }));
    },
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const showSkeleton = isPending || !mounted;

  if (mounted && isError && (!data || data.length === 0)) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4 px-2">
        <h2 className="text-[22px] font-black text-[var(--md-sys-color-on-surface)] tracking-wide">
          UPCOMING
        </h2>
        <a
          href={`/seasonal?season=${nextSeason.toLowerCase()}&year=${nextYear}`}
          className="text-sm font-bold text-[var(--md-sys-color-primary)] hover:bg-white/5 px-3 py-1.5 rounded-full transition-colors uppercase tracking-wider"
        >
          VIEW ALL ➔
        </a>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 px-2">
        {showSkeleton ? (
          <div className="col-span-full">
            <AnimeGridSkeleton count={6} />
          </div>
        ) : data && data.length > 0 ? (
          data.map((anime: any) => (
            <AnimeCard
              key={anime.anilist_id}
              id={anime.anilist_id.toString()}
              name={anime.title}
              thumbnail={anime.images?.webp?.large_image_url || ''}
              score={anime.score}
              episodeCount={anime.episodes}
              showEpisode={false}
            />
          ))
        ) : (
          <p className="col-span-full text-center text-[var(--md-sys-color-on-surface-variant)] text-sm py-10">
            No upcoming anime announced yet.
          </p>
        )}
      </div>
    </div>
  );
}
