import React, { useState } from 'react';
import AppShell from '../components/AppShell';
import { useWatchHistory } from '../hooks/useWatchHistory';
import { useLibrary } from '../hooks/useLibrary';

interface Session {
  user_id: string;
  username: string;
  avatar_hash: string | null;
}

function ProfileContent({ version }: { version: string }) {
  const { history, clearHistory } = useWatchHistory();
  const { entries, removeFromLibrary } = useLibrary();
  
  const [autoNext, setAutoNext] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Compute stats
  const totalEpisodes = history.length;
  const totalAnime = new Set(history.map(h => h.animeId)).size;
  const totalHours = Math.round(history.reduce((acc, h) => acc + (h.currentTime || 0), 0) / 3600);

  React.useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('cerydra_autonext');
    if (stored !== 'false') {
      setAutoNext(true);
    }
  }, []);

  React.useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        setSession(data);
        setSessionLoading(false);
      })
      .catch(() => {
        setSessionLoading(false);
      });
  }, []);

  const handleClearHistory = () => {
    if (confirm('Are you sure you want to clear your watch history?')) {
      clearHistory();
    }
  };

  const handleClearLibrary = () => {
    if (confirm('Are you sure you want to clear your library?')) {
      removeFromLibrary(entries.map(e => e.animeId));
    }
  };

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out?')) {
      await fetch('/api/auth/logout', { method: 'POST' });
      const { navigate } = await import('astro:transitions/client');
      navigate('/');
    }
  };

  const toggleAutoNext = () => {
    const newVal = !autoNext;
    setAutoNext(newVal);
    localStorage.setItem('cerydra_autonext', newVal ? 'true' : 'false');
  };

  return (
    <div className="pb-32 bg-[var(--md-sys-color-background)] min-h-screen">
      {/* Header Profile Section */}
      <div className="px-4 md:px-8 py-10 flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
        {sessionLoading ? (
          <div className="w-24 h-24 rounded-full bg-[var(--md-sys-color-surface-container-high)] animate-pulse mb-4" />
        ) : session ? (
          <>
            {session.avatar_hash ? (
              <img
                src={`https://cdn.discordapp.com/avatars/${session.user_id}/${session.avatar_hash}.png?size=128`}
                alt={session.username}
                className="w-24 h-24 rounded-full mb-4 ring-2 ring-[var(--md-sys-color-primary)]/20"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] flex items-center justify-center mb-4 ring-2 ring-[var(--md-sys-color-primary)]/20">
                <span className="material-symbols-outlined text-[48px]">person</span>
              </div>
            )}
            <h1 className="text-3xl font-black text-[var(--md-sys-color-primary)] tracking-wide">
              {session.username}
            </h1>
            <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm mt-1">
              Discord account
            </p>
            <a href={`/u/${session.username}`} className="text-xs text-[var(--md-sys-color-primary)]/80 mt-2 hover:text-[var(--md-sys-color-primary)] hover:underline transition-colors">
              View public profile &rarr;
            </a>
          </>
        ) : (
          <>
            <div className="w-24 h-24 rounded-full bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[48px]">person</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-wide">
              Guest
            </h1>
            <a href="/api/auth/discord" className="mt-4 flex items-center gap-2 px-6 py-3 rounded-full bg-[#5865F2]/20 text-[#5865F2] hover:bg-[#5865F2]/30 transition-colors font-bold text-sm">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M20.317 4.3671a19.8062 19.8062 0 00-4.8850-1.5152.0742.0742 0 00-.0787.0371c-.211.3667-.4429.8465-.6068 1.2250-.5913-.0885-1.1787-.0885-1.7608 0-.1640-.3785-.3933-.8583-.6110-1.2250a.077.077 0 00-.0787-.037 19.7892 19.7892 0 00-4.8853 1.5151.0699.0699 0 00-.0321.0277C1.7150 8.9488 1.1099 12.4383 1.7475 15.8221a.082.082 0 00.0313.0556 19.9484 19.9484 0 005.9325 2.9786.08.08 0 00.0868-.0288c.4411-.6604.8326-1.3567 1.1544-2.0747a.07.07 0 00-.0387-.0991 13.1955 13.1955 0 01-1.9185-.9155.072.072 0 01-.0084-.1191c.1291-.0971.2584-.1982.3826-.3011a.071.071 0 01.0736-.0037c4.0271 1.8621 8.3862 1.8621 12.3823 0a.071.071 0 01.0741.0037c.1242.1029.2535 2.3.3826.3011a.072.072 0 01-.0079.1191 13.1734 13.1734 0 01-1.9188.9155.07.07 0 00-.0382.0991c.3217.7179.7132 1.4143 1.1544 2.0747a.07.07 0 00.0863.0288 19.963 19.963 0 005.9328-2.9784.072.072 0 00.0314-.0556c.6513-3.4384.0639-6.9265-2.7702-9.7519a.06.06 0 00-.0319-.0277zM8.02 12.6979c-1.1164 0-2.0348-.9975-2.0348-2.2139 0-1.2164.9183-2.2139 2.0348-2.2139 1.1164 0 2.0348.9975 2.0348 2.2139 0 1.2164-.9184 2.2139-2.0348 2.2139zm7.9974 0c-1.1164 0-2.0348-.9975-2.0348-2.2139 0-1.2164.9183-2.2139 2.0348-2.2139 1.1164 0 2.0348.9975 2.0348 2.2139 0 1.2164-.918 2.2139-2.0348 2.2139z" />
              </svg>
              Login with Discord
            </a>
          </>
        )}

        {/* Stats Row */}
        <div className="mt-6 text-[13px] font-medium text-[var(--md-sys-color-on-surface-variant)] flex items-center justify-center gap-2">
          <span><span className="text-white font-bold">{totalEpisodes}</span> Episodes</span>
          <span>&middot;</span>
          <span><span className="text-white font-bold">{totalAnime}</span> Anime</span>
          <span>&middot;</span>
          <span><span className="text-white font-bold">{totalHours}</span> Hours</span>
        </div>
      </div>

      <div className="px-4 md:px-8 max-w-2xl mx-auto flex flex-col gap-6">
        
        {/* Section: Preferences */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-75">
          <h2 className="text-xs font-bold text-[var(--md-sys-color-secondary)] uppercase tracking-wider mb-2 px-2">Preferences</h2>
          <div className="bg-[var(--md-sys-color-surface-container-low)] rounded-xl overflow-hidden">
            <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-[var(--md-sys-color-surface-container)] transition-colors">
              <div>
                <p className="text-sm font-bold text-white">Autoplay Next Episode</p>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-0.5">Automatically play the next episode</p>
              </div>
              <div className="shrink-0 ml-4">
                <input type="checkbox" className="sr-only" checked={autoNext} onChange={toggleAutoNext} />
                <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ease-in-out ${!mounted ? 'bg-white/5 opacity-50' : autoNext ? 'bg-[var(--md-sys-color-primary)]' : 'bg-[var(--md-sys-color-surface-container-highest)] border border-white/10'}`}>
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow ring-0 transition duration-300 ease-in-out ${!mounted ? 'translate-x-1 bg-[var(--md-sys-color-background)]' : autoNext ? 'translate-x-6 bg-[var(--md-sys-color-on-primary)]' : 'translate-x-1 bg-white/70'}`} />
                </div>
              </div>
            </label>
            <div className="h-px bg-[var(--md-sys-color-outline-variant)]/30 w-full" />
            <div className="flex items-center justify-between p-4 opacity-50 grayscale cursor-not-allowed">
              <div>
                <p className="text-sm font-bold text-white">Light Mode</p>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-0.5">Coming soon</p>
              </div>
              <div className="shrink-0 ml-4">
                <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-[var(--md-sys-color-surface-container-highest)] border border-white/10">
                  <span className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white/70 translate-x-1" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Data & Storage */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
          <h2 className="text-xs font-bold text-[var(--md-sys-color-secondary)] uppercase tracking-wider mb-2 px-2">Data & Storage</h2>
          <div className="bg-[var(--md-sys-color-surface-container-low)] rounded-xl overflow-hidden">
            <button 
              onClick={handleClearHistory}
              className="w-full flex items-center justify-between p-4 hover:bg-[var(--md-sys-color-surface-container)] transition-colors text-left"
            >
              <div>
                <p className="text-sm font-bold text-white">Clear Watch History</p>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-0.5">Delete all watch progress ({history.length} items)</p>
              </div>
              <span className="material-symbols-outlined text-[var(--md-sys-color-on-surface-variant)] shrink-0 ml-4 text-[20px]">history</span>
            </button>
            <div className="h-px bg-[var(--md-sys-color-outline-variant)]/30 w-full" />
            <button 
              onClick={handleClearLibrary}
              className="w-full flex items-center justify-between p-4 hover:bg-[var(--md-sys-color-surface-container)] transition-colors text-left"
            >
              <div>
                <p className="text-sm font-bold text-white">Clear Library</p>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-0.5">Remove all saved anime ({entries.length} items)</p>
              </div>
              <span className="material-symbols-outlined text-[var(--md-sys-color-on-surface-variant)] shrink-0 ml-4 text-[20px]">bookmark_remove</span>
            </button>
          </div>
        </div>

        {/* Section: Danger Zone */}
        {session && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150 mt-2">
            <button
              onClick={handleLogout}
              className="w-full py-4 rounded-xl bg-[var(--md-sys-color-error)]/10 text-[var(--md-sys-color-error)] font-black tracking-widest text-sm hover:bg-[var(--md-sys-color-error)] hover:text-[var(--md-sys-color-on-error)] transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
              LOGOUT
            </button>
          </div>
        )}

        {/* Footer info (Logo and version) */}
        <div className="flex flex-col items-center justify-center mt-12 mb-8">
          <img src="/img/logo.png" alt="Cerydra Logo" className="w-20 h-20 mb-2 object-contain" />
          <p className="text-xs font-mono text-[var(--md-sys-color-on-surface-variant)] opacity-60">
            v.{version}
          </p>
        </div>

      </div>
    </div>
  );
}

export default function ProfilePage({ version = 'dev' }: { version?: string }) {
  return (
    <AppShell activeTab="profile">
      <ProfileContent version={version} />
    </AppShell>
  );
}
