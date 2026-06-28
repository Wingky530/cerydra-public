import { map } from 'nanostores';

export interface PlayerState {
  isOpen: boolean;
  isMinimized: boolean;
  animeId: string;
  anilistId?: number;
  animeName?: string;
  thumbnail?: string;
  episode: string;
  initialTime?: number;
  isPaused?: boolean;
}

export const playerStore = map<PlayerState>({
  isOpen: false,
  isMinimized: false,
  animeId: '',
  episode: '',
  initialTime: 0,
});

if (typeof window !== 'undefined') {
  const isWatchPage = window.location.pathname.startsWith('/watch/');
  
  // Only recover from storage on non-watch pages — /watch/[id] gets initialTime from SSR
  if (!isWatchPage) {
    const saved = localStorage.getItem('cerydra_player_state');
    if (saved) {
      try {
        playerStore.set(JSON.parse(saved));
      } catch(e) {}
    }
    
    // SessionStorage recovery: override initialTime if more recent (survives full page reload)
    try {
      const sessionSaved = sessionStorage.getItem('cerydra_video_session');
      if (sessionSaved) {
        const data = JSON.parse(sessionSaved);
        if (data.currentTime > 0 && Date.now() - data.timestamp < 60000) {
          const currentState = playerStore.get();
          const storedInitialTime = currentState.initialTime || 0;
          if (data.currentTime > storedInitialTime) {
            playerStore.setKey('initialTime', data.currentTime);
            playerStore.setKey('isPaused', !data.wasPlaying);
          }
        }
      }
    } catch(e) {}
  }
  
  playerStore.listen((state) => {
    localStorage.setItem('cerydra_player_state', JSON.stringify(state));
  });
}
