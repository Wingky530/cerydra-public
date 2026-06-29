import React, { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import AppShell from '../components/AppShell';
import { useWatchHistory } from '../hooks/useWatchHistory';
import type { WatchHistoryEntry } from '../hooks/useWatchHistory';
import { getWatchUrl } from '../lib/routing';

function SearchIcon() {
  return (
    <span className="material-symbols-outlined text-[24px]">search</span>
  );
}

function DeleteIcon() {
  return <span className="material-symbols-outlined text-[24px] leading-none">delete</span>;
}

function CloseIcon() {
  return <span className="material-symbols-outlined text-[24px] leading-none">close</span>;
}

function SelectAllIcon() {
  return <span className="material-symbols-outlined text-[24px] leading-none">select_all</span>;
}

function SelectInverseIcon() {
  return <span className="material-symbols-outlined text-[24px] leading-none">deselect</span>;
}

function RingOverlay({ progress }: { progress: number }) {
  const [svgP, setSvgP] = useState<{ w: number; h: number; d: string; perim: number } | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((el: HTMLDivElement | null) => {
    if (roRef.current) { roRef.current.disconnect(); roRef.current = null; }
    if (!el) { setSvgP(null); return; }
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      if (w === 0 || h === 0) return;
      const sw = 3, x = sw/2, y = sw/2, iw = w-sw, ih = h-sw;
      const cr = parseFloat(getComputedStyle(el).borderRadius) || 6;
      const perim = 2*(iw+ih) - 8*cr + 2*Math.PI*cr;
      const d = `M ${x+iw/2} ${y+ih}L ${x+iw-cr} ${y+ih}A ${cr} ${cr} 0 0 0 ${x+iw} ${y+ih-cr}L ${x+iw} ${y+cr}A ${cr} ${cr} 0 0 0 ${x+iw-cr} ${y}L ${x+cr} ${y}A ${cr} ${cr} 0 0 0 ${x} ${y+cr}L ${x} ${y+ih-cr}A ${cr} ${cr} 0 0 0 ${x+cr} ${y+ih}L ${x+iw/2} ${y+ih}`;
      setSvgP({ w, h, d, perim });
    });
    ro.observe(el);
    roRef.current = ro;
  }, []);

  return (
    <div ref={ref} className="absolute inset-0 z-20 pointer-events-none rounded-md" style={{ contain: 'strict' }}>
      {svgP && (<svg className="w-full h-full" viewBox={`0 0 ${svgP.w} ${svgP.h}`}>
        <path d={svgP.d} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
        <path d={svgP.d} fill="none" stroke="var(--md-sys-color-primary)" strokeWidth={3}
          strokeDasharray={svgP.perim}
          strokeDashoffset={svgP.perim * (1 - Math.min(progress, 100) / 100)}
        />
      </svg>)}
    </div>
  );
}

function formatHistoryDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  
  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();

  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';

  return new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export function HistoryContent() {
  const { history, isLoading, removeEntries } = useWatchHistory();
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const latestEntry = history.length > 0 ? history[0] : null;
  const latestEntryName = latestEntry?.animeName;

  // Hero progress bar state
  const heroPosterRef = useRef<HTMLDivElement>(null);
  const [heroSvgP, setHeroSvgP] = useState<{ w: number; h: number; d: string; perim: number } | null>(null);
  const heroSvgUpdater = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    const el = heroPosterRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w === 0 || h === 0) return;
      const sw = 3, x = sw/2, y = sw/2, iw = w-sw, ih = h-sw;
      const cr = parseFloat(getComputedStyle(el).borderRadius) || 12;
      const perim = 2*(iw+ih) - 8*cr + 2*Math.PI*cr;
      const d =
        `M ${x+iw/2} ${y+ih}` +
        `L ${x+iw-cr} ${y+ih}` +
        `A ${cr} ${cr} 0 0 0 ${x+iw} ${y+ih-cr}` +
        `L ${x+iw} ${y+cr}` +
        `A ${cr} ${cr} 0 0 0 ${x+iw-cr} ${y}` +
        `L ${x+cr} ${y}` +
        `A ${cr} ${cr} 0 0 0 ${x} ${y+cr}` +
        `L ${x} ${y+ih-cr}` +
        `A ${cr} ${cr} 0 0 0 ${x+cr} ${y+ih}` +
        `L ${x+iw/2} ${y+ih}`;
      setHeroSvgP({ w, h, d, perim });
    };
    heroSvgUpdater.current = update;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [latestEntryName]);

  // Filter history based on search query
  const filteredHistory = history.filter(entry => 
    entry.animeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group history by date
  const groupedHistory = filteredHistory.reduce((acc, entry) => {
    const dateLabel = formatHistoryDate(entry.timestamp);
    if (!acc[dateLabel]) {
      acc[dateLabel] = [];
    }
    acc[dateLabel].push(entry);
    return acc;
  }, {} as Record<string, WatchHistoryEntry[]>);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
      if (newSet.size === 0) setIsSelectionMode(false);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleLongPress = (itemKey: string) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedIds(new Set([itemKey]));
      if (navigator.vibrate) navigator.vibrate(50);
    }
  };

  const handleCardClick = async (itemKey: string, e: React.MouseEvent) => {
    if (isSelectionMode) {
      e.preventDefault();
      toggleSelection(itemKey);
      return;
    }

    const { navigate } = await import('astro:transitions/client');
    const entry = history.find(h => `${h.animeId}|${h.episode}` === itemKey);
    if (entry) {
      navigate(getWatchUrl(entry.animeId, entry.episode, entry.animeName));
    }
  };

  const handleDeleteSelected = () => {
    if (confirm(`Are you sure you want to delete ${selectedIds.size} history entr${selectedIds.size === 1 ? 'y' : 'ies'}?`)) {
      removeEntries(Array.from(selectedIds).map(id => id.split('|')[0]));
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    }
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(filteredHistory.map(h => `${h.animeId}|${h.episode}`)));
  };

  const handleSelectInverse = () => {
    const all = new Set(filteredHistory.map(h => `${h.animeId}|${h.episode}`));
    const newSet = new Set<string>();
    for (const id of all) {
      if (!selectedIds.has(id)) newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // Fetch Anilist Data for High-Res Banner & Poster
  const { data: anilistData } = useQuery<any>({
    queryKey: ['anime-anilist-history-hero', latestEntryName],
    queryFn: async () => {
      if (!latestEntryName) return null;
      const query = `
        query($search: String) {
          Media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
            bannerImage
            coverImage { extraLarge }
          }
        }
      `;
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ query, variables: { search: latestEntryName } })
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json?.data?.Media || null;
    },
    enabled: !!latestEntryName && !isSelectionMode && !isLoading,
    staleTime: Infinity,
  });

  const bannerImage = anilistData?.bannerImage || latestEntry?.thumbnail;
  const posterImage = anilistData?.coverImage?.extraLarge || latestEntry?.thumbnail;

  return (
    <div className="pb-32 bg-[var(--md-sys-color-background)] min-h-screen relative">
      {/* HEADER SELECTION MODE */}
      <div 
        className={`fixed top-0 inset-x-0 z-50 bg-[var(--md-sys-color-surface-container-high)] px-4 py-3 flex items-center justify-between shadow-md transition-transform duration-300
          ${isSelectionMode ? 'translate-y-0' : '-translate-y-full'}
        `}
      >
        <div className="flex items-center gap-4">
          <button 
            onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }}
            className="w-10 h-10 flex items-center justify-center rounded-full text-white hover:bg-white/10"
            aria-label="Close selection"
          >
            <CloseIcon />
          </button>
          <span className="text-lg font-bold text-white">{selectedIds.size} Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSelectAll} className="w-10 h-10 flex items-center justify-center rounded-full text-white hover:bg-white/10" aria-label="Select all items">
            <SelectAllIcon />
          </button>
          <button onClick={handleSelectInverse} className="w-10 h-10 flex items-center justify-center rounded-full text-white hover:bg-white/10" aria-label="Inverse selection">
            <SelectInverseIcon />
          </button>
          <button onClick={handleDeleteSelected} className="w-10 h-10 flex items-center justify-center rounded-full text-red-400 hover:bg-red-400/20 ml-2" aria-label="Delete selected items">
            <DeleteIcon />
          </button>
        </div>
      </div>

      {/* Edge-to-Edge Hero Card for Latest Watch */}
      <div className={`transition-all duration-300 ${isSelectionMode ? 'opacity-0 max-h-0 overflow-hidden' : 'opacity-100 max-h-[700px]'}`}>
        {!isLoading && !isSelectionMode && latestEntry ? (
          <div className="relative w-full h-[35vh] md:h-[65vh] min-h-[200px] md:min-h-[450px] max-h-[700px] overflow-hidden group">
            {/* Background Poster */}
            <div className="absolute inset-0">
              {/* Background (Banner) */}
              <img
                src={bannerImage}
                alt=""
                className="w-full h-full object-cover object-center opacity-50 group-hover:scale-105 transition-transform duration-[10s] ease-out"
              />
              {/* Gradients */}
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--md-sys-color-background)] via-[var(--md-sys-color-background)]/80 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--md-sys-color-background)] via-[var(--md-sys-color-background)]/50 to-transparent md:w-3/4" />
            </div>

            {/* Floating Header over Hero */}
            <div className="absolute top-0 left-0 right-0 z-20 px-4 md:px-8 py-5 md:py-10 flex items-start justify-between bg-gradient-to-b from-[var(--md-sys-color-background)]/80 to-transparent">
              {isSearchActive ? (
                <div className="flex-1 flex items-center h-12 relative bg-[var(--md-sys-color-surface-container-high)] rounded-xl px-2">
                  <button 
                    onClick={() => {
                      setIsSearchActive(false);
                      setSearchQuery('');
                    }}
                    className="flex items-center justify-center w-10 h-10 rounded-full text-white hover:bg-white/20 transition-colors z-10 shrink-0"
                    aria-label="Close Search"
                  >
                    <span className="material-symbols-outlined text-[24px]">arrow_back</span>
                  </button>
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search history..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 bg-transparent text-white text-lg outline-none placeholder:text-white/30 ml-2 font-medium"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <h1 className="text-xl md:text-3xl font-black text-white tracking-wide uppercase drop-shadow-md">
                      HISTORY
                    </h1>
                    <p className="text-white/80 text-xs md:text-base mt-1 font-medium drop-shadow-md">
                      {history.length} episodes watched
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsSearchActive(true)}
                      className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/20 rounded-full transition-colors drop-shadow-md"
                      aria-label="Search history"
                    >
                      <SearchIcon />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Hero Content Area */}
            <div className="absolute inset-0 flex items-end">
              <div className="max-w-7xl mx-auto w-full px-4 md:px-8 pb-6 md:pb-12">
                <div className="flex flex-row gap-4 md:gap-10 items-end">
                  {/* Small Poster */}
                  <div ref={heroPosterRef} className="w-[100px] sm:w-[120px] md:w-[180px] lg:w-[220px] flex-shrink-0 relative group/poster rounded-lg md:rounded-xl overflow-hidden ring-1 ring-white/10">
                    <a
                      href={getWatchUrl(latestEntry.animeId, latestEntry.episode, latestEntry.animeName)}
                      onClick={async (e) => {
                        if (isSelectionMode) { e.preventDefault(); return; }
                        e.preventDefault();
                        const { navigate } = await import('astro:transitions/client');
                        navigate(getWatchUrl(latestEntry.animeId, latestEntry.episode, latestEntry.animeName));
                      }}
                      className="block relative w-full aspect-[2/3] outline-none rounded-lg md:rounded-xl overflow-hidden"
                      onContextMenu={(e) => { e.preventDefault(); handleLongPress(`${latestEntry.animeId}|${latestEntry.episode}`); }}
                      onTouchStart={(e) => { const timer = setTimeout(() => handleLongPress(`${latestEntry.animeId}|${latestEntry.episode}`), 500); e.currentTarget.dataset.timer = timer.toString(); }}
                      onTouchEnd={(e) => { clearTimeout(Number(e.currentTarget.dataset.timer)); }}
                      onTouchMove={(e) => { clearTimeout(Number(e.currentTarget.dataset.timer)); }}
                    >
                      <img
                        src={posterImage}
                        alt={latestEntry.animeName}
                        onLoad={() => heroSvgUpdater.current?.()}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover/poster:scale-105"
                      />
                      <div className="absolute inset-0 bg-[var(--md-sys-color-on-surface)] opacity-0 group-hover/poster:opacity-[0.08] transition-opacity pointer-events-none" />
                      
                      {/* SVG Border Progress Bar */}
                      {heroSvgP && (
                        <div className="absolute inset-0 z-20 pointer-events-none">
                          <svg className="w-full h-full" viewBox={`0 0 ${heroSvgP.w} ${heroSvgP.h}`}>
                            <path d={heroSvgP.d} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
                            <path 
                              d={heroSvgP.d} 
                              fill="none" 
                              stroke="var(--md-sys-color-primary)" 
                              strokeWidth={3}
                              strokeDasharray={heroSvgP.perim}
                              strokeDashoffset={heroSvgP.perim * (1 - Math.min(((latestEntry.currentTime || 0) / (latestEntry.duration || 1)) * 100, 100) / 100)}
                            />
                          </svg>
                        </div>
                      )}
                    </a>
                  </div>

                  {/* Details */}
                  <div className="flex-1 flex flex-col gap-2 md:gap-4 max-w-3xl relative z-10 pb-1 md:pb-4 w-full">
                    <h1 className="text-xl md:text-3xl font-bold text-white line-clamp-2 leading-tight drop-shadow-lg">
                      {latestEntry.animeName}
                    </h1>
                    
                    <div className="flex flex-col gap-1 drop-shadow-md">
                      <span className="text-sm md:text-base font-bold text-[var(--md-sys-color-on-surface-variant)]">
                        Episode {latestEntry.episode}
                      </span>
                      {latestEntry.currentTime && latestEntry.currentTime > 0 && (
                        <span className="text-sm md:text-base font-medium text-[var(--md-sys-color-on-surface-variant)]">
                          {Math.floor(latestEntry.currentTime / 60)}:{String(Math.floor(latestEntry.currentTime % 60)).padStart(2, '0')} / {Math.floor((latestEntry.duration || 0) / 60)}:{String(Math.floor((latestEntry.duration || 0) % 60)).padStart(2, '0')}
                        </span>
                      )}
                    </div>

                    {/* Watch button */}
                    <div className="pt-4 flex flex-col gap-4">
                      <a
                        href={getWatchUrl(latestEntry.animeId, latestEntry.episode, latestEntry.animeName)}
                        onClick={async (e) => {
                          e.preventDefault();
                          const { navigate } = await import('astro:transitions/client');
                          navigate(getWatchUrl(latestEntry.animeId, latestEntry.episode, latestEntry.animeName));
                        }}
                        className="inline-flex items-center justify-center gap-2 px-6 md:px-8 py-3 bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] rounded-full font-black text-sm md:text-base tracking-wide transition-all duration-300 hover:shadow-[0_0_20px_var(--md-sys-color-primary)] hover:bg-white active:scale-95 group w-max"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        CONTINUE WATCHING
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : !isLoading && !latestEntry ? (
          /* Normal Header when no Hero (e.g. Empty State) */
          <div 
            className="px-4 md:px-8 pt-8 pb-4 flex items-center justify-between transition-all duration-300 relative z-20 bg-gradient-to-b from-[var(--md-sys-color-surface-container-high)]/30 to-transparent"
          >
            {isSearchActive ? (
              <div className="flex-1 flex items-center h-12 relative bg-[var(--md-sys-color-surface-container-high)] rounded-xl px-2">
                <button 
                  onClick={() => {
                    setIsSearchActive(false);
                    setSearchQuery('');
                  }}
                  className="flex items-center justify-center w-10 h-10 rounded-full text-[var(--md-sys-color-on-surface-variant)] hover:text-white hover:bg-white/10 transition-colors z-10 shrink-0"
                  aria-label="Close Search"
                >
                  <span className="material-symbols-outlined text-[24px]">arrow_back</span>
                </button>
                <input
                  type="text"
                  autoFocus
                  placeholder="Search history..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 bg-transparent text-white text-lg outline-none placeholder:text-white/30 ml-2 font-medium"
                />
              </div>
            ) : (
              <>
                <div>
                  <h1 className="text-2xl md:text-3xl font-black text-white tracking-wide uppercase">
                    HISTORY
                  </h1>
                  <p className="text-[var(--md-sys-color-on-surface-variant)] mt-2 font-medium">
                    {history.length} episodes watched
                  </p>
                </div>
                
                <div className="flex items-center gap-1">
                  {!isLoading && history.length > 0 && (
                    <button 
                      onClick={() => setIsSearchActive(true)}
                      className="w-10 h-10 flex items-center justify-center text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-primary)] transition-colors"
                      aria-label="Search history"
                    >
                      <SearchIcon />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>

      {/* Skeleton Loading */}
      {isLoading && (
        <div className="px-4 md:px-8 max-w-4xl mx-auto pt-8">
          <div className="w-full h-[200px] md:h-[450px] rounded-xl bg-[var(--md-sys-color-surface-container-high)] animate-pulse mb-8" />
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex items-center gap-4 py-3 px-4">
              <div className="w-6 h-6 rounded-full bg-[var(--md-sys-color-surface-container-high)] animate-pulse shrink-0" />
              <div className="w-16 h-24 md:w-20 rounded-md bg-[var(--md-sys-color-surface-container-high)] animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-[var(--md-sys-color-surface-container-high)] rounded animate-pulse" />
                <div className="h-3 w-1/4 bg-[var(--md-sys-color-surface-container-high)] rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grouped history list */}
      {!isLoading && (
        <div className={`px-0 md:px-8 max-w-4xl pb-8 mx-auto w-full flex-1 flex flex-col ${isSelectionMode ? 'pt-16' : ''}`}>
          {Object.entries(groupedHistory).length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-24 text-center px-4">
              <div className="w-20 h-20 mb-6 rounded-full bg-[var(--md-sys-color-surface-container-high)] flex items-center justify-center text-[var(--md-sys-color-on-surface-variant)]">
                <span className="material-symbols-outlined text-[40px]">history</span>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">
                {searchQuery ? 'No Results Found' : 'No Watch History'}
              </h2>
              <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm max-w-xs mx-auto mb-8 leading-relaxed">
                {searchQuery 
                  ? `No watch history found matching "${searchQuery}".` 
                  : "You haven't watched any anime yet. Start watching to see your history here."}
              </p>
              {!searchQuery && (
                <a 
                  onClick={async (e) => { e.preventDefault(); const { navigate } = await import('astro:transitions/client'); navigate('/'); }}
                  href="/"
                  className="px-6 py-2.5 bg-[var(--md-sys-color-surface-container-high)] text-white text-sm font-bold rounded-full hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors border border-transparent hover:border-[var(--md-sys-color-primary)] hover:text-[var(--md-sys-color-primary)]"
                >
                  Explore Anime
                </a>
              )}
            </div>
          ) : (
            Object.entries(groupedHistory).map(([dateLabel, entries], groupIndex) => {
              // Skip date group header if its only item was consumed by hero
              if (groupIndex === 0 && entries.length === 1 && !isSelectionMode && !isLoading) return null;

              return (
              <div key={dateLabel} className="mb-6 relative animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both" style={{ animationDelay: `${groupIndex * 100}ms` }}>
                <div className="sticky top-0 z-30 bg-[var(--md-sys-color-background)] py-3 px-4 md:px-0">
                  <h2 className="text-sm font-bold text-[var(--md-sys-color-on-surface-variant)]">
                    {dateLabel}
                  </h2>
                </div>
                <div className="flex flex-col">
                  {entries.map((entry, index) => {
                    const itemKey = `${entry.animeId}|${entry.episode}`;
                    const isSelected = selectedIds.has(itemKey);
                    const progressPercent = Math.min((entry.currentTime ?? entry.progressSeconds ?? 0) / (entry.duration || 1440) * 100, 100);

                    // Skip the first item if it's already shown in the hero card (unless in selection mode)
                    if (!isSelectionMode && groupIndex === 0 && index === 0) return null;

                    return (
                      <div
                        key={itemKey}
                        className={`relative flex items-center gap-4 py-3 px-4 md:px-4 transition-colors cursor-pointer group md:rounded-xl ${
                          isSelected
                            ? 'bg-[var(--md-sys-color-primary)]/10'
                            : 'hover:bg-white/5'
                        }`}
                        role="button"
                        tabIndex={0}
                        aria-selected={isSelected}
                        onClick={(e) => handleCardClick(itemKey, e)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCardClick(itemKey, e as any); }}
                      >
                        {isSelectionMode && (
                          <div
                            className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[var(--md-sys-color-primary)] border-[var(--md-sys-color-primary)]'
                                : 'border-[var(--md-sys-color-on-surface-variant)]'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelection(itemKey);
                            }}
                            role="checkbox"
                            aria-checked={isSelected}
                            tabIndex={-1}
                          >
                            {isSelected && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--md-sys-color-on-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                        )}

                        {/* Thumbnail */}
                        <div 
                          className="shrink-0 w-16 md:w-20 aspect-[2/3] rounded-md overflow-hidden bg-[var(--md-sys-color-surface-container-highest)] relative"
                          onContextMenu={(e) => { e.preventDefault(); handleLongPress(itemKey); }}
                          onTouchStart={(e) => { const timer = setTimeout(() => handleLongPress(itemKey), 500); e.currentTarget.dataset.timer = timer.toString(); }}
                          onTouchEnd={(e) => { clearTimeout(Number(e.currentTarget.dataset.timer)); }}
                          onTouchMove={(e) => { clearTimeout(Number(e.currentTarget.dataset.timer)); }}
                        >
                          <img
                            src={entry.thumbnail}
                            alt={entry.animeName}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                          <RingOverlay progress={progressPercent} />
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1 py-1 pr-2">
                          <p className="text-base font-bold text-[var(--md-sys-color-on-surface)] truncate group-hover:text-[var(--md-sys-color-primary)] transition-colors">{entry.animeName}</p>
                          <div className="flex flex-col gap-0.5 mt-0.5">
                            <span className="text-sm font-medium text-[var(--md-sys-color-on-surface-variant)]">
                              Episode {entry.episode}
                            </span>
                            {entry.currentTime && entry.currentTime > 0 && (
                              <div className="flex flex-col gap-1.5 mt-0.5">
                                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] font-medium">
                                  {Math.floor(entry.currentTime / 60)}:{String(Math.floor(entry.currentTime % 60)).padStart(2, '0')} / {Math.floor((entry.duration || 0) / 60)}:{String(Math.floor((entry.duration || 0) % 60)).padStart(2, '0')}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )})
          )}
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  return (
    <AppShell activeTab="history">
      <HistoryContent />
    </AppShell>
  );
}
