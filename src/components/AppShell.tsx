import { type ReactNode, useState, useEffect, useRef } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import PresenceTracker from './PresenceTracker';
import { getQueryClient } from '../lib/queryClient';
import ErrorBoundary from './ErrorBoundary';

const queryClient = getQueryClient();

interface AppShellProps {
  children: ReactNode;
  activeTab?: 'home' | 'search' | 'library' | 'history' | 'schedule' | 'settings' | 'profile';
  hideNav?: boolean;
  showFloatingSearch?: boolean;
}

interface Session {
  user_id: string;
  username: string;
  avatar_hash: string | null;
}

// --- Icons ---
function HomeIcon({ filled }: { filled?: boolean }) {
  return <span className={`material-symbols-outlined ${filled ? 'filled' : ''} text-[24px]`}>home</span>;
}

function SearchIcon({ filled }: { filled?: boolean }) {
  return <span className={`material-symbols-outlined ${filled ? 'filled' : ''} text-[24px]`}>search</span>;
}

function LibraryIcon({ filled }: { filled?: boolean }) {
  return <span className={`material-symbols-outlined ${filled ? 'filled' : ''} text-[24px]`}>video_library</span>;
}

function ProfileIcon({ filled, session }: { filled?: boolean; session?: Session | null }) {
  if (session && session.avatar_hash) {
    return (
      <img
        src={`https://cdn.discordapp.com/avatars/${session.user_id}/${session.avatar_hash}.png?size=32`}
        alt="Profile"
        className={`w-6 h-6 rounded-full object-cover transition-colors ${filled ? 'ring-2 ring-[var(--md-sys-color-primary)]' : ''}`}
      />
    );
  }
  return <span className={`material-symbols-outlined ${filled ? 'filled' : ''} text-[24px]`}>person</span>;
}

function HistoryIcon({ filled }: { filled?: boolean }) {
  return <span className={`material-symbols-outlined ${filled ? 'filled' : ''} text-[24px]`}>history</span>;
}

function ScheduleIcon({ filled }: { filled?: boolean }) {
  return <span className={`material-symbols-outlined ${filled ? 'filled' : ''} text-[24px]`}>calendar_month</span>;
}

function NavItem({ href, label, icon, active, topNav = false, rail = false }: { href: string; label: string; icon: ReactNode; active: boolean; topNav?: boolean; rail?: boolean }) {
  if (topNav) {
    return (
      <a href={href} className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all group relative ${
        active ? 'bg-[var(--md-sys-color-primary)]/10 text-[var(--md-sys-color-primary)]' : 'text-[var(--md-sys-color-on-surface-variant)] hover:text-white hover:bg-white/5'
      }`}>
        <div className="w-5 h-5 flex items-center justify-center">
          {icon}
        </div>
        <span className={`text-[13px] font-bold tracking-wide ${active ? 'text-[var(--md-sys-color-primary)]' : ''}`}>
          {label}
        </span>
      </a>
    );
  }

  return (
    <a href={href} className={`flex flex-col items-center justify-center gap-1 group relative ${rail ? 'w-full h-[72px] mb-2' : 'flex-1 h-full'}`}>
      <div className={`relative flex items-center justify-center w-16 h-8 rounded-full transition-colors duration-200 ${
        active 
          ? 'bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]' 
          : 'text-[var(--md-sys-color-on-surface-variant)] group-hover:bg-[var(--md-sys-color-on-surface)]/8'
      }`}>
        {icon}
        {/* State layer for interaction */}
        <div className="absolute inset-0 rounded-full opacity-0 group-active:opacity-12 bg-[var(--md-sys-color-on-surface)] transition-opacity"></div>
      </div>
      <span className={`text-[12px] font-medium tracking-wide transition-colors ${
        active ? 'text-[var(--md-sys-color-on-surface)] font-bold' : 'text-[var(--md-sys-color-on-surface-variant)]'
      }`}>
        {label}
      </span>
    </a>
  );
}


export default function AppShell({ children, activeTab, hideNav, showFloatingSearch }: AppShellProps) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => setSession(data))
      .catch(() => setSession(null));
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col min-h-screen bg-[var(--md-sys-color-background)]">
        {session && session.user_id && <PresenceTracker />}
        
        {/* Desktop Bottom Navigation Bar (Dock) */}
        {!hideNav && (
          <div className="hidden md:flex fixed bottom-8 left-1/2 -translate-x-1/2 z-[10000] items-center gap-4">
            <nav className="h-[56px] bg-[var(--md-sys-color-surface-container-high)] shadow-[0_8px_32px_rgba(0,0,0,0.6)] rounded-full px-3 flex items-center justify-center">
              <div className="flex items-center gap-2">
                <NavItem href="/" label="Home" icon={<HomeIcon filled={activeTab === 'home'} />} active={activeTab === 'home'} topNav />
                <NavItem href="/schedule" label="Schedule" icon={<ScheduleIcon filled={activeTab === 'schedule'} />} active={activeTab === 'schedule'} topNav />
                <NavItem href="/library" label="Library" icon={<LibraryIcon filled={activeTab === 'library'} />} active={activeTab === 'library'} topNav />
                <NavItem href="/history" label="History" icon={<HistoryIcon filled={activeTab === 'history'} />} active={activeTab === 'history'} topNav />
              </div>
            </nav>
            <a 
              href="/profile" 
              className={`w-[56px] h-[56px] flex items-center justify-center rounded-full bg-[var(--md-sys-color-surface-container-high)] shadow-[0_8px_32px_rgba(0,0,0,0.6)] hover:bg-[var(--md-sys-color-surface-container-highest)] hover:scale-105 active:scale-95 transition-all ${activeTab === 'profile' ? 'ring-2 ring-[var(--md-sys-color-primary)]' : ''}`}
              title="Profile"
            >
              {session && session.avatar_hash ? (
                <img
                  src={`https://cdn.discordapp.com/avatars/${session.user_id}/${session.avatar_hash}.png?size=64`}
                  alt="Profile"
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <span className={`material-symbols-outlined ${activeTab === 'profile' ? 'filled text-[var(--md-sys-color-primary)]' : 'text-[var(--md-sys-color-on-surface-variant)]'} text-[24px]`}>person</span>
              )}
            </a>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
          <main className="flex-1">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </div>

        {/* Mobile Bottom Navigation Bar */}
        {!hideNav && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[10000] h-[80px] bg-[var(--md-sys-color-background)] flex justify-around items-center px-2 pb-safe border-t border-[var(--md-sys-color-surface-container)]">
            <NavItem href="/" label="Home" icon={<HomeIcon filled={activeTab === 'home'} />} active={activeTab === 'home'} />
            <NavItem href="/library" label="Library" icon={<LibraryIcon filled={activeTab === 'library'} />} active={activeTab === 'library'} />
            <NavItem href="/history" label="History" icon={<HistoryIcon filled={activeTab === 'history'} />} active={activeTab === 'history'} />
            <NavItem href="/profile" label="Profile" icon={<ProfileIcon filled={activeTab === 'profile'} session={session} />} active={activeTab === 'profile'} />
          </nav>
        )}
      </div>
    </QueryClientProvider>
  );
}
