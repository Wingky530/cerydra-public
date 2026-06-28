import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import AnimeCard from '../components/AnimeCard';
import AnimeGridSkeleton from '../components/AnimeGridSkeleton';
import AppShell from '../components/AppShell';
import FilterSortModal, { type SortOption } from '../components/FilterSortModal';

const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
const getCurrentSeason = () => {
  const month = new Date().getMonth();
  if (month >= 3 && month <= 5) return 'SPRING';
  if (month >= 6 && month <= 8) return 'SUMMER';
  if (month >= 9 && month <= 11) return 'FALL';
  return 'WINTER';
};

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 15 }, (_, i) => currentYear + 1 - i);

function SeasonalContent() {
  const [season, setSeason] = useState(getCurrentSeason());
  const [year, setYear] = useState(currentYear);
  const [sort, setSort] = useState<SortOption>('POPULARITY_DESC');
  const [page, setPage] = useState(1);
  const [allResults, setAllResults] = useState<any[]>([]);

  // Search state
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page and results when filters change
  useEffect(() => {
    setPage(1);
    setAllResults([]);
  }, [season, year, sort, debouncedSearch]);

  const { data, isPending, isError } = useQuery<any>({
    queryKey: ['seasonal-anilist', season, year, sort, debouncedSearch, page],
    queryFn: async ({ signal }) => {
      const query = `
        query ($page: Int, $season: MediaSeason, $seasonYear: Int, $sort: [MediaSort], $search: String) {
          Page(page: $page, perPage: 24) {
            pageInfo {
              hasNextPage
            }
            media(search: $search, season: $season, seasonYear: $seasonYear, sort: $sort, type: ANIME, isAdult: false) {
              id
              idMal
              title { english romaji native }
              coverImage { extraLarge }
              averageScore
              episodes
            }
          }
        }
      `;
      const variables: any = { page, season, seasonYear: year, sort: [sort] };
      if (debouncedSearch.trim() !== '') {
        variables.search = debouncedSearch;
      }

      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
        signal,
      });

      if (!res.ok) throw new Error('AniList API error');
      const json = await res.json();
      return json?.data?.Page || { media: [], pageInfo: { hasNextPage: false } };
    },
    staleTime: 60 * 60 * 1000,
  });

  useEffect(() => {
    if (data?.media) {
      if (page === 1) {
        setAllResults(data.media);
      } else {
        setAllResults(prev => {
          const newMedia = data.media.filter((m: any) => !prev.some(p => p.id === m.id));
          return [...prev, ...newMedia];
        });
      }
    }
  }, [data, page]);

  const hasNextPage = data?.pageInfo?.hasNextPage;
  const filteredResults = allResults.filter(anime => anime.coverImage?.extraLarge);

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen pb-24 bg-[var(--md-sys-color-background)]">
      <div className="max-w-7xl mx-auto">
        
        {/* Header and Filters */}
        <div className="flex flex-col mb-8 mt-2">
          <div className="flex items-center h-12 w-full relative">
            {/* Back Button */}
            <button 
              onClick={() => {
                if (isSearchActive) {
                  setIsSearchActive(false);
                  setSearchQuery('');
                } else {
                  import('astro:transitions/client').then(({ navigate }) => navigate('/'));
                }
              }}
              className="absolute left-0 flex items-center justify-center w-10 h-10 rounded-full text-[var(--md-sys-color-on-surface)] hover:bg-white/10 transition-colors z-10"
              aria-label={isSearchActive ? 'Close Search' : 'Back to Home'}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>

            {/* Title or Search Input */}
            <div className="flex-1 pl-12 pr-24 h-full flex items-center w-full justify-start">
              {isSearchActive ? (
                <input
                  type="text"
                  autoFocus
                  placeholder="Search in seasonal..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 bg-transparent text-[var(--md-sys-color-on-surface)] text-lg outline-none placeholder:text-white/30"
                />
              ) : (
                <h1 className="text-xl md:text-2xl font-black text-[var(--md-sys-color-on-surface)] tracking-wide">SEASONAL ANIME</h1>
              )}
            </div>

            {/* Right Icons (Search & Filter) */}
            <div className="absolute right-0 flex items-center">
              {!isSearchActive && (
                <button
                  onClick={() => setIsSearchActive(true)}
                  className="flex items-center justify-center w-10 h-10 rounded-full text-[var(--md-sys-color-on-surface)] hover:bg-white/10 hover:text-[var(--md-sys-color-primary)] transition-colors"
                  aria-label="Search Seasonal Anime"
                >
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </button>
              )}
              
              <FilterSortModal
                currentSeason={season}
                currentYear={year}
                currentSort={sort}
                seasons={SEASONS}
                years={YEARS}
                onApply={(s: string, y: number, so: SortOption) => {
                  setSeason(s);
                  setYear(y);
                  setSort(so);
                }}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        {isPending && page === 1 && (
          <AnimeGridSkeleton count={24} />
        )}

        {isError && (
          <div className="text-center py-12 text-[var(--md-sys-color-error)]">
            An error occurred while loading data. Please try again.
          </div>
        )}

        {filteredResults.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredResults.map((anime) => (
                <AnimeCard
                  key={anime.id}
                  id={anime.id.toString()}
                  name={anime.title.english || anime.title.romaji}
                  romajiTitle={anime.title.romaji}
                  nativeTitle={anime.title.native}
                  thumbnail={anime.coverImage.extraLarge}
                  episodeCount={anime.episodes}
                  score={anime.averageScore ? (anime.averageScore / 10).toFixed(2) : undefined}
                />
              ))}
            </div>

            {/* Load More */}
            {hasNextPage && (
              <div className="mt-12 flex justify-center">
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={isPending}
                  className="px-8 py-3 rounded-xl font-bold text-sm tracking-wider uppercase transition-all duration-200 flex items-center gap-2 bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-primary)] hover:text-[var(--md-sys-color-on-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </button>
              </div>
            )}
            
            {!hasNextPage && !isPending && (
              <div className="mt-12 text-center text-[var(--md-sys-color-on-surface-variant)] text-sm">
                All anime for this season have been loaded.
              </div>
            )}
          </>
        )}

        {!isPending && !isError && filteredResults.length === 0 && (
          <div className="text-center py-16">
            <h2 className="text-xl font-medium text-[var(--md-sys-color-on-surface)] mb-2">No anime found</h2>
            <p className="text-[var(--md-sys-color-on-surface-variant)]">
              No anime data available for {season} {year}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SeasonalPage() {
  return (
    <AppShell>
      <SeasonalContent />
    </AppShell>
  );
}
