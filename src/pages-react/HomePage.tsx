import { useState, useEffect, useRef } from 'react';
import { getAnimeUrl } from '../lib/routing';
import AppShell from '../components/AppShell';
import HeroCarousel from '../components/HeroCarousel';
import ContinueWatchingRow from '../components/ContinueWatchingRow';
import LibraryRow from '../components/LibraryRow';
import SeasonalAnime from '../components/SeasonalAnime';
import RecentlyUpdated from '../components/RecentlyUpdated';
import TopRatedAnime from '../components/TopRatedAnime';
import GenreFilteredAnime from '../components/GenreFilteredAnime';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

function HomeContent({ initialHero }: { initialHero?: any[] }) {
  const [showFloatingIsland, setShowFloatingIsland] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

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

  return (
    <>
      {/* Floating Island Search */}
      <div 
        className={`fixed top-4 md:top-8 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] ${
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
          onClick={async () => {
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
          }}
          className="w-[48px] h-[48px] rounded-full bg-[var(--md-sys-color-surface-container-high)] flex items-center justify-center text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors shadow-md flex-shrink-0"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><circle cx="15.5" cy="15.5" r="1.5"></circle><circle cx="15.5" cy="8.5" r="1.5"></circle><circle cx="8.5" cy="15.5" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle></svg>
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
                onClick={async () => {
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
                }}
                className="w-[56px] h-[56px] flex-shrink-0 rounded-full bg-[var(--md-sys-color-surface-container-high)] flex items-center justify-center text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors shadow-sm"
                title="Randomize Anime"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><circle cx="15.5" cy="15.5" r="1.5"></circle><circle cx="15.5" cy="8.5" r="1.5"></circle><circle cx="8.5" cy="15.5" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle></svg>
              </button>
            </div>
          </div>
        )}

        <ContinueWatchingRow />
        <LibraryRow />
        <RecentlyUpdated />

        {/* Schedule link — mobile only (desktop has dock nav) */}
        <div className="md:hidden px-2 mb-8">
          <a
            href="/schedule"
            className="flex items-center gap-3 bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)] rounded-2xl p-4 transition-colors group"
          >
            <div className="w-12 h-12 rounded-xl bg-[var(--md-sys-color-primary)]/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[var(--md-sys-color-secondary)] text-2xl">calendar_month</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[var(--md-sys-color-on-background)]">Schedule</p>
              <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">Weekly airing schedule</p>
            </div>
            <span className="material-symbols-outlined text-[var(--md-sys-color-on-surface-variant)] group-hover:text-[var(--md-sys-color-primary)] transition-colors">chevron_right</span>
          </a>
        </div>

        <SeasonalAnime />
        <TopRatedAnime />
        <GenreFilteredAnime />
        
        {/* Footer Area */}
        <div className="mt-16 mb-24 flex flex-col items-center justify-center text-center opacity-60">
          <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm mb-3">
            You've reached the bottom! Time to watch some anime 🍿
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
