import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAnimeUrl } from '../lib/routing';

interface AnimeInfoModalProps {
  open: boolean;
  onClose: () => void;
  anime: any;
}

export default function AnimeInfoModal({ open, anime, onClose }: AnimeInfoModalProps) {
  const [touchStartY, setTouchStartY] = React.useState(0);
  const [touchCurrentY, setTouchCurrentY] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isLoadingNavigate, setIsLoadingNavigate] = React.useState(false);
  const [animateIn, setAnimateIn] = React.useState(false);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setAnimateIn(true));
    } else {
      setAnimateIn(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const queryEnabled = open && !!anime?.idMal;
  const { data: detailedAnime, isLoading, isError } = useQuery({
    queryKey: ['anime-jikan-full', anime?.idMal],
    queryFn: async ({ signal }) => {
      const res = await fetch(`https://api.jikan.moe/v4/anime/${anime.idMal}/full`, { signal });
      if (!res.ok) {
        throw new Error('Failed to fetch from Jikan');
      }
      const json = await res.json();
      return json.data;
    },
    enabled: queryEnabled,
    staleTime: 1000 * 60 * 60 * 2, // 2 hours
    retry: 1,
  });

  const isPending = queryEnabled ? isLoading : false;
  const displayData = detailedAnime || anime;

  const handleNavigate = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsLoadingNavigate(true);
    try {
      const { navigate } = await import('astro:transitions/client');
      const targetId = anime.anilist_id || anime.id || anime.idMal;
      if (targetId) {
        navigate(getAnimeUrl(targetId, title));
      }
    } catch (err) {
      // ignore
    } finally {
      setIsLoadingNavigate(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    if (currentY > touchStartY) {
      setTouchCurrentY(currentY - touchStartY);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (touchCurrentY > 100) {
      onClose();
    }
    setTouchCurrentY(0);
  };

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  if (!open) return null;

  const slideY = isDragging ? touchCurrentY : 0;
  
  // Freeze these to the initial AniList data so the UI doesn't jump when Jikan data loads
  const posterImg = anime.images?.webp?.large_image_url || anime.thumbnail;
  const trailerUrl = detailedAnime?.trailer?.url;
  const title = anime.title_english || anime.title;
  const nativeTitle = anime.title_native || anime.title_japanese;
  const romajiTitle = anime.title_romaji;

  return (
    <div className="fixed inset-0 z-[1300] flex items-end sm:items-center justify-center pointer-events-none" role="dialog" aria-modal="true" aria-label="Anime details">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      
      {/* Modal Surface */}
      <div 
        className="relative w-full sm:w-[600px] md:w-[750px] lg:w-[850px] max-h-[82vh] sm:max-h-[90vh] bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] rounded-t-2xl sm:rounded-2xl overflow-y-auto pointer-events-auto transition-transform duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1)] shadow-[0_24px_48px_rgba(0,0,0,0.5)] scrollbar-hide"
        style={{ transform: animateIn ? `translateY(${slideY}px)` : 'translateY(100%)' }}
      >


        <div className="p-0 sm:p-0">
          <div className="flex flex-col sm:flex-row gap-0 sm:gap-6">
            
            {/* Left/Top Area: Poster */}
            <div 
              className="w-full sm:w-[280px] md:w-[320px] shrink-0 relative touch-pan-y flex flex-col"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Drag Handle (Mobile) */}
              <div className="absolute top-0 inset-x-0 flex justify-center pt-3 pb-4 sm:hidden z-50 bg-gradient-to-b from-black/40 to-transparent">
                <div className="w-10 h-[5px] rounded-full bg-white shadow-md" />
              </div>

              <img 
                src={posterImg} 
                alt={title} 
                className="w-full flex-1 aspect-[2/3] sm:aspect-auto sm:h-full object-cover sm:rounded-tl-2xl sm:rounded-bl-2xl pointer-events-none"
              />
              {/* Gradient overlay for mobile text legibility */}
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[var(--md-sys-color-surface)] to-transparent sm:hidden pointer-events-none" />
              
              {trailerUrl && !isPending && (
                <a 
                  href={trailerUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 w-14 h-14 bg-[var(--md-sys-color-primary)]/90 hover:bg-[var(--md-sys-color-primary)] rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-[0_0_20px_rgba(61,217,224,0.4)] group z-20 hidden sm:flex"
                >
                  <svg className="w-6 h-6 text-[var(--md-sys-color-on-primary)] ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </a>
              )}
            </div>

            {/* Right/Bottom Area: Details */}
            <div className="flex-1 px-5 pb-6 pt-2 sm:pt-6 sm:pr-6 sm:pl-0 flex flex-col justify-between z-10 -mt-20 sm:mt-0 relative">
              
              <div>
                <div className="flex flex-wrap gap-2 mb-3 items-center">
                  {displayData.type && (
                    <span className="px-2 py-0.5 bg-white text-black text-[11px] sm:text-[12px] font-bold uppercase rounded-[8px] tracking-wider">
                      {displayData.type}
                    </span>
                  )}
                  {[...(anime.genres || []), ...(detailedAnime?.themes || [])]
                    .filter((item, index, self) => index === self.findIndex((t) => t.name === item.name))
                    .map((g: any) => (
                      <span key={`genre-${g.mal_id || g.name}`} className="px-2 py-0.5 bg-[var(--md-sys-color-primary)] text-white text-[11px] sm:text-[12px] font-bold uppercase rounded-[8px] tracking-wider">
                        {g.name}
                      </span>
                  ))}
                </div>
                
                <h2 className="text-2xl sm:text-3xl font-black mb-1 leading-tight text-white sm:text-[var(--md-sys-color-on-surface)]">
                  {title}
                </h2>
                
                {nativeTitle && nativeTitle !== title && (
                  <h3 className={`text-sm font-medium text-white/70 sm:text-[var(--md-sys-color-on-surface-variant)] ${romajiTitle && romajiTitle !== title && romajiTitle !== nativeTitle ? 'mb-1' : 'mb-4'}`}>
                    {nativeTitle}
                  </h3>
                )}

                {romajiTitle && romajiTitle !== title && romajiTitle !== nativeTitle && (
                  <h4 className="text-xs font-medium text-[var(--md-sys-color-primary)]/80 italic mb-4">
                    {romajiTitle}
                  </h4>
                )}

                {/* Quick Info Tags */}
                <div className="flex flex-wrap items-center gap-2 mb-4 text-sm font-medium text-[var(--md-sys-color-on-surface-variant)]">
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

                <div className="w-full h-px bg-[var(--md-sys-color-outline)]/20 mb-4" />

                {/* Main Scrollable Info */}
                <div className="max-h-[30vh] sm:max-h-[400px] overflow-y-auto pr-3 scrollbar-hide">
                  {isPending ? (
                    <div className="flex justify-center p-4">
                      <md-circular-progress indeterminate></md-circular-progress>
                    </div>
                  ) : (
                    <div className="space-y-6 pb-2">
                      
                      {/* Stats Bento Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full text-center">
                        <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                          <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] uppercase font-bold tracking-wider mb-1">Score</div>
                          <div className="text-sm font-black text-[var(--md-sys-color-primary)] flex items-center justify-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                            {detailedAnime?.score || anime.score || '-'}
                          </div>
                        </div>
                        <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                          <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] uppercase font-bold tracking-wider mb-1">Rank</div>
                          <div className="text-sm font-black text-white">#{detailedAnime?.rank || '-'}</div>
                        </div>
                        <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                          <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] uppercase font-bold tracking-wider mb-1">Popularity</div>
                          <div className="text-sm font-black text-white">#{detailedAnime?.popularity || '-'}</div>
                        </div>
                        <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                          <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] uppercase font-bold tracking-wider mb-1">Members</div>
                          <div className="text-sm font-black text-white">{detailedAnime?.members ? (detailedAnime.members / 1000).toFixed(0) + 'K' : '-'}</div>
                        </div>
                      </div>

                      {/* Synopsis */}
                      <section>
                        <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">Synopsis</h3>
                        <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm leading-relaxed">
                          {displayData.synopsis ? displayData.synopsis.replace('[Written by MAL Rewrite]', '').trim() : 'No synopsis available.'}
                        </p>
                      </section>

                      {/* Info Grid */}
                      <section>
                        <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">Information</h3>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm bg-black/10 p-3 rounded-lg border border-white/5">
                          <div><span className="text-[var(--md-sys-color-on-surface-variant)] block text-xs">Aired</span><span className="font-medium text-white">{detailedAnime?.aired?.string || '-'}</span></div>
                          <div><span className="text-[var(--md-sys-color-on-surface-variant)] block text-xs">Source</span><span className="font-medium text-white">{displayData.source || '-'}</span></div>
                          <div><span className="text-[var(--md-sys-color-on-surface-variant)] block text-xs">Duration</span><span className="font-medium text-white">{displayData.duration || '-'}</span></div>
                          <div><span className="text-[var(--md-sys-color-on-surface-variant)] block text-xs">Studios</span><span className="font-medium text-[var(--md-sys-color-primary)]">{detailedAnime?.studios?.map((s:any)=>s.name).join(', ') || '-'}</span></div>
                        </div>
                      </section>

                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <md-filled-button onClick={handleNavigate} disabled={isLoadingNavigate} class="flex-1 h-12 text-base font-bold tracking-wide">
                  {isLoadingNavigate ? 'Loading...' : 'Go to Anime'}
                </md-filled-button>
                {trailerUrl && !isPending && (
                  <md-outlined-button href={trailerUrl} target="_blank" class="h-12 text-sm font-bold sm:hidden">
                    Watch Trailer
                  </md-outlined-button>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
