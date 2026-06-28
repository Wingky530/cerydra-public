import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import AnimeInfoModal from './AnimeInfoModal';
import { getAnimeUrl } from '../lib/routing';

const StarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--md-sys-color-star)" stroke="var(--md-sys-color-star)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1.5">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
  </svg>
);

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1.5">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
);

interface JikanAnime {
  mal_id: number;
  title: string;
  title_english?: string;
  title_japanese?: string;
  synopsis: string;
  images: { webp: { large_image_url: string; image_url: string }; };
  trailer: { images: { maximum_image_url: string | null }; };
  score: number;
  members: number;
  genres?: { name: string }[];
  studios?: { name: string }[];
  status?: string;
  episodes?: number;
  rating?: string;
  year?: number;
  season?: string;
  source?: string;
  duration?: string;
  rank?: number;
  popularity?: number;
  favorites?: number;
  themes?: { name: string }[];
  demographics?: { name: string }[];
  producers?: { name: string }[];
  aired?: { string: string };
}

export default function HeroCarousel({ initialHero = null }: { initialHero?: any[] | null }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [openModalAnime, setOpenModalAnime] = useState<JikanAnime | null>(null);
  const [isLoadingNavigate, setIsLoadingNavigate] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: animeList = initialHero || [], isPending, isError } = useQuery<any[]>({
    queryKey: ['hero-carousel-anilist', 1],
    enabled: initialHero === null,
    initialData: initialHero || undefined,
    queryFn: async ({ signal }) => {
      const month = new Date().getMonth();
      let currentSeason = 'WINTER';
      if (month >= 0 && month <= 2) currentSeason = 'WINTER'; // Jan, Feb, Mar
      else if (month >= 3 && month <= 5) currentSeason = 'SPRING'; // Apr, May, Jun
      else if (month >= 6 && month <= 8) currentSeason = 'SUMMER'; // Jul, Aug, Sep
      else if (month >= 9 && month <= 11) currentSeason = 'FALL'; // Oct, Nov, Dec
      
      const currentYear = new Date().getFullYear();

      const query = `
        query($season: MediaSeason, $seasonYear: Int) {
          Page(page: 1, perPage: 5) {
            media(season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC, type: ANIME, isAdult: false, status_in: [RELEASING, FINISHED]) {
              id
              idMal
              title { english romaji native }
              coverImage { extraLarge }
              description(asHtml: false)
              averageScore
              popularity
              genres
            }
          }
        }
      `;
      const variables = { season: currentSeason, seasonYear: currentYear };
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
        signal,
      });
      if (!res.ok) throw new Error('Failed to fetch hero anime from AniList');
      const json = await res.json();
      const mediaList = json?.data?.Page?.media || [];
      return mediaList.map((m: any) => ({
        mal_id: m.idMal || m.id,
        idMal: m.idMal,
        anilist_id: m.id,
        title: m.title.english || m.title.romaji,
        title_english: m.title.english,
        title_romaji: m.title.romaji,
        title_native: m.title.native,
        images: { webp: { large_image_url: m.coverImage.extraLarge } },
        synopsis: m.description ? m.description.replace(/<[^>]*>?/gm, '').trim() : 'No description available.',
        score: m.averageScore ? (m.averageScore / 10) : null,
        members: m.popularity || 0,
        genres: m.genres ? m.genres.map((g: string) => ({ name: g })) : [],
      }));
    },
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  // Remove IntersectionObserver and cardRefs that hold stale DOM nodes across Astro transitions
  // Auto-scroll every 7 seconds (pauses on hover/focus)
  useEffect(() => {
    if (!animeList || animeList.length <= 1 || isPaused) return;

    const interval = setInterval(() => {
      const container = scrollRef.current;
      if (!container) return;
      
      const nextIndex = (activeIndex + 1) % animeList.length;
      const cardWidth = container.offsetWidth;
      container.scrollTo({ left: nextIndex * cardWidth, behavior: 'smooth' });
      // activeIndex will also be updated by the onScroll handler, but we set it here for immediate feedback
      setActiveIndex(nextIndex);
    }, 7000);

    return () => clearInterval(interval);
  }, [animeList, activeIndex, isPaused]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollLeft = container.scrollLeft;
    const cardWidth = container.offsetWidth;
    if (cardWidth === 0) return;
    
    // Calculate which card is most visible
    const newIndex = Math.round(scrollLeft / cardWidth);
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < animeList.length) {
      setActiveIndex(newIndex);
    }
  };

  // Pause on hover/focus
  const handleMouseEnter = () => setIsPaused(true);
  const handleMouseLeave = () => setIsPaused(false);
  const handleFocus = () => setIsPaused(true);
  const handleBlur = () => setIsPaused(false);



  const handleNavigate = async (e: React.MouseEvent, title: string, anilistId: number, romajiTitleProp?: string) => {
    e.preventDefault();
    const { navigate } = await import('astro:transitions/client');
    navigate(getAnimeUrl(anilistId, title));
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const showSkeleton = (isPending || !mounted) && !initialHero;

  if (showSkeleton) {
    return (
      <SkeletonTheme baseColor="var(--md-sys-color-surface)" highlightColor="var(--md-sys-color-surface-variant)">
        <div className="relative w-full overflow-hidden bg-[var(--md-sys-color-background)] pt-4 md:pt-6">
          <div className="flex-shrink-0 w-full snap-center snap-always flex flex-row items-stretch justify-center px-4 sm:px-8 gap-4 md:gap-6 py-8">
            <div className="flex-1 flex flex-col items-start justify-center text-left w-full md:max-w-[60%] py-1 md:py-2">
              <div className="flex flex-col gap-2 w-full">
                {/* Badges Skeleton */}
                <div className="flex items-center gap-2">
                  <Skeleton width={40} height={20} borderRadius={9999} />
                  <Skeleton width={80} height={20} />
                </div>
                {/* Title Skeleton */}
                <Skeleton width="80%" height={48} className="md:h-[72px]" />
                {/* Genres Skeleton */}
                <div className="flex gap-2">
                  <Skeleton width={60} height={24} borderRadius={9999} />
                  <Skeleton width={50} height={24} borderRadius={9999} />
                  <Skeleton width={70} height={24} borderRadius={9999} />
                </div>
                {/* Synopsis Skeleton */}
                <div className="max-w-2xl w-full">
                  <Skeleton count={3} />
                </div>
              </div>
            </div>
            <div className="flex flex-col shrink-0 self-center w-[120px] sm:w-[150px] md:w-[240px]">
              <Skeleton className="aspect-[2/3] w-full !rounded-[var(--md-sys-shape-corner-medium)] md:!rounded-[var(--md-sys-shape-corner-large)]" />
            </div>
          </div>
        </div>
      </SkeletonTheme>
    );
  }

  if (isError || !animeList || animeList.length === 0) {
    return null;
  }

  const formatNumber = (num?: number) => {
    if (num === undefined || num === null) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div 
      className="relative w-full mb-2 bg-[var(--md-sys-color-background)] pt-4 md:pt-6"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="region"
      aria-label="Trending anime carousel"
      aria-live="polite"
      aria-atomic="false"
    >
      
      {/* Background Images Crossfade — clipped to container */}
      <div className="absolute inset-0 overflow-hidden">
        {animeList.map((anime, idx) => {
          const bannerUrlRaw = anime.trailer?.images?.maximum_image_url || anime.images?.webp?.large_image_url || '';
          const bannerUrl = bannerUrlRaw.includes('myanimelist') ? `https://wsrv.nl/?url=${encodeURIComponent(bannerUrlRaw)}` : bannerUrlRaw;
          return (
            <img
              key={`bg-${anime.mal_id}`}
              src={bannerUrl}
              alt=""
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out pointer-events-none filter blur-md scale-105 ${activeIndex === idx ? 'opacity-40' : 'opacity-0'}`}
            />
          );
        })}
      </div>

      {/* Dark Overlays for Text Legibility — extends 1px past container */}
      <div className="absolute -inset-1 bg-gradient-to-r from-[var(--md-sys-color-background)] via-[var(--md-sys-color-background)]/80 to-[var(--md-sys-color-background)] z-[1] pointer-events-none" />
      <div className="absolute -inset-1 bg-gradient-to-t from-[var(--md-sys-color-background)] via-[var(--md-sys-color-background)]/50 to-[var(--md-sys-color-background)] z-[1] pointer-events-none" />

      {/* Scrollable Container */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative z-[2] flex overflow-x-auto snap-x snap-mandatory scrollbar-hide pt-4 pb-8"
        onFocus={handleFocus}
        onBlur={handleBlur}
        role="group"
        aria-label={`Slide ${activeIndex + 1} of ${animeList.length}: ${animeList[activeIndex]?.title_english || animeList[activeIndex]?.title || 'Loading'}`}
      >
        {animeList.map((anime, idx) => {
          const displayTitle = anime.title_english || anime.title;
          const displaySynopsis = anime.synopsis 
            ? anime.synopsis.replace('[Written by MAL Rewrite]', '').trim()
            : 'No synopsis available.';

          return (
            <div 
              key={anime.mal_id}
              data-index={idx}
              className={`flex-shrink-0 w-full snap-center snap-always flex flex-row items-stretch justify-between px-4 sm:px-8 gap-4 md:gap-6 transition-opacity duration-500 ${activeIndex === idx ? 'opacity-100' : 'opacity-40'}`}
            >
              {/* Left Side: Typography */}
              <div className="flex-1 flex flex-col items-start justify-center text-left w-full md:max-w-[60%] py-1 md:py-2">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-white text-black text-[11px] sm:text-[12px] font-bold uppercase rounded-[8px] tracking-wider">
                      {anime.type || 'TV'}
                    </span>
                    {(anime.score || anime.members > 0) && (
                      <div className="flex items-center gap-2 text-[var(--md-sys-color-on-background)] text-xs sm:text-sm font-medium">
                        {anime.score && <span className="flex items-center gap-1"><StarIcon /> {anime.score}</span>}
                        {anime.members > 0 && <span className="flex items-center gap-1"><EyeIcon /> {formatNumber(anime.members)}</span>}
                      </div>
                    )}
                  </div>
                  
                  <h2 className="text-2xl sm:text-4xl md:text-6xl font-black text-white mb-0 line-clamp-2 leading-none md:leading-tight">
                    {displayTitle}
                  </h2>
                  
                  {anime.genres && anime.genres.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {anime.genres.slice(0, 3).map((genre: any, i: number) => (
                        <span key={genre.mal_id || i} className="px-2 py-0.5 bg-[var(--md-sys-color-primary)] text-white text-[11px] sm:text-[12px] font-bold uppercase rounded-[8px] tracking-wider">
                          {genre.name}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <p 
                    onClick={() => setOpenModalAnime(anime)}
                    className="text-sm sm:text-base md:text-lg text-white/50 hover:text-white/80 cursor-pointer line-clamp-3 mb-0 max-w-2xl leading-snug md:leading-relaxed transition-colors [mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)]"
                    title="Click to view full synopsis"
                  >
                    {displaySynopsis}
                  </p>
                </div>
              </div>

              {/* Right Side: Poster */}
              <div className="flex flex-col shrink-0 self-center w-[120px] sm:w-[150px] md:w-[240px]">
                <a
                  href={getAnimeUrl(anime.anilist_id, displayTitle)}
                  onClick={(e) => handleNavigate(e, displayTitle, anime.anilist_id, anime.title)}
                  className="block relative w-full aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 group"
                >
                  <img
                    src={anime.images?.webp?.large_image_url?.includes('myanimelist') ? `https://wsrv.nl/?url=${encodeURIComponent(anime.images.webp.large_image_url)}` : anime.images?.webp?.large_image_url}
                    alt={displayTitle}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

       {/* Pagination Dots */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-3 z-[3] pb-2">
        {animeList.map((_, idx) => (
          <button
            key={idx}
            onClick={() => {
              setActiveIndex(idx);
              if (scrollRef.current) {
                const cardWidth = scrollRef.current.offsetWidth;
                scrollRef.current.scrollTo({ left: idx * cardWidth, behavior: 'smooth' });
              }
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            aria-label={`Go to slide ${idx + 1}`}
            className={`h-2 rounded-full transition-all duration-300 ease-in-out focus:outline-2 focus:outline-offset-2 focus:outline-[var(--md-sys-color-primary)] ${activeIndex === idx ? 'w-8 bg-[var(--md-sys-color-primary)]' : 'w-2 bg-[var(--md-sys-color-on-surface-variant)] opacity-60 hover:opacity-100'}`}
          />
        ))}
      </div>

      {openModalAnime && (
        <AnimeInfoModal
          open={!!openModalAnime}
          anime={openModalAnime}
          onClose={() => setOpenModalAnime(null)}
        />
      )}
    </div>
  );
}
