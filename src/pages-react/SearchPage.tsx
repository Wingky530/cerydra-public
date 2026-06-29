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
  } catch (err) {
    console.warn('AniList poster fetch failed:', (err as Error)?.message || err);
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

const SearchIcon = () => <span className="material-symbols-outlined text-[24px] leading-none">search</span>;
const SortIcon = () => <span className="material-symbols-outlined text-[24px] leading-none">filter_alt</span>;
const HistoryIcon = () => <span className="material-symbols-outlined text-[20px] leading-none">history</span>;
const CloseIcon = () => <span className="material-symbols-outlined text-[18px] leading-none">close</span>;

type SortOption = 'POPULARITY_DESC' | 'POPULARITY' | 'SCORE_DESC' | 'SCORE' | 'TRENDING_DESC' | 'TRENDING' | 'TITLE_ROMAJI' | 'TITLE_ROMAJI_DESC';

type BaseSort = 'POPULARITY' | 'SCORE' | 'TRENDING' | 'TITLE_ROMAJI';
const BASE_SORTS: BaseSort[] = ['POPULARITY', 'SCORE', 'TRENDING', 'TITLE_ROMAJI'];
const SORT_LABELS: Record<BaseSort, string> = {
  POPULARITY: 'Popular',
  SCORE: 'Score',
  TRENDING: 'Trending',
  TITLE_ROMAJI: 'Name',
};

const FILTER_SECTIONS: { label: string; prefix: string; values: string[] }[] = [
  { label: 'Format', prefix: 'format', values: ['TV', 'Movie', 'ONA', 'OVA', 'Special'] },
  { label: 'Status', prefix: 'status', values: ['Ongoing', 'Completed', 'Upcoming'] },
  { label: 'Season', prefix: 'season', values: ['Spring', 'Summer', 'Fall', 'Winter'] },
  { label: 'Year', prefix: 'year', values: [String(new Date().getFullYear()), String(new Date().getFullYear() - 1), String(new Date().getFullYear() - 2), String(new Date().getFullYear() - 3)] },
];

const TIPS = [
  { text: 'Hunting for something airing right now? Try', code: 'status:ongoing' },
  { text: 'Just want a quick watch? Filter to movies with', code: 'format:movie' },
  { text: 'Fresh romance from last year? Combine them', code: 'genre:romance year:2024' },
  { text: 'Missed the spring season? You can go back with', code: 'season:spring year:2024' },
  { text: 'Not sure what to watch? Start broad with', code: 'genre:action' },
  { text: 'Looking for something specific? Search by tags like', code: 'tag:isekai' },
  { text: 'Hate a specific genre? Exclude it by using minus (-)', code: '-genre:romance' },
  { text: 'Not a fan of mecha? Keep them out with', code: '-genre:mecha' },
  { text: 'Want to watch something finished? Try', code: 'status:completed' },
  { text: 'Skip Chinese anime (donghua) by adding', code: '-region:cn' },
  { text: 'Bored of the usual? Try different tags like', code: 'tag:time_manipulation' }
];

const AUTOCOMPLETE: Record<string, string[]> = {
  format: ['tv', 'movie', 'ona', 'ova', 'special'],
  genre: ['action', 'adventure', 'comedy', 'drama', 'ecchi', 'fantasy', 'horror', 'mahou_shoujo', 'mecha', 'music', 'mystery', 'psychological', 'romance', 'sci-fi', 'slice_of_life', 'sports', 'supernatural', 'thriller'],
  year: Array.from({ length: new Date().getFullYear() - 1939 + 2 }, (_, i) => String(new Date().getFullYear() + 1 - i)),
  status: ['ongoing', 'completed', 'upcoming'],
  season: ['spring', 'summer', 'fall', 'winter'],
  region: ['jp', 'cn', 'kr', 'tw'],
};

const PREFIX_KEYS = Object.keys(AUTOCOMPLETE);
const FILTER_REGEX = /^(-?)(genre|tag|format|season|year|status|region):(.+)/i;
const FILTER_LIKE_REGEX = /^(-?)(genre|tag|format|season|year|status|region):(.*)/i;

type Suggestion = { type: 'prefix' | 'value' | 'exclude'; prefix: string; value: string };

function parseToken(token: string) {
  const match = token.match(FILTER_REGEX);
  if (match) return { type: 'filter' as const, prefix: match[2].toLowerCase(), value: match[3], excluded: match[1] === '-' };
  return { type: 'text' as const, value: token };
}

function SearchContent({ initialQuery = '' }: { initialQuery?: string }) {
  const initialTokens = initialQuery ? initialQuery.trim().split(/\s+/).filter(Boolean) : [];
  const [tokens, setTokens] = useState<string[]>(initialTokens);
  const [currentInput, setCurrentInput] = useState('');
  const query = [...tokens, currentInput].filter(Boolean).join(' ');
  const [debounced, setDebounced] = useState(initialQuery || '');
  const [history, setHistory] = useState<string[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [page, setPage] = useState(1);
  const [allResults, setAllResults] = useState<any[]>([]);

  const [sort, setSort] = useState<SortOption>('POPULARITY_DESC');
  const [showSort, setShowSort] = useState(false);
  const [isClosingSort, setIsClosingSort] = useState(false);

  const [randomTip, setRandomTip] = useState(TIPS[0]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);

  const [isArmed, setIsArmed] = useState(false);
  const filterActiveRef = useRef(false);

  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const PLACEHOLDERS = ['Try genre:action...', 'Try status:ongoing...', 'Try format:movie...', 'Type -genre:romance to exclude', 'Try tag:isekai...'];

  useEffect(() => {
    if (isInputFocused || tokens.length > 0) return;
    const timer = setInterval(() => setPlaceholderIndex(i => (i + 1) % PLACEHOLDERS.length), 4000);
    return () => clearInterval(timer);
  }, [isInputFocused, tokens.length]);

  const activeFilterCount = tokens.filter(t => FILTER_REGEX.test(t)).length;

  useEffect(() => {
    setRandomTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
    try {
      const h = localStorage.getItem('cerydra_search_history');
      if (h) setHistory(JSON.parse(h));
    } catch {}

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsInputFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveHistory = (q: string) => {
    if (!q.trim()) return;
    const clean = q.trim();
    setHistory((prev: string[]) => {
      const newHist = [clean, ...prev.filter((x: string) => x !== clean)].slice(0, 5);
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

  const applyQueryString = (str: string) => {
    const parsed = str.trim().split(/\s+/).filter(Boolean);
    setTokens(parsed);
    filterActiveRef.current = false;
    setCurrentInput('');
    setIsArmed(false);
    setDebounced(str);
    saveHistory(str);
    inputRef.current?.blur();
  };

  const removeToken = (idx: number) => {
    setTokens(prev => prev.filter((_, i) => i !== idx));
    filterActiveRef.current = false;
    setIsArmed(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    if (filterActiveRef.current) {
      if (raw.includes(' ')) {
        const parts = raw.split(/\s+/).filter(Boolean);
        setTokens(prev => [...prev, ...parts.filter(p => !prev.includes(p))]);
        filterActiveRef.current = false;
        setCurrentInput('');
        setIsArmed(false);
      } else {
        setCurrentInput(raw.toLowerCase());
        setIsArmed(false);
      }
      return;
    }

    let value = raw.replace(/^-?(genre|tag|format|season|year|status):/i, (m) => m.toLowerCase());

    if (FILTER_LIKE_REGEX.test(value)) {
      filterActiveRef.current = true;
      setCurrentInput(value);
      setIsArmed(false);
      return;
    }

    if (value.includes(' ')) {
      const parts = value.split(/\s+/);
      const last = parts.pop() || '';
      setTokens(prev => [...prev, ...parts.filter(Boolean).filter(p => !prev.includes(p || ''))]);
      setCurrentInput(last);
    } else {
      setCurrentInput(value);
    }
  };

  const filterMatch = currentInput.match(FILTER_LIKE_REGEX);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filterMatch) {
      const prefix = `${filterMatch[1]}${filterMatch[2]}`;
      const value = filterMatch[3];

      if (e.key === 'Backspace') {
        e.preventDefault();
        if (isArmed) {
          filterActiveRef.current = false;
          setCurrentInput('');
          setIsArmed(false);
        } else if (value.length > 0) {
          setCurrentInput(`${prefix}:${value.slice(0, -1)}`);
        } else {
          setIsArmed(true);
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        filterActiveRef.current = false;
        setTokens(prev => prev.includes(currentInput) ? prev : [...prev, currentInput]);
        setCurrentInput('');
        setIsArmed(false);
        saveHistory([...tokens, currentInput].filter(Boolean).join(' '));
        inputRef.current?.blur();
        return;
      }

      return;
    }

    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestion(prev => Math.min(prev + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestion(prev => Math.max(-1, prev - 1));
        return;
      }
      if (e.key === 'Enter' && selectedSuggestion >= 0) {
        e.preventDefault();
        applySuggestion(suggestions[selectedSuggestion]);
        return;
      }
    }

    if (e.key === 'Enter') {
      if (currentInput) {
        setTokens(prev => prev.includes(currentInput) ? prev : [...prev, currentInput]);
        setCurrentInput('');
      }
      const fullQuery = [...tokens, currentInput].filter(Boolean).join(' ');
      saveHistory(fullQuery);
      e.currentTarget.blur();
      return;
    }

    if (e.key === 'Backspace' && !currentInput && tokens.length > 0) {
      setTokens(prev => {
        const last = prev[prev.length - 1];
        setCurrentInput(last);
        return prev.slice(0, -1);
      });
      e.preventDefault();
    }
  };

  const handleHistoryClick = (item: string) => {
    applyQueryString(item);
  };

  const handleQuickChipClick = (item: string) => {
    applyQueryString(item);
  };

  const handleFilterChip = (prefix: string, value: string) => {
    const token = `${prefix.toLowerCase()}:${value.toLowerCase().replace(/\s+/g, '_')}`;
    const lower = token.toLowerCase();
    const existing = tokens.findIndex(t => t.toLowerCase() === lower);
    const samePrefix = tokens.findIndex(t => t.toLowerCase().startsWith(prefix.toLowerCase() + ':'));

    setTokens(prev => {
      let next: string[];
      if (existing >= 0) {
        next = prev.filter((_, i) => i !== existing);
      } else if (samePrefix >= 0) {
        next = prev.map((t, i) => i === samePrefix ? token : t);
      } else {
        next = [...prev, token];
      }
      const newQuery = [...next, currentInput].filter(Boolean).join(' ');
      setDebounced(newQuery);
      saveHistory(newQuery);
      return next;
    });
    setCurrentInput('');
    filterActiveRef.current = false;
    setIsArmed(false);
    inputRef.current?.blur();
  };

  const applySuggestion = (suggestion: Suggestion) => {
    if (suggestion.type === 'prefix') {
      setCurrentInput(suggestion.prefix + ':');
    } else if (suggestion.type === 'exclude') {
      setCurrentInput(`-${suggestion.prefix}:${suggestion.value}`);
    } else {
      const token = `${suggestion.prefix}:${suggestion.value}`;
      setTokens(prev => prev.includes(token) ? prev : [...prev, token]);
      filterActiveRef.current = false;
      setCurrentInput('');
    }
    setIsArmed(false);
    inputRef.current?.focus();
    setSuggestions([]);
    setSelectedSuggestion(-1);
  };

  useEffect(() => {
    if (!isInputFocused || !currentInput.trim()) {
      setSuggestions([]);
      return;
    }

    const rawInput = currentInput.toLowerCase();
    const isExcluded = rawInput.startsWith('-');
    const input = isExcluded ? rawInput.slice(1) : rawInput;

    if (input.includes(':')) {
      const [prefix, partial] = input.split(':');
      if (AUTOCOMPLETE[prefix]) {
        const match = AUTOCOMPLETE[prefix].filter(val => val.startsWith(partial));
        const finalPrefix = isExcluded ? `-${prefix}` : prefix;
        
        if (partial && AUTOCOMPLETE[prefix].includes(partial) && !isExcluded) {
          setSuggestions([
            { type: 'exclude' as const, prefix, value: partial },
            ...match.map(v => ({ type: 'value' as const, prefix: finalPrefix, value: v }))
          ]);
        } else {
          setSuggestions(match.map(v => ({ type: 'value' as const, prefix: finalPrefix, value: v })));
        }
        return;
      }
      setSuggestions([]);
    } else {
      const matches = PREFIX_KEYS.filter(k => k.startsWith(input));
      setSuggestions(matches.map(k => ({ type: 'prefix' as const, prefix: isExcluded ? `-${k}` : k, value: '' })));
    }
  }, [currentInput, isInputFocused]);

  useEffect(() => {
    setSelectedSuggestion(-1);
  }, [suggestions]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 500);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setPage(1);
    setAllResults([]);
  }, [debounced, sort]);

  useEffect(() => {
    if (!showSort) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSort();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showSort]);

  useEffect(() => {
    if (showSort) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showSort]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
          setShowSort(true);
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const isSearchActive = typeof debounced === 'string' && debounced.trim().length > 0;

  const { data, isPending, isError } = useQuery({
    queryKey: ['hybrid-search', debounced, sort, page],
    queryFn: async ({ signal }) => {
      if (!isSearchActive) return null;

      let parsedSearch = debounced.trim();
      let parsedGenre: string[] = [];
      let parsedTag: string[] = [];
      let parsedFormat = '';
      let parsedSeason = '';
      let parsedYear = '';
      let parsedStatus = '';
      let parsedGenreNot: string[] = [];
      let parsedTagNot: string[] = [];
      let parsedFormatNot = '';
      let parsedStatusNot = '';
      let parsedRegion = '';

      const tagRegex = /(-?)(genre|tag|format|season|year|status|region):([^\s]+)/gi;
      parsedSearch = parsedSearch.replace(tagRegex, (_, neg, key, value) => {
        const k = key.toLowerCase();
        let v = value.replace(/-/g, ' ').replace(/_/g, ' ');
        if (k === 'genre') {
          v = v.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
          if (v === 'Sci fi' || v === 'Sci Fi') v = 'Sci-Fi';
          if (v === 'Slice Of Life') v = 'Slice of Life';
          if (neg === '-') parsedGenreNot.push(v); else parsedGenre.push(v);
        } else if (k === 'tag') {
          v = v.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
          if (neg === '-') parsedTagNot.push(v); else parsedTag.push(v);
        } else if (k === 'format') {
          if (neg === '-') parsedFormatNot = v.toUpperCase(); else parsedFormat = v.toUpperCase();
        } else if (k === 'season') {
          if (neg !== '-') parsedSeason = v.toUpperCase();
        } else if (k === 'year') {
          if (neg !== '-') parsedYear = v;
        } else if (k === 'status') {
          let val = v.toUpperCase().replace(/\s+/g, '_');
          if (val === 'UPCOMING') val = 'NOT_YET_RELEASED';
          if (val === 'ONGOING') val = 'RELEASING';
          if (val === 'COMPLETED') val = 'FINISHED';
          if (neg === '-') parsedStatusNot = val; else parsedStatus = val;
        } else if (k === 'region') {
          if (neg !== '-') parsedRegion = v.toUpperCase();
        }
        return '';
      }).replace(/\s+/g, ' ').trim();

      const hasFilters = parsedGenre.length > 0 || parsedTag.length > 0 || parsedFormat || parsedSeason || parsedYear || parsedStatus;

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
                ids: aniListIds.length > 0 ? aniListIds.map(Number) : [-1],
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
            for (const item of fromIds) {
              map.set(item.id, item);
            }
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

      const graphqlQuery = `
        query ($page: Int, $search: String, $genre_in: [String], $tag_in: [String], $format: MediaFormat, $season: MediaSeason, $seasonYear: Int, $status: MediaStatus, $countryOfOrigin: CountryCode, $genre_not_in: [String], $tag_not_in: [String], $format_not: MediaFormat, $status_not: MediaStatus, $sort: [MediaSort]) {
          Page(page: $page, perPage: 30) {
            pageInfo { hasNextPage }
            media(search: $search, genre_in: $genre_in, tag_in: $tag_in, format: $format, season: $season, seasonYear: $seasonYear, status: $status, countryOfOrigin: $countryOfOrigin, genre_not_in: $genre_not_in, tag_not_in: $tag_not_in, format_not: $format_not, status_not: $status_not, type: ANIME, isAdult: false, sort: $sort) {
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
      if (parsedSearch) {
        variables.search = parsedSearch;
        variables.sort = ['SEARCH_MATCH', sort];
      } else {
        variables.sort = [sort];
      }
      if (parsedGenre.length > 0) variables.genre_in = parsedGenre;
      if (parsedTag.length > 0) variables.tag_in = parsedTag;
      if (parsedFormat) variables.format = parsedFormat;
      if (parsedSeason) variables.season = parsedSeason;
      if (parsedYear) variables.seasonYear = parseInt(parsedYear);
      if (parsedStatus) variables.status = parsedStatus;
      if (parsedRegion) variables.countryOfOrigin = parsedRegion;
      if (parsedGenreNot.length > 0) variables.genre_not_in = parsedGenreNot;
      if (parsedTagNot.length > 0) variables.tag_not_in = parsedTagNot;
      if (parsedFormatNot) variables.format_not = parsedFormatNot;
      if (parsedStatusNot) variables.status_not = parsedStatusNot;

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
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 500;

      if (isAtBottom && !isPending && data?.hasNextPage) {
        setPage(p => p + 1);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
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

  const filteredResults = allResults;

  return (
    <div className="bg-[var(--md-sys-color-background)] flex flex-col min-h-[80dvh] md:min-h-[calc(100dvh-64px)]">
      <div className="sticky top-0 bg-[var(--md-sys-color-background)] transition-all duration-300 px-4 md:px-8 py-4 z-40 border-b border-[var(--md-sys-color-surface-container)] md:border-transparent">
        <div className="max-w-7xl mx-auto flex items-center gap-3">

          <div className="relative flex-1 min-w-0" ref={containerRef}>
            <div className="absolute inset-y-0 left-0 pl-4 pr-2 flex items-center pointer-events-none text-[var(--md-sys-color-on-surface-variant)] z-10 bg-[var(--md-sys-color-surface-container)] rounded-l-full">
               <SearchIcon />
            </div>
            <div
              className="flex flex-nowrap items-center gap-1 w-full min-h-[56px] pl-12 pr-4 py-2.5 bg-[var(--md-sys-color-surface-container)] rounded-full cursor-text focus-within:ring-2 focus-within:ring-[var(--md-sys-color-primary)] transition-shadow overflow-x-auto scrollbar-hide"
              onClick={() => inputRef.current?.focus()}
            >
              {tokens.map((token, i) => {
                const p = parseToken(token);
                if (p.type === 'filter') {
                  return (
                    <span key={i} className={`inline-flex items-center gap-0.5 whitespace-nowrap ${p.excluded ? 'bg-rose-500/20' : 'bg-black/40'} rounded px-1.5 py-1`}>
                      <span className={`${p.excluded ? 'text-rose-400' : 'text-[var(--md-sys-color-primary)]'} font-semibold text-sm leading-none`}>{p.excluded ? '-' : ''}{p.prefix}:</span>
                      <span className={`${p.excluded ? 'text-rose-200/70' : 'text-white/70'} text-sm leading-none`}>{p.value}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeToken(i); }}
                        className="text-white/40 hover:text-white border-l border-white/10 pl-1.5 ml-1 flex items-center"
                      >
                        <span className="material-symbols-outlined text-[14px] leading-none">close</span>
                      </button>
                    </span>
                  );
                }
                return <span key={i} className="text-white text-sm leading-none">{p.value}</span>;
              })}
              {(() => {
                const m = currentInput.match(FILTER_LIKE_REGEX);
                return (
                  <div className={`relative ${m ? 'inline-flex items-center' : 'flex-1 min-w-[60px]'}`}>
                    {m && (
                      <span className={`flex items-center gap-0.5 rounded px-1.5 py-1 transition-colors ${isArmed ? 'bg-[var(--md-sys-color-primary)]/20 ring-1 ring-[var(--md-sys-color-primary)]' : m[1] === '-' ? 'bg-rose-500/20' : 'bg-black/40'}`}>
                        <span className={`${m[1] === '-' ? 'text-rose-400' : 'text-[var(--md-sys-color-primary)]'} font-semibold text-sm leading-none`}>{m[1]}{m[2]}:</span>
                        <span className={`${m[1] === '-' ? 'text-rose-200/70' : 'text-white/70'} text-sm leading-none`}>{m[3]}</span>
                      </span>
                    )}
                    <input
                      ref={inputRef}
                      type="text"
                      autoFocus
                      placeholder={!m && tokens.length === 0 && !currentInput ? (isInputFocused ? 'Search anime or use genre:action...' : PLACEHOLDERS[placeholderIndex]) : ''}
                      value={currentInput}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      onFocus={() => {
                        setIsInputFocused(true);
                      }}
                      onBlur={() => {
                        setIsInputFocused(false);
                      }}
                      className={`bg-transparent outline-none ${m ? 'absolute inset-0 text-transparent caret-white text-sm font-semibold px-1.5 py-1 border-0 rounded' : 'relative w-full text-[16px] text-white placeholder:text-[var(--md-sys-color-on-surface-variant)]'}`}
                    />
                  </div>
                );
              })()}
            </div>

            <div className={`absolute top-full left-0 right-0 mt-2 bg-[var(--md-sys-color-surface-container-high)] rounded-2xl shadow-xl overflow-hidden py-2 border border-white/5 z-[100] ${!isInputFocused || currentInput ? 'hidden' : ''}`}>
                   {history.length > 0 && (
                    <div className="px-4 py-2 text-xs font-bold text-[var(--md-sys-color-secondary)] uppercase tracking-wider">
                      <span>Recent Searches</span>
                    </div>)}
                   {history.map((item: string, idx: number) => (
                     <div
                       key={item + idx}
                       className="px-4 py-3 flex items-center justify-between hover:bg-white/5 cursor-pointer"
                       onMouseDown={(e) => { e.preventDefault(); handleHistoryClick(item); }}
                     >
                        <div className="flex items-center gap-3">
                          <HistoryIcon />
                          <span className="font-medium text-white">{item}</span>
                        </div>
                        <button onMouseDown={(e) => { e.preventDefault(); removeHistoryItem(e, item); }} className="p-1 hover:bg-white/10 rounded-full text-[var(--md-sys-color-on-surface-variant)] z-10 relative">
                          <CloseIcon />
                        </button>
                     </div>
                   ))}
                   {history.length > 0 && <div className="border-t border-white/5 my-1" />}
                   <div className="px-4 py-2 text-xs font-bold text-[var(--md-sys-color-secondary)] uppercase tracking-wider">Filter by</div>
                    <div className="px-4 pb-3 flex flex-col gap-3">
                      {['genre', 'format', 'year', 'season', 'status', 'tag', 'region'].map(p => (
                        <button
                          key={p}
                          onMouseDown={(e) => { e.preventDefault(); setCurrentInput(p + ':'); inputRef.current?.focus(); }}
                          className="inline-flex items-center gap-0.5 whitespace-nowrap bg-black/40 rounded px-2 py-1 text-sm font-semibold leading-none text-[var(--md-sys-color-primary)] hover:bg-white/10 transition-colors cursor-pointer w-fit"
                        >
                          <span>{p}:</span>
                          <span className="text-white/50">{currentInput.startsWith(p + ':') && currentInput.length > p.length + 1 ? currentInput.slice(p.length + 1) : '...'}</span>
                        </button>
                      ))}
                    </div>
               </div>

            <div className={`absolute top-full left-0 right-0 mt-2 bg-[var(--md-sys-color-surface-container-high)] rounded-2xl shadow-xl overflow-hidden py-2 border border-white/5 z-[100] max-h-48 overflow-y-auto scrollbar-hide ${suggestions.length === 0 ? 'hidden' : ''}`}>
                {suggestions.length > 0 && suggestions[0].type === 'exclude' && (
                  <>
                    <div
                      onMouseDown={(e) => { e.preventDefault(); applySuggestion(suggestions[0]); }}
                      className={`px-4 py-1.5 cursor-pointer text-sm flex items-center transition-colors ${selectedSuggestion === 0 ? 'bg-white/10' : 'hover:bg-white/5'}`}
                    >
                      <span className="inline-flex items-center gap-0.5 whitespace-nowrap bg-rose-500/20 rounded px-2 py-1">
                        <span className="material-symbols-outlined text-rose-400 text-[14px] leading-none mr-1">block</span>
                        <span className="text-rose-400 font-semibold leading-none">-{suggestions[0].prefix}:</span>
                        <span className="text-rose-200/70 leading-none">{suggestions[0].value}</span>
                      </span>
                    </div>
                    <div className="border-t border-white/5 my-1" />
                    <div className="px-4 py-2 text-xs font-bold text-[var(--md-sys-color-secondary)] uppercase tracking-wider">Suggestions</div>
                    {suggestions.slice(1).map((s, idx) => {
                      const actualIdx = idx + 1;
                      return (
                        <div
                          key={`${s.type}-${s.prefix}:${s.value}`}
                          onMouseDown={(e) => { e.preventDefault(); applySuggestion(s); }}
                          className={`px-4 py-1.5 cursor-pointer text-sm flex items-center transition-colors ${actualIdx === selectedSuggestion ? 'bg-white/10' : 'hover:bg-white/5'}`}
                        >
                          <span className="inline-flex items-center gap-0.5 whitespace-nowrap bg-black/40 rounded px-2 py-1">
                            <span className="text-[var(--md-sys-color-primary)] font-semibold leading-none">{s.prefix}:</span>
                            {s.type === 'value' && <span className="text-white/70 leading-none">{s.value}</span>}
                          </span>
                        </div>
                      );
                    })}
                  </>
                )}
                {suggestions.length > 0 && suggestions[0].type !== 'exclude' && (
                  <>
                    <div className="px-4 py-2 text-xs font-bold text-[var(--md-sys-color-secondary)] uppercase tracking-wider">Suggestions</div>
                    {suggestions.map((s, idx) => (
                      <div
                        key={`${s.type}-${s.prefix}:${s.value}`}
                        onMouseDown={(e) => { e.preventDefault(); applySuggestion(s); }}
                        className={`px-4 py-1.5 cursor-pointer text-sm flex items-center transition-colors ${idx === selectedSuggestion ? 'bg-white/10' : 'hover:bg-white/5'}`}
                      >
                        <span className="inline-flex items-center gap-0.5 whitespace-nowrap bg-black/40 rounded px-2 py-1">
                          <span className="text-[var(--md-sys-color-primary)] font-semibold leading-none">{s.prefix}:</span>
                          {s.type === 'value' && <span className="text-white/70 leading-none">{s.value}</span>}
                        </span>
                      </div>
                    ))}
                  </>
                  )}
                </div>
          </div>

          <button
            onClick={() => setShowSort(true)}
            className="relative w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full transition-colors bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-highest)]"
            title="Filter"
          >
            <SortIcon />
            {activeFilterCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] text-[10px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-lg">
                {activeFilterCount}
              </span>
            )}
          </button>

        </div>
      </div>

      <div className="flex-1 flex flex-col h-full">
        <div className="max-w-7xl mx-auto p-4 md:p-8 flex-1 flex flex-col w-full h-full">

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

        {!isSearchActive && (
          <div className="flex-1 w-full flex flex-col items-center justify-center">
            <div className="text-center flex flex-col items-center">
              <span className="material-symbols-outlined text-[32px] text-[var(--md-sys-color-on-surface-variant)] opacity-50 mb-4">search</span>
              <div className="text-[15px] text-white flex flex-col items-center justify-center gap-1.5">
                <span className="text-[var(--md-sys-color-on-surface-variant)] text-center">{randomTip.text}</span>
                <button
                  onClick={() => handleQuickChipClick(randomTip.code)}
                  className="inline-flex items-center gap-0.5 whitespace-nowrap hover:bg-white/5 transition-colors rounded px-2 py-1.5 cursor-pointer text-sm font-sans"
                >
                  {randomTip.code.startsWith('-') ? (
                    <span className="inline-flex items-center gap-0.5 whitespace-nowrap bg-rose-500/20 rounded px-2 py-1">
                      <span className="text-rose-400 font-semibold leading-none">{randomTip.code.split(':')[0]}:</span>
                      <span className="text-rose-200/70 leading-none">{randomTip.code.split(':')[1]}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 whitespace-nowrap bg-black/40 rounded px-2 py-1">
                      <span className="text-[var(--md-sys-color-primary)] font-semibold leading-none">{randomTip.code.split(':')[0]}:</span>
                      <span className="text-white/70 leading-none">{randomTip.code.split(':')[1]}</span>
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

      {/* Sort + Filter Modal */}
      {(showSort || isClosingSort) && (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4">
          <div
            className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${isClosingSort ? 'opacity-0' : 'opacity-100'}`}
            onClick={closeSort}
          />
          <div className={`relative w-full sm:w-[400px] max-h-[60vh] flex flex-col bg-[var(--md-sys-color-surface-container-high)] rounded-2xl shadow-2xl transition-all duration-200 ease-out ${isClosingSort ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>

            <div className="flex items-center justify-between px-6 pb-4 pt-6 border-b border-white/5 shrink-0">
              <h3 className="font-bold text-[13px] text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">SORT &amp; FILTER</h3>
              <div className="flex items-center gap-2">
                <button onClick={closeSort} className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[var(--md-sys-color-on-surface-variant)] text-xs font-mono transition-colors">
                  <span className="text-[11px] font-bold">ESC</span>
                </button>
                <button onClick={closeSort} className="md:hidden w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-[var(--md-sys-color-on-surface-variant)] transition-colors">
                  <CloseIcon />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto scrollbar-hide">
              <div className="mb-8">
                <div className="text-[11px] font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mb-3">SORT BY</div>
                <div className="flex flex-col gap-2">
                  {BASE_SORTS.map(baseKey => {
                    const isActive = sort.startsWith(baseKey);
                    const isDefaultDesc = baseKey !== 'TITLE_ROMAJI';
                    const isDesc = isActive ? sort.endsWith('_DESC') : isDefaultDesc;
                    
                    const handleClick = () => {
                      if (isActive) {
                        const newSort = isDesc ? baseKey : `${baseKey}_DESC`;
                        setSort(newSort as SortOption);
                      } else {
                        const newSort = isDefaultDesc ? `${baseKey}_DESC` : baseKey;
                        setSort(newSort as SortOption);
                      }
                    };

                    return (
                      <button
                        key={baseKey}
                        onClick={handleClick}
                        className={`flex items-center justify-between px-4 py-3.5 rounded-xl text-left font-medium transition-all duration-200 ${
                          isActive
                            ? 'bg-[var(--md-sys-color-primary)]/15 text-[var(--md-sys-color-primary)] ring-1 ring-[var(--md-sys-color-primary)]'
                            : 'bg-white/5 text-[var(--md-sys-color-on-surface)] hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {SORT_LABELS[baseKey]}
                          {isActive && (
                            <svg 
                              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                              className={`transition-transform duration-300 ${!isDesc ? 'rotate-180' : ''}`}
                            >
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <polyline points="19 12 12 19 5 12" />
                            </svg>
                          )}
                        </div>
                        {isActive && (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {FILTER_SECTIONS.map((section) => (
                <div key={section.prefix} className="mb-5 last:mb-0">
                  <div className="text-[11px] font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mb-2.5">{section.label}</div>
                  <div className="flex flex-wrap gap-2">
                    {section.values.map((val) => {
                      const token = `${section.prefix}:${val.toLowerCase().replace(/\s+/g, '_')}`;
                      const isActive = tokens.some(t => t.toLowerCase() === token);
                      return (
                        <button
                          key={val}
                          onClick={() => handleFilterChip(section.prefix, val)}
                          className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 border border-transparent ${
                            isActive
                              ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-md shadow-[var(--md-sys-color-primary)]/20'
                              : 'bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface)] hover:border-[var(--md-sys-color-primary)]/30'
                          }`}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                  {section.prefix === 'year' && (
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const year = formData.get('manualYear') as string;
                        if (year && year.length === 4) {
                          handleFilterChip('year', year);
                          e.currentTarget.reset();
                        }
                      }}
                      className="mt-3 flex"
                    >
                      <input 
                        type="number" 
                        name="manualYear"
                        placeholder="Manual Year (e.g. 2011)"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium text-white placeholder-white/30 outline-none focus:border-[var(--md-sys-color-primary)]/50 focus:bg-white/10 transition-all"
                      />
                      <button 
                        type="submit" 
                        className="ml-2 px-4 py-2.5 rounded-xl bg-[var(--md-sys-color-primary)]/20 text-[var(--md-sys-color-primary)] font-bold text-sm hover:bg-[var(--md-sys-color-primary)]/30 transition-all"
                      >
                        Add
                      </button>
                    </form>
                  )}
                </div>
              ))}
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
