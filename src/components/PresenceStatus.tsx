import { useState, useEffect, useRef } from 'react';

interface PresenceData {
  status?: string;
  user_id?: string;
  username?: string;
  avatar?: string;
  activity_type?: string;
  anime_title?: string;
  episode_number?: number;
  episode_title?: string;
  duration?: number;
  position?: number;
  updated_at?: number;
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function PresenceStatus({ initialData, username: pageUsername }: { initialData: PresenceData; username: string }) {
  const [data, setData] = useState<PresenceData>(initialData);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/presence/${pageUsername}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch {}
    }, 15000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pageUsername]);

  const isIdle = !data.activity_type || data.status === 'idle' || data.activity_type === 'idle';
  const avatarUrl = data.avatar
    ? `https://cdn.discordapp.com/avatars/${data.user_id}/${data.avatar}.png`
    : null;
  const progress = data.duration && data.duration > 0 ? ((data.position ?? 0) / data.duration) : 0;

  return (
    <div className="min-h-screen bg-[var(--md-sys-color-background)] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-[var(--md-sys-color-surface-container)] rounded-2xl p-8 flex flex-col items-center gap-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-white/5">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-20 h-20 rounded-full border-2 border-[var(--md-sys-color-primary)]/30" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-[var(--md-sys-color-surface-container-high)] flex items-center justify-center text-[var(--md-sys-color-on-surface-variant)] text-3xl font-black">
            {(data.username || pageUsername)[0]?.toUpperCase()}
          </div>
        )}

        <div className="text-center">
          <h1 className="text-xl font-black text-[var(--md-sys-color-on-background)]">{data.username || pageUsername}</h1>
          {isIdle ? (
            <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm mt-2">{data.username || pageUsername} is not watching anything right now</p>
          ) : data.activity_type === 'browsing' ? (
            <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm mt-2">{data.username} is browsing Cerydra</p>
          ) : data.activity_type === 'searching' ? (
            <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm mt-2">{data.username} is searching for <span className="text-[var(--md-sys-color-on-background)] font-bold">{data.anime_title}</span></p>
          ) : data.activity_type === 'viewing' ? (
            <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm mt-2">{data.username} is looking at <span className="text-[var(--md-sys-color-on-background)] font-bold">{data.anime_title}</span></p>
          ) : data.activity_type === 'watching' || data.activity_type === 'paused' ? (
            <div className="flex flex-col items-center gap-3 mt-2">
              <p className="text-[var(--md-sys-color-secondary)] text-sm font-bold tracking-wide uppercase">
                {data.activity_type === 'watching' ? 'Watching on Cerydra' : 'Paused on Cerydra'}
              </p>
              <p className="text-[var(--md-sys-color-on-background)] font-bold text-base">{data.anime_title}</p>
              <p className="text-[var(--md-sys-color-on-surface-variant)] text-xs">
                Episode {data.episode_number}
                {data.episode_title ? ` · ${data.episode_title}` : ''}
              </p>
              <div className="w-full max-w-xs mt-1">
                <div className="w-full h-1.5 bg-[var(--md-sys-color-background)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--md-sys-color-primary-container)] rounded-full transition-all duration-300" style={{ width: `${Math.min(progress * 100, 100)}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-[var(--md-sys-color-on-surface-variant)] font-medium mt-1">
                  <span>{formatTime(data.position ?? 0)}</span>
                  <span>{formatTime(data.duration ?? 0)}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm mt-2">{data.username || pageUsername} is not watching anything right now</p>
          )}
        </div>

        <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] mt-2">
          {data.updated_at && !isIdle ? (
            <span>Last seen {new Date(data.updated_at).toLocaleTimeString()}</span>
          ) : (
            <span>Offline</span>
          )}
        </div>
      </div>
    </div>
  );
}
