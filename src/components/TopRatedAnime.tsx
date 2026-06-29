import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import AnimeCard from './AnimeCard';
import { getAnimeUrl } from '../lib/routing';
import AnimeGridSkeleton from './AnimeGridSkeleton';

export default function TopRatedAnime() {
  const [page, setPage] = useState(1);

  const { data, isPending, isError } = useQuery<any[]>({
    queryKey: ['top-rated-anime', page],
    queryFn: async ({ signal }) => {
      const query = `
        query ($page: Int) {
          Page(page: $page, perPage: 50) {
            media(type: ANIME, sort: SCORE_DESC, isAdult: false, countryOfOrigin: "JP", format: TV) {
              id
              idMal
              title { english romaji native }
              coverImage { extraLarge }
              averageScore
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
        body: JSON.stringify({ query, variables: { page } }),
        signal,
      });
      if (!res.ok) throw new Error('Failed to fetch from AniList');
      const json = await res.json();
      const validMedia = json?.data?.Page?.media || [];
      const uniqueMedia = Array.from(new Map(validMedia.map((m: any) => [m.idMal || m.id, m])).values());

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
          episodeText,
        };
      });
    },
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  const [allAnime, setAllAnime] = useState<any[]>([]);
  const [visibleGridCount, setVisibleGridCount] = useState(12);

  useEffect(() => {
    if (data && data.length > 0) {
      setAllAnime(prev => {
        const currentIds = new Set(prev.map(d => d.mal_id));
        const isNewData = data.some((d: any) => !currentIds.has(d.mal_id));
        if (!isNewData) return prev;
        const combined = [...prev, ...data];
        return Array.from(new Map(combined.map(item => [item.mal_id, item])).values());
      });
    }
  }, [data]);

  const displayList = allAnime.length > 0 ? allAnime : (data || []);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const showSkeleton = isPending || !mounted;

  if (mounted && isError && displayList.length === 0) {
    return (
      <div className="mb-8 px-2">
        <h2 className="text-[22px] font-black mb-4 text-[var(--md-sys-color-on-surface)] tracking-wide uppercase">TOP RATED</h2>
        <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm">Couldn't load top rated anime.</p>
      </div>
    );
  }

  const top3 = displayList.slice(0, 3);
  const rest = displayList.slice(3, 3 + visibleGridCount);
  const hasTop3 = top3.length === 3;

  const handleLoadMore = () => {
    const newVisibleCount = visibleGridCount + 12;
    setVisibleGridCount(newVisibleCount);
    if (allAnime.length < newVisibleCount + 3 + 12) {
      setPage(p => p + 1);
    }
  };

  const handleNavigateBento = async (e: React.MouseEvent, anime: any) => {
    e.preventDefault();
    const { navigate } = await import('astro:transitions/client');
    navigate(getAnimeUrl(anime.anilist_id, anime.title_english || anime.title));
  };

  const BentoCard = ({ anime, rank, className }: { anime: any, rank: number, className: string }) => {
    const thumbnail = anime.images?.webp?.large_image_url || '';
    const proxiedThumb = thumbnail.includes('myanimelist') ? `https://wsrv.nl/?url=${encodeURIComponent(thumbnail)}` : thumbnail;
    
    return (
      <a 
        href={getAnimeUrl(anime.anilist_id, anime.title_english || anime.title)} 
        onClick={(e) => handleNavigateBento(e, anime)}
        className={`relative rounded-2xl group cursor-pointer bg-[var(--md-sys-color-background)] ring-1 ring-white/[0.06] ${className} outline-none focus-visible:ring-4 focus-visible:ring-[var(--md-sys-color-primary)]`}
      >
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          <img src={proxiedThumb} alt={anime.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        </div>
        <div className="absolute -inset-1 bg-gradient-to-t from-[var(--md-sys-color-background)] from-20% via-[var(--md-sys-color-background)]/80 via-60% to-transparent z-10 pointer-events-none" />
        <div className={`absolute top-3 left-3 md:top-4 md:left-4 flex items-center justify-center font-bold rounded-[8px] z-10 shadow-lg ${
          rank === 1 
            ? 'w-10 h-10 bg-amber-400 text-black text-[18px]' 
            : rank === 2
            ? 'w-9 h-9 bg-zinc-300 text-zinc-800 text-[15px]'
            : 'w-9 h-9 bg-amber-700 text-white text-[15px]'
        }`}>
          #{rank}
        </div>
        <div className="absolute bottom-3 left-3 right-3 md:bottom-4 md:left-4 md:right-4 z-10">
          <h3 className={`font-bold text-white line-clamp-2 drop-shadow-lg ${rank === 1 ? 'text-xl md:text-2xl' : 'text-sm sm:text-base md:text-2xl'}`}>{anime.title}</h3>
          <div className="flex items-center gap-3 mt-1.5 drop-shadow-md">
            {anime.score && (
              <div className="flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--md-sys-color-star)" stroke="var(--md-sys-color-star)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                <span className="text-white text-xs md:text-sm font-bold">{anime.score}</span>
              </div>
            )}
            <div className="flex items-center">
              <span className="text-white/80 text-[10px] md:text-xs font-semibold">{anime.episodeText || (anime.episodes ? `${anime.episodes} Episode` : 'Ongoing')}</span>
            </div>
          </div>
        </div>
      </a>
    );
  };

  return (
    <div className="mb-8">
      <h2 className="text-[22px] font-black mb-4 px-2 text-[var(--md-sys-color-on-surface)] tracking-wide uppercase">
        TOP RATED
      </h2>

      {hasTop3 && (
        <div className="mb-12 px-2">
          {/* Responsive Bento Grid */}
          <div className="grid grid-cols-2 grid-rows-3 md:grid-cols-4 md:grid-rows-2 gap-3 md:gap-4 h-[450px] sm:h-[550px] md:h-[400px] lg:h-[480px]">
            <BentoCard anime={top3[0]} rank={1} className="col-span-2 row-span-2 shadow-xl" />
            <BentoCard anime={top3[1]} rank={2} className="col-span-1 md:col-span-2 row-span-1 shadow-md" />
            <BentoCard anime={top3[2]} rank={3} className="col-span-1 md:col-span-2 row-span-1 shadow-md" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 px-2">
        {rest.map((anime: any) => (
          <AnimeCard
            key={anime.anilist_id}
            id={anime.anilist_id.toString()}
            name={anime.title}
            romajiTitle={anime.romajiTitle}
            nativeTitle={anime.nativeTitle}
            thumbnail={anime.images?.webp?.large_image_url}
            score={anime.score}
            episodeCount={anime.episodes}
            episodeText={anime.episodeText}
          />
        ))}
        {showSkeleton && (
          <div className="col-span-full">
            <AnimeGridSkeleton count={12} />
          </div>
        )}
      </div>

      {allAnime.length > 0 && (
        <div className="flex justify-center mt-10">
          <button 
            onClick={handleLoadMore} 
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
