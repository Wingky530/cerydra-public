import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getWatchUrl } from '../lib/routing';
import Md3VideoPlayer from './Md3VideoPlayer';
import { useWatchHistory } from '../hooks/useWatchHistory';

interface DirectLink {
  link?: string;
  resolution?: string;
  hls?: boolean;
}

interface Source {
  sourceName?: string;
  type?: string;
  decodedPath?: string;
  directLinks?: (string | DirectLink)[];
  tracks?: any[];
}

interface EpisodeLinksResult {
  episode?: string;
  title?: string;
  thumbnail?: string;
  synopsis?: string;
  episodeSynopsis?: string;
  sources?: Source[];
}

interface ShowData {
  _id: string;
  name: string;
  englishName?: string;
  thumbnail: string;
  availableEpisodesDetail: { sub: string[] };
}

const ChevronDownIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

const ChevronLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"></polyline>
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
);

const PlayIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"></polygon>
  </svg>
);

const AlertIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);



function wrapWorkerUrl(rawUrl: string, source?: string, ext: string = '.mp4'): string {
  const base = `https://video.cerydra.my.id/?url=${encodeURIComponent(rawUrl)}`;
  const urlWithSource = source ? `${base}&source=${encodeURIComponent(source)}` : base;
  return `${urlWithSource}&ext=${ext}`;
}

export default function WatchContent({ animeId, episode, initialTime: ssrInitialTime, isMini, autoPlay, anilistId: propAnilistId }: { animeId: string; episode: string; initialTime?: number; isMini?: boolean; autoPlay?: boolean; anilistId?: number }) {
  const queryClient = useQueryClient();
  const [failedSources, setFailedSources] = useState<number[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [mobileTab, setMobileTab] = useState<'episodes' | 'details'>('episodes');
  const episodeListRef = useRef<HTMLDivElement>(null);
  const activeEpRef = useRef<HTMLAnchorElement>(null);
  const lastSavedTime = useRef<number>(0);
  const durationRef = useRef<number>(0);
  const refetchAttemptsRef = useRef(0);

  const [activeSourceIdx, setActiveSourceIdx] = useState<number>(-1);
  const [sourceVariantMap, setSourceVariantMap] = useState<Record<number, '.mp4' | '.m3u8'>>({});
  const [iframeUrl, setIframeUrl] = useState<string>('');
  const [translationMode, setTranslationMode] = useState<'sub' | 'sub-id' | 'dub'>('sub');
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [useMegaPlayFallback, setUseMegaPlayFallback] = useState(false);
  const [hfResolvedUrl, setHfResolvedUrl] = useState<string>('');
  const [hfResolving, setHfResolving] = useState(false);
  const [nocache, setNocache] = useState(false);
  const [activeQualityIdx, setActiveQualityIdx] = useState<number>(-1);
  const [showSourceList, setShowSourceList] = useState(false);
  const [epRange, setEpRange] = useState(0);
  const [epRangeDesktop, setEpRangeDesktop] = useState(0);
  const mobileGridRef = useRef<HTMLDivElement>(null);
  const desktopGridRef = useRef<HTMLDivElement>(null);
  const [mobileCellSize, setMobileCellSize] = useState(0);
  const [desktopCellSize, setDesktopCellSize] = useState(0);
  const [showRangeDropdown, setShowRangeDropdown] = useState(false);
  const [showRangeDropdownDesktop, setShowRangeDropdownDesktop] = useState(false);
  const [epSearch, setEpSearch] = useState('');
  const [epSearchDesktop, setEpSearchDesktop] = useState('');
  const [highlightedEp, setHighlightedEp] = useState<string | null>(null);

  useEffect(() => {
    setFailedSources([]);
    refetchAttemptsRef.current = 0;
    setActiveSourceIdx(-1);
    setSourceVariantMap({});
    setIframeUrl('');
    setNocache(false);
    setActiveQualityIdx(-1);
    setEpRange(0);
    setEpRangeDesktop(0);
  }, [episode]);

  useEffect(() => {
    if (isMini) return;
    
    // Small delay to ensure DOM is painted, especially when switching tabs
    const timer = setTimeout(() => {
      const containers = document.querySelectorAll('.cerydra-ep-list-container');
      const targets = document.querySelectorAll('.cerydra-active-ep');
      
      let container: Element | null = null;
      let target: Element | null = null;
      
      for (let i = 0; i < containers.length; i++) {
        if (containers[i].clientHeight > 0) {
          container = containers[i];
          target = targets[i];
          break;
        }
      }
      
      if (container && target) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const relativeOffset = targetRect.top - containerRect.top;
        const centerOffset = containerRect.height / 2 - targetRect.height / 2;
        container.scrollTo({
          top: container.scrollTop + relativeOffset - centerOffset,
          behavior: 'smooth'
        });
      }
    }, 50);
    
    return () => clearTimeout(timer);
  }, [episode, isMini, mobileTab, epRange]);

  useEffect(() => {
    if (!mobileGridRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setMobileCellSize(Math.floor((w - 5 * 6) / 6));
    });
    ro.observe(mobileGridRef.current);
    return () => ro.disconnect();
  }, [mobileTab]);

  useEffect(() => {
    if (!desktopGridRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setDesktopCellSize(Math.floor((w - 5 * 6) / 6));
    });
    ro.observe(desktopGridRef.current);
    return () => ro.disconnect();
  }, []);

  const [resolvedInitialTime, setResolvedInitialTime] = useState<number | undefined>(
    ssrInitialTime && ssrInitialTime > 0 ? ssrInitialTime : undefined
  );
  const { history, isLoading, saveProgress } = useWatchHistory();

  const isAnilistId = /^\d+$/.test(animeId);
  const baseAnilistId = isAnilistId ? parseInt(animeId) : null;
  
  const { data: resolvedMapping, isPending: mappingPending } = useQuery<{allanimeId: string | null}>({
    queryKey: ['mapping', animeId],
    queryFn: async ({ signal }) => {
      if (!isAnilistId) return { allanimeId: animeId };
      const anilistRes = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query($id: Int) { Media(id: $id, type: ANIME) { title { english romaji } seasonYear status } }`,
          variables: { id: baseAnilistId },
        }),
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

  useEffect(() => {
    setResolvedInitialTime(ssrInitialTime && ssrInitialTime > 0 ? ssrInitialTime : undefined);
  }, [ssrInitialTime, allAnimeId, episode]);

  useEffect(() => {
    if (resolvedInitialTime === undefined && !isLoading && allAnimeId) {
      const entry = history.find(e => e.animeId === allAnimeId && e.episode === episode);
      if (entry?.currentTime && entry.currentTime > 0) {
        setResolvedInitialTime(entry.currentTime);
      } else {
        setResolvedInitialTime(0);
      }
    }
  }, [isLoading, history, allAnimeId, episode, resolvedInitialTime]);

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
      } finally { clearTimeout(timer); }
    },
    enabled: !!allAnimeId,
    retry: 1,
  });

  const initialAnilistId = baseAnilistId || propAnilistId;

  const { data: anilistData, isFetching: anilistFetching } = useQuery<any>({
    queryKey: ['watch-anilist-meta', showData?.name, initialAnilistId],
    queryFn: async ({ signal }) => {
      let query, variables;
      if (initialAnilistId) {
        query = `
          query($id: Int) {
            Media(id: $id, type: ANIME) {
              id
              title { english romaji }
              coverImage { extraLarge }
              bannerImage
              description
              genres
              meanScore
              studios { nodes { name } }
              episodes
              status
              format
              season
              seasonYear
              duration
              source
              rankings { rank type }
              popularity
              trailer { id site }
              recommendations(sort: RATING_DESC, page: 1, perPage: 12) {
                nodes {
                  mediaRecommendation {
                    id
                    title { english romaji }
                    coverImage { extraLarge }
                  }
                }
              }
            }
          }
        `;
        variables = { id: initialAnilistId };
      } else if (showData?.name) {
        const cleanName = showData.name.replace(/^#\d+\s+/, '').replace(/\s+hd$/i, '').trim();
        let malId = null;
        try {
          const jRes = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(cleanName)}&limit=1`, { signal });
          const jData = await jRes.json();
          if (jData?.data?.[0]?.mal_id) {
            malId = jData.data[0].mal_id;
          }
        } catch (e) {
          console.warn('Jikan search failed:', e);
        }

        if (malId) {
          query = `
            query($idMal: Int) {
              Media(idMal: $idMal, type: ANIME) {
                id
                title { english romaji }
                coverImage { extraLarge }
                bannerImage
                description
                genres
                meanScore
                studios { nodes { name } }
                episodes
                status
                format
                season
                seasonYear
                duration
                source
                rankings { rank type }
                popularity
                trailer { id site }
                recommendations(sort: RATING_DESC, page: 1, perPage: 12) {
                  nodes {
                    mediaRecommendation {
                      id
                      title { english romaji }
                      coverImage { extraLarge }
                    }
                  }
                }
              }
            }
          `;
          variables = { idMal: parseInt(malId) };
        } else {
          query = `
            query ($search: String) {
              Media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
                id
                title { english romaji }
                coverImage { extraLarge }
                bannerImage
                description
                genres
                meanScore
                studios { nodes { name } }
                episodes
                status
                format
                season
                seasonYear
                duration
                source
                rankings { rank type }
                popularity
                trailer { id site }
                recommendations(sort: RATING_DESC, page: 1, perPage: 12) {
                  nodes {
                    mediaRecommendation {
                      id
                      title { english romaji }
                      coverImage { extraLarge }
                    }
                  }
                }
              }
            }
          `;
          variables = { search: cleanName };
        }
      } else {
        return null;
      }

      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
        signal,
      });
      const json = await res.json();
      return json?.data?.Media || null;
    },
    enabled: !!showData?.name || !!initialAnilistId,
    staleTime: 1000 * 60 * 60 * 24,
  });

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['watch-anilist-meta'] });
  }, []);

  const activeAnilistId = initialAnilistId || anilistData?.id;

  const { data: episodeData, isPending: episodePending, isError: episodeError, isFetching: isFetchingLinks } = useQuery<EpisodeLinksResult | null>({
    queryKey: ['episode-links', allAnimeId, episode, translationMode, nocache, activeAnilistId],
    queryFn: async ({ signal }) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      signal?.addEventListener('abort', () => ctrl.abort(), { once: true });
      try {
        const queryId = allAnimeId || animeId;
        const res = await fetch(`/api/anime/episode-links?id=${encodeURIComponent(queryId)}&episode=${encodeURIComponent(episode)}&mode=${translationMode}${nocache ? '&nocache=1' : ''}${activeAnilistId ? `&anilistId=${activeAnilistId}` : ''}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      } finally { clearTimeout(timer); }
    },
    enabled: (!!allAnimeId || !!activeAnilistId) && (!showPending && !anilistFetching),
    retry: 1,
  });

  const { data: subtitleData } = useQuery<any>({
    queryKey: ['subtitles', anilistData?.id, episode],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/anime/subtitles?anilistId=${anilistData.id}&episode=${episode}`, { signal });
      if (!res.ok) throw new Error('Failed to fetch subtitles');
      return res.json();
    },
    enabled: !!anilistData?.id,
  });

  const animeTitle = anilistData?.title?.english || showData?.englishName || anilistData?.title?.romaji || showData?.name || episodeData?.title || 'Anime';
  const animeThumbnail = anilistData?.coverImage?.extraLarge || showData?.thumbnail || episodeData?.thumbnail || '';

  useEffect(() => {
    if (animeTitle) {
      import('../store/player').then(({ playerStore }) => {
        playerStore.setKey('animeName', animeTitle);
        if (animeThumbnail) {
          playerStore.setKey('thumbnail', animeThumbnail);
        }
      });
    }
  }, [animeTitle, animeThumbnail]);

  const sources = useMemo(() => {
    const raw = episodeData?.sources ?? [];
    return [...raw].sort((a, b) => {
      const aMega = a.sourceName?.toLowerCase().includes('mega') ? 1 : 0;
      const bMega = b.sourceName?.toLowerCase().includes('mega') ? 1 : 0;
      return aMega - bMega;
    });
  }, [episodeData?.sources]);

  // Group sub-id sources by base name: "vidhide (360p)" → group "vidhide" with all quality indices.
  const sourceGroups = useMemo(() => {
    if (translationMode !== 'sub-id' || sources.length === 0) return null;
    const map = new Map<string, { label: string; indices: number[] }>();
    sources.forEach((s, i) => {
      const name = s.sourceName || `Source ${i + 1}`;
      const base = name.replace(/\s*\(\d+p\)$/i, '').replace(/hd$/i, '').trim();
      if (!map.has(base)) map.set(base, { label: base, indices: [] });
      map.get(base)!.indices.push(i);
    });
    return Array.from(map.values());
  }, [sources, translationMode]);

  // --- Auto / User source selection ---
  const { selectedSourceIdx, selectedSource } = useMemo(() => {
    if (activeSourceIdx >= 0 && !failedSources.includes(activeSourceIdx) && sources[activeSourceIdx]) {
      return { selectedSourceIdx: activeSourceIdx, selectedSource: sources[activeSourceIdx] };
    }
    const working = sources
      .map((s, i) => ({ ...s, originalIdx: i }))
      .filter(s => !failedSources.includes(s.originalIdx));

    let auto;
    if (translationMode === 'sub-id') {
      // Prioritaskan yang punya directLinks (bisa play di Md3VideoPlayer dengan setting resolusi), kecuali Mega dan Desu yang dipaksa iframe
      auto =
        working.find(s => s.directLinks && s.directLinks.length > 0 && !s.sourceName?.toLowerCase().includes('mega') && !s.sourceName?.toLowerCase().includes('desu')) ||
        working[0];
    } else {
      // Prioritaskan Ok dan S-mp4 untuk Sub & Dub EN
      auto =
        working.find(s => s.sourceName === 'Ok') ||
        working.find(s => s.sourceName === 'S-mp4') ||
        working.find(s => s.sourceName === 'MegaPlay') ||
        working.find(s => s.sourceName === 'Mp4') ||
        working.find(s => s.type === 'player') ||
        working.find(s => s.directLinks && s.directLinks.length > 0) ||
        working[0];
    }

    return { selectedSourceIdx: auto ? auto.originalIdx : -1, selectedSource: auto || null };
  }, [activeSourceIdx, activeQualityIdx, failedSources, sources, translationMode]);

  // Compute quality variants for the active source group (sub-id only)
  const { qualityList, activeQualityLabel } = useMemo(() => {
    if (translationMode !== 'sub-id' || !sourceGroups || selectedSourceIdx < 0) {
      return { qualityList: [] as { label: string; idx: number }[], activeQualityLabel: '' };
    }
    const group = sourceGroups.find(g => g.indices.includes(selectedSourceIdx));
    if (!group) {
      return { qualityList: [] as { label: string; idx: number }[], activeQualityLabel: '' };
    }
    const list = group.indices.map(idx => {
      const s = sources[idx];
      const name = s.sourceName || '';
      const qualMatch = name.match(/(\d+p)/i);
      return { label: qualMatch ? qualMatch[1] : name, idx };
    });
    const activeLabel = list.find(q => q.idx === selectedSourceIdx)?.label || '';
    return { qualityList: list, activeQualityLabel: activeLabel };
  }, [translationMode, sourceGroups, selectedSourceIdx, sources]);

  const handleQualityChange = useCallback((idx: number) => {
    setActiveSourceIdx(idx);
    setActiveQualityIdx(idx);
    setFailedSources(prev => prev.filter(f => f !== idx));
  }, []);

  // Resolve Ok/Mp4/HLS embeds via HF Space Playwright
  useEffect(() => {
    if (!selectedSource || translationMode !== 'sub') { 
      setHfResolvedUrl(''); 
      setHfResolving(false);
      return; 
    }
    const src = selectedSource;
    const isSmp4 = src.type === 's-mp4';
    const isPlayer = src.type === 'player';
    const hasDirect = (src.directLinks?.length ?? 0) > 0;
    const isEmbed = (src.sourceName === 'Ok' || src.sourceName === 'Mp4' || src.type === 'hls' || src.sourceName?.toLowerCase().includes('hls'));
    if (isSmp4 || isPlayer || hasDirect || !isEmbed) { 
      setHfResolvedUrl(''); 
      setHfResolving(false);
      return; 
    }

    const embedUrl = src.decodedPath;
    if (!embedUrl) { 
      setHfResolvedUrl(''); 
      setHfResolving(false);
      return; 
    }
    const sourceName = src.sourceName || 'generic';

    setHfResolving(true);
    fetch(`/api/anime/resolve-source?url=${encodeURIComponent(embedUrl)}&sourceName=${encodeURIComponent(sourceName)}`, { signal: AbortSignal.timeout(20000) })
      .then(r => r.ok ? r.json() : Promise.reject('resolve failed'))
      .then(data => { setHfResolvedUrl(data.url || ''); })
      .catch(() => { setHfResolvedUrl(''); })
      .finally(() => setHfResolving(false));
  }, [selectedSourceIdx, selectedSource, translationMode]);

  // --- All sources resolved by Cloudflare Worker (cerydra-video-proxy) ---
  // S-mp4 (clock.json), Ok, Mp4, and generic embeds are handled by Worker
  // which resolves from Worker IP to avoid IP-locking. Backend resolve-source.ts is deprecated.

  const handleProgressRefined = useCallback((currentTime: number, duration: number) => {
    if (!animeId || !episode) return;
    durationRef.current = duration;
    lastSavedTime.current = currentTime;
    const entry = {
      animeId: (activeAnilistId ? activeAnilistId.toString() : (allAnimeId || animeId)),
      animeName: animeTitle,
      thumbnail: animeThumbnail,
      episode,
      timestamp: Date.now(),
      progressSeconds: currentTime,
      currentTime,
      duration,
    };
    saveProgress(entry);
  }, [allAnimeId, episode, animeTitle, animeThumbnail, saveProgress, activeAnilistId]);

  const handleEndedRefined = () => {
    if (!animeId || !episode) return;
    const duration = durationRef.current;
    const entry = {
      animeId: (activeAnilistId ? activeAnilistId.toString() : (allAnimeId || animeId)),
      animeName: animeTitle,
      thumbnail: animeThumbnail,
      episode,
      timestamp: Date.now(),
      progressSeconds: duration || 9999,
      currentTime: duration || 9999,
      duration: duration || 9999,
    };
    saveProgress(entry);

    const autonext = localStorage.getItem('cerydra_autonext') !== 'false';
    if (autonext && nextEp) {
      window.setTimeout(async () => {
        const { navigate } = await import('astro:transitions/client');
        navigate(getWatchUrl(isAnilistId ? parseInt(animeId) : allAnimeId || animeId, nextEp, showData?.name));
      }, 800);
    }
  };

  const handleSourceClick = (idx: number) => {
    if (idx === activeSourceIdx) return;
    setActiveSourceIdx(idx);
    // resolve trigger via useEffect
  };

  const handleSourceError = () => {
    if (selectedSourceIdx >= 0 && sources[selectedSourceIdx]) {
      const src = sources[selectedSourceIdx];
      const isHls = src.sourceName?.toLowerCase().includes('hls') || src.type === 'hls';
      const currentVar = sourceVariantMap[selectedSourceIdx] || (isHls ? '.m3u8' : '.mp4');

      // Some proxy sources (like Ok) might return M3U8 instead of MP4. 
      // If native MP4 provider fails, try HLS provider before completely marking as failed.
      if (currentVar === '.mp4' && !src.directLinks?.length) {
        setSourceVariantMap(prev => ({ ...prev, [selectedSourceIdx]: '.m3u8' }));
        return;
      }
      
      const newFailed = [...failedSources, selectedSourceIdx];
      setFailedSources(newFailed);
      console.warn(`[WatchContent] Source failed: ${sources[selectedSourceIdx]?.sourceName || selectedSourceIdx}`);
      const stillWorking = sources.filter((_, i) => !newFailed.includes(i)).length;
      if (stillWorking <= 1 && refetchAttemptsRef.current < 1) {
        refetchAttemptsRef.current += 1;
        setFailedSources([]);
        setActiveSourceIdx(-1);
        setNocache(true);
      }
    }
  };

  let activeUrl = '';
  let isResolving = false;
  let resolveError = '';

  if (selectedSource) {
    const isPlayer = selectedSource.type === 'player';
    const isSmp4 = selectedSource.type === 's-mp4';
    const nameLower = selectedSource.sourceName?.toLowerCase() || '';
    const hasDirect = (selectedSource.directLinks?.length ?? 0) > 0 && !nameLower.includes('mega') && !nameLower.includes('desu');
    const isHlsSource = nameLower.includes('hls') || selectedSource.type === 'hls';
    const isEmbed = selectedSource.sourceName === 'Ok' || selectedSource.sourceName === 'Mp4' || isHlsSource;
    const sourceVariant = sourceVariantMap[selectedSourceIdx] || (isHlsSource ? '.m3u8' : '.mp4');

    if (hasDirect) {
      // Always prefer extracted directLinks over embed URL (covers sub-id vidhide/odstream/desustream)
      const firstLink = selectedSource.directLinks![0];
      const rawUrl = typeof firstLink === 'string' ? firstLink : firstLink.link || '';
      const isHls = typeof firstLink === 'string' ? rawUrl.includes('.m3u8') : !!firstLink.hls;
      if (rawUrl.includes('blogger.com')) {
        // iframeUrl will be set by useEffect below
      } else if (rawUrl.includes('archive.org') || selectedSource.sourceName?.includes('MegaPlay')) {
        // archive.org supports CORS but blocks Cloudflare Workers; bypass proxy
        // MegaPlay streams are direct HLS with custom loader, bypass proxy
        activeUrl = rawUrl;
      } else {
        activeUrl = wrapWorkerUrl(rawUrl, undefined, isHls ? '.m3u8' : '.mp4');
      }
    } else if (isPlayer) {
      activeUrl = selectedSource.decodedPath || '';
    } else if (isSmp4) {
      activeUrl = wrapWorkerUrl(selectedSource.decodedPath || '', 's-mp4', sourceVariant);
    } else if (isEmbed && hfResolvedUrl) {
      // HF Space resolved the embed to a direct video URL → proxy it through Worker
      activeUrl = wrapWorkerUrl(hfResolvedUrl, undefined, sourceVariant);
    } else if (isEmbed && hfResolving) {
      isResolving = true;
    } else if (isHlsSource || !isEmbed) {
      // HLS or other generic embeds (Sw, Vg, etc.) without direct links: render as iframe.
      // iframeUrl is set via useEffect below.
    } else {
      // Fallback: Worker handles embed resolution directly
      const embedUrl = selectedSource.decodedPath || '';
      const sourceName = selectedSource.sourceName || 'generic';
      activeUrl = wrapWorkerUrl(embedUrl, sourceName, sourceVariant);
    }
  }


  // Set iframeUrl for generic embeds that can't be resolved (Sw, Vg, Yt-mp4, Default)
  const isDownloadable = activeUrl && !activeUrl.includes('.m3u8') && !activeUrl.includes('.m3u');
  let downloadUrl = activeUrl;
  if (isDownloadable) {
    const safeTitle = (animeTitle || 'Anime').replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '_');
    const customFilename = `Cerydra_${safeTitle}_Ep_${episode}.mp4`;
    const proxyDomain = new URL(import.meta.env.PUBLIC_VIDEO_PROXY_URL || 'https://cerydra-video-proxy.wingky530-id.workers.dev').hostname;
    if (downloadUrl.includes(proxyDomain)) {
      downloadUrl = downloadUrl.replace(proxyDomain, 'download.cerydra.my.id');
      
      if (downloadUrl.includes('/?url=')) {
        downloadUrl = downloadUrl.replace('/?url=', `/${customFilename}?url=`);
      }
    }
    if (downloadUrl.includes('?')) downloadUrl += '&download=1';
    else downloadUrl += '?download=1';
  }
  // Also handles blogger.com directLinks (updesu mirrors) and explicit iframe types
  useEffect(() => {
    if (!selectedSource) { setIframeUrl(''); return; }
    const isPlayer = selectedSource.type === 'player';
    const isSmp4 = selectedSource.type === 's-mp4';
    const nameLower = selectedSource.sourceName?.toLowerCase() || '';
    const hasDirect = (selectedSource.directLinks?.length ?? 0) > 0 && !nameLower.includes('mega') && !nameLower.includes('desu');
    const isOkMp4 = selectedSource.sourceName === 'Ok' || selectedSource.sourceName === 'Mp4';
    const isHls = nameLower.includes('hls') || selectedSource.type === 'hls';

    if (selectedSource.type === 'iframe' && selectedSource.decodedPath && !isOkMp4) {
      setIframeUrl(selectedSource.decodedPath);
      return;
    }

    // blogger.com directLinks must render as iframe (updesu mirror)
    if (hasDirect) {
      const firstLink = selectedSource.directLinks![0];
      const rawUrl = typeof firstLink === 'string' ? firstLink : (firstLink as any).link || '';
      if (rawUrl.includes('blogger.com')) {
        setIframeUrl(rawUrl);
        return;
      }
      setIframeUrl('');
      return;
    }

    if (((!hasDirect && !isOkMp4 && !isSmp4 && !isPlayer) || (isHls && !hasDirect)) && selectedSource.decodedPath) {
      let iframeTarget = selectedSource.decodedPath;
      if (iframeTarget.startsWith('//')) {
        iframeTarget = `https:${iframeTarget}`;
      } else if (iframeTarget.startsWith('/')) {
        iframeTarget = `https://allanime.day${iframeTarget}`;
      }
      setIframeUrl(iframeTarget);
    } else {
      setIframeUrl('');
    }
  }, [selectedSourceIdx, selectedSource]);


  const episodeList = [...(showData?.availableEpisodesDetail?.sub ?? [])].sort((a, b) => Number(a) - Number(b));
  const currentEpIndex = episodeList.findIndex(e => e === episode);
  const nextEp = currentEpIndex !== -1 && currentEpIndex < episodeList.length - 1 ? episodeList[currentEpIndex + 1] : null;
  const prevEp = currentEpIndex > 0 ? episodeList[currentEpIndex - 1] : null;
  const totalRangesMobile = Math.ceil(episodeList.length / 50);
  const rangeEpsMobile = episodeList.slice(epRange * 50, (epRange + 1) * 50);
  const totalRangesDesktop = Math.ceil(episodeList.length / 100);
  const rangeEpsDesktop = episodeList.slice(epRangeDesktop * 100, (epRangeDesktop + 1) * 100);
  useEffect(() => {
    if (currentEpIndex >= 0) {
      setEpRange(Math.floor(currentEpIndex / 50));
    }
  }, [currentEpIndex]);
  useEffect(() => {
    if (currentEpIndex >= 0) {
      setEpRangeDesktop(Math.floor(currentEpIndex / 100));
    }
  }, [currentEpIndex]);
  const synopsis = episodeData?.episodeSynopsis || episodeData?.synopsis || '';
  const cleanSynopsis = synopsis.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace('[Written by MAL Rewrite]', '').trim();

  const renderDetails = (isDesktop = false, sidebarOpen = false) => {
    if (!anilistData && !cleanSynopsis) {
      return (
        <div className="p-4 md:p-8 pt-6">
          <p className="text-[var(--md-sys-color-on-surface-variant)] italic text-sm">No details available</p>
        </div>
      );
    }

    const title = anilistData?.title?.english || animeTitle;
    const desc = (anilistData?.description || cleanSynopsis || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim();

    return (
      <div className={`flex flex-col sm:flex-row gap-0 sm:gap-8 w-full overflow-hidden bg-transparent sm:bg-[var(--md-sys-color-surface-container)] ${isDesktop ? 'rounded-none my-0 border-none' : 'max-w-6xl mx-auto rounded-none sm:rounded-2xl my-0 sm:my-8 border-none sm:border border-[var(--md-sys-color-outline)]/20 sm:shadow-lg'}`}>
        {/* Left/Top Area: Poster */}
        {!(isDesktop && sidebarOpen) && (
          <div className="w-full sm:w-[240px] md:w-[280px] shrink-0 relative flex flex-col">
          {anilistData?.coverImage?.extraLarge ? (
            <>
              <img 
                src={anilistData.coverImage.extraLarge} 
                alt={title} 
                className="w-full flex-1 aspect-[2/3] sm:aspect-auto sm:h-full object-cover pointer-events-none"
              />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[var(--md-sys-color-background)] to-transparent sm:hidden pointer-events-none" />
            </>
          ) : (
            <div className="w-full aspect-[2/3] bg-[var(--md-sys-color-surface-container-high)] flex items-center justify-center">
              <span className="text-[var(--md-sys-color-on-surface-variant)] text-sm font-bold">No Image</span>
            </div>
          )}
        </div>
        )}

        <div className={`flex-1 min-w-0 pb-24 flex flex-col z-10 relative ${isDesktop ? (sidebarOpen ? 'p-5 md:p-8 md:pb-24' : 'py-5 pr-5 md:py-8 md:pr-8 md:pl-0 md:pb-24') : 'px-5 pt-2 sm:py-8 sm:pr-8 sm:pl-0 -mt-20 sm:mt-0'}`}>
          
          <div className="flex flex-wrap gap-2 mb-3 items-center">
            {anilistData?.format && (
              <span className="px-2 py-0.5 bg-white text-black text-[11px] font-bold uppercase rounded-[8px] tracking-wider">
                {anilistData.format}
              </span>
            )}
            {anilistData?.genres?.map((g: string) => (
              <a key={g} href={`/genre/${encodeURIComponent(g.toLowerCase())}`} className="px-2 py-0.5 bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] text-[11px] font-bold uppercase rounded-[8px] tracking-wider hover:bg-[var(--md-sys-color-primary)] hover:text-[var(--md-sys-color-on-primary)] transition-colors">
                {g}
              </a>
            ))}
          </div>
          
          <h2 className="text-2xl sm:text-3xl font-black mb-1 leading-tight text-white sm:text-[var(--md-sys-color-on-surface)] drop-shadow-md sm:drop-shadow-none">
            {title}
          </h2>
          
          {(anilistData?.title?.native || anilistData?.title?.romaji) && (
            <h3 className="text-sm font-medium text-white/70 sm:text-[var(--md-sys-color-on-surface-variant)] mb-4 drop-shadow-md sm:drop-shadow-none">
              {anilistData.title?.native || anilistData.title?.romaji}
            </h3>
          )}

          {/* Quick Info Tags */}
          <div className="flex flex-wrap items-center gap-2 mb-6 text-sm font-medium text-white/80 sm:text-[var(--md-sys-color-on-surface-variant)] drop-shadow-md sm:drop-shadow-none">
            {[
              anilistData?.season && anilistData?.seasonYear ? `${anilistData.season} ${anilistData.seasonYear}` : null,
              anilistData?.episodes ? `${anilistData.episodes} Eps` : null,
              anilistData?.status ? anilistData.status.replaceAll('_', ' ') : null,
            ].filter(Boolean).map((info, idx, arr) => (
              <React.Fragment key={idx}>
                <span className="capitalize">{info?.toLowerCase()}</span>
                {idx < arr.length - 1 && <span className="text-white/40 sm:text-[var(--md-sys-color-outline)]/40 select-none">|</span>}
              </React.Fragment>
            ))}
          </div>

          <div className="w-full h-px bg-white/20 sm:bg-[var(--md-sys-color-outline)]/20 mb-6" />

          <div className="space-y-6">
            
            {/* Stats Bento Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full text-center">
              <div className="bg-black/20 sm:bg-[var(--md-sys-color-surface-container-high)] p-3 rounded-xl border border-white/5 sm:border-none">
                <div className="text-[10px] text-white/70 sm:text-[var(--md-sys-color-on-surface-variant)] uppercase font-bold tracking-wider mb-1">Score</div>
                <div className="text-sm font-black text-[var(--md-sys-color-primary)] flex items-center justify-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                  {anilistData?.meanScore ? (anilistData.meanScore / 10).toFixed(1) : '-'}
                </div>
              </div>
              <div className="bg-black/20 sm:bg-[var(--md-sys-color-surface-container-high)] p-3 rounded-xl border border-white/5 sm:border-none">
                <div className="text-[10px] text-white/70 sm:text-[var(--md-sys-color-on-surface-variant)] uppercase font-bold tracking-wider mb-1">Popularity</div>
                <div className="text-sm font-black text-white sm:text-[var(--md-sys-color-on-surface)]">#{anilistData?.popularity || '-'}</div>
              </div>
              <div className="bg-black/20 sm:bg-[var(--md-sys-color-surface-container-high)] p-3 rounded-xl border border-white/5 sm:border-none">
                <div className="text-[10px] text-white/70 sm:text-[var(--md-sys-color-on-surface-variant)] uppercase font-bold tracking-wider mb-1">Duration</div>
                <div className="text-sm font-black text-white sm:text-[var(--md-sys-color-on-surface)]">{anilistData?.duration ? `${anilistData.duration}m` : '-'}</div>
              </div>
              <div className="bg-black/20 sm:bg-[var(--md-sys-color-surface-container-high)] p-3 rounded-xl border border-white/5 sm:border-none">
                <div className="text-[10px] text-white/70 sm:text-[var(--md-sys-color-on-surface-variant)] uppercase font-bold tracking-wider mb-1">Source</div>
                <div className="text-sm font-black text-white sm:text-[var(--md-sys-color-on-surface)] capitalize">{anilistData?.source ? anilistData.source.replaceAll('_', ' ').toLowerCase() : '-'}</div>
              </div>
            </div>

            {/* Synopsis */}
            <section>
              <h3 className="text-sm font-bold text-white sm:text-[var(--md-sys-color-on-surface)] mb-2 uppercase tracking-wider">Synopsis</h3>
              <p className="text-white/90 sm:text-[var(--md-sys-color-on-surface-variant)] text-sm leading-relaxed break-words whitespace-pre-wrap">
                {desc || 'No synopsis available.'}
              </p>
            </section>

            {/* Recommendations */}
            {anilistData?.recommendations?.nodes?.length > 0 && (
              <section className="mt-6">
                <h3 className="text-sm font-bold text-white sm:text-[var(--md-sys-color-on-surface)] mb-3 uppercase tracking-wider">More Like This</h3>
                <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0">
                  {anilistData.recommendations.nodes.map((rec: any) => {
                    const recData = rec.mediaRecommendation;
                    if (!recData) return null;
                    return (
                      <a key={recData.id} href={`/anime/${recData.id}`} className="shrink-0 w-24 sm:w-28 group">
                        <div className="aspect-[2/3] rounded-lg overflow-hidden bg-[var(--md-sys-color-surface-container-high)] mb-2 relative">
                          {recData.coverImage?.extraLarge && (
                            <img src={recData.coverImage.extraLarge} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          )}
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-300" />
                        </div>
                        <p className="text-[10px] sm:text-xs font-bold text-white/90 sm:text-[var(--md-sys-color-on-surface-variant)] group-hover:text-[var(--md-sys-color-primary)] transition-colors leading-tight line-clamp-2 drop-shadow-md sm:drop-shadow-none">
                          {recData.title?.english || recData.title?.romaji || '?'}
                        </p>
                      </a>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
    <div className={`bg-[var(--md-sys-color-background)] text-[var(--md-sys-color-on-background)] flex flex-col font-sans selection:bg-[var(--md-sys-color-primary)]/30 ${isMini ? 'h-full' : 'min-h-screen'}`}>

      {!isMini && (
        <header className="w-full bg-[var(--md-sys-color-background)] border-b border-[var(--md-sys-color-surface-container)] px-4 md:px-6 h-16 flex items-center gap-4 shrink-0 sticky top-0 z-50">
          <button onClick={() => window.dispatchEvent(new CustomEvent('cerydra_minimize'))} className="flex items-center justify-center w-10 h-10 text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-background)] hover:bg-white/5 rounded-full transition-colors shrink-0">
            <ChevronDownIcon />
          </button>
          
          <div className="ml-auto flex items-center gap-2 md:gap-3">
            <div className="relative">
              <button 
                onClick={() => setShowReportMenu(!showReportMenu)}
                className="flex items-center justify-center w-10 h-10 rounded-full text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-background)] hover:bg-[var(--md-sys-color-surface-container)] transition-colors"
                title="Report Link"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
              </button>
              
              {showReportMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowReportMenu(false)} />
                  <div className="absolute right-0 top-12 w-48 bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-surface-container-highest)] rounded-xl shadow-lg z-50 overflow-hidden">
                    <button 
                      onClick={() => {
                        setShowReportMenu(false);
                        setShowReportModal(true);
                      }}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm font-bold text-red-400 hover:bg-red-500/10 transition-colors text-left"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>
                      Report Link
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setShowSidebar(v => !v)}
              className="hidden md:flex items-center gap-2 text-xs font-bold text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-background)] hover:bg-[var(--md-sys-color-surface-container)] transition-colors px-3 py-2 rounded-lg shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
              {showSidebar ? 'Hide' : 'Show'} List
            </button>
          </div>
        </header>
      )}

      <div className={`flex-1 flex w-full relative z-0 ${isMini ? 'flex-col' : 'flex-col md:flex-row max-w-[1920px] mx-auto h-[calc(100vh-64px)] overflow-hidden'}`}>

        <main className="flex-1 min-w-0 flex flex-col md:overflow-y-auto custom-scrollbar">

          <div className={`w-full bg-black flex items-center justify-center relative z-10 ${isMini ? 'h-full' : 'shadow-[0_10px_40px_rgba(0,0,0,0.5)] md:border-b md:border-r border-[#2B2B2B]'}`}>
            <div className={`w-full relative ${isMini ? 'h-full' : 'aspect-video max-h-[85vh] 2xl:w-auto 2xl:aspect-auto 2xl:h-[80vh] 2xl:aspect-video'}`}>
              {isAnilistId && !allAnimeId && mappingPending && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--md-sys-color-background)] z-[100]">
                  <div className="w-10 h-10 border-4 border-[var(--md-sys-color-surface-container)] border-t-[var(--md-sys-color-primary)] rounded-full animate-spin"></div>
                  <p className="mt-4 text-[var(--md-sys-color-on-surface-variant)] text-sm font-bold">Resolving anime...</p>
                </div>
              )}

              {(showPending || isFetchingLinks || hfResolving) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[var(--md-sys-color-background)]">
                  <div className="w-10 h-10 rounded-full border-[3px] border-[var(--md-sys-color-surface-container)] border-t-[var(--md-sys-color-primary)] animate-spin" />
                  {!isMini && <span className="text-[var(--md-sys-color-on-surface-variant)] text-xs font-bold tracking-widest uppercase">{hfResolving ? 'Resolving source...' : 'Loading stream'}</span>}
                </div>
              )}
              {!episodePending && episodeError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--md-sys-color-background)]">
                  <div className="text-red-400"><AlertIcon /></div>
                  {!isMini && <p className="text-[var(--md-sys-color-on-background)] font-bold text-sm">{resolveError || 'Stream unavailable'}</p>}
                </div>
              )}
              {!episodePending && (useMegaPlayFallback && activeAnilistId ? `https://megaplay.buzz/stream/ani/${activeAnilistId}/${episode}/${translationMode === 'dub' ? 'dub' : 'sub'}` : iframeUrl) && !isMini && (
                <iframe
                  key={(useMegaPlayFallback && activeAnilistId ? `https://megaplay.buzz/stream/ani/${activeAnilistId}/${episode}/${translationMode === 'dub' ? 'dub' : 'sub'}` : iframeUrl)}
                  src={(useMegaPlayFallback && activeAnilistId ? `https://megaplay.buzz/stream/ani/${activeAnilistId}/${episode}/${translationMode === 'dub' ? 'dub' : 'sub'}` : iframeUrl)}
                  className="absolute inset-0 w-full h-full border-0 bg-black z-[100]"
                  allowFullScreen
                  allow="autoplay; fullscreen"
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                  referrerPolicy={(useMegaPlayFallback || (iframeUrl && iframeUrl.includes('megaplay.buzz'))) ? "origin" : "no-referrer"}
                />
              )}
              {!episodePending && activeUrl && !(useMegaPlayFallback && activeAnilistId) && !iframeUrl && resolvedInitialTime !== undefined && (
                <Md3VideoPlayer
                  key={activeUrl}
                  src={activeUrl}
                  poster={animeThumbnail}
                  initialTime={resolvedInitialTime}
                  autoPlay={autoPlay}
                  animeId={animeId}
                  animeTitle={animeTitle}
                  episode={episode}
                  episodeTitle={episodeData?.title}
                  prevEp={prevEp}
                  nextEp={nextEp}
                  isMini={isMini}
                  tracks={selectedSource?.tracks && selectedSource.tracks.length > 0 ? selectedSource.tracks : subtitleData?.subtitles}
                  qualities={qualityList.length > 1 ? qualityList : undefined}
                  activeQuality={activeQualityLabel}
                  onQualityChange={handleQualityChange}
                  onPrev={prevEp ? async () => {
                    import('astro:transitions/client').then(({ navigate }) => {
                      navigate(getWatchUrl(isAnilistId ? parseInt(animeId) : allAnimeId || animeId, prevEp, showData?.name));
                    });
                  } : undefined}
                  onNext={nextEp ? async () => {
                    import('astro:transitions/client').then(({ navigate }) => {
                      navigate(getWatchUrl(isAnilistId ? parseInt(animeId) : allAnimeId || animeId, nextEp, showData?.name));
                    });
                  } : undefined}
                  onError={handleSourceError}
                  onProgress={handleProgressRefined}
                  onEnded={handleEndedRefined}
                />
              )}
            </div>
          </div>

          {/* --- Translation Mode Selector --- */}
          {!isMini && (
            <div className="w-full bg-[var(--md-sys-color-background)] border-b border-[var(--md-sys-color-surface-container)] px-4 md:px-8 py-3 sticky top-0 z-20">
              <div className={`flex flex-col gap-4 max-w-6xl mx-auto ${showSidebar ? '' : 'md:flex-row md:items-center'}`}>
                <div className={showSidebar ? '' : 'min-w-0 flex-1'}>
                  <h2 className="text-base md:text-2xl font-black text-[var(--md-sys-color-on-background)] leading-tight">{animeTitle}</h2>
                  <p className="text-xs md:text-sm text-[var(--md-sys-color-on-surface-variant)] font-semibold mt-0.5 md:mt-1">Episode {episode}</p>
                </div>
                <div className={`flex flex-col gap-2 w-full ${showSidebar ? '' : 'md:flex-1'}`}>
                  <div className="flex gap-2 w-full">
                    <div className="flex-1 bg-[var(--md-sys-color-surface-container)] rounded-xl overflow-hidden">
                      <button
                      onClick={() => setShowSourceList(!showSourceList)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-bold text-[var(--md-sys-color-on-background)] hover:bg-[var(--md-sys-color-surface-container-high)] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--md-sys-color-on-surface-variant)]">Source:</span>
                        <span className="text-[var(--md-sys-color-primary)]">{selectedSource?.sourceName || 'Auto'}</span>
                      </div>
                      <div className={`transition-transform ${showSourceList ? 'rotate-180' : ''}`}>
                        <ChevronDownIcon />
                      </div>
                    </button>
                    </div>
                    {isDownloadable && !iframeUrl && (
                      <a 
                        href={downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] rounded-xl px-4 hover:bg-[var(--md-sys-color-primary)] hover:text-[var(--md-sys-color-on-primary)] transition-colors"
                        title="Download Video"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                      </a>
                    )}
                  </div>
                  <div className="w-full bg-[var(--md-sys-color-surface-container)] rounded-xl overflow-hidden mt-0">
                    {showSourceList && (
                      <div className="flex items-center gap-2 px-3 pb-3 pt-1 overflow-x-auto custom-scrollbar">
                        {translationMode === 'sub-id' && sourceGroups ? (
                          sourceGroups.map((g, i) => {
                            const hasFailed = g.indices.some(idx => failedSources.includes(idx));
                            if (hasFailed) return null;
                            const validIdx = g.indices[0];
                            const isActive = g.indices.includes(selectedSourceIdx);
                            return (
                              <button
                                key={i}
                                onClick={() => {
                                  handleSourceClick(validIdx);
                                  setShowSourceList(false);
                                }}
                                className={`
                                  px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors shrink-0
                                  ${isActive 
                                    ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] ' 
                                    : 'bg-[var(--md-sys-color-background)] text-[var(--md-sys-color-on-surface-variant)] hover:text-white'
                                  }
                                `}
                              >
                                {g.label}
                              </button>
                            );
                          })
                        ) : (
                          sources.map((s, idx) => {
                            if (failedSources.includes(idx)) return null;
                            const isActive = idx === selectedSourceIdx;
                            return (
                              <button
                                key={idx}
                                onClick={() => {
                                  handleSourceClick(idx);
                                  setShowSourceList(false);
                                }}
                                className={`
                                  px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors shrink-0
                                  ${isActive 
                                    ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] ' 
                                    : 'bg-[var(--md-sys-color-background)] text-[var(--md-sys-color-on-surface-variant)] hover:text-white'
                                  }
                                `}
                              >
                                {s.sourceName || `Source ${idx + 1}`}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 w-full">
                    <button
                      onClick={() => {
                        setTranslationMode('sub');
                        setFailedSources([]);
                        setActiveSourceIdx(-1);
                        setSourceVariantMap({});
                        setIframeUrl('');
                        setNocache(false);
                      }}
                      className={`
                        flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 flex-1 justify-center
                        ${translationMode === 'sub'
                          ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] '
                          : 'bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)] hover:text-[var(--md-sys-color-on-background)]'
                        }
                      `}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" ry="2"/><line x1="7" y1="10" x2="11" y2="10"/><line x1="7" y1="14" x2="13" y2="14"/><line x1="15" y1="14" x2="17" y2="14"/><line x1="15" y1="10" x2="17" y2="10"/></svg>
                      <span>Sub (EN)</span>
                    </button>
                    <button
                      onClick={() => {
                        setTranslationMode('dub');
                        setFailedSources([]);
                        setActiveSourceIdx(-1);
                        setSourceVariantMap({});
                        setIframeUrl('');
                        setNocache(false);
                      }}
                      className={`
                        flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 flex-1 justify-center
                        ${translationMode === 'dub'
                          ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] '
                          : 'bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)] hover:text-[var(--md-sys-color-on-background)]'
                        }
                      `}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                      <span>Dub (EN)</span>
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setTranslationMode('sub-id');
                      setFailedSources([]);
                      setActiveSourceIdx(-1);
                      setSourceVariantMap({});
                      setIframeUrl('');
                      setNocache(false);
                    }}
                    className={`
                      flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all w-full justify-center
                      ${translationMode === 'sub-id'
                        ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] '
                        : 'bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)] hover:text-[var(--md-sys-color-on-background)]'
                      }
                    `}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" ry="2"/><line x1="7" y1="10" x2="11" y2="10"/><line x1="7" y1="14" x2="13" y2="14"/><line x1="15" y1="14" x2="17" y2="14"/><line x1="15" y1="10" x2="17" y2="10"/></svg>
                    <span>Sub (ID)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* --- Mobile Only: Tab Bar --- */}
          {!isMini && (
            <div className="md:hidden flex flex-col flex-1 min-h-0 bg-[var(--md-sys-color-background)]">
              <div className="flex items-center border-y border-[var(--md-sys-color-surface-container)] bg-[var(--md-sys-color-background)] sticky top-[53px] z-10 px-4">
                 <button 
                    onClick={() => setMobileTab('episodes')} 
                    className={`flex-1 py-3.5 text-sm font-bold border-b-[3px] transition-colors -mb-[1px] ${mobileTab === 'episodes' ? 'border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-primary)]' : 'border-transparent text-[var(--md-sys-color-on-surface-variant)] hover:text-white'}`}
                  >
                    Episodes
                  </button>
                  <button 
                     onClick={() => setMobileTab('details')} 
                     className={`flex-1 py-3.5 text-sm font-bold border-b-[3px] transition-colors -mb-[1px] ${mobileTab === 'details' ? 'border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-primary)]' : 'border-transparent text-[var(--md-sys-color-on-surface-variant)] hover:text-white'}`}
                   >
                     Details
                   </button>
              </div>
              <div className={`flex-1 overflow-y-auto custom-scrollbar cerydra-ep-list-container ${mobileTab === 'episodes' ? 'p-4 pb-24' : 'pb-24'}`}>
                {mobileTab === 'episodes' && (
                  <div ref={episodeListRef}>
                    <div className="flex items-center gap-2 mb-3">
                      {totalRangesMobile > 1 && (
                        <div className="relative">
                          <button
                            onClick={() => setShowRangeDropdown(v => !v)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-background)] text-xs font-bold transition-colors hover:bg-[var(--md-sys-color-surface-container-high)] whitespace-nowrap"
                          >
                            {epRange * 50 + 1}&ndash;{Math.min((epRange + 1) * 50, episodeList.length)}
                            <ChevronDownIcon />
                          </button>
                          {showRangeDropdown && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setShowRangeDropdown(false)} />
                              <div className="absolute left-0 top-full mt-1 z-50 bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-surface-container-highest)] rounded-xl overflow-hidden min-w-[120px]">
                                {Array.from({ length: totalRangesMobile }, (_, i) => (
                                  <button
                                    key={i}
                                    onClick={() => { setEpRange(i); setShowRangeDropdown(false); }}
                                    className={`w-full px-4 py-2.5 text-left text-xs font-bold transition-colors ${
                                      epRange === i
                                        ? 'text-[var(--md-sys-color-primary)]'
                                        : 'text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-background)] hover:bg-[var(--md-sys-color-surface-container-highest)]'
                                    }`}
                                  >
                                    {i * 50 + 1}&ndash;{Math.min((i + 1) * 50, episodeList.length)}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      <div className="relative flex-1">
                        <input
                          type="number"
                          min="1"
                          max={episodeList.length}
                          placeholder="Find episode..."
                          value={epSearch}
                          onChange={e => setEpSearch(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const num = e.currentTarget.value.trim();
                              const found = episodeList.find(ep => ep === num);
                              if (found) {
                                const rangeIdx = Math.floor(episodeList.indexOf(found) / 50);
                                setEpRange(rangeIdx);
                                setHighlightedEp(found);
                                setTimeout(() => setHighlightedEp(null), 2000);
                                setTimeout(() => {
                                  document.querySelector('.cerydra-active-ep')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }, 50);
                              }
                            }
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-background)] text-xs font-bold placeholder:text-[var(--md-sys-color-on-surface-variant)] outline-none focus:ring-1 focus:ring-[var(--md-sys-color-primary)] transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </div>

                    {/* Episode grid */}
                    <div ref={mobileGridRef} className="grid grid-cols-6 gap-1.5 w-full mx-auto [&>a]:aspect-square">
                      {rangeEpsMobile.map((ep) => {
                        const isActive = ep === episode;
                        return (
                          <a
                            key={ep}
                            ref={isActive ? activeEpRef : null}
                            href={getWatchUrl(isAnilistId ? parseInt(animeId) : allAnimeId || animeId, ep, showData?.name)}
                            title={`Episode ${ep}`}
                            style={mobileCellSize > 0 ? { width: mobileCellSize, height: mobileCellSize } : undefined}
                            className={`cerydra-active-ep-placeholder flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                              isActive
                                ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] cerydra-active-ep'
                                : 'bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)] hover:text-[var(--md-sys-color-on-background)]'
                            } ${highlightedEp === ep ? 'ring-2 ring-[var(--md-sys-color-primary)] ring-offset-1 ring-offset-[var(--md-sys-color-background)]' : ''}`}
                          >
                            {ep}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
                {mobileTab === 'details' && (
                  <div className="pb-24">
                    {anilistFetching ? (
                      <div className="space-y-4 animate-pulse">
                        <div className="h-40 rounded-xl bg-[var(--md-sys-color-surface-container)]" />
                        <div className="h-5 w-2/3 rounded bg-[var(--md-sys-color-surface-container)]" />
                        <div className="h-5 w-full rounded bg-[var(--md-sys-color-surface-container)]" />
                        <div className="h-5 w-4/5 rounded bg-[var(--md-sys-color-surface-container)]" />
                      </div>
                    ) : (
                      renderDetails()
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- Desktop Only: Main Content (Details) --- */}
          {!isMini && (
            <div className="hidden md:block w-full">
              {renderDetails(true, showSidebar)}
            </div>
          )}
        </main>

        {/* --- Desktop Only: Sidebar --- */}
        {!isMini && showSidebar && (
          <aside className="hidden md:flex w-[420px] 2xl:w-[500px] shrink-0 flex-col bg-[var(--md-sys-color-background)] border-l border-[var(--md-sys-color-surface-container)] z-0">
            <div className="px-5 py-4 border-b border-[var(--md-sys-color-surface-container)] flex items-center justify-between sticky top-0 bg-[var(--md-sys-color-background)] z-10">
              <h3 className="text-sm font-black text-[var(--md-sys-color-on-background)] uppercase tracking-wider">Episodes</h3>
              <span className="text-[11px] font-bold text-[var(--md-sys-color-on-surface-variant)] bg-[var(--md-sys-color-surface-container)] px-2 py-1 rounded-md">{episodeList.length} Total</span>
            </div>

            <div ref={episodeListRef} className="flex-1 overflow-y-auto p-3 pb-24 flex flex-col gap-1 custom-scrollbar cerydra-ep-list-container">
              {showPending && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-[var(--md-sys-color-surface-container)] border-t-[var(--md-sys-color-primary)] animate-spin" />
                  <p className="text-[var(--md-sys-color-on-surface-variant)] text-xs font-bold uppercase tracking-widest">Loading</p>
                </div>
              )}
              {showError && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="text-[var(--md-sys-color-on-surface-variant)]"><AlertIcon /></div>
                  <p className="text-[var(--md-sys-color-on-surface-variant)] text-xs font-bold uppercase tracking-widest">Failed to load</p>
                </div>
              )}
              {!showPending && !showError && episodeList.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <p className="text-[var(--md-sys-color-on-surface-variant)] text-xs font-bold uppercase tracking-widest">No Episodes</p>
                </div>
              )}
              <div className="flex items-center gap-2 mb-3">
                {totalRangesDesktop > 1 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowRangeDropdownDesktop(v => !v)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-background)] text-xs font-bold transition-colors hover:bg-[var(--md-sys-color-surface-container-high)] whitespace-nowrap"
                    >
                      {epRangeDesktop * 100 + 1}&ndash;{Math.min((epRangeDesktop + 1) * 100, episodeList.length)}
                      <ChevronDownIcon />
                    </button>
                    {showRangeDropdownDesktop && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowRangeDropdownDesktop(false)} />
                        <div className="absolute left-0 top-full mt-1 z-50 bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-surface-container-highest)] rounded-xl overflow-hidden min-w-[120px]">
                          {Array.from({ length: totalRangesDesktop }, (_, i) => (
                            <button
                              key={i}
                              onClick={() => { setEpRangeDesktop(i); setShowRangeDropdownDesktop(false); }}
                              className={`w-full px-4 py-2.5 text-left text-xs font-bold transition-colors ${
                                epRangeDesktop === i
                                  ? 'text-[var(--md-sys-color-primary)]'
                                  : 'text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-background)] hover:bg-[var(--md-sys-color-surface-container-highest)]'
                              }`}
                            >
                              {i * 100 + 1}&ndash;{Math.min((i + 1) * 100, episodeList.length)}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="relative flex-1">
                  <input
                    type="number"
                    min="1"
                    max={episodeList.length}
                    placeholder="Find episode..."
                    value={epSearchDesktop}
                    onChange={e => setEpSearchDesktop(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const num = e.currentTarget.value.trim();
                        const found = episodeList.find(ep => ep === num);
                        if (found) {
                          const rangeIdx = Math.floor(episodeList.indexOf(found) / 100);
                          setEpRangeDesktop(rangeIdx);
                          setHighlightedEp(found);
                          setTimeout(() => setHighlightedEp(null), 2000);
                          setTimeout(() => {
                            document.querySelector('.cerydra-active-ep')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }, 50);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-background)] text-xs font-bold placeholder:text-[var(--md-sys-color-on-surface-variant)] outline-none focus:ring-1 focus:ring-[var(--md-sys-color-primary)] transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              {/* Episode grid */}
              <div ref={desktopGridRef} className="grid grid-cols-6 gap-1.5 w-full mx-auto [&>a]:aspect-square">
                {rangeEpsDesktop.map((ep) => {
                  const isActive = ep === episode;
                  return (
                    <a
                      key={ep}
                      ref={isActive ? activeEpRef : null}
                      href={getWatchUrl(isAnilistId ? parseInt(animeId) : allAnimeId || animeId, ep, showData?.name)}
                      title={`Episode ${ep}`}
                      style={desktopCellSize > 0 ? { width: desktopCellSize, height: desktopCellSize } : undefined}
                      className={`cerydra-active-ep-placeholder flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                        isActive
                          ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] cerydra-active-ep'
                          : 'bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)] hover:text-[var(--md-sys-color-on-background)]'
                      } ${highlightedEp === ep ? 'ring-2 ring-[var(--md-sys-color-primary)] ring-offset-1 ring-offset-[var(--md-sys-color-background)]' : ''}`}
                    >
                      {ep}
                    </a>
                  );
                })}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>

    {/* Report Modal */}
    {showReportModal && (
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-sm bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-surface-container-highest)] rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200 relative">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>
          </div>
          <h3 className="text-xl font-black text-white mb-2">Video Error / Not Playing?</h3>
          <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm mb-6 font-medium">
            If all servers are currently down or the video is unavailable, you can try using the alternative server (MegaPlay).
          </p>
          <button 
            onClick={() => {
              setUseMegaPlayFallback(true);
              setShowReportModal(false);
            }}
            className="w-full py-3.5 rounded-xl bg-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-primary)]/90 text-[var(--md-sys-color-on-primary)] font-bold text-sm transition-all  mb-4"
          >
            Try Alternative Server
          </button>
          <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]/70 font-medium px-4">
            If the alternative server also fails, please report this to <a href="mailto:hi@cerydra.my.id" className="text-[var(--md-sys-color-primary)] hover:underline">hi@cerydra.my.id</a>
          </p>
          <button 
            onClick={() => setShowReportModal(false)}
            className="absolute top-4 right-4 p-2 text-[var(--md-sys-color-on-surface-variant)] hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </div>
    )}
    </>
  );
}
