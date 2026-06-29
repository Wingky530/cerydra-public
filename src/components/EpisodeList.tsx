import { useState, useEffect } from 'react';
import { getWatchUrl } from '../lib/routing';

const ChevronDownIcon = (props: any) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

interface EpisodeListProps {
  animeId: string;
  animeName?: string;
  episodes: string[];
  currentEpisode?: string;
  episodeProgress?: Record<string, number>;
}

export default function EpisodeList({ animeId, animeName, episodes, currentEpisode, episodeProgress }: EpisodeListProps) {
  // Sort episodes ascendingly (1, 2, 3...)
  const sortedEpisodes = [...episodes].sort((a, b) => parseInt(a) - parseInt(b));
  
  const [epRange, setEpRange] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [epSearch, setEpSearch] = useState('');
  const [highlightedEp, setHighlightedEp] = useState<string | null>(null);

  const totalRanges = Math.ceil(sortedEpisodes.length / 100);

  useEffect(() => {
    if (currentEpisode) {
      const idx = sortedEpisodes.findIndex(e => e === currentEpisode);
      if (idx >= 0) setEpRange(Math.floor(idx / 100));
    }
  }, [currentEpisode, sortedEpisodes.length]);

  const rangeEps = sortedEpisodes.slice(epRange * 100, (epRange + 1) * 100);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {totalRanges > 1 && (
          <div className="relative">
            <button
              onClick={() => setShowDropdown(v => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-background)] text-xs font-bold transition-colors hover:bg-[var(--md-sys-color-surface-container-high)] whitespace-nowrap"
            >
              {epRange * 100 + 1}&ndash;{Math.min((epRange + 1) * 100, sortedEpisodes.length)}
              <ChevronDownIcon />
            </button>
            {showDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
                <div className="absolute left-0 top-full mt-1 z-50 bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-surface-container-highest)] rounded-xl overflow-hidden min-w-[120px] shadow-xl max-h-[300px] overflow-y-auto custom-scrollbar">
                  {Array.from({ length: totalRanges }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => { setEpRange(i); setShowDropdown(false); }}
                      className={`w-full px-4 py-2.5 text-left text-xs font-bold transition-colors ${
                        epRange === i
                          ? 'text-[var(--md-sys-color-primary)]'
                          : 'text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-background)] hover:bg-[var(--md-sys-color-surface-container-highest)]'
                      }`}
                    >
                      {i * 100 + 1}&ndash;{Math.min((i + 1) * 100, sortedEpisodes.length)}
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
            max={sortedEpisodes.length}
            placeholder="Find episode..."
            value={epSearch}
            onChange={e => setEpSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const num = e.currentTarget.value.trim();
                const found = sortedEpisodes.find(ep => ep === num);
                if (found) {
                  const rangeIdx = Math.floor(sortedEpisodes.indexOf(found) / 100);
                  setEpRange(rangeIdx);
                  setHighlightedEp(found);
                  setTimeout(() => setHighlightedEp(null), 2000);
                  setTimeout(() => {
                    document.getElementById(`anime-ep-${found}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 50);
                }
              }
            }}
            className="w-full px-3 py-2 rounded-lg bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-background)] text-xs font-bold placeholder:text-[var(--md-sys-color-on-surface-variant)] outline-none focus:ring-1 focus:ring-[var(--md-sys-color-primary)] transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(48px,1fr))] gap-1.5 w-full mx-auto [&>a]:aspect-square">
        {rangeEps.map((ep) => {
          const isCurrent = ep === currentEpisode;
          const progress = episodeProgress?.[ep];
          return (
            <a
              key={ep}
              id={`anime-ep-${ep}`}
              href={getWatchUrl(animeId, ep, animeName)}
              title={`Episode ${ep}`}
              className={`
                relative flex items-center justify-center rounded-lg text-xs font-bold transition-colors border-none overflow-hidden
                ${isCurrent 
                  ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-none' 
                  : 'bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)] hover:text-[var(--md-sys-color-on-background)]'
                }
                ${highlightedEp === ep ? 'ring-2 ring-[var(--md-sys-color-primary)] ring-offset-1 ring-offset-[var(--md-sys-color-background)]' : ''}
              `}
            >
              <span className={isCurrent ? 'text-sm' : 'text-xs'}>
                {ep}
              </span>
              {progress !== undefined && progress > 0 && progress < 100 && (
                <div 
                  className="absolute inset-0 rounded-[inherit] pointer-events-none p-[2px]"
                  style={{
                    background: `conic-gradient(var(--md-sys-color-primary) ${progress}%, transparent 0)`,
                    WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                  }}
                />
              )}
              {progress !== undefined && progress >= 100 && (
                <div className="absolute inset-0 rounded-[inherit] pointer-events-none border-2 border-green-500/70" />
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}
