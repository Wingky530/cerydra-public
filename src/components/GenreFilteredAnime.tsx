import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ALL_GENRES, getBentoPicks } from '../lib/bentoLogic';

export default function GenreFilteredAnime() {

  // Daily seeded bento data
  const { data: bentoData, isPending: isBentoPending } = useQuery<any[]>({
    queryKey: ['bento-genres-daily', 'v2'],
    queryFn: async () => {
      const QUERY = `
        query($page: Int) {
          Page(page: $page, perPage: 50) {
            media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
              id
              idMal
              title { english romaji }
              coverImage { extraLarge }
              description
              averageScore
              episodes
              status
              genres
              tags { name }
            }
          }
        }
      `;
      const pages = await Promise.all(
        [1, 2, 3].map(page =>
          fetch('/api/anime/ani-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: QUERY, variables: { page } }),
          }).then(r => r.json())
        )
      );
      const seen = new Set<number>();
      return pages.flatMap(p => (p?.data?.Page?.media || [])).filter((m: any) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const showSkeleton = isBentoPending || !mounted;

  const bentoItems = useMemo(() => {
    if (showSkeleton || !bentoData) return ALL_GENRES.map(g => ({ ...g, animeTitle: '' }));

    let userId = typeof window !== 'undefined' ? localStorage.getItem('cerydra_user_id') : null;
    if (!userId && typeof window !== 'undefined') {
      userId = Math.floor(Math.random() * 1000000).toString();
      localStorage.setItem('cerydra_user_id', userId);
    }

    const picks = getBentoPicks(bentoData, userId || '0');
    
    return ALL_GENRES.map(genreObj => {
      const picked = picks.get(genreObj.name);
      if (picked) {
        return {
          ...genreObj,
          animeTitle: picked.title?.english || picked.title?.romaji || 'Unknown',
          image: picked.coverImage?.extraLarge || ''
        };
      }
      return { ...genreObj, animeTitle: '' };
    });
  }, [bentoData, showSkeleton]);

  return (
    <div className="mb-8">
      <h2 className="text-[22px] font-black mb-4 px-2 text-[var(--md-sys-color-on-surface)] tracking-wide uppercase">
        EXPLORE GENRES
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 grid-flow-row-dense gap-3 md:gap-4 px-2 md:px-4">
        {bentoItems.map((item) => {
          return (
            <a
              key={item.name}
              href={`/genre/${item.name.toLowerCase().replace(/\s+/g, '-')}`}
              className={`relative group rounded-2xl md:rounded-[var(--md-sys-shape-corner-large)] p-4 md:p-5 flex flex-col justify-end min-h-[110px] md:min-h-[140px] shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-[var(--md-sys-color-background)] ring-1 ring-white/[0.06] ${item.bento}`}
            >
              {showSkeleton ? (
                <div className="absolute inset-0 bg-[var(--md-sys-color-surface-variant)] animate-pulse rounded-2xl" />
              ) : (
                <div className="absolute inset-0 overflow-hidden rounded-2xl">
                  <img 
                    src={item.image} 
                    alt={item.name} 
                    loading="lazy" 
                    className="w-full h-full object-cover opacity-50 group-hover:scale-110 transition-transform duration-500" 
                  />
                </div>
              )}
              <div className="absolute -inset-1 bg-gradient-to-t from-[var(--md-sys-color-background)] from-20% via-[var(--md-sys-color-background)]/80 via-60% to-transparent opacity-90 group-hover:opacity-100 transition-opacity duration-300" />
              
              {/* Hover Title Overlay */}
              {item.animeTitle && (
                <div className="absolute inset-0 flex items-center justify-center p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 rounded-2xl overflow-hidden bg-[var(--md-sys-color-surface-container)]/80">
                  <span className="text-white font-bold text-center text-sm md:text-base drop-shadow-lg leading-tight">
                    {item.animeTitle}
                  </span>
                </div>
              )}

              <span className="relative z-20 text-white font-bold text-sm md:text-base leading-tight drop-shadow-md group-hover:-translate-y-1 transition-transform duration-300 origin-bottom-left group-hover:opacity-0">
                {item.name}
              </span>
              <svg className="absolute top-3 right-3 w-4 h-4 md:w-5 md:h-5 text-white/50 group-hover:text-white transition-colors duration-300 z-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
            </a>
          );
        })}
      </div>
    </div>
  );
}
