import AppShell from '../components/AppShell';
import { playerStore } from '../store/player';

interface WatchPageProps {
  animeId: string;
  episode: string;
  initialTime?: number;
  anilistId?: number;
}

export default function WatchPage({ animeId, episode, initialTime, anilistId }: WatchPageProps) {
  // Sync: ensure GlobalPlayer reads correct initialTime on first render (not in useEffect)
  playerStore.setKey('initialTime', initialTime || 0);
  playerStore.setKey('animeId', animeId);
  if (anilistId) playerStore.setKey('anilistId', anilistId);
  playerStore.setKey('episode', episode);
  playerStore.setKey('isOpen', true);
  playerStore.setKey('isMinimized', false);

  return (
    <AppShell>
      <div className="min-h-screen bg-[var(--md-sys-color-background)] pt-[20vh] flex flex-col items-center gap-6 selection:bg-[var(--md-sys-color-primary)]/30">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-[var(--md-sys-color-surface-container)] border-t-[var(--md-sys-color-primary)] animate-spin" />
        </div>
        <div className="text-center">
          <h2 className="text-[var(--md-sys-color-on-background)] font-black text-xl mb-1">Starting Player</h2>
          <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm font-semibold tracking-wide">Please wait...</p>
        </div>
      </div>
    </AppShell>
  );
}
