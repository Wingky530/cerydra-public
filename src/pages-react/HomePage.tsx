import { useState, useEffect, useRef } from 'react';
import { getAnimeUrl } from '../lib/routing';
import AppShell from '../components/AppShell';
import HeroCarousel from '../components/HeroCarousel';
import ContinueWatchingRow from '../components/ContinueWatchingRow';
import LibraryRow from '../components/LibraryRow';
import SeasonalAnime from '../components/SeasonalAnime';
import UpcomingSeason from '../components/UpcomingSeason';
import RecentlyUpdated from '../components/RecentlyUpdated';
import TopRatedAnime from '../components/TopRatedAnime';
import GenreFilteredAnime from '../components/GenreFilteredAnime';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

function HomeContent({ initialHero }: { initialHero?: any[] }) {
  const [showFloatingIsland, setShowFloatingIsland] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const pickRandomAnime = async () => {
    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `query { Page(page: ${Math.floor(Math.random() * 50) + 1}, perPage: 1) { media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) { id title { english romaji } } } }` })
      });
      const json = await res.json();
      const media = json.data?.Page?.media?.[0];
      if (media && media.id) {
        const { navigate } = await import('astro:transitions/client');
        navigate(getAnimeUrl(media.id, media.title?.english || media.title?.romaji));
      }
    } catch {}
  };

  useEffect(() => {
    const timer = setTimeout(() => setIsSearchLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isSearchLoading) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show floating island when the sentinel leaves the viewport (scrolled past)
        setShowFloatingIsland(entry.boundingClientRect.top < 0 && !entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isSearchLoading]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (e.key === '/') {
        e.preventDefault();
        import('astro:transitions/client').then(({ navigate }) => navigate('/search'));
      }
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
        pickRandomAnime();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const keycap = 'inline-flex items-center justify-center min-w-[28px] h-[28px] px-[6px] bg-[var(--md-sys-color-surface-variant)] text-xs font-mono font-bold text-[var(--md-sys-color-on-surface)] rounded-md cursor-pointer hover:bg-[var(--md-sys-color-primary)] hover:text-white transition-colors select-none';
  const tips: React.ReactNode[] = [
    <>Press <button className={keycap} onClick={() => { import('astro:transitions/client').then(m => m.navigate('/search')); }} title="Go to search">/</button> to search any anime instantly</>,
    <>Press <button className={keycap} onClick={pickRandomAnime} title="Random anime">R</button> for a random anime surprise</>,
    'Swipe the carousel to browse trending anime',
    'Add anime to your library to track your progress',
    'Use the schedule to find when your anime airs',
    'Browse genres to discover something new',
    'Keep watching where you left off with watch history',
  ];
  const [tip] = useState(() => tips[Math.floor(Math.random() * tips.length)]);

  return (
    <>
      <h1 className="sr-only">Cerydra — Watch Anime Online</h1>
      {/* Floating Island Search */}
      <div 
        className={`fixed top-4 md:top-8 left-1/2 -translate-x-1/2 z-[100] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          showFloatingIsland 
            ? 'w-[320px] md:w-[400px] opacity-100 translate-y-0 scale-100' 
            : 'w-[120px] opacity-0 -translate-y-8 scale-75 pointer-events-none'
        }`}
      >
        <div className="flex gap-2">

        <a 
          href="/search"
          className="flex-1 flex items-center h-[48px] bg-[var(--md-sys-color-surface-container-high)] rounded-full px-4 text-[var(--md-sys-color-on-surface)] overflow-hidden group shadow-md hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors"
        >
          <div className="flex items-center text-[var(--md-sys-color-on-surface)] mr-3">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <span className="flex-1 text-[15px] font-bold text-[var(--md-sys-color-on-surface-variant)] truncate">
            Search...
          </span>
        </a>
        <button 
          onClick={pickRandomAnime}
          className="w-[48px] h-[48px] rounded-full bg-[var(--md-sys-color-surface-container-high)] flex items-center justify-center text-[var(--md-sys-color-on-surface)] hover:text-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors shadow-md flex-shrink-0"
          title="Random anime"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/></svg>
        </button>
        </div>
      </div>

      {/* Hero starts at top-0 (navbar overlays it transparently) */}
      <HeroCarousel initialHero={initialHero} />

      <div className="max-w-7xl mx-auto px-2 md:px-4 pb-8 mt-8 md:mt-10">
        {isSearchLoading ? (
          <SkeletonTheme baseColor="var(--md-sys-color-surface-container-high)" highlightColor="var(--md-sys-color-surface-variant)">
            <Skeleton height={56} borderRadius={9999} className="mb-8" />
          </SkeletonTheme>
        ) : (
          /* Sentinel: IntersectionObserver watches this to trigger floating search */
          <div id="home-search-sentinel" ref={sentinelRef} className="relative mb-8">
            <div className="flex gap-2">
              <a
                href="/search"
                className="relative flex-1 flex items-center h-[56px] bg-[var(--md-sys-color-surface-container-high)] rounded-full px-4 text-[var(--md-sys-color-on-surface)] overflow-hidden transition-shadow duration-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--md-sys-color-primary)] group"
              >
                <div className="flex items-center text-[var(--md-sys-color-on-surface)] mr-4 z-10 pointer-events-none">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                </div>
                <span className="flex-1 text-[16px] font-bold text-[var(--md-sys-color-on-surface-variant)] z-10 pointer-events-none truncate">
                  Search...
                </span>
              </a>
              <button 
                onClick={pickRandomAnime}
                className="w-[56px] h-[56px] flex-shrink-0 rounded-full bg-[var(--md-sys-color-surface-container-high)] flex items-center justify-center text-[var(--md-sys-color-on-surface)] hover:text-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors shadow-sm"
                title="Random anime"
              >
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/>
                  <path d="m18 2 4 4-4 4"/>
                  <path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/>
                  <path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/>
                  <path d="m18 14 4 4-4 4"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        <ContinueWatchingRow />
        <LibraryRow />
        <RecentlyUpdated />

        {/* Schedule link — mobile only (desktop has dock nav) */}
        <div className="md:hidden px-2 mb-8">
          {!mounted ? (
            <div className="flex items-center gap-3 bg-[var(--md-sys-color-surface-container)] rounded-2xl p-4 animate-pulse">
              <div className="w-12 h-12 rounded-xl bg-[var(--md-sys-color-surface-variant)] shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-4 w-24 bg-[var(--md-sys-color-surface-variant)] rounded" />
                <div className="h-3 w-36 bg-[var(--md-sys-color-surface-variant)] rounded" />
              </div>
              <div className="w-6 h-6 bg-[var(--md-sys-color-surface-variant)] rounded-full" />
            </div>
          ) : (
          <a
            href="/schedule"
            className="flex items-center gap-3 bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)] rounded-2xl p-4 transition-colors group"
          >
            <div className="w-12 h-12 rounded-xl bg-[var(--md-sys-color-primary)]/10 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--md-sys-color-primary)]"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[var(--md-sys-color-on-background)]">Schedule</p>
              <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">Weekly airing schedule</p>
            </div>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--md-sys-color-on-surface-variant)] group-hover:text-[var(--md-sys-color-primary)] transition-colors">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </a>
          )}
        </div>

        <SeasonalAnime />
        <UpcomingSeason />
        <TopRatedAnime />
        <GenreFilteredAnime />
        
        {/* Footer Area */}
        <div className="mt-16 mb-24 flex flex-col items-center justify-center text-center">
          <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm mb-3 max-w-lg leading-relaxed">
            {tip}
          </p>
          <button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2 text-[var(--md-sys-color-primary)] text-sm font-bold bg-[var(--md-sys-color-primary)]/10 px-4 py-2 rounded-full hover:bg-[var(--md-sys-color-primary)]/20 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7"/>
            </svg>
            Back to Top
          </button>
        </div>
      </div>
    </>
  );
}

export default function HomePage({ initialHero }: { initialHero?: any[] }) {
  return (
    <AppShell activeTab="home" showFloatingSearch>
      <HomeContent initialHero={initialHero} />
    </AppShell>
  );
}
