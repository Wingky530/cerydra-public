import { useState, useCallback, useEffect, useRef } from 'react';
import { getUserId } from '../lib/user-id';

export interface WatchHistoryEntry {
  animeId: string;
  anilistId?: number;
  animeName: string;
  thumbnail: string;
  episode: string;
  timestamp: number;
  progressSeconds?: number;
  currentTime?: number;
  duration?: number;
}

export function useWatchHistory() {
  const [history, setHistory] = useState<WatchHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);
  const userId = useRef<string>('');

  useEffect(() => {
    mountedRef.current = true;
    userId.current = getUserId();
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (!userId.current) {
      userId.current = getUserId();
    }
    try {
      const res = await fetch('/api/history', {
        headers: { 'X-User-Id': userId.current },
      });
      if (res.ok) {
        const data = await res.json();
        if (mountedRef.current) setHistory(data);
      }
    } catch {
      // silent
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const saveProgress = useCallback(async (entry: WatchHistoryEntry) => {
    try {
      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId.current },
        body: JSON.stringify(entry),
        keepalive: true,
      });
      refresh();
    } catch {
      // silent
    }
  }, [refresh]);

  const removeEntry = useCallback(async (animeId: string) => {
    try {
      await fetch('/api/history?_method=delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId.current },
        body: JSON.stringify({ animeId }),
      });
      refresh();
    } catch {
      // silent
    }
  }, [refresh]);

  const removeEntries = useCallback(async (keys: string[]) => {
    try {
      await fetch('/api/history?_method=delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId.current },
        body: JSON.stringify({ ids: keys }),
      });
      refresh();
    } catch {
      // silent
    }
  }, [refresh]);

  const clearHistory = useCallback(async () => {
    try {
      await fetch('/api/history?_method=delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId.current },
        body: JSON.stringify({}),
      });
      if (mountedRef.current) setHistory([]);
    } catch {
      // silent
    }
  }, []);

  return { history, isLoading, saveProgress, removeEntry, removeEntries, clearHistory } as const;
}
