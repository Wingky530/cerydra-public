import { useEffect, useState, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '../lib/queryClient';
import { playerStore } from '../store/player';
import WatchContent from './WatchContent';
import ErrorBoundary from './ErrorBoundary';
import { getAnimeUrl } from '../lib/routing';

const queryClient = getQueryClient();

export default function GlobalPlayer() {
  const state = useStore(playerStore);
  const wasPlayingRef = useRef<boolean>(false);
  const [pathname, setPathname] = useState(typeof window !== 'undefined' ? window.location.pathname : '');
  const [navType, setNavType] = useState<'VT' | 'FULL' | ''>('');
  const [progress, setProgress] = useState(0);
  const navTimerRef = useRef<number>(0);

  useEffect(() => {
    const handleProgress = (e: any) => {
      if (e.detail?.currentTime && e.detail?.duration) {
        setProgress((e.detail.currentTime / e.detail.duration) * 100);
      }
    };
    window.addEventListener('cerydra_progress', handleProgress);
    return () => window.removeEventListener('cerydra_progress', handleProgress);
  }, []);

  useEffect(() => {
    // Check on mount (catches full reloads where page-load fired before handler registration)
    const isVT = !!document.querySelector('[data-astro-transition]');
    setNavType(isVT ? 'VT' : 'FULL');
    clearTimeout(navTimerRef.current);
    navTimerRef.current = window.setTimeout(() => setNavType(''), 3000);

    const handleBeforeSwap = () => {
      wasPlayingRef.current = !playerStore.get().isPaused;
    };

    const handlePageLoad = () => {
      setPathname(window.location.pathname);
      
      if (!window.location.pathname.startsWith('/watch') && playerStore.get().isOpen) {
        playerStore.setKey('isMinimized', true);
      }
    };

    // Update badge on view transitions too
    const handlePageLoadBadge = () => {
      const vt = !!document.querySelector('[data-astro-transition]');
      setNavType(vt ? 'VT' : 'FULL');
      clearTimeout(navTimerRef.current);
      navTimerRef.current = window.setTimeout(() => setNavType(''), 3000);
    };

    document.addEventListener('astro:before-swap', handleBeforeSwap);
    document.addEventListener('astro:page-load', handlePageLoad);
    document.addEventListener('astro:page-load', handlePageLoadBadge);
    window.addEventListener('cerydra_minimize', handleMinimize);

    return () => {
      document.removeEventListener('astro:before-swap', handleBeforeSwap);
      document.removeEventListener('astro:page-load', handlePageLoad);
      document.removeEventListener('astro:page-load', handlePageLoadBadge);
      window.removeEventListener('cerydra_minimize', handleMinimize);
    };
  }, []);

  // Capture-phase click handler: close mini player before navigating to a different anime's watch page
  useEffect(() => {
    const handleCaptureClick = (e: MouseEvent) => {
      const composedPath = e.composedPath?.() || [];
      let targetLink: HTMLAnchorElement | null = null;
      for (const el of composedPath) {
        if (el instanceof HTMLAnchorElement && el.getAttribute('href')?.startsWith('/watch/')) {
          targetLink = el;
          break;
        }
      }
      if (!targetLink) return;
      
      const href = targetLink.getAttribute('href')!;
      const parts = href.split('/');
      // href = /watch/animeId/episode
      const targetAnimeId = parts[2];
      const state = playerStore.get();
      if (state.isOpen && state.animeId && state.animeId !== targetAnimeId) {
        playerStore.setKey('isOpen', false);
      }
    };

    document.addEventListener('click', handleCaptureClick, true);

    return () => {
      document.removeEventListener('click', handleCaptureClick, true);
    };
  }, []);

  useEffect(() => {
    if (state.isOpen && !state.isMinimized) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      // Prevent mobile scroll bounce chaining
      document.body.classList.add('overscroll-none', 'touch-none');
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.classList.remove('overscroll-none', 'touch-none');
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.classList.remove('overscroll-none', 'touch-none');
    };
  }, [state.isOpen, state.isMinimized]);

  const hideNav = pathname.startsWith('/watch');
  const bottomClasses = hideNav 
    ? 'bottom-6 md:bottom-8' 
    : 'bottom-[92px] md:bottom-[104px]';

  const handleMinimize = () => {
    if (window.location.pathname.startsWith('/watch')) {
      const animeId = playerStore.get().animeId;
      const anilistId = playerStore.get().anilistId;
      if (animeId) {
        playerStore.setKey('isMinimized', true);
        import('astro:transitions/client').then(({ navigate }) => {
          navigate(getAnimeUrl(anilistId || animeId, playerStore.get().animeName));
        });
      } else {
        window.history.back();
      }
    } else {
      playerStore.setKey('isMinimized', true);
    }
  };


  return (
    <QueryClientProvider client={queryClient}>
      <div id="global-player-root" className={!state.isOpen ? 'hidden' : ''}>
        {state.isOpen && state.animeId && state.episode && (
          <div 
            className={`fixed z-[9999] transition-all duration-300 overflow-hidden ${
              state.isMinimized 
                ? `${bottomClasses} top-auto left-1/2 -translate-x-1/2 w-[calc(100%-24px)] md:w-[460px] h-[68px] md:h-[72px] rounded-2xl border border-white/10 bg-[var(--md-sys-color-surface-container)] flex flex-row shadow-[0_20px_60px_rgba(0,0,0,0.6)] touch-none` 
                : 'inset-0 w-full h-full bg-[var(--md-sys-color-background)] left-0 translate-x-0 rounded-none'
            }`}>
            
            <div className={`shrink-0 relative ${state.isMinimized ? 'h-full aspect-video pointer-events-none z-0 bg-black' : 'w-full h-full overflow-y-auto custom-scrollbar z-0 overscroll-none touch-auto'}`}>
               {import.meta.env.DEV && navType && state.isMinimized && (
                 <div className={`absolute top-1 left-1 z-[99999] px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider pointer-events-none ${
                   navType === 'VT' ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'
                 }`}>
                   {navType}
                 </div>
               )}
               {state.isMinimized && state.thumbnail && (
                 <img src={state.thumbnail} alt={state.animeName} className="absolute inset-0 w-full h-full object-cover opacity-50" />
               )}
               <ErrorBoundary fallback={(err: Error, reset: () => void) => {
                 setTimeout(reset, 100);
                 return (
                   <div className="fixed inset-0 z-[9999] bg-[var(--md-sys-color-background)] flex items-center justify-center p-8">
                     <div className="max-w-lg text-center">
                       <div className="text-red-400 mb-4">
                         <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                           <circle cx="12" cy="12" r="10"/>
                           <line x1="12" y1="8" x2="12" y2="12"/>
                           <line x1="12" y1="16" x2="12.01" y2="16"/>
                         </svg>
                       </div>
                       <p className="text-[var(--md-sys-color-on-background)] font-bold text-lg mb-2">Player Error</p>
                       <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm font-mono break-all">
                         {err.message || err.toString()}
                       </p>
                       <button
                         onClick={reset}
                         className="mt-4 px-4 py-2 bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] rounded-lg font-bold text-sm"
                       >
                         Retry
                       </button>
                     </div>
                   </div>
                 );
               }}>
                  <WatchContent 
                    animeId={state.animeId} 
                    episode={state.episode} 
                    initialTime={state.initialTime} 
                    isMini={state.isMinimized} 
                    autoPlay={!state.isPaused}
                    anilistId={state.anilistId}
                  />
               </ErrorBoundary>
            </div>

            {state.isMinimized && (
              <div 
                className="flex-1 min-w-0 flex flex-row items-center justify-between p-2 pl-3 md:px-4 z-[100] cursor-pointer"
                onClick={() => playerStore.setKey('isMinimized', false)}
              >
                
                {/* Title & Episode Text */}
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="text-[13px] md:text-sm font-bold text-[var(--md-sys-color-on-background)] truncate">{state.animeName || 'Anime'}</span>
                  <span className="text-[10px] md:text-[11px] text-[var(--md-sys-color-on-surface-variant)] font-bold">Episode {state.episode}</span>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                   <button onClick={() => window.dispatchEvent(new CustomEvent('cerydra_toggle_play'))} className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center text-[var(--md-sys-color-on-background)] hover:text-[var(--md-sys-color-primary)] hover:bg-white/5 rounded-full transition-colors">
                     {state.isPaused ? (
                       <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 19,12 6,20" /></svg>
                     ) : (
                       <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                     )}
                   </button>
                   <button onClick={() => playerStore.setKey('isOpen', false)} className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center text-[var(--md-sys-color-outline)] hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors">
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                   </button>
                </div>
               </div>
             )}

             {state.isMinimized && progress > 0 && (
               <div 
                  className="absolute bottom-0 left-0 h-[2px] md:h-[3px] bg-[var(--md-sys-color-primary-container)] transition-all duration-300 z-[101]"
                 style={{ width: `${progress}%` }}
               />
             )}


          </div>
        )}
      </div>
    </QueryClientProvider>
  );
}
