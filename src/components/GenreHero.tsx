import { useState, useEffect, useMemo } from 'react';
import { useDailySeededRandom } from '../hooks/useDailySeededRandom';
import { useQuery } from '@tanstack/react-query';
import { getBentoPicks } from '../lib/bentoLogic';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import { getAnimeUrl } from '../lib/routing';
import 'react-loading-skeleton/dist/skeleton.css';

const StarIcon = () => (
  <svg className="w-5 h-5 text-amber-400 drop-shadow-md" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
);

interface GenreHeroProps {
  genre: string;
  allAnimeData: any[];
  isPending: boolean;
}

export default function GenreHero({ genre, allAnimeData, isPending }: GenreHeroProps) {
  const [mounted, setMounted] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => setMounted(true), []);

  const { data: bentoData } = useQuery<any[]>({
    queryKey: ['bento-genres-daily', 'v2'],
    queryFn: async () => {
      const QUERY = `
        query($page: Int) {
          Page(page: $page, perPage: 50) {
            media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
              id
              idMal
              title { english romaji }
              coverImage { extraLarge }
              description
              averageScore
              episodes
              status
              genres
              tags { name }
            }
          }
        }
      `;
      const pages = await Promise.all(
        [1, 2, 3].map(page =>
          fetch('/api/anime/ani-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: QUERY, variables: { page } }),
          }).then(r => r.json())
        )
      );
      const seen = new Set<number>();
      return pages.flatMap(p => (p?.data?.Page?.media || [])).filter((m: any) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });

  const bentoHero = useMemo(() => {
    if (!bentoData) return null;
    let userId = typeof window !== 'undefined' ? localStorage.getItem('cerydra_user_id') : null;
    const picks = getBentoPicks(bentoData, userId || '0');
    return picks.get(genre.toLowerCase()) || picks.get(genre);
  }, [bentoData, genre]);

  const fallbackHero = useDailySeededRandom(allAnimeData || []);
  const heroAnime = bentoHero || fallbackHero;

  const getImageUrl = (url: string) => {
    if (!url) return '/favicon.svg';
    return url.includes('myanimelist') ? `https://wsrv.nl/?url=${encodeURIComponent(url)}` : url;
  };

  const title = heroAnime ? ((typeof heroAnime.title === 'string' ? heroAnime.title : (heroAnime.title?.english || heroAnime.title?.romaji)) || 'Unknown') : 'Unknown';

  const handleNavigate = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!heroAnime) return;

    setIsNavigating(true);
    try {
      const { navigate } = await import('astro:transitions/client');
      navigate(getAnimeUrl(heroAnime.id, title));
    } catch (err) {
      // ignore
    } finally {
      setIsNavigating(false);
    }
  };

  const showSkeleton = isPending || !mounted;

  if (showSkeleton) {
    return (
      <SkeletonTheme baseColor="var(--md-sys-color-surface-container-high)" highlightColor="var(--md-sys-color-surface-variant)">
        <div className="relative w-full h-[40vh] min-h-[300px] max-h-[450px] overflow-hidden bg-[var(--md-sys-color-surface-container-high)] flex items-end">
          <div className="max-w-7xl mx-auto w-full px-4 md:px-8 pb-6 md:pb-8 flex flex-row items-stretch justify-between gap-4 md:gap-8">
            <div className="flex-1 flex flex-col items-start justify-center gap-4 py-1">
              <Skeleton height={48} width="80%" className="max-w-[300px]" />
              <div className="flex gap-2">
                <Skeleton width={60} height={24} borderRadius={9999} />
                <Skeleton width={70} height={24} borderRadius={9999} />
              </div>
              <Skeleton count={2} width="90%" />
              <Skeleton width={120} height={40} borderRadius={9999} />
            </div>
            <div className="flex flex-col shrink-0 self-center w-[110px] sm:w-[140px] md:w-[180px] z-10">
              <Skeleton className="w-full aspect-[2/3] rounded-xl" />
            </div>
          </div>
        </div>
      </SkeletonTheme>
    );
  }

  if (!heroAnime) {
    return null;
  }

  const synopsis = heroAnime.description
    ? heroAnime.description.replace(/<[^>]*>?/gm, '').trim()
    : 'No description available.';
  const genres = heroAnime.genres || [];

  return (
    <div className="relative w-full h-[40vh] min-h-[300px] max-h-[450px] overflow-hidden group">
      {/* Background Poster */}
      <div className="absolute inset-0">
        <img
          src={getImageUrl(heroAnime.coverImage?.extraLarge || '')}
          alt=""
          className="w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-[10s] ease-out"
        />
        {/* Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--md-sys-color-background)] via-[var(--md-sys-color-background)]/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--md-sys-color-background)] via-[var(--md-sys-color-background)]/50 to-transparent md:w-3/4" />
      </div>

      {/* Content Area */}
      <div className="absolute inset-0 flex items-end">
        <div className="max-w-7xl mx-auto w-full px-4 md:px-8 pb-6 md:pb-8 flex flex-row items-stretch justify-between gap-4 md:gap-8">
          
          {/* Left Side: Typography */}
          <div className="flex-1 flex flex-col items-start justify-center text-left w-full md:max-w-[60%] py-1 relative z-10">
            <h1 className="text-xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white line-clamp-2 md:line-clamp-2 leading-tight tracking-tight drop-shadow-lg mb-1">
              {title}
            </h1>
            
            <div className="flex items-center gap-2 md:gap-3 flex-wrap drop-shadow-md mb-1">
              {heroAnime.averageScore && (
                <div className="flex items-center gap-1 text-white/90">
                  <StarIcon />
                  <span className="text-xs md:text-base font-bold">{(heroAnime.averageScore / 10).toFixed(1)}</span>
                </div>
              )}
              {heroAnime.episodes && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                  <span className="text-xs md:text-base font-medium text-white/80">
                    {heroAnime.episodes} Episodes
                  </span>
                </>
              )}
              {heroAnime.status && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                  <span className={`text-[10px] md:text-sm font-bold uppercase px-1.5 md:px-2 py-0.5 rounded ${
                    heroAnime.status === 'RELEASING' 
                      ? 'bg-[var(--md-sys-color-primary)]/90 text-[var(--md-sys-color-on-primary)]'
                      : 'bg-white/20 text-white'
                  }`}>
                    {heroAnime.status === 'RELEASING' ? 'Ongoing' : 'Finished'}
                  </span>
                </>
              )}
            </div>

            {/* Genre badges */}
            {genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 md:gap-2 mb-2">
                {genres.slice(0, 3).map((g: string, idx: number) => (
                  <span
                    key={idx}
                    className="text-[10px] md:text-xs font-bold px-2 md:px-3 py-0.5 md:py-1 bg-[var(--md-sys-color-surface-container)] text-white/90 rounded-full border border-white/10 shadow-sm"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}

            {/* Synopsis */}
            <p className="text-[11px] sm:text-xs md:text-sm text-white/70 line-clamp-2 leading-relaxed max-w-2xl drop-shadow-md mb-2">
              {synopsis}
            </p>

            {/* Watch button */}
            <div className="mt-1 flex gap-3">
              <a
                href={getAnimeUrl(heroAnime.id, title)}
                onClick={handleNavigate}
                className="inline-flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-2 md:py-2.5 bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] rounded-full font-black text-xs md:text-sm tracking-wide transition-all duration-300 hover:shadow-[0_4px_12px_var(--md-sys-color-primary)] hover:brightness-110 active:scale-95 group"
              >
                {isNavigating ? (
                  <>
                    <svg className="w-4 h-4 md:w-5 md:h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    LOADING...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    WATCH NOW
                  </>
                )}
              </a>
            </div>
          </div>

          {/* Right Side: Poster */}
          <div className="flex flex-col shrink-0 self-center w-[110px] sm:w-[140px] md:w-[180px] relative z-10 shadow-2xl ring-1 ring-white/10 rounded-xl overflow-hidden group/poster">
            <a
              href={getAnimeUrl(heroAnime.id, title)}
              onClick={handleNavigate}
              className="block relative w-full aspect-[2/3]"
            >
              <img
                src={getImageUrl(heroAnime.coverImage?.extraLarge || '')}
                alt={title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover/poster:scale-105"
              />
              <div className="absolute inset-0 bg-[var(--md-sys-color-on-surface)] opacity-0 group-hover/poster:opacity-[0.08] transition-opacity pointer-events-none" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
