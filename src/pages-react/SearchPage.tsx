import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAnimeUrl } from '../lib/routing';
import AppShell from '../components/AppShell';
import AnimeCard from '../components/AnimeCard';
import AnimeGridSkeleton from '../components/AnimeGridSkeleton';

const ANILIST_CACHE_KEY = 'cerydra_anilist_poster_cache';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

function getPosterCache() {
  try {
    const cached = localStorage.getItem(ANILIST_CACHE_KEY);
    if (!cached) return {};
    const data = JSON.parse(cached);
    const now = Date.now();
    const valid = Object.entries(data).reduce((acc: Record<string, any>, [key, val]: [string, any]) => {
      if (val.expires > now) acc[key] = val.url;
      return acc;
    }, {});
    if (Object.keys(valid).length !== Object.keys(data).length) {
      localStorage.setItem(ANILIST_CACHE_KEY, JSON.stringify(
        Object.fromEntries(
          Object.entries(data).filter(([_, val]: [string, any]) => val.expires > now)
        )
      ));
    }
    return valid;
  } catch {
    return {};
  }
}

function setPosterCache(animeName: string, posterUrl: string) {
  try {
    const data = JSON.parse(localStorage.getItem(ANILIST_CACHE_KEY) || '{}');
    data[animeName] = { url: posterUrl, expires: Date.now() + CACHE_TTL };
    localStorage.setItem(ANILIST_CACHE_KEY, JSON.stringify(data));
  } catch {}
}

async function fetchAniListPoster(animeName: string, signal?: AbortSignal): Promise<string | null> {
  const cache = getPosterCache();
  if (cache[animeName]) return cache[animeName];

  try {
    const query = `
      query($search: String) {
        Media(search: $search, type: ANIME, isAdult: false) {
          id
          coverImage { extraLarge }
        }
      }
    `;
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { search: animeName } }),
      signal,
    });
    if (!res.ok) throw new Error('AniList fetch failed');
    const json = await res.json();
    const posterUrl = json?.data?.Media?.coverImage?.extraLarge || null;
    if (posterUrl) setPosterCache(animeName, posterUrl);
    return posterUrl;
  } catch {
    return null;
  }
}

async function enrichResultsWithPosters(results: any[], signal?: AbortSignal): Promise<any[]> {
  const enriched = [...results];
  const missingPosters = enriched.map((r, idx) => ({
    idx,
    anime: r,
    title: r.title?.english || r.title?.romaji || r.title,
  })).filter(item => !item.anime.coverImage?.extraLarge);

  for (const item of missingPosters) {
    await new Promise(r => setTimeout(r, 250));
    const posterUrl = await fetchAniListPoster(item.title, signal);
    if (posterUrl) {
      enriched[item.idx].coverImage = { extraLarge: posterUrl };
    }
  }

  return enriched;
}

interface SearchPageProps {
  initialQuery?: string;
}

// --- Icons ---
const SearchIcon = () => <span className="material-symbols-outlined text-[24px] leading-none">search</span>;
const SortIcon = () => <span className="material-symbols-outlined text-[24px] leading-none">swap_vert</span>;
const HistoryIcon = () => <span className="material-symbols-outlined text-[20px] leading-none">history</span>;
const CloseIcon = () => <span className="material-symbols-outlined text-[18px] leading-none">close</span>;

type SortOption = 'POPULARITY_DESC' | 'SCORE_DESC' | 'TRENDING_DESC' | 'TITLE_ROMAJI';
const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: 'Popular', value: 'POPULARITY_DESC' },
  { label: 'Score', value: 'SCORE_DESC' },
  { label: 'Trending', value: 'TRENDING_DESC' },
  { label: 'A-Z', value: 'TITLE_ROMAJI' },
];

const TIPS = [
  { text: 'Hunting for something airing right now? Try', code: 'status:releasing' },
  { text: 'Just want a quick watch? Filter to movies with', code: 'format:movie' },
  { text: 'Fresh romance from last year? Combine them', code: 'genre:romance year:2024' },
  { text: 'Missed the spring season? You can go back with', code: 'season:spring year:2024' },
  { text: 'Not sure what to watch? Start broad with', code: 'genre:action' },
  { text: 'Looking for something specific? Search by tags like', code: 'tag:isekai' }
];

const AUTOCOMPLETE: Record<string, string[]> = {
  format: ['tv', 'movie', 'ona', 'ova', 'special'],
  genre: ['action', 'adventure', 'comedy', 'drama', 'ecchi', 'fantasy', 'horror', 'mahou_shoujo', 'mecha', 'music', 'mystery', 'psychological', 'romance', 'sci-fi', 'slice_of_life', 'sports', 'supernatural', 'thriller'],
  year: Array.from({ length: new Date().getFullYear() - 1939 + 2 }, (_, i) => String(new Date().getFullYear() + 1 - i)),
  status: ['releasing', 'finished', 'not_yet_released'],
  season: ['spring', 'summer', 'fall', 'winter'],
};

function SearchContent({ initialQuery = '' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery || '');
  const [debounced, setDebounced] = useState(initialQuery || '');
  const [history, setHistory] = useState<string[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [page, setPage] = useState(1);
  const [allResults, setAllResults] = useState<any[]>([]);

  // Sort State
  const [sort, setSort] = useState<SortOption>('POPULARITY_DESC');
  const [showSort, setShowSort] = useState(false);
  const [isClosingSort, setIsClosingSort] = useState(false);

  const [randomTip, setRandomTip] = useState(TIPS[0]);
  const [suggestions, setSuggestions] = useState<{ prefix: string; value: string }[]>([]);

  useEffect(() => {
    setRandomTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
    try {
      const h = localStorage.getItem('cerydra_search_history');
      if (h) setHistory(JSON.parse(h));
    } catch {}
    
    // Dynamically fetch tags for autocomplete to avoid hardcoding 400+ tags
    if (!AUTOCOMPLETE.tag) {
      fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'query { MediaTagCollection { name } }' })
      })
      .then(r => r.json())
      .then(d => {
        if (d?.data?.MediaTagCollection) {
          AUTOCOMPLETE.tag = d.data.MediaTagCollection.map((t: any) => t.name.toLowerCase());
        }
      })
      .catch(() => {});
    }
  }, []);

  const saveHistory = (q: string) => {
    if (!q.trim()) return;
    const clean = q.trim();
    setHistory((prev: string[]) => {
      const newHist = [clean, ...prev.filter((x: string) => x !== clean)].slice(0, 15);
      localStorage.setItem('cerydra_search_history', JSON.stringify(newHist));
      return newHist;
    });
  };

  const removeHistoryItem = (e: React.MouseEvent, item: string) => {
    e.stopPropagation();
    setHistory((prev: string[]) => {
      const newHist = prev.filter((x: string) => x !== item);
      localStorage.setItem('cerydra_search_history', JSON.stringify(newHist));
      return newHist;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      saveHistory(query);
      e.currentTarget.blur();
    }
  };

  const handleHistoryClick = (item: string) => {
    setQuery(item);
    setDebounced(item); // trigger instant search
    saveHistory(item);
    inputRef.current?.blur();
  };

  const handleQuickChipClick = (item: string) => {
    setQuery(item);
    setDebounced(item);
    saveHistory(item);
    inputRef.current?.blur();
  };

  const applySuggestion = (prefix: string, value: string) => {
    const tokens = query.split(/\s+/);
    tokens.pop(); // remove the partial token
    const newQuery = (tokens.length > 0 ? tokens.join(' ') + ' ' : '') + `${prefix}:${value} `;
    setQuery(newQuery);
    inputRef.current?.focus();
    setSuggestions([]);
  };

  useEffect(() => {
    if (!isInputFocused || !query.trim()) {
      setSuggestions([]);
      return;
    }
    const lastToken = query.split(/\s+/).pop();
    if (lastToken && lastToken.includes(':')) {
      const [prefix, partial] = lastToken.split(':');
      const p = prefix.toLowerCase();
      if (AUTOCOMPLETE[p]) {
        const match = AUTOCOMPLETE[p].filter(val => val.startsWith(partial.toLowerCase()));
        setSuggestions(match.map(v => ({ prefix: p, value: v })));
      } else {
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
    }
  }, [query, isInputFocused]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(query);
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  // Reset page when debounced query or sort changes
  useEffect(() => {
    setPage(1);
    setAllResults([]);
  }, [debounced, sort]);

  const isSearchActive = typeof debounced === 'string' && debounced.trim().length > 0;

  const { data, isPending, isError } = useQuery({
    queryKey: ['hybrid-search', debounced, sort, page],
    queryFn: async ({ signal }) => {
      if (!isSearchActive) return null;

      let parsedSearch = debounced.trim();
      let parsedGenre = '';
      let parsedTag = '';
      let parsedFormat = '';
      let parsedSeason = '';
      let parsedYear = '';
      let parsedStatus = '';

      // Extract tags like genre:action year:2024 tag:isekai
      const tagRegex = /(genre|tag|format|season|year|status):([^\s]+)/gi;
      parsedSearch = parsedSearch.replace(tagRegex, (_, key, value) => {
        const k = key.toLowerCase();
        let v = value.replace(/-/g, ' ').replace(/_/g, ' ');
        if (k === 'genre') {
          v = v.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
          if (v === 'Sci fi' || v === 'Sci Fi') v = 'Sci-Fi';
          if (v === 'Slice Of Life') v = 'Slice of Life';
          parsedGenre = v;
        } else if (k === 'tag') {
          v = v.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
          parsedTag = v;
        } else if (k === 'format') {
          parsedFormat = v.toUpperCase();
        } else if (k === 'season') {
          parsedSeason = v.toUpperCase();
        } else if (k === 'year') {
          parsedYear = v;
        } else if (k === 'status') {
          parsedStatus = v.toUpperCase().replace(/\s+/g, '_');
        }
        return '';
      }).replace(/\s+/g, ' ').trim();

      const hasFilters = parsedGenre || parsedTag || parsedFormat || parsedSeason || parsedYear || parsedStatus;
      
      // If it's a pure text search (no filters), route to Allanime for hyper-accurate prefix/Kanji/Romaji matching
      // AND also query AniList natively to catch unreleased/upcoming anime.
      if (parsedSearch && !hasFilters) {
        const res = await fetch(`/api/anime/search?q=${encodeURIComponent(parsedSearch)}&page=${page}`);
        if (!res.ok) throw new Error('Cerydra API error');
        const json = await res.json();
        const edges = json?.data?.shows?.edges || [];
        
        const aniListIds = edges.map((e: any) => e.aniListId).filter(Boolean);
        
        const hybridQuery = `
          query ($ids: [Int], $search: String, $sort: [MediaSort], $searchSort: [MediaSort], $page: Int) {
            FromIds: Page(page: 1, perPage: 40) {
              media(id_in: $ids, type: ANIME, isAdult: false, sort: $sort) {
                id
                title { english romaji native }
                coverImage { extraLarge }
                averageScore
                episodes
              }
            }
            FromSearch: Page(page: $page, perPage: 30) {
              pageInfo { hasNextPage }
              media(search: $search, type: ANIME, isAdult: false, sort: $searchSort) {
                id
                title { english romaji native }
                coverImage { extraLarge }
                averageScore
                episodes
              }
            }
          }
        `;
        
        try {
          const aniRes = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: hybridQuery,
              variables: { 
                ids: aniListIds.length > 0 ? aniListIds.map(Number) : [-1], // -1 to avoid graphql error on empty array
                search: parsedSearch,
                sort: [sort],
                searchSort: ['SEARCH_MATCH', sort],
                page: page
              }
            }),
            signal
          });
          
          if (aniRes.ok) {
            const aniJson = await aniRes.json();
            const fromIds = aniJson?.data?.FromIds?.media || [];
            const fromSearch = aniJson?.data?.FromSearch?.media || [];
            const hasNextPage = aniJson?.data?.FromSearch?.pageInfo?.hasNextPage || (edges.length === 40);
            
            const map = new Map();
            // Prioritize FromIds (exact matches from Allanime)
            for (const item of fromIds) {
              map.set(item.id, item);
            }
            // Append FromSearch (unreleased, fallbacks from AniList)
            for (const item of fromSearch) {
              if (!map.has(item.id)) {
                map.set(item.id, item);
              }
            }
            
            const mediaList = Array.from(map.values());
            const unified = mediaList.map((e: any) => ({
              _source: 'anilist',
              id: e.id.toString(),
              title: e.title,
              coverImage: e.coverImage,
              episodes: e.episodes,
              averageScore: e.averageScore
            }));
            
            return { media: unified, hasNextPage };
          }
        } catch (err) {
          console.error('Hybrid AniList enrichment failed', err);
        }
        
        const unified = edges.map((e: any) => ({
          _source: 'rodoknai',
          id: e.aniListId ? String(e.aniListId) : e._id,
          title: { english: e.name, romaji: e.name, native: e.name },
          coverImage: { extraLarge: e.thumbnail },
          episodes: e.availableEpisodes ? (e.availableEpisodes.sub || e.availableEpisodes.dub) : null,
          averageScore: 0
        }));

        return { media: unified, hasNextPage: edges.length === 40 };
      }

      // Hybrid Search (Filters applied) -> AniList
      const graphqlQuery = `
        query ($page: Int, $search: String, $genre: String, $tag: String, $format: MediaFormat, $season: MediaSeason, $seasonYear: Int, $status: MediaStatus, $sort: [MediaSort]) {
          Page(page: $page, perPage: 30) {
            pageInfo { hasNextPage }
            media(search: $search, genre: $genre, tag: $tag, format: $format, season: $season, seasonYear: $seasonYear, status: $status, type: ANIME, isAdult: false, sort: $sort) {
              id
              title { english romaji native }
              coverImage { extraLarge }
              averageScore
              episodes
            }
          }
        }
      `;

      const variables: any = { page };
      // Enforce SEARCH_MATCH sorting for AniList if there's a text search
      if (parsedSearch) {
        variables.search = parsedSearch;
        variables.sort = ['SEARCH_MATCH', sort];
      } else {
        variables.sort = [sort];
      }
      if (parsedGenre) variables.genre = parsedGenre;
      if (parsedTag) variables.tag = parsedTag;
      if (parsedFormat) variables.format = parsedFormat;
      if (parsedSeason) variables.season = parsedSeason;
      if (parsedYear) variables.seasonYear = parseInt(parsedYear);
      if (parsedStatus) variables.status = parsedStatus;

      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: graphqlQuery, variables }),
        signal
      });

      if (!res.ok) throw new Error('AniList API error');
      const json = await res.json();
      const pageData = json?.data?.Page || { media: [], pageInfo: { hasNextPage: false } };
      
      const unified = pageData.media.map((e: any) => ({
        _source: 'anilist',
        id: e.id.toString(),
        title: e.title,
        coverImage: e.coverImage,
        episodes: e.episodes,
        averageScore: e.averageScore
      }));

      return { media: unified, hasNextPage: pageData.pageInfo.hasNextPage };
    },
    enabled: isSearchActive,
  });

  useEffect(() => {
    const scrollContainer = document.getElementById('search-scroll-container');
    const handleScroll = () => {
      if (!scrollContainer) return;
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 500;
      
      if (isAtBottom && !isPending && data?.hasNextPage) {
        setPage(p => p + 1);
      }
    };

    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [isPending, data?.hasNextPage]);

  useEffect(() => {
    if (data?.media) {
      const processMedia = async () => {
        let media = data.media;
        if (data.media[0]?._source === 'rodoknai') {
          
          media = await enrichResultsWithPosters(data.media);
          
        }
        if (page === 1) {
          setAllResults(media);
        } else {
          setAllResults((prev: any[]) => [...prev, ...media]);
        }
      };
      processMedia();
    }
  }, [data, page]);

  const closeSort = () => {
    setIsClosingSort(true);
    setTimeout(() => {
      setShowSort(false);
      setIsClosingSort(false);
    }, 200);
  };

  const handleSortSelect = (newSort: SortOption) => {
    setSort(newSort);
    closeSort();
  };

  const filteredResults = allResults;
  const hasNextPage = data?.hasNextPage;

  return (
    <div className="bg-[var(--md-sys-color-background)] h-[calc(100dvh-6rem)] flex flex-col">
      {/* Fixed Header */}
      <div className="flex-none bg-[var(--md-sys-color-background)] transition-all duration-300 px-4 md:px-8 py-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--md-sys-color-on-surface-variant)]">
               <SearchIcon />
            </div>
            <input
              ref={inputRef}
              type="text"
              autoFocus
              placeholder="Search anime..."
              value={query}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setTimeout(() => setIsInputFocused(false), 200)}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-12 pr-4 py-3.5 bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface)] rounded-full outline-none focus:ring-2 focus:ring-[var(--md-sys-color-primary)] transition-shadow placeholder:text-[var(--md-sys-color-on-surface-variant)] text-[16px]"
            />
            
            {/* Search History Dropdown */}
            {isInputFocused && !query && history.length > 0 && (
               <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--md-sys-color-surface-container-high)] rounded-2xl shadow-xl overflow-hidden py-2 border border-white/5 z-50">
                   <div className="px-4 py-2 text-xs font-bold text-[var(--md-sys-color-secondary)] uppercase tracking-wider">Recent Searches</div>
                  {history.map((item: string, idx: number) => (
                    <div 
                      key={item + idx} 
                      className="px-4 py-3 flex items-center justify-between hover:bg-white/5 cursor-pointer"
                      onClick={() => handleHistoryClick(item)}
                    >
                       <div className="flex items-center gap-3">
                         <HistoryIcon />
                         <span className="font-medium text-white">{item}</span>
                       </div>
                       <button onClick={(e) => removeHistoryItem(e, item)} className="p-1 hover:bg-white/10 rounded-full text-[var(--md-sys-color-on-surface-variant)]">
                         <CloseIcon />
                       </button>
                    </div>
                  ))}
               </div>
            )}

            {/* Suggestions Dropdown */}
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--md-sys-color-surface-container-high)] rounded-2xl shadow-xl overflow-hidden py-2 border border-white/5 z-50 max-h-48 overflow-y-auto scrollbar-hide">
                <div className="px-4 py-2 text-xs font-bold text-[var(--md-sys-color-secondary)] uppercase tracking-wider">Suggestions</div>
                {suggestions.map(({ prefix, value }) => (
                  <div 
                    key={`${prefix}:${value}`} 
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applySuggestion(prefix, value);
                    }}
                    className="px-4 py-3 hover:bg-white/5 cursor-pointer font-mono text-sm flex items-center transition-colors"
                  >
                    <span className="text-[var(--md-sys-color-primary)] font-semibold">{prefix}:</span>
                    <span className="text-white">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button 
            onClick={() => setShowSort(true)}
            className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full transition-colors bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-highest)]`}
            title="Sort Results"
          >
            <SortIcon />
          </button>

        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto scrollbar-hide" id="search-scroll-container">
        <div className="max-w-7xl mx-auto p-4 md:p-8 min-h-full flex flex-col">

        {isPending && page === 1 && isSearchActive && (
          <AnimeGridSkeleton count={12} />
        )}

        {isError && (
          <div className="text-center py-12 text-[var(--md-sys-color-error)]">
            An error occurred while searching. Please try again.
          </div>
        )}

        {filteredResults.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredResults.map((anime: any) => (
                <AnimeCard
                  key={`${anime._source}-${anime.id}`}
                  id={anime.id}
                  href={anime._source === 'rodoknai' ? getAnimeUrl(anime.id, anime.title?.english || anime.title?.romaji || anime.title) : undefined}
                  name={anime.title?.english || anime.title?.romaji || anime.title}
                  romajiTitle={anime.title?.romaji}
                  nativeTitle={anime.title?.native}
                  thumbnail={anime.coverImage?.extraLarge || anime.coverImage}
                  episodeCount={anime.episodes}
                  score={anime.averageScore ? parseFloat((anime.averageScore / 10).toFixed(2)) : undefined}
                />
              ))}
            </div>

            {hasNextPage && (
              <div className="mt-10 text-center">
                <button
                  onClick={() => setPage((p: number) => p + 1)}
                  disabled={isPending}
                  className="px-8 py-3 rounded-xl font-bold text-sm tracking-wider uppercase transition-all duration-200 flex items-center gap-2 bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-primary)] hover:text-[var(--md-sys-color-on-primary)] disabled:opacity-50 disabled:cursor-not-allowed mx-auto"
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
                All results have been loaded.
              </div>
            )}
          </>
        ) : (
          !isPending && isSearchActive && (
            <div className="flex-1 w-full flex flex-col items-center justify-center text-[var(--md-sys-color-on-surface-variant)]">
              <span className="material-symbols-outlined text-[64px] mb-4 opacity-50">search_off</span>
              <p className="text-lg font-medium text-white">No results found</p>
              <p className="text-sm mt-1">Try different keywords or filters</p>
            </div>
          )
        )}
        
        {/* Empty State View */}
        {!isSearchActive && (
          <div className="flex-1 w-full flex flex-col items-center justify-center">
            <div className="text-center flex flex-col items-center">
              <span className="material-symbols-outlined text-[32px] text-[var(--md-sys-color-on-surface-variant)] opacity-50 mb-4">search</span>
              <div className="text-[15px] text-white flex flex-col items-center justify-center gap-3">
                <span className="text-[var(--md-sys-color-on-surface-variant)] text-center">{randomTip.text}</span>
                <button 
                  onClick={() => handleQuickChipClick(randomTip.code)}
                  className="font-mono text-sm bg-[var(--md-sys-color-primary)]/10 text-[var(--md-sys-color-primary)] px-3 py-1 rounded-md hover:bg-[var(--md-sys-color-primary)]/20 transition-colors"
                >
                  {randomTip.code}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

      {/* Sort Bottom Sheet */}
      {(showSort || isClosingSort) && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div 
            className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${isClosingSort ? 'opacity-0' : 'opacity-100'}`} 
            onClick={closeSort} 
          />
          <div className={`relative w-full sm:w-[400px] flex flex-col bg-[var(--md-sys-color-surface-container-high)] sm:rounded-2xl rounded-t-3xl shadow-2xl transition-transform duration-200 ease-out ${isClosingSort ? 'translate-y-full sm:translate-y-8 sm:scale-95' : 'translate-y-0 sm:scale-100'}`}>
            
            <div className="w-full flex justify-center pt-3 pb-1 cursor-grab sm:hidden" onClick={closeSort}>
              <div className="w-12 h-1.5 rounded-full bg-white/20"></div>
            </div>

            <div className="flex items-center justify-between px-6 pb-4 pt-2 sm:pt-6 border-b border-white/5 shrink-0">
              <h3 className="font-bold text-[13px] text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">SORT BY</h3>
              <button 
                onClick={closeSort}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-[var(--md-sys-color-on-surface-variant)] transition-colors"
              >
                <CloseIcon />
              </button>
            </div>
            
            <div className="p-6">
              <div className="flex flex-wrap gap-3">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSortSelect(opt.value)}
                    className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                      sort === opt.value
                        ? 'bg-[var(--md-sys-color-primary)]/20 text-[var(--md-sys-color-primary)] ring-1 ring-[var(--md-sys-color-primary)]'
                        : 'bg-[var(--md-sys-color-surface-container-highest)] text-white hover:bg-white/10 border border-white/5'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default function SearchPage({ initialQuery = '' }: SearchPageProps) {
  return (
    <AppShell activeTab="search">
      <SearchContent initialQuery={initialQuery} />
    </AppShell>
  );
}
