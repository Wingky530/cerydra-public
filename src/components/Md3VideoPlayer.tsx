import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Controls,
  Gesture,
  MediaPlayer,
  MediaProvider,
  Menu,
  PIPButton,
  Spinner,
  useMediaPlayer,
  useMediaRemote,
  useMediaStore,
  useVideoQualityOptions,
  useCaptionOptions,
  Track
} from '@vidstack/react';
import '@vidstack/react/player/styles/base.css';
import { getWatchUrl } from '../lib/routing';
import WaveSeekbar from './WaveSeekbar';

const ToastContext = createContext<(msg: string) => void>(() => {});

interface Md3VideoPlayerProps {
  src: string | { src: string; type: string };
  poster?: string;
  initialTime?: number;
  autoPlay?: boolean;
  animeId?: string;
  animeTitle?: string;
  episode?: string;
  episodeTitle?: string;
  prevEp?: string | null;
  nextEp?: string | null;
  isMini?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onError?: () => void;
  onProgress?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  tracks?: { src: string; label: string; kind: string; lang: string; default?: boolean; }[];
  qualities?: { label: string; idx: number }[];
  activeQuality?: string;
  onQualityChange?: (idx: number) => void;
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

const PlayIcon = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <polygon points="6,3 20,12 6,21" />
  </svg>
);

const PauseIcon = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <rect x="5" y="3" width="4" height="18" rx="1.5" />
    <rect x="15" y="3" width="4" height="18" rx="1.5" />
  </svg>
);

const ReplayIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
  </svg>
);

const ForwardIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
  </svg>
);

const NextEpIcon = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
  </svg>
);

const PrevEpIcon = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
  </svg>
);

const StretchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
  </svg>
);

const FitIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7" />
  </svg>
);

const AutoplayIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 20q-3.35 0-5.675-2.325Q4 15.35 4 12q0-3.35 2.325-5.675Q8.65 4 12 4q1.725 0 3.3.712 1.575.713 2.7 2.038V4h2v7h-7V9h3.2q-.8-1.4-2.187-2.2T12 6Q9.5 6 7.75 7.75T6 12q0 2.5 1.75 4.25T12 18q1.925 0 3.475-1.1T17.65 14h2.1q-.5 2.825-2.75 4.413Q14.75 20 12 20ZM10 16.5l6-4.5-6-4.5Z" />
  </svg>
);

const VolumeOnIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
    <path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
  </svg>
);

const VolumeMuteIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
    <line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const FullscreenEnterIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </svg>
);

const FullscreenExitIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M8 3v3a2 2 0 0 1-2 2H3" />
    <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
    <path d="M3 16h3a2 2 0 0 1 2 2v3" />
    <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
  </svg>
);

const PipIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <rect x="12" y="12" width="6" height="4" rx="1" />
  </svg>
);

const LockIcon = ({ locked }: { locked: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d={locked 
      ? "M6 22q-.825 0-1.412-.587Q4 20.825 4 20V10q0-.825.588-1.413Q5.175 8 6 8h1V6q0-2.075 1.463-3.538Q9.925 1 12 1t3.538 1.462Q17 3.925 17 6v2h1q.825 0 1.413.587Q20 9.175 20 10v10q0 .825-.587 1.413Q18.825 22 18 22H6Zm6-5q.825 0 1.413-.587Q14 15.825 14 15q0-.825-.587-1.413Q12.825 13 12 13q-.825 0-1.412.587Q10 14.175 10 15q0 .825.588 1.413Q11.175 17 12 17ZM9 8h6V6q0-1.25-.875-2.125T12 3q-1.25 0-2.125.875T9 6v2Z"
      : "M6 22q-.825 0-1.412-.587Q4 20.825 4 20V10q0-.825.588-1.413Q5.175 8 6 8h1V6q0-2.075 1.463-3.538Q9.925 1 12 1t3.538 1.462Q17 3.925 17 6h-2q0-1.25-.875-2.125T12 3q-1.25 0-2.125.875T9 6v2h9q.825 0 1.413.587Q20 9.175 20 10v10q0 .825-.587 1.413Q18.825 22 18 22H6Zm6-5q.825 0 1.413-.587Q14 15.825 14 15q0-.825-.587-1.413Q12.825 13 12 13q-.825 0-1.412.587Q10 14.175 10 15q0 .825.588 1.413Q11.175 17 12 17Z"
    } />
  </svg>
);

const CcIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1z" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.73 9.05c-.12.21-.08.47.12.61l2.03 1.58c-.04.3-.06.61-.06.94s.02.64.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .43-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.49-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
  </svg>
);

type SkipDir = 'back' | 'forward';

function Md3CenterControls({ prevEp, nextEp, onPrev, onNext }: { prevEp?: string | null, nextEp?: string | null, onPrev?: () => void, onNext?: () => void }) {
  const { paused, ended } = useMediaStore();
  const remote = useMediaRemote();

  return (
    <>
      <div className="absolute inset-0 z-25 flex items-center justify-center gap-10 sm:gap-20 pointer-events-none transition-opacity duration-300 opacity-0 group-data-[visible]:opacity-100 prevent-hide">
        <div className="flex flex-col items-center justify-center w-20">
          <button
            className={`flex flex-col items-center justify-center text-white cursor-pointer pointer-events-none group-data-[visible]:pointer-events-auto hover:scale-110 active:scale-90 transition-transform duration-150 ${!prevEp ? 'opacity-30 pointer-events-none' : ''}`}
            onClick={(e) => { e.stopPropagation(); onPrev?.(); }}
            title="Previous Episode"
            disabled={!prevEp}
            style={{ filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.8))' }}
          >
            <PrevEpIcon size={42} />
          </button>
          {prevEp && <span className="text-[10px] font-bold text-white/80 mt-1.5 drop-shadow-md">Episode {prevEp}</span>}
        </div>

        <button
          className="flex items-center justify-center text-white cursor-pointer pointer-events-none group-data-[visible]:pointer-events-auto hover:scale-110 active:scale-90 transition-transform duration-150"
          onClick={(e) => {
            e.stopPropagation();
            if (ended) { remote.seek(0); remote.play(); }
            else if (paused) { remote.play(); }
            else { remote.pause(); }
          }}
          title={ended ? 'Replay' : paused ? 'Play' : 'Pause'}
          style={{ filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.9)) drop-shadow(0 0 20px rgba(61,217,224,0.3))' }}
        >
          {ended ? <ReplayIcon size={64} /> : paused ? <PlayIcon size={64} /> : <PauseIcon size={64} />}
        </button>

        <div className="flex flex-col items-center justify-center w-20">
          <button
            className={`flex flex-col items-center justify-center text-white cursor-pointer pointer-events-none group-data-[visible]:pointer-events-auto hover:scale-110 active:scale-90 transition-transform duration-150 ${!nextEp ? 'opacity-30 pointer-events-none' : ''}`}
            onClick={(e) => { e.stopPropagation(); onNext?.(); }}
            title="Next Episode"
            disabled={!nextEp}
            style={{ filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.8))' }}
          >
            <NextEpIcon size={42} />
          </button>
          {nextEp && <span className="text-[10px] font-bold text-white/80 mt-1.5 drop-shadow-md">Episode {nextEp}</span>}
        </div>

      </div>
    </>
  );
}

function Md3FullscreenOverlay({ animeTitle, episode }: { animeTitle?: string; episode?: string }) {
  const { fullscreen } = useMediaStore();
  if (!fullscreen) return null;

  return (
    <div className="absolute inset-x-0 top-0 z-30 pointer-events-none px-4 pt-4 pb-12 bg-gradient-to-b from-black/80 via-black/35 to-transparent transition-opacity duration-300 opacity-0 group-data-[visible]:opacity-100">
      <p className="text-sm md:text-base font-black text-white truncate drop-shadow-lg">{animeTitle || 'Anime'}</p>
      {episode && <p className="text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] mt-0.5 drop-shadow-lg">Episode {episode}</p>}
    </div>
  );
}

function SpeedMenu() {
  const { playbackRate } = useMediaStore();
  const remote = useMediaRemote();
  const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <Menu.Root>
      <Menu.Button className="h-9 px-2.5 rounded-full text-xs font-bold text-white/60 hover:text-white hover:bg-white/10 transition-all active:scale-95">
        {playbackRate}x
      </Menu.Button>
      <Menu.Content placement="top end" className="z-50 min-w-24 rounded-xl border border-white/10 bg-black/90 p-1 text-white backdrop-blur-xl mb-2">
        <Menu.RadioGroup value={String(playbackRate)} onChange={(value) => remote.changePlaybackRate(Number(value))}>
          {speeds.map(speed => (
            <Menu.Radio key={speed} value={String(speed)} className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-white/60 data-[checked]:bg-[var(--md-sys-color-primary)]/15 data-[checked]:text-[var(--md-sys-color-primary)] hover:bg-white/10 hover:text-white">
              {speed}x
            </Menu.Radio>
          ))}
        </Menu.RadioGroup>
      </Menu.Content>
    </Menu.Root>
  );
}

function QualityMenu({ qualities, activeQuality, onQualityChange }: {
  qualities: { label: string; idx: number }[];
  activeQuality?: string;
  onQualityChange?: (idx: number) => void;
}) {
  if (!qualities || qualities.length === 0) return null;
  const label = activeQuality || qualities[qualities.length - 1]?.label || 'Quality';
  return (
    <Menu.Root>
      <Menu.Button className="h-9 px-2.5 rounded-full text-xs font-bold text-white/60 hover:text-white hover:bg-white/10 transition-all active:scale-95">
        {label}
      </Menu.Button>
      <Menu.Content placement="top end" className="z-50 min-w-24 rounded-xl border border-white/10 bg-black/90 p-1 text-white backdrop-blur-xl mb-2">
        <Menu.RadioGroup value={activeQuality || ''} onChange={(val) => {
          const q = qualities.find(q => q.label === val);
          if (q) onQualityChange?.(q.idx);
        }}>
          {qualities.map(q => (
            <Menu.Radio
              key={q.idx}
              value={q.label}
              className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-white/60 data-[checked]:bg-[var(--md-sys-color-primary)]/15 data-[checked]:text-[var(--md-sys-color-primary)] hover:bg-white/10 hover:text-white"
            >
              {q.label}
            </Menu.Radio>
          ))}
        </Menu.RadioGroup>
      </Menu.Content>
    </Menu.Root>
  );
}

function NativeQualityMenu() {
  const options = useVideoQualityOptions({ auto: 'Auto' });
  const remote = useMediaRemote();

  if (options.disabled || options.length <= 1) return null;

  return (
    <Menu.Root>
      <Menu.Button className="h-9 px-2.5 rounded-full text-xs font-bold text-white/60 hover:text-white hover:bg-white/10 transition-all active:scale-95 flex items-center gap-1.5" title="Quality">
        <SettingsIcon />
        <span>{options.selectedQuality?.height ? `${options.selectedQuality.height}p` : 'Auto'}</span>
      </Menu.Button>
      <Menu.Content placement="top end" className="z-50 min-w-24 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-black/90 p-1 text-white backdrop-blur-xl mb-2">
        <Menu.RadioGroup value={options.selectedValue} onChange={(val) => {
          const opt = options.find(o => o.value === val);
          if (opt) opt.select();
        }}>
          {options.map(opt => (
            <Menu.Radio
              key={opt.value}
              value={opt.value}
              className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-white/60 data-[checked]:bg-[var(--md-sys-color-primary)]/15 data-[checked]:text-[var(--md-sys-color-primary)] hover:bg-white/10 hover:text-white flex items-center justify-between"
            >
              <span>{opt.label}</span>
              {opt.quality?.bitrate ? <span className="text-[10px] opacity-50 ml-3">{Math.round(opt.quality.bitrate / 1000)}kbps</span> : null}
            </Menu.Radio>
          ))}
        </Menu.RadioGroup>
      </Menu.Content>
    </Menu.Root>
  );
}

function CaptionsMenu() {
  const options = useCaptionOptions({ off: 'Off' });
  const store = useMediaStore();
  
  if (options.disabled || options.length <= 1) return null;
  
  const currentLabel = store.textTrack?.label || 'Off';

  return (
    <Menu.Root>
      <Menu.Button className={`h-9 px-2.5 rounded-full text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 ${store.textTrack ? 'text-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary)]/10 hover:bg-[var(--md-sys-color-primary)]/20' : 'text-white/60 hover:text-white hover:bg-white/10'}`} title="Subtitles">
        <CcIcon />
      </Menu.Button>
      <Menu.Content placement="top end" className="z-50 min-w-32 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-black/90 p-1 text-white backdrop-blur-xl mb-2">
        <Menu.RadioGroup value={options.selectedValue} onChange={(val) => {
          const opt = options.find(o => o.value === val);
          if (opt) opt.select();
        }}>
          {options.map(opt => (
            <Menu.Radio
              key={opt.value}
              value={opt.value}
              className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-white/60 data-[checked]:bg-[var(--md-sys-color-primary)]/15 data-[checked]:text-[var(--md-sys-color-primary)] hover:bg-white/10 hover:text-white"
            >
              {opt.label}
            </Menu.Radio>
          ))}
        </Menu.RadioGroup>
      </Menu.Content>
    </Menu.Root>
  );
}

function AutonextToggle() {
  const [enabled, setEnabled] = useState(true);
  const showToast = useContext(ToastContext);

  useEffect(() => {
    const saved = localStorage.getItem('cerydra_autonext');
    setEnabled(saved !== 'false');
  }, []);

  const toggle = () => {
    setEnabled(prev => {
      const next = !prev;
      localStorage.setItem('cerydra_autonext', String(next));
      showToast(next ? 'Autoplay On' : 'Autoplay Off');
      return next;
    });
  };

  return (
    <button
      onClick={toggle}
      className={`w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-90 ${enabled ? 'text-[var(--md-sys-color-primary)]' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
      title={enabled ? "Autoplay is on" : "Autoplay is off"}
    >
      <AutoplayIcon />
    </button>
  );
}

function ProgressTracker({ onProgress }: { onProgress?: (ct: number, d: number) => void }) {
  const { currentTime, duration, paused } = useMediaStore();
  const remote = useMediaRemote();
  const lastSaved = useRef(0);

  useEffect(() => {
    const handler = () => {
      paused ? remote.play() : remote.pause();
    };
    const forcePlay = () => remote.play();
    window.addEventListener('cerydra_toggle_play', handler);
    window.addEventListener('cerydra_force_play', forcePlay);
    return () => {
      window.removeEventListener('cerydra_toggle_play', handler);
      window.removeEventListener('cerydra_force_play', forcePlay);
    };
  }, [paused, remote]);

  useEffect(() => {
    import('../store/player').then(({ playerStore }) => {
      playerStore.setKey('isPaused', paused);
    });
    
    if (duration > 0) {
      if (Math.abs(currentTime - lastSaved.current) >= 15 || (paused && currentTime !== lastSaved.current)) {
        lastSaved.current = currentTime;
        onProgress?.(currentTime, duration);
      }
    }
    
    // SessionStorage: save current time on every meaningful update for crash recovery
    try {
      sessionStorage.setItem('cerydra_video_session', JSON.stringify({
        currentTime,
        duration,
        wasPlaying: !paused,
        timestamp: Date.now(),
      }));
    } catch (e) {}
  }, [currentTime, duration, paused, onProgress]);

  const [needsRestore, setNeedsRestore] = useState(false);
  const wasPlayingRef = useRef(false);

  useEffect(() => {
    const handleBeforeSwap = () => {
      wasPlayingRef.current = !paused;
      import('../store/player').then(({ playerStore }) => {
        playerStore.setKey('initialTime', currentTime);
      });
    };
    const handlePageLoad = () => {
      setNeedsRestore(true);
    };
    document.addEventListener('astro:before-swap', handleBeforeSwap);
    document.addEventListener('astro:page-load', handlePageLoad);
    return () => {
      document.removeEventListener('astro:before-swap', handleBeforeSwap);
      document.removeEventListener('astro:page-load', handlePageLoad);
    };
  }, [currentTime, paused]);

  useEffect(() => {
    if (duration > 0 && needsRestore) {
      import('../store/player').then(({ playerStore }) => {
        const time = playerStore.get().initialTime;
        if (time && time > 0) {
          remote.seek(time);
        }
        if (wasPlayingRef.current) {
          remote.play();
        }
      });
      setNeedsRestore(false);
    }
  }, [duration, needsRestore, remote]);

  return null;
}

function sendRPC(data: { details: string; state?: string; image?: string; url?: string; largeImage?: string; startTimestamp?: number; endTimestamp?: number } | null) {
  const bridge = (window as any).CerydraRPC;
  if (!bridge?.isConnected()) return;
  if (!data) { bridge.clear(); return; }
  bridge.updatePresence(JSON.stringify(data));
}

function PlayerPresenceReporter({ animeTitle, animeId, episode, episodeTitle, poster }: { animeTitle?: string; animeId?: string; episode?: string; episodeTitle?: string; poster?: string }) {
  const { paused, currentTime, duration, ended } = useMediaStore();
  const prevPaused = useRef(paused);
  const prevEnded = useRef(false);
  const lastTimeUpdate = useRef(0);

  const rpcState = episode ? `Episode ${episode}` : undefined;
  const watchUrl = animeId && episode ? `${window.location.origin}${getWatchUrl(animeId, episode, animeTitle)}` : undefined;

  useEffect(() => {
    if (ended && !prevEnded.current) {
      fetch('/api/presence/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_type: 'browsing' }),
      }).catch(() => {});
      sendRPC(null);
    }
    prevEnded.current = ended;
  }, [ended]);

  useEffect(() => {
    if (prevPaused.current !== paused) {
      if (!paused) {
        fetch('/api/presence/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activity_type: 'watching',
            anime_title: animeTitle,
            episode_number: episode ? Number(episode) : undefined,
            episode_title: episodeTitle,
            duration: Math.floor(duration),
            position: Math.floor(currentTime),
          }),
        }).catch(() => {});
        const now = Date.now();
        const startTimestamp = Math.floor(now - (currentTime * 1000));
        const endTimestamp = duration > 0 ? Math.floor(now + ((duration - currentTime) * 1000)) : undefined;
        sendRPC({ details: animeTitle ?? 'Watching', state: rpcState, url: watchUrl, largeImage: poster, startTimestamp, endTimestamp });
      } else {
        fetch('/api/presence/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activity_type: 'paused',
            anime_title: animeTitle,
            episode_number: episode ? Number(episode) : undefined,
            episode_title: episodeTitle,
            duration: Math.floor(duration),
            position: Math.floor(currentTime),
          }),
        }).catch(() => {});
        sendRPC({ details: animeTitle ?? 'Paused', state: rpcState, url: watchUrl, largeImage: poster });
      }
    }
    prevPaused.current = paused;
  }, [paused, currentTime, duration, animeTitle, episode, poster]);

  useEffect(() => {
    if (!paused && duration > 0) {
      const now = Date.now();
      if (now - lastTimeUpdate.current >= 15000) {
        lastTimeUpdate.current = now;
        fetch('/api/presence/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activity_type: 'watching',
            anime_title: animeTitle,
            episode_number: episode ? Number(episode) : undefined,
            episode_title: episodeTitle,
            duration: Math.floor(duration),
            position: Math.floor(currentTime),
          }),
        }).catch(() => {});
        const startTimestamp = Math.floor(now - (currentTime * 1000));
        const endTimestamp = duration > 0 ? Math.floor(now + ((duration - currentTime) * 1000)) : undefined;
        sendRPC({ details: animeTitle ?? 'Watching', state: rpcState, url: watchUrl, largeImage: poster, startTimestamp, endTimestamp });
      }
    }
  }, [currentTime, paused, duration, animeTitle, episode, poster]);

  return null;
}

function Md3BottomBar({ isStretch, setStretch, qualities, activeQuality, onQualityChange }: {
  isStretch: boolean;
  setStretch: (v: boolean) => void;
  qualities?: { label: string; idx: number }[];
  activeQuality?: string;
  onQualityChange?: (idx: number) => void;
}) {
  const store = useMediaStore();
  const remote = useMediaRemote();
  const player = useMediaPlayer();
  const showToast = useContext(ToastContext);
  const [showVolume, setShowVolume] = useState(false);
  const { paused, currentTime, duration, volume, muted, buffered, fullscreen, canFullscreen } = store;
  const progress = duration > 0 ? currentTime / duration : 0;
  const bufferedEnd = buffered?.length > 0 ? buffered.end(buffered.length - 1) : 0;
  const bufferedRatio = duration > 0 ? bufferedEnd / duration : 0;

  const setVol = (v: number) => {
    if (!player) return;
    player.volume = v;
    player.muted = v === 0;
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 pointer-events-none transition-opacity duration-300 opacity-0 group-data-[visible]:opacity-100">
      <div className="absolute inset-x-0 bottom-0 h-32 pointer-events-none bg-gradient-to-t from-black/90 via-black/55 to-transparent" />
      <div className="relative pt-1">
        {/* Buttons Row (Above Seekbar) */}
        <div className="flex items-center justify-between px-3 pointer-events-auto prevent-hide">
          <div className="flex items-center gap-0.5 min-w-0">
            <div className="relative flex items-center" onMouseEnter={() => setShowVolume(true)} onMouseLeave={() => setShowVolume(false)}>
              <button onClick={() => muted ? remote.unmute() : remote.mute()} className="w-9 h-9 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all active:scale-90" title="Mute">
                {muted || volume === 0 ? <VolumeMuteIcon /> : <VolumeOnIcon />}
              </button>
              <div className="overflow-hidden transition-all duration-200" style={{ width: showVolume ? 72 : 0, opacity: showVolume ? 1 : 0, marginLeft: showVolume ? 4 : 0 }}>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={muted ? 0 : volume}
                  onChange={(e) => setVol(parseFloat(e.target.value))}
                  className="w-full h-1 appearance-none rounded-full cursor-pointer"
                  style={{ backgroundImage: `linear-gradient(to right, var(--md-sys-color-primary) ${(muted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) ${(muted ? 0 : volume) * 100}%)` }}
                />
              </div>
            </div>
            <span className="text-[12px] font-medium text-white/55 tabular-nums tracking-tight ml-1 whitespace-nowrap">
              {formatTime(currentTime)}<span className="text-white/25 mx-1">/</span>{formatTime(duration)}
            </span>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <AutonextToggle />
            {qualities && qualities.length > 0 ? (
              <QualityMenu qualities={qualities} activeQuality={activeQuality} onQualityChange={onQualityChange} />
            ) : (
              <NativeQualityMenu />
            )}
            <CaptionsMenu />
            <SpeedMenu />
            <PIPButton className="w-9 h-9 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all active:scale-90" title="Picture in picture">
              <PipIcon />
            </PIPButton>
            {canFullscreen && (
              <div className="relative flex items-center">
                <button onClick={() => fullscreen ? remote.exitFullscreen() : remote.enterFullscreen()} className="w-9 h-9 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all active:scale-90" title="Fullscreen">
                  {fullscreen ? <FullscreenExitIcon /> : <FullscreenEnterIcon />}
                </button>
                {fullscreen && (
                  <button 
                    onClick={() => {
                      setStretch(!isStretch);
                      showToast(!isStretch ? 'Stretch Video' : 'Fit Video');
                    }}
                    className="absolute -top-12 left-0 w-9 h-9 flex items-center justify-center rounded-full bg-black/50 text-white/80 hover:text-white hover:bg-white/20 transition-all active:scale-90 pointer-events-auto"
                    title={isStretch ? "Fit Video" : "Stretch Video"}
                  >
                    {isStretch ? <FitIcon /> : <StretchIcon />}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Seekbar (Absolute Bottom) */}
        <div className="w-full relative bottom-0 pointer-events-auto prevent-hide px-3 pb-1.5 -mt-2">
          <WaveSeekbar progress={progress} buffered={bufferedRatio} duration={duration} onSeek={(ratio) => remote.seek(ratio * duration)} />
        </div>
      </div>
    </div>
  );
}

function PlayerHotkeys() {
  const { paused, fullscreen, muted, currentTime, duration } = useMediaStore();
  const remote = useMediaRemote();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      switch (e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          paused ? remote.play() : remote.pause();
          break;
        case 'ArrowLeft':
        case 'KeyJ':
          e.preventDefault();
          remote.seek(Math.max(0, currentTime - 10));
          break;
        case 'ArrowRight':
        case 'KeyL':
          e.preventDefault();
          remote.seek(Math.min(duration, currentTime + 10));
          break;
        case 'KeyF':
          fullscreen ? remote.exitFullscreen() : remote.enterFullscreen();
          break;
        case 'KeyM':
          muted ? remote.unmute() : remote.mute();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paused, fullscreen, muted, currentTime, duration, remote]);

  return null;
}

function FirstPlayHint() {
  const { paused, ended } = useMediaStore();
  const remote = useMediaRemote();
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!paused) setStarted(true);
  }, [paused]);

  if (!paused || ended || started) return null;

  return (
    <button
      className="absolute inset-0 z-24 flex items-center justify-center text-white transition-opacity duration-300"
      onClick={(e) => {
        e.stopPropagation();
        remote.play();
      }}
      title="Play"
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-white/90 transition-transform duration-150 active:scale-95">
        <PlayIcon size={38} />
      </span>
    </button>
  );
}

function PlayerChrome({ animeTitle, episode, locked, setLocked, prevEp, nextEp, onPrev, onNext, isStretch, setStretch, isMini, qualities, activeQuality, onQualityChange }: { animeTitle?: string; episode?: string; locked: boolean; setLocked: React.Dispatch<React.SetStateAction<boolean>>; prevEp?: string | null; nextEp?: string | null; onPrev?: () => void; onNext?: () => void; isStretch: boolean; setStretch: (v: boolean) => void; isMini?: boolean; qualities?: { label: string; idx: number }[]; activeQuality?: string; onQualityChange?: (idx: number) => void; }) {
  const [forceHide, setForceHide] = useState(false);
  const { controlsVisible, fullscreen } = useMediaStore();
  const showToast = useContext(ToastContext);

  useEffect(() => {
    if (!controlsVisible) setForceHide(false);
  }, [controlsVisible]);

  if (isMini) return null;

  const handleBgTap = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Do not hide if the user is interacting with controls
    if (target.closest('button, input, [role="menu"], .prevent-hide')) return;

    if (controlsVisible && !forceHide) {
      setForceHide(true);
      e.stopPropagation();
    } else if (forceHide) {
      setForceHide(false);
      e.stopPropagation();
    }
  };

  return (
    <>
      <PlayerHotkeys />
      <div className="absolute inset-0 z-10 transition-opacity duration-200" onClickCapture={handleBgTap}>
        
        {/* Background layer for immediate hide/show on tap */}
        <div className="absolute inset-0 z-0">
          {!locked && (
            <>
              <Gesture className="absolute inset-y-0 left-0 z-0 w-1/2" event="dblpointerup" action="seek:-10" />
              <Gesture className="absolute inset-y-0 right-0 z-0 w-1/2" event="dblpointerup" action="seek:10" />
            </>
          )}
          <Gesture className="absolute inset-0 z-0" event="pointerup" action="toggle:controls" />
        </div>

        {/* Spinner */}
        <Spinner.Root className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none opacity-0 data-[visible]:opacity-100">
          <Spinner.Track className="w-11 h-11 rounded-full border-2 border-white/10" />
          <Spinner.TrackFill className="w-11 h-11 rounded-full border-2 border-transparent border-t-[var(--md-sys-color-primary)] animate-spin" />
        </Spinner.Root>

        <FirstPlayHint />

        {/* Controls — pointer-events-none at root so hidden controls don't block gestures */}
        <Controls.Root className="group absolute inset-0 z-30 pointer-events-none" hideDelay={3000}>
          <div className={`absolute inset-0 transition-opacity duration-300 ${(forceHide || locked) ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}>
            <Md3CenterControls prevEp={prevEp} nextEp={nextEp} onPrev={onPrev} onNext={onNext} />
            <Md3FullscreenOverlay animeTitle={animeTitle} episode={episode} />
            <Md3BottomBar isStretch={isStretch} setStretch={setStretch} qualities={qualities} activeQuality={activeQuality} onQualityChange={onQualityChange} />
          </div>

          <div className={`absolute right-3 top-3 flex items-center gap-2 transition-opacity duration-300 ${forceHide ? 'opacity-0 pointer-events-none' : 'opacity-0 group-data-[visible]:opacity-100'} ${locked ? 'opacity-100' : ''}`}>
            {(fullscreen || locked) && (
              <button
                onClick={() => {
                  const newLocked = !locked;
                  setLocked(newLocked);
                  showToast(newLocked ? 'Screen Locked' : 'Screen Unlocked');
                }}
                className={`pointer-events-auto w-10 h-10 flex items-center justify-center transition-all active:scale-90 ${locked ? 'text-[var(--md-sys-color-primary)] drop-shadow-[0_2px_8px_rgba(61,217,224,0.4)]' : 'text-white/70 hover:text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]'}`}
                title={locked ? 'Unlock controls' : 'Lock controls'}
              >
                <LockIcon locked={locked} />
              </button>
            )}
          </div>
        </Controls.Root>
      </div>
    </>
  );
}

function PlayerDebugOverlay({ eventsLog }: { eventsLog: {event: string; time: string}[] }) {
  return null;
  
  // const { paused, canPlay, waiting, currentTime, duration, ended, seeking } = useMediaStore();
  // ...
}

export default function Md3VideoPlayer({
  src,
  poster,
  initialTime,
  autoPlay,
  animeId,
  animeTitle,
  episode,
  episodeTitle,
  prevEp,
  nextEp,
  isMini,
  onPrev,
  onNext,
  onError,
  onProgress,
  onEnded,
  tracks,
  qualities,
  activeQuality,
  onQualityChange,
}: Md3VideoPlayerProps) {
  const [locked, setLocked] = useState(false);
  const [isStretch, setStretch] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimeout = useRef<number>(0);

  const [eventsLog, setEventsLog] = useState<{event: string; time: string}[]>([]);
  const eventsLogRef = useRef<{event: string; time: string}[]>([]);
  const addEvent = useCallback((event: string) => {
    const now = new Date();
    const time = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0') + ':' + now.getSeconds().toString().padStart(2,'0') + '.' + String(now.getMilliseconds()).padStart(3,'0');
    eventsLogRef.current = [...eventsLogRef.current.slice(-9), { event, time }];
    setEventsLog(eventsLogRef.current);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimeout.current) window.clearTimeout(toastTimeout.current);
    toastTimeout.current = window.setTimeout(() => setToastMsg(null), 2000);
  }, []);

  const onProviderChange = useCallback((provider: any) => {
    if (provider && provider.type === 'hls') {
      provider.config = {
        ...provider.config,
        fLoader: function (config: any) {
          const loader = new config.loader(config);
          const parentOnSuccess = loader.onSuccess;
          loader.onSuccess = function (response: any, stats: any, context: any, networkDetails: any) {
            if (context.type === 'fragment' || context.type === 'part') {
              let data = response.data;
              if (data instanceof ArrayBuffer) {
                const view = new DataView(data);
                if (view.byteLength > 4 && view.getUint32(0) === 0x89504E47) {
                  response.data = data.slice(252);
                }
              }
            }
            return parentOnSuccess.call(this, response, stats, context, networkDetails);
          };
          return loader;
        }
      };
    }
  }, []);

  useEffect(() => {
    // Force hide native Cast/AirPlay and PiP buttons that browsers inject
    const interval = setInterval(() => {
      const videos = document.querySelectorAll('video');
      videos.forEach(v => {
        if (!v.disableRemotePlayback) v.disableRemotePlayback = true;
        if (!v.disablePictureInPicture) v.disablePictureInPicture = true;
        if (!v.hasAttribute('disableRemotePlayback')) v.setAttribute('disableRemotePlayback', 'true');
        if (!v.hasAttribute('disablePictureInPicture')) v.setAttribute('disablePictureInPicture', 'true');
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      <MediaPlayer
      src={src as any}
      poster={poster}
      currentTime={initialTime}
      autoPlay={autoPlay}
      playsInline
      title={animeTitle ? `${animeTitle} - Ep ${episode}` : 'Watching Anime'}
      artist="Cerydra"
      style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, backgroundColor: 'black' }}
      onProviderChange={onProviderChange}
      onLoadStart={() => addEvent('loadStart')}
      onCanPlay={() => addEvent('canPlay')}
      onWaiting={() => addEvent('waiting')}
      onPlaying={() => addEvent('playing')}
      onPause={() => addEvent('pause')}
      onSeeked={() => addEvent('seeked')}
      onError={(e) => {
        addEvent('ERROR: ' + (e?.message || 'unknown'));
        onError?.();
      }}
      onEnded={() => {
        addEvent('ended');
        onEnded?.();
      }}
      >
        <MediaProvider className={`absolute inset-0 [&_video]:h-full [&_video]:w-full ${isStretch ? '[&_video]:object-cover' : '[&_video]:object-contain'}`}>
          {tracks?.map((track, idx) => (
            <Track
              key={String(idx)}
              src={track.src}
              kind={track.kind as any}
              label={track.label}
              lang={track.lang}
              default={track.default}
            />
          ))}
        </MediaProvider>
        <ProgressTracker onProgress={onProgress} />
        <PlayerPresenceReporter animeId={animeId} animeTitle={animeTitle} episode={episode} episodeTitle={episodeTitle} poster={poster} />
        <PlayerChrome animeTitle={animeTitle} episode={episode} prevEp={prevEp} nextEp={nextEp} onPrev={onPrev} onNext={onNext} locked={locked} setLocked={setLocked} isStretch={isStretch} setStretch={setStretch} isMini={isMini} qualities={qualities} activeQuality={activeQuality} onQualityChange={onQualityChange} />
        
        {/* Toast Overlay */}
        <div className={`absolute top-10 left-1/2 -translate-x-1/2 z-[60] transition-all duration-300 pointer-events-none ${toastMsg ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-95'}`}>
          <div className="bg-[var(--md-sys-color-surface-container-highest)] border border-white/10 text-white text-[13px] font-bold px-5 py-2 rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
            {toastMsg}
          </div>
        </div>

        <PlayerDebugOverlay eventsLog={eventsLog} />
      </MediaPlayer>
    </ToastContext.Provider>
  );
}
