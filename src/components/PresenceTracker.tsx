import { useEffect, useRef } from 'react';

function sendRPC(data: { details: string; state?: string; image?: string; url?: string } | null) {
  const bridge = (window as any).CerydraRPC;
  if (!bridge?.isConnected()) return;
  if (!data) { bridge.clear(); return; }
  bridge.updatePresence(JSON.stringify(data));
}

export default function PresenceTracker() {
  const lastSent = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const send = async (data: Record<string, unknown>, rpcData: { details: string; state?: string; image?: string; url?: string } | null) => {
      const now = Date.now();
      if (now - lastSent.current < 2000) return;
      lastSent.current = now;
      try {
        await fetch('/api/presence/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } catch {}
      sendRPC(rpcData);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        send({ activity_type: 'idle' }, null);
      }, 5 * 60 * 1000);
    };

    const track = () => {
      const path = window.location.pathname;
      const search = window.location.search;
      const currentUrl = path + search;
      
      try {
        const hist = JSON.parse(sessionStorage.getItem('cerydra_history') || '[]');
        if (hist[hist.length - 1] !== currentUrl) {
          hist.push(currentUrl);
          if (hist.length > 20) hist.shift();
          sessionStorage.setItem('cerydra_history', JSON.stringify(hist));
        }
      } catch (e) {}

      if (path.startsWith('/watch/') || path.includes('/episode/')) return;
      let data: Record<string, unknown>;
      let rpcData: { details: string; state?: string; image?: string; url?: string } | null;
      if (path === '/' || path.startsWith('/browse')) {
        data = { activity_type: 'browsing' };
        rpcData = { details: 'Browsing', state: path === '/' ? 'Home' : 'Browse' };
      } else if (path.startsWith('/search')) {
        const q = new URLSearchParams(search).get('q') || '';
        data = { activity_type: 'searching', search_query: q };
        rpcData = q ? { details: 'Searching', state: q } : { details: 'Searching' };
      } else if (/^\/anime\/[^/]+$/.test(path)) {
        const title = document.title.replace(/ - Cerydra$/, '');
        data = { activity_type: 'viewing', anime_title: title };
        rpcData = { details: 'Viewing', state: title };
      } else if (path.startsWith('/u/')) {
        data = { activity_type: 'browsing' };
        rpcData = { details: 'Browsing', state: 'Profile' };
      } else {
        data = { activity_type: 'browsing' };
        rpcData = { details: 'Browsing' };
      }
      send(data, rpcData);
    };

    track();
    document.addEventListener('astro:page-load', track);
    return () => {
      document.removeEventListener('astro:page-load', track);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  return null;
}
