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
        <div className="relative overflow-hidden rounded-2xl md:rounded-[var(--md-sys-shape-corner-large)] bg-[var(--md-sys-color-surface-container-high)] p-6 md:p-8 mb-10 flex flex-col md:flex-row gap-6 md:gap-8 items-stretch md:items-center mt-8">
          <div className="w-full md:w-auto md:flex-shrink-0">
            <Skeleton className="w-full md:w-[180px] aspect-[2/3] rounded-xl" />
          </div>
          <div className="flex-1 flex flex-col gap-4">
            <Skeleton height={48} width="80%" />
            <div className="flex gap-2">
              <Skeleton width={60} height={24} borderRadius={9999} />
              <Skeleton width={70} height={24} borderRadius={9999} />
            </div>
            <Skeleton count={3} />
            <Skeleton width={120} height={40} borderRadius={8} />
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
    <div className="relative w-full h-[55vh] md:h-[65vh] min-h-[450px] max-h-[700px] overflow-hidden group">
      {/* Background Poster */}
      <div className="absolute inset-0">
        <img
          src={getImageUrl(heroAnime.coverImage?.extraLarge || '')}
          alt=""
          className="w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-[10s] ease-out"
        />
        {/* Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--md-sys-color-background)] via-[var(--md-sys-color-background)]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--md-sys-color-background)] via-[var(--md-sys-color-background)]/50 to-transparent md:w-3/4" />
      </div>

      {/* Content Area */}
      <div className="absolute inset-0 flex items-end">
        <div className="max-w-7xl mx-auto w-full px-4 md:px-8 pb-8 md:pb-12 flex flex-col md:flex-row gap-6 md:gap-10 items-end">
          
          {/* Small Poster (Desktop Only) */}
          <div className="hidden md:block w-[180px] lg:w-[220px] flex-shrink-0 relative group/poster rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10">
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

          {/* Details */}
          <div className="flex-1 flex flex-col gap-3 md:gap-4 max-w-3xl relative z-10 pb-2 md:pb-4">
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white line-clamp-2 md:line-clamp-3 leading-tight tracking-tight drop-shadow-lg">
              {title}
            </h1>
            
            <div className="flex items-center gap-3 flex-wrap drop-shadow-md">
              {heroAnime.averageScore && (
                <div className="flex items-center gap-1 text-white/90">
                  <StarIcon />
                  <span className="text-sm md:text-base font-bold">{(heroAnime.averageScore / 10).toFixed(1)}</span>
                </div>
              )}
              {heroAnime.episodes && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                  <span className="text-sm md:text-base font-medium text-white/80">
                    {heroAnime.episodes} Episodes
                  </span>
                </>
              )}
              {heroAnime.status && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                  <span className={`text-xs md:text-sm font-bold uppercase px-2 py-0.5 rounded ${
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
              <div className="flex flex-wrap gap-2 mt-1">
                {genres.slice(0, 4).map((g: string, idx: number) => (
                  <span
                    key={idx}
                    className="text-[11px] md:text-xs font-bold px-3 py-1 bg-[var(--md-sys-color-surface-container)] text-white/90 rounded-full border border-white/10 shadow-sm"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}

            {/* Synopsis */}
            <p className="text-sm md:text-base text-white/70 line-clamp-3 md:line-clamp-4 leading-relaxed max-w-2xl mt-1 drop-shadow-md">
              {synopsis}
            </p>

            {/* Watch button */}
            <div className="pt-4 flex gap-3">
              <a
                href={getAnimeUrl(heroAnime.id, title)}
                onClick={handleNavigate}
                className="inline-flex items-center gap-2 px-6 md:px-8 py-3 bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] rounded-full font-black text-sm md:text-base tracking-wide transition-all duration-300 hover:shadow-[0_0_20px_var(--md-sys-color-primary)] hover:bg-white active:scale-95 group"
              >
                {isNavigating ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    LOADING...
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    WATCH NOW
                  </>
                )}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
