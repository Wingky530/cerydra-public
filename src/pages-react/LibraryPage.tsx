import React, { useState, useEffect, useRef, useMemo } from 'react';
import AppShell from '../components/AppShell';
import AnimeCard from '../components/AnimeCard';
import { useLibrary } from '../hooks/useLibrary';
import { getAnimeUrl } from '../lib/routing';

// --- Icons ---
const CloseIcon = () => <span className="material-symbols-outlined text-[24px] leading-none">close</span>;
const SelectAllIcon = () => <span className="material-symbols-outlined text-[24px] leading-none">select_all</span>;
const SelectInverseIcon = () => <span className="material-symbols-outlined text-[24px] leading-none">deselect</span>;
const TrashIcon = () => <span className="material-symbols-outlined text-[24px] leading-none">delete</span>;
const SearchIcon = () => <span className="material-symbols-outlined text-[24px] leading-none">search</span>;
const FilterIcon = () => <span className="material-symbols-outlined text-[24px] leading-none">filter_list</span>;
const FolderIcon = () => <span className="material-symbols-outlined text-[24px] leading-none">folder</span>;
const ShareIcon = () => <span className="material-symbols-outlined text-[24px] leading-none">share</span>;
const PlusIcon = () => <span className="material-symbols-outlined text-[20px] leading-none">add</span>;
const EditIcon = () => <span className="material-symbols-outlined text-[18px] leading-none">edit</span>;

function LibraryContent({ isSelectionMode, setIsSelectionMode }: { isSelectionMode: boolean, setIsSelectionMode: (v: boolean) => void }) {
  const { entries, categories, removeFromLibrary, setCategoriesForEntries, addCategory, removeCategory, renameCategory, syncLibrary } = useLibrary();
  
  // UI States
  const [mounted, setMounted] = useState(false);
  const [showFloatingIsland, setShowFloatingIsland] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  
  // Search State
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selection Mode States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [editingCat, setEditingCat] = useState<{ id: string; name: string } | null>(null);
  const [deleteCatConfirm, setDeleteCatConfirm] = useState<{ id: string; name: string } | null>(null);

  // Modal States
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false);
  const [showCreateCat, setShowCreateCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Filter & Display States
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<'SORT' | 'DISPLAY'>('SORT');
  const [sortBy, setSortBy] = useState<'names'|'rated'|'popular'|'episodes'|'last_watch'|'last_added'|'last_updated'|'random'>('last_added');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [randomSeed, setRandomSeed] = useState(Date.now());
  const [displayMode, setDisplayMode] = useState<'grid' | 'list'>('grid');
  const [showCategoryTabs, setShowCategoryTabs] = useState(true);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [showEndFade] = useState(true);
  const [showItemCount, setShowItemCount] = useState(true);
  const [showRating, setShowRating] = useState(true);
  const [showEpisode, setShowEpisode] = useState(true);
  const [showPopularity, setShowPopularity] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  
  // Selection onboarding
  const [showSelectionHint, setShowSelectionHint] = useState(false);
  
  useEffect(() => {
    if (mounted && !localStorage.getItem('cerydra_selection_hint_seen')) {
      const t = setTimeout(() => { setShowSelectionHint(true); }, 2000);
      return () => clearTimeout(t);
    }
  }, [mounted]);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  // Body scroll lock for modals
  const anyModalOpen = showCategoryModal || showEditCategoryModal || showFilterModal || confirmDeleteSelected || showCreateCat || !!editingCat || !!deleteCatConfirm;
  useEffect(() => { document.body.style.overflow = anyModalOpen ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [anyModalOpen]);

  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncProgress(0);
    await syncLibrary((c, t) => setSyncProgress(Math.round((c/t)*100)));
    setIsSyncing(false);
    setSyncProgress(0);
  };

  // DB History
  const [dbHistory, setDbHistory] = useState<Record<string, number>>({});

  useEffect(() => {
    setMounted(true);
    
    // Load Settings
    try {
      const saved = localStorage.getItem('cerydra_library_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.sortBy) setSortBy(parsed.sortBy);
        if (parsed.sortOrder) setSortOrder(parsed.sortOrder);
        if (parsed.displayMode) setDisplayMode(parsed.displayMode);
        if (typeof parsed.showCategoryTabs === 'boolean') setShowCategoryTabs(parsed.showCategoryTabs);
        if (typeof parsed.showItemCount === 'boolean') setShowItemCount(parsed.showItemCount);
        if (typeof parsed.showRating === 'boolean') setShowRating(parsed.showRating);
        if (typeof parsed.showEpisode === 'boolean') setShowEpisode(parsed.showEpisode);
        if (typeof parsed.showPopularity === 'boolean') setShowPopularity(parsed.showPopularity);
      }
    } catch (e) {}
    setSettingsLoaded(true);

    // Fetch watch history for sorting
    fetch('/api/history')
      .then(res => res.json())
      .then(data => {
        if (data.history) {
          const histMap: Record<string, number> = {};
          data.history.forEach((h: any) => {
            const t = new Date(h.updatedAt).getTime();
            if (!histMap[h.animeId] || t > histMap[h.animeId]) {
              histMap[h.animeId] = t;
            }
          });
          setDbHistory(histMap);
        }
      })
      .catch(() => setToast('Could not load watch history for sorting'));
  }, []);

  // Save settings when changed
  useEffect(() => {
    if (!settingsLoaded) return;
    const settings = { sortBy, sortOrder, displayMode, showCategoryTabs, showItemCount, showRating, showEpisode, showPopularity };
    localStorage.setItem('cerydra_library_settings', JSON.stringify(settings));
  }, [sortBy, sortOrder, displayMode, showCategoryTabs, showItemCount, showRating, showEpisode, showPopularity, settingsLoaded]);

  useEffect(() => {
    if (!mounted) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowFloatingIsland(entry.boundingClientRect.top < 0 && !entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [mounted]);

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  // Scroll-snap panel navigation for category swipe
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const views = useMemo(() => [{ id: null, name: 'All Anime' }, ...categories.map(c => ({ id: c.id, name: c.name }))], [categories]);
  const viewEntries = useMemo(() => {
    const sortFn = (a: any, b: any) => {
      if (sortBy === 'random') {
        const hashA = (a.animeId.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) * randomSeed) % 100;
        const hashB = (b.animeId.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) * randomSeed) % 100;
        return hashA - hashB;
      }
      let valA: any = a.dateAdded, valB: any = b.dateAdded;
      switch (sortBy) {
        case 'names': valA = (a.englishName || a.animeName).toLowerCase(); valB = (b.englishName || b.animeName).toLowerCase(); break;
        case 'rated': valA = a.score || 0; valB = b.score || 0; break;
        case 'popular': valA = a.popularity ? -a.popularity : -999999; valB = b.popularity ? -b.popularity : -999999; break;
        case 'episodes': valA = a.episodeCount || 0; valB = b.episodeCount || 0; break;
        case 'last_watch': valA = dbHistory[a.animeId] || 0; valB = dbHistory[b.animeId] || 0; break;
        case 'last_added': valA = a.dateAdded; valB = b.dateAdded; break;
        case 'last_updated': valA = a.lastUpdated || a.dateAdded; valB = b.lastUpdated || b.dateAdded; break;
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    };
    return views.map(view => {
      return entries.filter(e => {
        const searchString = `${e.animeName} ${e.englishName || ''}`.toLowerCase();
        return searchString.includes(searchQuery.toLowerCase()) && (view.id ? e.categoryIds.includes(view.id) : true);
      }).sort(sortFn);
    });
  }, [entries, views, searchQuery, sortBy, sortOrder, randomSeed, dbHistory]);

  const activeViewIdx = useMemo(() => views.findIndex(v => v.id === activeCategoryId), [views, activeCategoryId]);
  const scrollToPanel = (idx: number) => {
    const panel = panelRefs.current[idx];
    if (panel && scrollRef.current) scrollRef.current.scrollTo({ left: panel.offsetLeft, behavior: 'smooth' });
  };

  // Sync activeCategoryId from visible snap panel
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idx = Number(entry.target.getAttribute('data-idx'));
          const v = views[idx];
          if (v) setActiveCategoryId(v.id);
        }
      });
    }, { root: el, threshold: 0.5 });
    panelRefs.current.forEach(ref => { if (ref) observer.observe(ref); });
    return () => observer.disconnect();
  }, [views.length]);

  // --- Selection Actions ---
  const handleSelectAll = () => {
    setSelectedIds(new Set(entries.map(e => e.animeId)));
  };

  const handleSelectInverse = () => {
    const newSet = new Set<string>();
    entries.forEach(e => {
      if (!selectedIds.has(e.animeId)) newSet.add(e.animeId);
    });
    setSelectedIds(newSet);
  };

  const handleRemoveSelected = () => {
    setConfirmDeleteSelected(true);
  };

  const handleShare = async () => {
    const selectedEntries = entries.filter(e => selectedIds.has(e.animeId));
    const text = `Anime Recommendations from Cerydra:\n` + selectedEntries.map((e, i) => `${i + 1}. ${e.animeName}`).join('\n') + `\n\nWatch on Cerydra!`;
    
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Cerydra Library', text });
      } else {
        await navigator.clipboard.writeText(text);
        setToast('Text copied to clipboard!');
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') setToast('Share failed');
    }
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleLongPress = (animeId: string) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedIds(new Set([animeId]));
      // Vibrate if supported
      if (navigator.vibrate) navigator.vibrate(50);
    }
  };

  const toggleSelect = (animeId: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(animeId)) {
      newSet.delete(animeId);
      if (newSet.size === 0) setIsSelectionMode(false);
    } else {
      newSet.add(animeId);
    }
    setSelectedIds(newSet);
  };

  // --- Category Management ---
  const [localCatSelections, setLocalCatSelections] = useState<Set<string>>(new Set());
  
  const openCategoryModal = () => {
    const selectedEntries = entries.filter(e => selectedIds.has(e.animeId));
    const initialCats = new Set<string>();
    categories.forEach(c => {
      const allHaveIt = selectedEntries.every(e => e.categoryIds.includes(c.id));
      if (allHaveIt) initialCats.add(c.id);
    });
    setLocalCatSelections(initialCats);
    setShowCategoryModal(true);
  };

  const handleSaveCategories = () => {
    setCategoriesForEntries(Array.from(selectedIds), Array.from(localCatSelections));
    setShowCategoryModal(false);
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleCreateCategory = () => {
    setNewCatName('');
    setShowCreateCat(true);
  };

  const confirmCreateCategory = () => {
    if (newCatName.trim()) {
      const newId = addCategory(newCatName.trim());
      setLocalCatSelections(prev => new Set(prev).add(newId));
      setShowCreateCat(false);
      setNewCatName('');
    }
  };

  // --- Render ---
  if (!mounted) return null;

  return (
    <div className="pb-28 bg-[var(--md-sys-color-background)] min-h-screen relative">
      
      {/* FLOATING ISLAND (When scrolled) */}
      <div 
        className={`fixed ${categories.length > 0 && showCategoryTabs ? 'top-[56px] md:top-[64px]' : 'top-4 md:top-6'} left-1/2 -translate-x-1/2 z-[60] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] w-[320px] md:w-[400px] ${
          showFloatingIsland && !isSelectionMode
            ? 'opacity-100 translate-y-0 scale-100' 
            : 'opacity-0 -translate-y-8 scale-75 pointer-events-none'
        }`}
      >
        <div className="flex gap-2 w-full">
          <div className="flex-1 flex items-center h-[48px] bg-[var(--md-sys-color-surface-container-high)] shadow-md rounded-full px-2 text-[var(--md-sys-color-on-surface)] overflow-hidden">
            <div className="flex items-center justify-center w-10 h-10 text-[var(--md-sys-color-on-surface-variant)] shrink-0">
              <span className="material-symbols-outlined text-[20px]">search</span>
            </div>
            <input
              type="text"
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-full bg-transparent text-[var(--md-sys-color-on-surface)] text-[15px] outline-none font-medium placeholder:text-[var(--md-sys-color-on-surface-variant)]"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="w-10 h-10 flex items-center justify-center rounded-full text-[var(--md-sys-color-on-surface-variant)] hover:text-white shrink-0 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            )}
          </div>
          
          <button 
            onClick={() => setShowFilterModal(true)}
            className="w-[48px] h-[48px] rounded-full bg-[var(--md-sys-color-surface-container-high)] shadow-md flex items-center justify-center text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors shrink-0"
          >
            <FilterIcon />
          </button>
        </div>
      </div>

      {/* STATIC HEADER (Normal Mode) */}
      <div 
        ref={sentinelRef}
        className={`px-4 md:px-8 pt-8 pb-4 flex items-center justify-between transition-all duration-300 ${
          isSelectionMode ? 'opacity-0 -translate-y-4 pointer-events-none absolute' : 'opacity-100 relative'
        }`}
      >
        {isSearchActive ? (
          <div className="flex-1 flex items-center h-12 relative bg-[var(--md-sys-color-surface-container-high)] rounded-2xl px-2">
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
              placeholder="Search in library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 bg-transparent text-white text-lg outline-none placeholder:text-white/30 ml-2 font-medium"
            />
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-xl md:text-3xl font-black text-white tracking-wide uppercase">
                {!showCategoryTabs ? (activeCategoryId ? categories.find(c => c.id === activeCategoryId)?.name : 'MY ANIME') : 'LIBRARY'}
              </h1>
              {showItemCount && !showCategoryTabs && (
                <p className="text-sm font-medium text-[var(--md-sys-color-on-surface-variant)] mt-1">{viewEntries[activeViewIdx]?.length || 0} anime</p>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setIsSearchActive(true)}
                className="w-10 h-10 flex items-center justify-center text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-primary)] transition-colors"
                aria-label="Search"
              >
                <SearchIcon />
              </button>
              <button 
                onClick={() => setShowFilterModal(true)}
                className="w-10 h-10 flex items-center justify-center text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-primary)] transition-colors"
                aria-label="Filter"
              >
                <FilterIcon />
              </button>
              <div className="relative">
                <button 
                  onClick={() => setShowHeaderMenu(p => !p)}
                  className="w-10 h-10 flex items-center justify-center text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-primary)] transition-colors relative"
                  aria-label="More options"
                >
                  <span className="material-symbols-outlined text-[24px] leading-none">more_vert</span>
                  {showSelectionHint && (
                    <span className="absolute -top-1 -right-0.5 w-2.5 h-2.5 rounded-full bg-[var(--md-sys-color-primary)] animate-ping" />
                  )}
                </button>
                {showHeaderMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowHeaderMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--md-sys-color-surface-container-high)] rounded-2xl shadow-xl border border-white/10 py-2 min-w-[200px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <button 
                        onClick={() => { setShowHeaderMenu(false); setIsSelectionMode(true); setSelectedIds(new Set()); localStorage.setItem('cerydra_selection_hint_seen', '1'); setShowSelectionHint(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-white/80 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
                      >
                        <span className="material-symbols-outlined text-[20px]">checklist</span>
                        Select items
                      </button>
                      <button 
                        onClick={() => { setShowHeaderMenu(false); handleSync(); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-white/80 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
                      >
                        <span className={`material-symbols-outlined text-[20px] ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
                        {isSyncing ? `Syncing ${syncProgress}%` : 'Sync Library'}
                      </button>
                      <div className="mx-3 my-1 border-t border-white/5" />
                      <button 
                        onClick={() => { setShowHeaderMenu(false); handleCreateCategory(); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-white/80 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
                      >
                        <span className="material-symbols-outlined text-[20px]">create_new_folder</span>
                        Create category
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* CATEGORY TABS */}
      {!isSelectionMode && categories.length > 0 && showCategoryTabs && (
        <div className="sticky top-0 z-50 bg-[var(--md-sys-color-background)] px-2 md:px-6 pt-2 mb-4 border-b border-white/10 relative">
          <div ref={tabsRef} className="overflow-x-auto scrollbar-hide flex">
            <button
              onClick={() => scrollToPanel(0)}
              className={`px-4 py-3 font-bold text-sm whitespace-nowrap transition-colors relative ${
                !activeCategoryId 
                  ? 'text-[var(--md-sys-color-primary)]' 
                  : 'text-[var(--md-sys-color-on-surface-variant)] hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="flex items-center gap-1.5">
                All Anime
                {showItemCount && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${!activeCategoryId ? 'bg-[var(--md-sys-color-primary)]/20 text-[var(--md-sys-color-primary)]' : 'bg-white/10 text-[var(--md-sys-color-on-surface-variant)]'}`}>
                    {viewEntries[0]?.length || 0}
                  </span>
                )}
              </span>
               {!activeCategoryId && (
                 <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[var(--md-sys-color-primary-container)] rounded-t-full" />
               )}
            </button>
            {views.slice(1).map((view, vi) => {
              return (
                <button
                  key={view.id ?? vi}
                  onClick={() => scrollToPanel(vi + 1)}
                  className={`px-4 py-3 font-bold text-sm whitespace-nowrap transition-colors relative ${
                    activeCategoryId === view.id
                      ? 'text-[var(--md-sys-color-primary)]' 
                      : 'text-[var(--md-sys-color-on-surface-variant)] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {view.name}
                    {showItemCount && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeCategoryId === view.id ? 'bg-[var(--md-sys-color-primary)]/20 text-[var(--md-sys-color-primary)]' : 'bg-white/10 text-[var(--md-sys-color-on-surface-variant)]'}`}>
                        {viewEntries[vi + 1]?.length || 0}
                      </span>
                    )}
                  </span>
                   {activeCategoryId === view.id && (
                     <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[var(--md-sys-color-primary-container)] rounded-t-full" />
                   )}
                </button>
              );
            })}
          </div>
          {showEndFade && (
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[var(--md-sys-color-background)] to-transparent pointer-events-none" />
          )}
        </div>
      )}

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
          >
            <CloseIcon />
          </button>
          <span className="text-lg font-bold text-white">{selectedIds.size} Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSelectAll} className="w-10 h-10 flex items-center justify-center rounded-full text-white hover:bg-white/10" title="Select All">
            <SelectAllIcon />
          </button>
          <button onClick={handleSelectInverse} className="w-10 h-10 flex items-center justify-center rounded-full text-white hover:bg-white/10" title="Inverse Selection">
            <SelectInverseIcon />
          </button>
          <button onClick={handleRemoveSelected} className="w-10 h-10 flex items-center justify-center rounded-full text-red-400 hover:bg-red-400/20 ml-2" title="Remove">
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* CONTENT — swipeable snap panels */}
      <div ref={scrollRef} className={`overflow-x-auto snap-x snap-mandatory scrollbar-hide ${isSelectionMode ? 'pt-20' : 'pt-4'}`}>
        <div className="flex">
          {views.map((view, idx) => {
            const panelEntries = viewEntries[idx] || [];
            return (
              <div
                key={view.id ?? '__all'}
                ref={el => { panelRefs.current[idx] = el; }}
                data-idx={idx}
                className="w-full flex-shrink-0 snap-start snap-always"
              >
                <div className="px-4 md:px-8 pb-12">
                  {panelEntries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                      <div className="w-20 h-20 mb-6 rounded-full bg-[var(--md-sys-color-surface-container-high)] flex items-center justify-center text-[var(--md-sys-color-on-surface-variant)]">
                        <span className="material-symbols-outlined text-[40px]">video_library</span>
                      </div>
                      <h2 className="text-xl font-bold text-white mb-2">
                        {searchQuery ? 'No Results Found' : 'Your Library is Empty'}
                      </h2>
                      <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm max-w-xs mx-auto mb-8 leading-relaxed">
                        {searchQuery 
                          ? `No anime found matching "${searchQuery}".` 
                          : 'Save your favorite anime to the Library to watch them later and organize them into categories.'}
                      </p>
                      {!searchQuery && (
                        <a 
                          href="/"
                          className="px-6 py-2.5 bg-[var(--md-sys-color-surface-container-high)] text-white text-sm font-bold rounded-full hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors border border-transparent hover:border-[var(--md-sys-color-primary)] hover:text-[var(--md-sys-color-primary)]"
                        >
                          Explore Anime
                        </a>
                      )}
                    </div>
                  ) : displayMode === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 sm:gap-6">
                      {panelEntries.map((entry, index) => {
                        const isSelected = selectedIds.has(entry.animeId);
                        return (
                          <div 
                            key={entry.animeId} 
                            className="relative animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
                            style={{ animationDelay: `${index * 30}ms` }}
                          >
                            <div 
                              className={`transition-transform duration-200 ${isSelected ? 'scale-90 opacity-80' : 'scale-100'}`}
                              onContextMenu={(e) => { e.preventDefault(); handleLongPress(entry.animeId); }}
                              onTouchStart={(e) => { const timer = setTimeout(() => handleLongPress(entry.animeId), 500); e.currentTarget.dataset.timer = timer.toString(); }}
                              onTouchEnd={(e) => { clearTimeout(Number(e.currentTarget.dataset.timer)); }}
                              onTouchMove={(e) => { clearTimeout(Number(e.currentTarget.dataset.timer)); }}
                            >
                              <AnimeCard
                                id={entry.animeId}
                                name={entry.englishName || entry.animeName}
                                thumbnail={entry.thumbnail}
                                score={entry.score}
                                popularity={entry.popularity}
                                episodeCount={entry.episodeCount}
                                showRating={showRating}
                                showEpisode={showEpisode}
                                showPopularity={showPopularity}
                                href={isSelectionMode ? undefined : getAnimeUrl(entry.animeId, entry.englishName || entry.animeName)}
                                onClick={isSelectionMode ? () => toggleSelect(entry.animeId) : undefined}
                              />
                            </div>
                            {isSelectionMode && (
                              <div className="absolute top-2 left-2 z-10 pointer-events-none">
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-[var(--md-sys-color-primary)] border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)]' : 'bg-black/50 border-white/50 text-transparent'}`}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {panelEntries.map((entry, index) => {
                        const isSelected = selectedIds.has(entry.animeId);
                        return (
                          <div 
                            key={entry.animeId} 
                            className={`relative animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both ${isSelected ? 'opacity-80 scale-[0.98]' : 'scale-100'} transition-all`}
                            style={{ animationDelay: `${index * 30}ms` }}
                          >
                            <div
                              className={`flex gap-4 py-3 px-4 md:px-4 transition-colors cursor-pointer group hover:bg-white/5 ${isSelected ? 'bg-[var(--md-sys-color-primary)]/10' : ''}`}
                              onClick={async () => {
                                if (isSelectionMode) { toggleSelect(entry.animeId); } else {
                                  const { navigate } = await import('astro:transitions/client');
                                  navigate(getAnimeUrl(entry.anilistId || entry.animeId, entry.englishName || entry.animeName));
                                }
                              }}
                              onContextMenu={(e) => { e.preventDefault(); handleLongPress(entry.animeId); }}
                              onTouchStart={(e) => { const timer = setTimeout(() => handleLongPress(entry.animeId), 500); e.currentTarget.dataset.timer = timer.toString(); }}
                              onTouchEnd={(e) => clearTimeout(Number(e.currentTarget.dataset.timer)) }
                              onTouchMove={(e) => clearTimeout(Number(e.currentTarget.dataset.timer)) }
                            >
                              <img src={entry.thumbnail} alt={entry.animeName} className="w-20 h-28 object-cover rounded-lg shrink-0" />
                              <div className="flex-1 py-1 pr-2">
                                <h3 className="text-white font-bold line-clamp-2 group-hover:text-[var(--md-sys-color-primary)] transition-colors">{entry.englishName || entry.animeName}</h3>
                                {showEpisode && entry.episodeCount && <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm font-medium mt-1">{entry.episodeCount} Episodes</p>}
                                {showRating && entry.score && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--md-sys-color-star)" stroke="var(--md-sys-color-star)" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                    <span className="text-white text-xs font-bold">{entry.score}</span>
                                  </div>
                                )}
                                {showPopularity && entry.popularity && (
                                  <div className="mt-1 flex items-center gap-1">
                                    <span className="text-[var(--md-sys-color-secondary)] font-bold text-sm">#</span>
                                    <span className="text-[var(--md-sys-color-secondary)] text-xs font-bold">{entry.popularity}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {isSelectionMode && (
                              <div className="absolute top-1/2 -translate-y-1/2 right-4 z-10 pointer-events-none">
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-[var(--md-sys-color-primary)] border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)]' : 'bg-black/50 border-white/50 text-transparent'}`}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* BOTTOM BAR SELECTION MODE */}
      {isSelectionMode && (
        <div className="fixed bottom-0 md:bottom-8 left-0 md:left-1/2 md:-translate-x-1/2 right-0 md:right-auto z-[200] animate-in slide-in-from-bottom-8 duration-300">
          <div className="bg-[var(--md-sys-color-surface-container-high)] md:bg-[var(--md-sys-color-surface-container-high)] border-t md:border border-white/10 shadow-[0_-4px_24px_rgba(0,0,0,0.3)] md:shadow-[0_8px_32px_rgba(0,0,0,0.6)] md:rounded-full flex items-center justify-center p-3 md:px-2 md:py-0 gap-3 h-[80px] md:h-[56px] w-full pb-safe">
            <button 
              onClick={openCategoryModal}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 md:py-2 md:h-10 rounded-xl md:rounded-full bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] font-bold hover:opacity-90 transition-opacity active:scale-95"
            >
              <FolderIcon />
              <span className="hidden sm:inline">Set as category</span>
              <span className="sm:hidden">Category</span>
            </button>
            <button 
              onClick={handleShare}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 md:py-2 md:h-10 rounded-xl md:rounded-full bg-white/10 text-white font-bold hover:bg-white/20 transition-colors active:scale-95"
            >
              <ShareIcon />
              Share
            </button>
          </div>
        </div>
      )}

      {/* MODAL: SET CATEGORY */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--md-sys-color-surface-container)] w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden border border-white/10 flex flex-col">
            <div className="p-6 pb-2">
              <h3 className="text-xl font-bold text-white mb-1">Set Category</h3>
              <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">Add anime to your playlist · {selectedIds.size} selected</p>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[40vh] custom-scrollbar flex flex-col gap-2">
              {categories.length === 0 ? (
                <div 
                  onClick={handleCreateCategory}
                  className="w-full border-2 border-dashed border-white/20 rounded-xl p-4 flex flex-col items-center justify-center text-[var(--md-sys-color-on-surface-variant)] hover:border-[var(--md-sys-color-primary)] hover:text-[var(--md-sys-color-primary)] cursor-pointer transition-colors"
                >
                  <PlusIcon />
                  <span className="font-bold mt-2">Create new category</span>
                </div>
              ) : (
                categories.map(cat => (
                  <label key={cat.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-white/20 text-[var(--md-sys-color-primary)] focus:ring-[var(--md-sys-color-primary)] focus:ring-offset-[var(--md-sys-color-surface-container)] bg-black/50"
                      checked={localCatSelections.has(cat.id)}
                      onChange={(e) => {
                        const newSet = new Set(localCatSelections);
                        if (e.target.checked) newSet.add(cat.id);
                        else newSet.delete(cat.id);
                        setLocalCatSelections(newSet);
                      }}
                    />
                    <span className="text-white font-medium flex-1">{cat.name}</span>
                  </label>
                ))
              )}
            </div>

            <div className="p-4 bg-[var(--md-sys-color-surface-container-high)] flex items-center justify-between border-t border-white/5">
              <button 
                onClick={() => { setShowCategoryModal(false); setShowEditCategoryModal(true); }}
                className="text-sm font-bold text-[var(--md-sys-color-primary)] px-3 py-2 rounded-lg hover:bg-[var(--md-sys-color-primary)]/10 transition-colors flex items-center gap-2"
              >
                <EditIcon /> Edit
              </button>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 font-bold text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveCategories}
                  className="px-6 py-2 font-bold bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] rounded-full hover:opacity-90 transition-opacity"
                >
                  Ok
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT CATEGORY */}
      {showEditCategoryModal && (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--md-sys-color-surface-container)] w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden border border-white/10 flex flex-col">
            <div className="p-6 pb-2 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Edit Categories</h3>
                <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">Manage your playlists</p>
              </div>
              <button onClick={handleCreateCategory} className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--md-sys-color-primary)]/10 text-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-primary)]/20">
                <PlusIcon />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[40vh] custom-scrollbar flex flex-col gap-2">
              {categories.length === 0 && (
                <p className="text-center text-white/50 py-4 text-sm">No categories found</p>
              )}
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-2 p-2 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex-1 px-2 py-1">
                    <p className="text-white font-medium">{cat.name}</p>
                  </div>
                  <button 
                    onClick={() => setEditingCat({ id: cat.id, name: cat.name })}
                    className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white rounded-lg hover:bg-white/10"
                  >
                    <EditIcon />
                  </button>
                  <button 
                    onClick={() => setDeleteCatConfirm({ id: cat.id, name: cat.name })}
                    className="w-8 h-8 flex items-center justify-center text-red-400/80 hover:text-red-400 rounded-lg hover:bg-red-400/10"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>

            <div className="p-4 bg-[var(--md-sys-color-surface-container-high)] flex justify-end border-t border-white/5">
              <button 
                onClick={() => setShowEditCategoryModal(false)}
                className="px-6 py-2 font-bold bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] rounded-full hover:opacity-90 transition-opacity"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE SELECTED */}
      {confirmDeleteSelected && (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--md-sys-color-surface-container)] w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden border border-white/10">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-2">Remove from Library?</h3>
              <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] leading-relaxed">
                Are you sure you want to remove <strong className="text-white">{selectedIds.size}</strong> anime from the Library?
              </p>
            </div>
            <div className="px-6 pb-4 flex justify-end gap-3">
              <button onClick={() => setConfirmDeleteSelected(false)} className="px-5 py-2 font-bold text-white hover:bg-white/10 rounded-full transition-colors">Cancel</button>
              <button onClick={() => { removeFromLibrary(Array.from(selectedIds)); setIsSelectionMode(false); setSelectedIds(new Set()); setConfirmDeleteSelected(false); }} className="px-5 py-2 font-bold bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors">Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE CATEGORY INPUT */}
      {showCreateCat && (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--md-sys-color-surface-container)] w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden border border-white/10">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-4">New Category</h3>
              <input
                autoFocus
                type="text"
                placeholder="Category name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') confirmCreateCategory(); }}
                className="w-full px-4 py-3 bg-[var(--md-sys-color-surface-container-high)] border border-white/10 rounded-xl text-white text-sm outline-none focus:border-[var(--md-sys-color-primary)] placeholder:text-white/30"
              />
            </div>
            <div className="px-6 pb-4 flex justify-end gap-3">
              <button onClick={() => setShowCreateCat(false)} className="px-5 py-2 font-bold text-white hover:bg-white/10 rounded-full transition-colors">Cancel</button>
              <button onClick={confirmCreateCategory} className="px-5 py-2 font-bold bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] rounded-full hover:opacity-90 transition-opacity">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* RENAME CATEGORY INPUT */}
      {editingCat && (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--md-sys-color-surface-container)] w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden border border-white/10">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-4">Rename Category</h3>
              <input
                autoFocus
                type="text"
                placeholder="Category name"
                defaultValue={editingCat.name}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.currentTarget.value.trim();
                    if (input) { renameCategory(editingCat.id, input); setEditingCat(null); }
                  }
                  if (e.key === 'Escape') setEditingCat(null);
                }}
                onBlur={(e) => {
                  const input = e.currentTarget.value.trim();
                  if (input) { renameCategory(editingCat.id, input); }
                  setEditingCat(null);
                }}
                className="w-full px-4 py-3 bg-[var(--md-sys-color-surface-container-high)] border border-white/10 rounded-xl text-white text-sm outline-none focus:border-[var(--md-sys-color-primary)] placeholder:text-white/30"
              />
            </div>
            <div className="px-6 pb-4 flex justify-end">
              <button onClick={() => setEditingCat(null)} className="px-5 py-2 font-bold text-white hover:bg-white/10 rounded-full transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE CATEGORY */}
      {deleteCatConfirm && (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--md-sys-color-surface-container)] w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden border border-white/10">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-2">Delete Category?</h3>
              <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] leading-relaxed">
                Are you sure you want to delete "<strong className="text-white">{deleteCatConfirm.name}</strong>"? Anime in this category won't be deleted.
              </p>
            </div>
            <div className="px-6 pb-4 flex justify-end gap-3">
              <button onClick={() => setDeleteCatConfirm(null)} className="px-5 py-2 font-bold text-white hover:bg-white/10 rounded-full transition-colors">Cancel</button>
              <button onClick={() => { removeCategory(deleteCatConfirm.id, false); setDeleteCatConfirm(null); }} className="px-5 py-2 font-bold bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* SELECTION ONBOARDING HINT */}
      {showSelectionHint && !isSelectionMode && (
        <div className="fixed bottom-24 md:bottom-28 left-1/2 -translate-x-1/2 z-[150] animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-[var(--md-sys-color-surface-container-high)] rounded-full px-5 py-3 shadow-lg border border-white/10 flex items-center gap-3 whitespace-nowrap">
            <span className="material-symbols-outlined text-[var(--md-sys-color-primary)] text-[20px]">touch_app</span>
            <span className="text-white text-sm font-medium">Tap & hold an anime to select, or tap the <span className="material-symbols-outlined text-[16px] align-text-bottom mx-0.5">checklist</span> icon</span>
            <button 
              onClick={() => { setShowSelectionHint(false); localStorage.setItem('cerydra_selection_hint_seen', '1'); }}
              className="w-8 h-8 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 shrink-0"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      )}

      {/* FILTER MODAL */}
      {showFilterModal && (
        <div className="fixed inset-0 z-[10010] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowFilterModal(false)} />
          <div className="relative bg-[var(--md-sys-color-surface-container)] w-full sm:w-[480px] max-h-[65vh] sm:rounded-2xl rounded-t-[24px] shadow-2xl overflow-hidden border-t sm:border border-white/10 flex flex-col animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h3 className="text-xl font-bold text-white ml-2">View Options</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={async () => {
                    if (isSyncing) return;
                    setIsSyncing(true);
                    setSyncProgress(0);
                    await syncLibrary((c, t) => setSyncProgress(Math.round((c/t)*100)));
                    setIsSyncing(false);
                    setSyncProgress(0);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--md-sys-color-primary)]/10 text-[var(--md-sys-color-primary)] text-sm font-bold hover:bg-[var(--md-sys-color-primary)]/20 transition-colors"
                >
                  <span className={`material-symbols-outlined text-[18px] ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
                  {isSyncing ? `${syncProgress}%` : 'Sync Library'}
                </button>
                <button onClick={() => setShowFilterModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full text-[var(--md-sys-color-on-surface-variant)] hover:bg-white/10">
                  <CloseIcon />
                </button>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="flex px-2 border-b border-white/5">
              {(['SORT', 'DISPLAY'] as const).map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveFilterTab(tab)}
                  className={`flex-1 py-3 font-bold text-sm relative transition-colors text-center ${activeFilterTab === tab ? 'text-[var(--md-sys-color-primary)]' : 'text-[var(--md-sys-color-on-surface-variant)] hover:text-white/80'}`}
                >
                  {tab}
                   {activeFilterTab === tab && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[var(--md-sys-color-primary-container)] rounded-t-full" />}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
              {activeFilterTab === 'SORT' && (
                <div className="flex flex-col gap-2">
                  {[
                    { id: 'names', label: 'Names' },
                    { id: 'rated', label: 'Most Rated' },
                    { id: 'popular', label: 'Most Popular' },
                    { id: 'episodes', label: 'Total Episodes' },
                    { id: 'last_watch', label: 'Last Watched' },
                    { id: 'last_added', label: 'Last Added' },
                    { id: 'last_updated', label: 'Last Updated' },
                    { id: 'random', label: 'Randomize' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        if (sortBy === opt.id && opt.id !== 'random') {
                          setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy(opt.id as any);
                          if (opt.id === 'random') setRandomSeed(Date.now());
                        }
                      }}
                      className={`flex items-center justify-between p-3 rounded-xl transition-colors ${sortBy === opt.id ? 'bg-[var(--md-sys-color-primary)]/10 border border-[var(--md-sys-color-primary)]/30' : 'hover:bg-white/5 border border-transparent'}`}
                    >
                      <span className={sortBy === opt.id ? 'text-[var(--md-sys-color-primary)] font-bold' : 'text-white font-medium'}>
                        {opt.label}
                      </span>
                      {sortBy === opt.id && (
                        opt.id === 'random' ? (
                          <span className="material-symbols-outlined text-[var(--md-sys-color-primary)] text-[20px]">refresh</span>
                        ) : (
                          <span className="material-symbols-outlined text-[var(--md-sys-color-primary)] text-[20px]">
                            {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                          </span>
                        )
                      )}
                    </button>
                  ))}
                </div>
              )}

              {activeFilterTab === 'DISPLAY' && (
                <div className="flex flex-col gap-6">
                  {/* DISPLAY MODE */}
                  <div>
                    <h4 className="text-[var(--md-sys-color-secondary)] text-xs font-bold uppercase tracking-wider mb-2 px-2">Display Mode</h4>
                    <div className="flex flex-col gap-2">
                      {[
                        { id: 'grid', label: 'Grid View', icon: 'grid_view' },
                        { id: 'list', label: 'List View', icon: 'view_list' }
                      ].map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => setDisplayMode(opt.id as any)}
                          className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${displayMode === opt.id ? 'bg-[var(--md-sys-color-primary)]/10 border border-[var(--md-sys-color-primary)]/30' : 'hover:bg-white/5 border border-transparent'}`}
                        >
                          <span className={`material-symbols-outlined text-[20px] ${displayMode === opt.id ? 'text-[var(--md-sys-color-primary)]' : 'text-[var(--md-sys-color-on-surface-variant)]'}`}>{opt.icon}</span>
                          <span className={displayMode === opt.id ? 'text-[var(--md-sys-color-primary)] font-bold' : 'text-white font-medium'}>
                            {opt.label}
                          </span>
                          {displayMode === opt.id && <span className="material-symbols-outlined text-[var(--md-sys-color-primary)] ml-auto text-[20px]">check</span>}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* OVERLAY */}
                  <div>
                    <h4 className="text-[var(--md-sys-color-secondary)] text-xs font-bold uppercase tracking-wider mb-2 px-2">Overlay</h4>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent">
                        <div>
                          <h4 className="text-white font-bold mb-0.5">Rating Score</h4>
                          <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">Show average rating in top right corner</p>
                        </div>
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 rounded border-white/20 text-[var(--md-sys-color-primary)] focus:ring-[var(--md-sys-color-primary)] bg-black/50"
                          checked={showRating}
                          onChange={(e) => setShowRating(e.target.checked)}
                        />
                      </label>
                      <label className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent">
                        <div>
                          <h4 className="text-white font-bold mb-0.5">Total Episodes</h4>
                          <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">Show episode count under the title</p>
                        </div>
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 rounded border-white/20 text-[var(--md-sys-color-primary)] focus:ring-[var(--md-sys-color-primary)] bg-black/50"
                          checked={showEpisode}
                          onChange={(e) => setShowEpisode(e.target.checked)}
                        />
                      </label>
                      <label className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent">
                        <div>
                          <h4 className="text-white font-bold mb-0.5">Popularity Rank</h4>
                          <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">Show popularity rank in top left corner</p>
                        </div>
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 rounded border-white/20 text-[var(--md-sys-color-primary)] focus:ring-[var(--md-sys-color-primary)] bg-black/50"
                          checked={showPopularity}
                          onChange={(e) => setShowPopularity(e.target.checked)}
                        />
                      </label>
                    </div>
                  </div>

                  {/* TABS */}
                  <div>
                    <h4 className="text-[var(--md-sys-color-secondary)] text-xs font-bold uppercase tracking-wider mb-2 px-2">Tabs</h4>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent">
                        <div>
                          <h4 className="text-white font-bold mb-0.5">Category Tabs</h4>
                          <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">Show scrollable category tabs below header</p>
                        </div>
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 rounded border-white/20 text-[var(--md-sys-color-primary)] focus:ring-[var(--md-sys-color-primary)] bg-black/50"
                          checked={showCategoryTabs}
                          onChange={(e) => setShowCategoryTabs(e.target.checked)}
                        />
                      </label>
                      <label className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent">
                        <div>
                          <h4 className="text-white font-bold mb-0.5">Item Count</h4>
                          <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">Show number of anime below the title</p>
                        </div>
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 rounded border-white/20 text-[var(--md-sys-color-primary)] focus:ring-[var(--md-sys-color-primary)] bg-black/50"
                          checked={showItemCount}
                          onChange={(e) => setShowItemCount(e.target.checked)}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/5">
              <button 
                onClick={() => setShowFilterModal(false)}
                className="w-full py-3 bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] font-black rounded-full hover:opacity-90 transition-opacity active:scale-[0.98]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 z-[300] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-[var(--md-sys-color-surface-container-high)] rounded-full px-5 py-3 shadow-lg border border-white/10">
            <p className="text-white text-sm font-medium">{toast}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LibraryPage() {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  return (
    <AppShell activeTab="library" hideNav={isSelectionMode}>
      <LibraryContent isSelectionMode={isSelectionMode} setIsSelectionMode={setIsSelectionMode} />
    </AppShell>
  );
}
