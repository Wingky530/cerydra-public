import { getWatchUrl } from '../lib/routing';

const PlayArrowIcon = (props: any) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M8 5v14l11-7z" />
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

  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
      {sortedEpisodes.map((ep) => {
        const isCurrent = ep === currentEpisode;
        const progress = episodeProgress?.[ep];
        return (
          <a
            key={ep}
            href={getWatchUrl(animeId, ep, animeName)}
            className={`
              relative flex items-center justify-center gap-1 py-3 px-2 text-center rounded-[var(--md-sys-shape-corner-small)] font-medium transition-colors border overflow-hidden
              ${isCurrent 
                ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] border-[var(--md-sys-color-primary)] font-bold shadow-none' 
                : 'bg-transparent border-[var(--md-sys-color-outline)]/30 text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-variant)] hover:text-[var(--md-sys-color-on-surface-variant)]'
              }
            `}
          >
            {isCurrent && <PlayArrowIcon />}
            <span className={isCurrent ? 'text-base' : 'text-sm'}>
              {isCurrent ? `Ep ${ep}` : ep}
            </span>
            {progress !== undefined && progress > 0 && progress < 100 && (
              <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10">
                <div className="h-full bg-[var(--md-sys-color-primary-container)] transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
            {progress !== undefined && progress >= 100 && (
              <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500/70" />
            )}
          </a>
        );
      })}
    </div>
  );
}
