import { useMemo } from 'react';

export function useDailySeededRandom<T extends { id?: number; [key: string]: any }>(
  items: T[],
  excludeIds?: Set<number>
): T | null {
  return useMemo(() => {
    if (!items || items.length === 0) return null;

    const daySeed = Math.floor(Date.now() / 86400000);
    let userId = typeof window !== 'undefined' ? localStorage.getItem('cerydra_user_id') : null;
    if (!userId && typeof window !== 'undefined') {
      userId = Math.floor(Math.random() * 1000000).toString();
      localStorage.setItem('cerydra_user_id', userId);
    }

    const hashString = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash);
    };

    const seed = daySeed + hashString(userId || '0');
    let s = seed;
    const random = () => {
      s = Math.sin(s) * 10000;
      return s - Math.floor(s);
    };

    const filtered = excludeIds
      ? items.filter((item) => item.id !== undefined && !excludeIds.has(item.id))
      : items;

    if (filtered.length === 0) return null;

    const randIndex = Math.floor(random() * filtered.length);
    return filtered[randIndex];
  }, [items, excludeIds]);
}
