import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import AppShell from '../components/AppShell';
import ErrorBoundary from '../components/ErrorBoundary';
import EpisodeList from '../components/EpisodeList';
import { useLibrary } from '../hooks/useLibrary';
import { useWatchHistory } from '../hooks/useWatchHistory';
import { getWatchUrl } from '../lib/routing';
import React from 'react';

// --- Icons ---
const PlayArrowIcon = (props: any) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M8 5v14l11-7z" />
  </svg>
);

const BookmarkIcon = (props: any) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z" />
  </svg>
);

const BookmarkBorderIcon = (props: any) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2zm0 15l-5-2.18L7 18V5h10v13z" />
  </svg>
);

const StarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--md-sys-color-star)" stroke="var(--md-sys-color-star)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
  </svg>
);

const TrophyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 21h8"></path><path d="M12 17v4"></path><path d="M7 4h10"></path>
    <path d="M17 4v8a5 5 0 0 1-10 0V4"></path><path d="M4 4h3v8a2 2 0 0 0 4 0"></path><path d="M20 4h-3v8a2 2 0 0 1-4 0"></path>
  </svg>
);

const TrendingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
    <polyline points="17 6 23 6 23 12"></polyline>
  </svg>
);

const UsersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

interface AnimeDetailPageProps {
  animeId: string; // Could be AllAnime ID or AniList ID (numeric)
}

interface ShowData {
  _id: string;
  name: string;
  englishName?: string;
  thumbnail: string;
  availableEpisodesDetail: { sub: string[] };
}

function AnimeDetailContent({ animeId }: { animeId: string }) {
  const { toggleLibrary, isInLibrary } = useLibrary();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Identify if URL uses anilistId (numeric)
  const isAnilistId = /^\d+$/.test(animeId);
  const baseAnilistId = isAnilistId ? parseInt(animeId) : null;

  // Resolve AllAnime ID if we have an AniList ID
  const { data: resolvedMapping, isPending: mappingPending } = useQuery<{allanimeId: string | null}>({
    queryKey: ['mapping', animeId],
    queryFn: async ({ signal }) => {
      if (!isAnilistId) return { allanimeId: animeId };
      // Before resolving, we need the title. Let's fetch basic anilist info first
      const query = `
        query($id: Int) {
          Media(id: $id, type: ANIME) {
            title { romaji english }
            seasonYear
            status
          }
        }
      `;
      const anilistRes = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { id: baseAnilistId } }),
        signal,
      });
      if (!anilistRes.ok) return { allanimeId: null };
      const json = await anilistRes.json();
      const media = json?.data?.Media;
      if (!media?.title) return { allanimeId: null };
      

      
      const resolveRes = await fetch('/api/mapping/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          anilistId: baseAnilistId, 
          titleRomaji: media.title.romaji, 
          titleEnglish: media.title.english,
          year: media.seasonYear
        }),
        signal,
      });
      if (!resolveRes.ok) return { allanimeId: null };
      return await resolveRes.json();
    },
    enabled: isAnilistId,
    staleTime: Infinity,
  });

  const allAnimeId = isAnilistId ? resolvedMapping?.allanimeId : animeId;

  const { data: showData, isPending: showPending, isError: showError } = useQuery<ShowData | null>({
    queryKey: ['episodes', allAnimeId],
    queryFn: async ({ signal }) => {
      if (!allAnimeId) return null;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      signal?.addEventListener('abort', () => ctrl.abort(), { once: true });
      try {
        const res = await fetch(`/api/anime/episodes?id=${encodeURIComponent(allAnimeId)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        return json?.data?.show ?? null;
      } finally {
        clearTimeout(timer);
      }
    },
    enabled: !!allAnimeId,
    retry: 1,
  });

  const name = showData?.englishName ?? showData?.name ?? '';
  const thumbnail = showData?.thumbnail ?? '';
  const episodes = [...(showData?.availableEpisodesDetail?.sub ?? [])].sort((a, b) => Number(a) - Number(b));
  // Use animeId (which could be AniList) for library and history to ensure consistency
  const bookmarked = mounted && isInLibrary(animeId);

  const { history } = useWatchHistory();
  const animeHistory = history.filter(e => e.animeId === animeId || e.anilistId === baseAnilistId);
  const episodeProgress: Record<string, number> = {};
  let latestWatchedEp: string | null = null;
  let latestWatchedTs = 0;
  for (const entry of animeHistory) {
    const pct = Math.min((entry.currentTime ?? entry.progressSeconds ?? 0) / (entry.duration || 1440) * 100, 100);
    episodeProgress[entry.episode] = pct;
    if (entry.timestamp > latestWatchedTs) {
      latestWatchedTs = entry.timestamp;
      latestWatchedEp = entry.episode;
    }
  }

  // Pre-cache episode links for the first / latest episode
  useEffect(() => {
    if (!episodes.length || !allAnimeId) return;
    const target = latestWatchedEp || episodes[0];
    fetch(`/api/anime/episode-links?id=${allAnimeId}&episode=${target}`).catch(() => {});
  }, [allAnimeId, episodes, latestWatchedEp]);

  // 1. Fetch Jikan Search
  const forceMalId = animeId === 'nwzocDyuTsx9GCtrt' ? 19 : null;

  const { data: jikanSearchData, isPending: jikanSearchPending } = useQuery<any>({
    queryKey: ['anime-jikan-search', name],
    queryFn: async ({ signal }) => {
      if (!name || forceMalId || baseAnilistId) return null; // Skip if we have anilistId, we will get malId from anilist directly
      const cleanTitle = name.trim();
      const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(cleanTitle)}&limit=5`, { signal });
      if (!res.ok) throw new Error('Jikan fetch failed');
      const json = await res.json();
      const results = json?.data || [];
      const exactMatch = results.find((a: any) =>
        (a.title_english || a.title).toLowerCase() === cleanTitle.toLowerCase()
      );
      return exactMatch || results.find((a: any) => a.type === 'TV') || results[0] || null;
    },
    enabled: !!name && !baseAnilistId,
    staleTime: 1000 * 60 * 60 * 24,
  });

  // 3. Fetch AniList Data for High-Res Images & Characters & idMal
  const { data: anilistData, isPending: anilistPending } = useQuery<any>({
    queryKey: ['anime-anilist-search-full', baseAnilistId || forceMalId || jikanSearchData?.mal_id || name],
    queryFn: async ({ signal }) => {
      const searchMalId = forceMalId || jikanSearchData?.mal_id;
      if (!baseAnilistId && !searchMalId && !name) return null;
      
      const commonFields = `
        idMal
        coverImage { extraLarge }
        bannerImage
        title { romaji english native }
        description(asHtml: false)
        status
        episodes
        seasonYear
        season
        averageScore
        popularity
        format
        genres
        studios(isMain: true) { edges { node { name } } }
        characters(sort: ROLE, perPage: 15) {
          edges {
            role
            node { name { full } image { large } }
          }
        }
      `;

      let query, variables;
      if (baseAnilistId) {
        query = `query($id: Int) { Media(id: $id, type: ANIME) { ${commonFields} } }`;
        variables = { id: baseAnilistId };
      } else if (searchMalId) {
        query = `query($idMal: Int) { Media(idMal: $idMal, type: ANIME) { ${commonFields} } }`;
        variables = { idMal: parseInt(searchMalId) };
      } else {
        const cleanTitle = name.trim();
        query = `query($search: String) { Media(search: $search, type: ANIME, sort: POPULARITY_DESC) { ${commonFields} } }`;
        variables = { search: cleanTitle };
      }

      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
        signal,
      });
      if (!res.ok) throw new Error('AniList fetch failed');
      const json = await res.json();
      return json?.data?.Media || null;
    },
    enabled: !!baseAnilistId || !!forceMalId || !!jikanSearchData?.mal_id || !!name,
    staleTime: 1000 * 60 * 60 * 24,
  });

  // 2. Fetch Jikan Full Data (Now using idMal from AniList if available)
  const malId = forceMalId || anilistData?.idMal || jikanSearchData?.mal_id;
  
  const { data: detailedAnime, isPending: detailedAnimePending } = useQuery<any>({
    queryKey: ['anime-jikan-full', malId],
    queryFn: async ({ signal }) => {
      if (!malId) return null;
      await new Promise(r => setTimeout(r, 600)); // Rate limit prevention
      const res = await fetch(`https://api.jikan.moe/v4/anime/${malId}/full`, { signal });
      if (!res.ok) throw new Error('Jikan full fetch failed');
      const json = await res.json();
      return json?.data || null;
    },
    enabled: !!malId,
    staleTime: 1000 * 60 * 60 * 24,
  });

  const isMetadataPending = 
    (mappingPending) ||
    (!baseAnilistId && name && !forceMalId && jikanSearchPending) || 
    (malId && detailedAnimePending) || 
    ((baseAnilistId || malId || name) && anilistPending);

  // If the user navigates using a stream ID, we update the URL bar once we resolve the AniList ID
  useEffect(() => {
    if (mounted && anilistData?.id && !isAnilistId) {
      import('../lib/routing').then(({ getAnimeUrl }) => {
        const newUrl = getAnimeUrl(anilistData.id, anilistData.title?.english || anilistData.title?.romaji || name);
        if (window.location.pathname !== newUrl) {
          window.history.replaceState(null, '', newUrl);
        }
      });
    }
  }, [mounted, anilistData?.id, isAnilistId]);

  if ((!!allAnimeId && showPending) || isMetadataPending) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <md-circular-progress indeterminate></md-circular-progress>
      </div>
    );
  }

  if (showError || (!showData && !isAnilistId)) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <h2 className="text-[var(--md-sys-color-on-surface-variant)] text-xl">Anime not found.</h2>
      </div>
    );
  }

  // Merge Jikan and AniList data. Prioritize Jikan for stats/info/synopsis as requested.
  const j = detailedAnime || jikanSearchData || {};
  const displayData = {
    title_english: j.title_english || anilistData?.title?.english,
    title: j.title || anilistData?.title?.romaji,
    title_japanese: j.title_japanese || anilistData?.title?.native,
    synopsis: j.synopsis || anilistData?.description,
    year: j.year || anilistData?.seasonYear,
    episodes: j.episodes || anilistData?.episodes,
    status: j.status || anilistData?.status,
    score: j.score || (anilistData?.averageScore ? (anilistData.averageScore / 10).toFixed(2) : 'N/A'),
    popularity: j.popularity || anilistData?.popularity,
    type: j.type || anilistData?.format,
    genres: j.genres || anilistData?.genres?.map((g: string) => ({ name: g })),
    season: j.season || anilistData?.season,
    studios: j.studios || anilistData?.studios?.edges?.map((e: any) => ({ name: e.node.name })),
    characters: anilistData?.characters?.edges?.map((e: any) => ({
      role: e.role,
      character: { name: e.node.name.full, images: { webp: { image_url: e.node.image.large } } }
    })) || j.characters || [],
    duration: j.duration,
    rank: j.rank,
    source: j.source,
    members: j.members,
  };
  
  // Images
  const bannerUrlRaw = anilistData?.bannerImage || detailedAnime?.trailer?.images?.maximum_image_url || j?.images?.webp?.large_image_url || thumbnail;
  const bgImageUrl = bannerUrlRaw?.includes('myanimelist') ? `https://wsrv.nl/?url=${encodeURIComponent(bannerUrlRaw)}` : bannerUrlRaw;
  const posterImg = anilistData?.coverImage?.extraLarge || j?.images?.webp?.large_image_url || thumbnail;

  // Titles
  const displayTitle = displayData?.title_english || displayData?.title || name || (anilistData?.title?.english || anilistData?.title?.romaji);
  const nativeTitle = displayData?.title_japanese || displayData?.title;
  const romajiTitle = isAnilistId ? anilistData?.title?.romaji : detailedAnime?.title;

  const formatNumber = (num?: number) => {
    if (num === undefined || num === null) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="pb-10 bg-[var(--md-sys-color-background)] min-h-screen">
      
      {/* Hero Banner Section */}
      <div className="relative w-full bg-[var(--md-sys-color-background)] pb-12 md:pb-16">
        
        {/* Back Button */}
        <button 
          onClick={() => window.history.length > 1 ? window.history.back() : window.location.href = '/'}
          className="absolute top-4 left-4 md:top-6 md:left-6 z-[60] w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-[var(--md-sys-color-surface-container)] text-white hover:bg-[var(--md-sys-color-primary)] transition-colors shadow-lg border border-white/10"
          aria-label="Go Back"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>

        {/* Backdrop Image */}
        <div className="absolute inset-0 z-0 pointer-events-none hidden md:block overflow-hidden">
          <img src={bgImageUrl} alt="banner" className="w-full h-full object-cover blur-sm opacity-40 scale-105" />
        </div>
        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--md-sys-color-background)] via-[var(--md-sys-color-background)]/80 to-[var(--md-sys-color-background)]/0 z-[1] pointer-events-none hidden md:block" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--md-sys-color-background)] via-[var(--md-sys-color-background)]/90 to-[var(--md-sys-color-background)]/0 z-[1] pointer-events-none hidden md:block" />
        
        {/* Hero Content */}
        <div className="relative z-[2] pt-0 md:pt-28 px-0 md:px-12 lg:px-24 flex flex-col md:flex-row gap-0 md:gap-10 items-stretch md:items-start">
          
          {/* Left Poster */}
          <div className="shrink-0 w-full md:w-[280px] lg:w-[320px] relative flex flex-col">
            <img 
              src={posterImg} 
              alt={displayTitle} 
              className="w-full flex-1 aspect-[2/3] md:aspect-auto object-cover md:rounded-2xl md:shadow-[0_24px_48px_rgba(0,0,0,0.5)] md:border md:border-white/10"
            />
            {/* Gradient overlay for mobile text legibility */}
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[var(--md-sys-color-background)] via-[var(--md-sys-color-background)]/80 to-[var(--md-sys-color-background)]/0 md:hidden pointer-events-none" />
          </div>
          
          {/* Right Info */}
          <div className="flex-1 flex flex-col justify-end text-center md:text-left mt-[-80px] md:mt-auto px-5 md:px-0 pb-0 md:pb-4 w-full z-10 relative">
            
            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-3 items-center justify-center md:justify-start">
              {displayData?.type && (
                <span className="px-2 py-0.5 bg-white text-black text-[11px] sm:text-[12px] font-bold uppercase rounded-[8px] tracking-wider">
                  {displayData.type}
                </span>
              )}
              {[...(displayData?.genres || []), ...(detailedAnime?.themes || [])]
                .filter((item, index, self) => index === self.findIndex((t) => t.name === item.name))
                .map((g: any) => (
                  <span key={`genre-${g.mal_id || g.name}`} className="px-2 py-0.5 bg-[var(--md-sys-color-primary)] text-white text-[11px] sm:text-[12px] font-bold uppercase rounded-[8px] tracking-wider">
                    {g.name}
                  </span>
              ))}
            </div>
            
            {/* Titles */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-2 leading-tight text-white drop-shadow-lg">
              {displayTitle}
            </h1>
            
            {nativeTitle && nativeTitle !== displayTitle && (
              <h2 className={`text-lg md:text-xl font-medium text-white/70 ${romajiTitle && romajiTitle !== displayTitle && romajiTitle !== nativeTitle ? 'mb-1' : 'mb-6'} drop-shadow-md`}>
                {nativeTitle}
              </h2>
            )}
            {romajiTitle && romajiTitle !== displayTitle && romajiTitle !== nativeTitle && (
              <h3 className="text-sm md:text-base font-medium text-[var(--md-sys-color-secondary)] italic mb-6 drop-shadow-md">
                {romajiTitle}
              </h3>
            )}

            {/* Quick Info Separator */}
            <div className="flex flex-wrap justify-center md:justify-start items-center gap-2 mb-8 text-sm font-medium text-white/80">
              {[
                displayData.year,
                displayData.episodes ? `${displayData.episodes} Eps` : null,
                displayData.status
              ].filter(Boolean).map((info, idx, arr) => (
                <React.Fragment key={idx}>
                  <span>{info}</span>
                  {idx < arr.length - 1 && <span className="text-white/20 select-none">|</span>}
                </React.Fragment>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mt-2 justify-center md:justify-start">
              {episodes.length > 0 && allAnimeId ? (
                <div className="w-full sm:w-auto">
                  <a href={`${getWatchUrl(baseAnilistId || allAnimeId, latestWatchedEp || episodes[0], displayTitle)}`} className="block">
                    <md-filled-button class="w-full flex items-center justify-center" style={{ '--md-filled-button-container-height': '48px', '--md-filled-button-label-text-size': '16px' } as any}>
                      <div slot="icon" className="flex items-center justify-center"><PlayArrowIcon /></div>
                      {latestWatchedEp ? `Lanjut ke Ep. ${latestWatchedEp}` : 'Watch Episode 1'}
                    </md-filled-button>
                  </a>
                  {latestWatchedEp && episodeProgress[latestWatchedEp] !== undefined && episodeProgress[latestWatchedEp] > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden max-w-[200px]">
                        <div className="h-full rounded-full bg-[var(--md-sys-color-primary-container)] transition-all" style={{ width: `${Math.min(episodeProgress[latestWatchedEp], 100)}%` }} />
                      </div>
                      <span className="text-[10px] text-white/30 font-medium">{Math.round(Math.min(episodeProgress[latestWatchedEp], 100))}%</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full sm:w-auto">
                  <md-filled-button disabled class="w-full flex items-center justify-center" style={{ '--md-filled-button-container-height': '48px', '--md-filled-button-label-text-size': '16px' } as any}>
                    <div slot="icon" className="flex items-center justify-center"><PlayArrowIcon /></div>
                    Not Available Yet
                  </md-filled-button>
                </div>
              )}
              
              <div 
                className="w-full sm:w-auto cursor-pointer transition-transform duration-200 active:scale-90" 
                onClick={() => toggleLibrary({ animeId, anilistId: baseAnilistId || undefined, animeName: displayTitle || name, thumbnail: posterImg })}
              >
                {bookmarked ? (
                  <md-filled-tonal-button class="w-full sm:w-auto transition-colors flex items-center justify-center" style={{ '--md-filled-tonal-button-container-height': '48px', '--md-filled-tonal-button-label-text-size': '16px' } as any}>
                    <div slot="icon" className="flex items-center justify-center text-[var(--md-sys-color-primary)] animate-[pulse_0.5s_ease-in-out_1]"><BookmarkIcon /></div>
                    Saved to List
                  </md-filled-tonal-button>
                ) : (
                  <md-outlined-button class="w-full sm:w-auto transition-colors flex items-center justify-center" style={{ '--md-outlined-button-container-height': '48px', '--md-outlined-button-label-text-size': '16px' } as any}>
                    <div slot="icon" className="flex items-center justify-center"><BookmarkBorderIcon /></div>
                    Save to List
                  </md-outlined-button>
                )}
              </div>
            </div>
            
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="px-6 md:px-12 lg:px-24 max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-8 lg:gap-12">
        
        {/* Left Content Area */}
        <div className="flex-1 min-w-0 flex flex-col gap-10">
          
          {/* Synopsis */}
          {displayData?.synopsis && (
            <section>
              <h3 className="text-xl font-bold mb-4 flex items-center gap-3 text-white">
                Synopsis
                <div className="flex-1 h-px bg-white/10" />
              </h3>
              <p className="text-[var(--md-sys-color-on-surface-variant)] leading-relaxed text-base md:text-lg whitespace-pre-line">
                {displayData.synopsis.replace('[Written by MAL Rewrite]', '').trim()}
              </p>
            </section>
          )}

          {/* Characters Section */}
          {displayData?.characters && displayData.characters.length > 0 && (
            <section>
              <h3 className="text-xl font-bold mb-4 flex items-center gap-3 text-white">
                Characters
                <div className="flex-1 h-px bg-white/10" />
              </h3>
              <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
                {displayData.characters.slice(0, 15).map((charData: any, idx: number) => {
                  const char = charData.character;
                  return (
                    <div key={idx} className="shrink-0 w-[90px] md:w-[100px] flex flex-col items-center gap-2 snap-start group">
                      <div className="w-[70px] h-[70px] md:w-[80px] md:h-[80px] rounded-full overflow-hidden border-2 border-white/10 group-hover:border-[var(--md-sys-color-primary)] transition-colors shadow-md bg-black/20">
                        <img 
                          src={char.images?.webp?.image_url} 
                          alt={char.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="text-center w-full px-1">
                        <p className="text-[11px] md:text-xs font-bold text-white line-clamp-2 leading-tight">{char.name}</p>
                        <p className="text-[9px] md:text-[10px] text-[var(--md-sys-color-on-surface-variant)] line-clamp-1 mt-0.5">{charData.role}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          
          {/* Episodes List Section */}
          <section id="episodes">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-3 text-white">
              Episodes ({episodes.length})
              <div className="flex-1 h-px bg-white/10" />
            </h3>
            <div className="bg-[var(--md-sys-color-surface-container)] rounded-[var(--md-sys-shape-corner-large)] border border-white/5 p-4 md:p-6">
              {allAnimeId ? (
                <EpisodeList animeId={baseAnilistId ? String(baseAnilistId) : allAnimeId} animeName={displayTitle} episodes={episodes} episodeProgress={episodeProgress} />
              ) : (
                <div className="text-center text-[var(--md-sys-color-on-surface-variant)] py-4">No episodes found or upcoming.</div>
              )}
            </div>
          </section>

        </div>

        {/* Right Sidebar (Stats & Info) */}
        <div className="w-full lg:w-[320px] shrink-0 flex flex-col gap-6">
          
          {/* Stats Bento Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-1 bg-[var(--md-sys-color-surface-container)] rounded-[var(--md-sys-shape-corner-large)] p-4 border border-white/5 flex flex-col items-center justify-center text-center transition-colors hover:bg-[var(--md-sys-color-surface-container-high)]">
              <StarIcon />
              <p className="text-2xl font-black text-white mt-2 mb-0">{displayData?.score || 'N/A'}</p>
              <p className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider font-bold">Score</p>
            </div>
            <div className="col-span-1 bg-[var(--md-sys-color-surface-container)] rounded-[var(--md-sys-shape-corner-large)] p-4 border border-white/5 flex flex-col items-center justify-center text-center transition-colors hover:bg-[var(--md-sys-color-surface-container-high)]">
              <TrophyIcon />
              <p className="text-2xl font-black text-white mt-2 mb-0">#{displayData?.rank || '?'}</p>
              <p className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider font-bold">Rank</p>
            </div>
            <div className="col-span-1 bg-[var(--md-sys-color-surface-container)] rounded-[var(--md-sys-shape-corner-large)] p-4 border border-white/5 flex flex-col items-center justify-center text-center transition-colors hover:bg-[var(--md-sys-color-surface-container-high)]">
              <TrendingIcon />
              <p className="text-2xl font-black text-white mt-2 mb-0">#{displayData?.popularity || '?'}</p>
              <p className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider font-bold">Popularity</p>
            </div>
            <div className="col-span-1 bg-[var(--md-sys-color-surface-container)] rounded-[var(--md-sys-shape-corner-large)] p-4 border border-white/5 flex flex-col items-center justify-center text-center transition-colors hover:bg-[var(--md-sys-color-surface-container-high)]">
              <UsersIcon />
              <p className="text-xl font-black text-white mt-2 mb-0">{formatNumber(displayData?.members)}</p>
              <p className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider font-bold">Members</p>
            </div>
          </div>

          {/* Details List */}
          <div className="bg-[var(--md-sys-color-surface-container)] rounded-[var(--md-sys-shape-corner-large)] p-5 border border-white/5">
             <h3 className="text-base font-bold mb-4 text-white uppercase tracking-wider">Information</h3>
             
             <div className="flex flex-col gap-3 text-sm">
               <div className="flex justify-between items-center pb-2 border-b border-white/5">
                 <span className="text-[var(--md-sys-color-on-surface-variant)]">Format</span>
                 <span className="font-medium text-white">{displayData?.type || 'Unknown'}</span>
               </div>
               <div className="flex justify-between items-center pb-2 border-b border-white/5">
                 <span className="text-[var(--md-sys-color-on-surface-variant)]">Episodes</span>
                 <span className="font-medium text-white">{displayData?.episodes || 'Unknown'}</span>
               </div>
               <div className="flex justify-between items-center pb-2 border-b border-white/5">
                 <span className="text-[var(--md-sys-color-on-surface-variant)]">Duration</span>
                 <span className="font-medium text-white text-right max-w-[150px] truncate">{displayData?.duration || 'Unknown'}</span>
               </div>
               <div className="flex justify-between items-center pb-2 border-b border-white/5">
                 <span className="text-[var(--md-sys-color-on-surface-variant)]">Status</span>
                 <span className="font-medium text-white">{displayData?.status || 'Unknown'}</span>
               </div>
               <div className="flex justify-between items-center pb-2 border-b border-white/5">
                 <span className="text-[var(--md-sys-color-on-surface-variant)]">Season</span>
                 <span className="font-medium text-white capitalize">{displayData?.season && displayData?.year ? `${displayData.season} ${displayData.year}` : 'Unknown'}</span>
               </div>
               <div className="flex justify-between items-center pb-2 border-b border-white/5">
                 <span className="text-[var(--md-sys-color-on-surface-variant)]">Source</span>
                 <span className="font-medium text-white">{displayData?.source || 'Unknown'}</span>
               </div>
               <div className="flex justify-between items-start pb-2 border-b border-white/5">
                 <span className="text-[var(--md-sys-color-on-surface-variant)] shrink-0">Studios</span>
                 <span className="font-medium text-[var(--md-sys-color-primary)] text-right pl-4">
                   {displayData?.studios?.length > 0 ? displayData.studios.map((s: any) => s.name).join(', ') : 'Unknown'}
                 </span>
               </div>
             </div>
          </div>
          
        </div>
        
      </div>
    </div>
  );
}

export default function AnimeDetailPage({ animeId }: AnimeDetailPageProps) {
  return (
    <AppShell>
      <ErrorBoundary>
        <AnimeDetailContent animeId={animeId} />
      </ErrorBoundary>
    </AppShell>
  );
}
