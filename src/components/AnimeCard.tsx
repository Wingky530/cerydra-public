import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { getAnimeUrl } from '../lib/routing';

interface AnimeCardProps {
  id: string;
  name: string;
  thumbnail: string;
  episodeCount?: number;
  score?: number | string | null;
  popularity?: number;
  href?: string;
  romajiTitle?: string;
  nativeTitle?: string;
  onClick?: () => void;
  progressPercent?: number;
  episodeText?: string;
  timeLabel?: string;
  statusLabel?: string;
  formatLabel?: string;
  showRating?: boolean;
  showEpisode?: boolean;
  showPopularity?: boolean;
}

export default function AnimeCard({ id, name, thumbnail, episodeCount, score, popularity, href, onClick, progressPercent, episodeText, timeLabel, statusLabel, formatLabel, showRating = true, showEpisode = true, showPopularity = true }: AnimeCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement | HTMLAnchorElement>(null);
  const [svgP, setSvgP] = useState<{ w: number; h: number; d: string; perim: number } | null>(null);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w === 0 || h === 0) return;
      const sw = 3, x = sw/2, y = sw/2, iw = w-sw, ih = h-sw, cr = 10.5;
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
      setSvgP({ w, h, d, perim });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  
  const [imgSrc, setImgSrc] = useState(thumbnail || '');
  const [imgError, setImgError] = useState(!thumbnail);

  useEffect(() => {
    setImgSrc(thumbnail || '');
    setImgError(!thumbnail);
  }, [thumbnail]);
  
  const handleNavigate = async (e: React.MouseEvent) => {
    if (onClick) {
      onClick();
      return;
    }
    e.preventDefault();
    setIsLoading(true);
    const { navigate } = await import('astro:transitions/client');
    
    navigate(href || getAnimeUrl(id, name));
    setIsLoading(false);
  };

  const targetHref = href || getAnimeUrl(id, name);
  const Component = onClick ? "div" : "a";

  const handleKeyDown = onClick ? (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  } : undefined;

  return (
    <Component
      ref={cardRef as any}
      href={onClick ? undefined : targetHref}
      onClick={onClick ? onClick : handleNavigate}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={handleKeyDown}
      className="relative block w-full aspect-[2/3] rounded-xl bg-[var(--md-sys-color-background)] transition-transform duration-200 cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] no-underline active:scale-[0.98] transform-gpu"
    >
      {/* Image — clipped to rounded corners */}
      <div className="absolute inset-0 w-full h-full overflow-hidden rounded-xl bg-white/5">
        {imgError ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#141A2E] to-[#0B0E1A]">
            <span className="material-symbols-outlined text-[32px] text-white/20">movie</span>
          </div>
        ) : (
          <img
            src={imgSrc}
            alt={name}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          />
        )}
        {/* MD3 standard interaction state layer (8% on-surface on hover, 12% on active) */}
        <div className="absolute inset-0 bg-[var(--md-sys-color-on-surface)] opacity-0 group-hover:opacity-[0.08] group-active:opacity-[0.12] transition-opacity pointer-events-none z-10" />
        
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
            <md-circular-progress indeterminate></md-circular-progress>
          </div>
        )}
      </div>
      
      <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10 flex-wrap max-w-[80%]">
        {formatLabel && (
          <div className="bg-white px-1.5 py-0.5 rounded flex items-center shadow-sm">
            <span className="text-black text-xs font-bold uppercase leading-none">{formatLabel}</span>
          </div>
        )}
        {showPopularity && popularity !== undefined && popularity !== null && (
          <div className="bg-[var(--md-sys-color-surface-container)] px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--md-sys-color-primary)" stroke="var(--md-sys-color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
            </svg>
            <span className="text-white text-xs font-bold leading-none">#{popularity}</span>
          </div>
        )}
      </div>

      {showRating && score !== undefined && score !== null && (
        <div className="absolute top-2 right-2 bg-[var(--md-sys-color-surface-container)] px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm z-10">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--md-sys-color-star)" stroke="var(--md-sys-color-star)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
          <span className="text-white text-xs font-bold leading-none">{score}</span>
        </div>
      )}

      {/* Gradient overlay — full rectangle, not clipped */}
      <div className="absolute -inset-1 bg-gradient-to-t from-[var(--md-sys-color-background)] from-20% via-[var(--md-sys-color-background)]/80 via-60% to-transparent z-10 pointer-events-none" />
      
      {/* Title at bottom */}
      <div className="absolute inset-0 flex flex-col justify-end pb-3 px-3 z-10 pointer-events-none">
        {timeLabel && (
          <div className="text-[var(--md-sys-color-on-surface-variant)] text-[11px] font-medium leading-none mb-1 drop-shadow-md">
            {timeLabel}
          </div>
        )}
        <h3 className="text-white text-[14px] font-medium leading-snug line-clamp-2 drop-shadow-md">
          {name}
        </h3>
        {(showEpisode && (episodeText || episodeCount || statusLabel)) && (
          <p className="text-[var(--md-sys-color-on-surface-variant)] text-[12px] font-medium mt-0.5 drop-shadow-md flex items-center gap-1 leading-none">
            {(episodeText || episodeCount) && (
              <span>{episodeText || (episodeCount ? `${episodeCount} Episode` : '')}</span>
            )}
            {(episodeText || episodeCount) && statusLabel && <span className="text-white/20">•</span>}
            {statusLabel && (
              <span className={`text-[12px] font-semibold uppercase leading-none ${
                statusLabel === 'Ongoing' ? 'text-green-400' : 'text-[var(--md-sys-color-primary)]'
              }`}>
                {statusLabel}
              </span>
            )}
          </p>
        )}
      </div>
      
      {progressPercent !== undefined && progressPercent !== null && svgP && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          <svg className="w-full h-full" viewBox={`0 0 ${svgP.w} ${svgP.h}`}>
            <path d={svgP.d} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
            <path d={svgP.d} fill="none" stroke="var(--md-sys-color-primary)" strokeWidth={3}
              strokeDasharray={svgP.perim}
              strokeDashoffset={svgP.perim * (1 - Math.min(progressPercent, 100) / 100)}
            />
          </svg>
        </div>
      )}
    </Component>
  );
}
