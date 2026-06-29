import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import AnimeCard from '../components/AnimeCard';
import AnimeGridSkeleton from '../components/AnimeGridSkeleton';
import GenreHero from '../components/GenreHero';
import AppShell from '../components/AppShell';
import ErrorBoundary from '../components/ErrorBoundary';
import FilterSortModal, { type SortOption } from '../components/FilterSortModal';

const GENRE_MAP: Record<string, string> = {
  // Official Genres
  'action': 'Action', 'adventure': 'Adventure', 'comedy': 'Comedy', 'drama': 'Drama', 'fantasy': 'Fantasy',
  'horror': 'Horror', 'romance': 'Romance', 'sci-fi': 'Sci-Fi', 'slice-of-life': 'Slice of Life', 'sports': 'Sports',
  'mystery': 'Mystery', 'supernatural': 'Supernatural', 'psychological': 'Psychological', 'thriller': 'Thriller',
  'mecha': 'Mecha', 'music': 'Music', 'mahou-shoujo': 'Mahou Shoujo', 'ecchi': 'Ecchi',
  // Popular Tags
  'isekai': 'Isekai', 'school': 'School', 'magic': 'Magic', 'vampire': 'Vampire', 'demons': 'Demons',
  'martial-arts': 'Martial Arts', 'space': 'Space', 'historical': 'Historical', 'super-power': 'Super Power',
  'gore': 'Gore', 'cyberpunk': 'Cyberpunk', 'post-apocalyptic': 'Post-Apocalyptic', 'mythology': 'Mythology',
  'time-manipulation': 'Time Manipulation'
};

const OFFICIAL_ANILIST_GENRES = new Set([
  'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy', 'Horror', 'Mahou Shoujo', 
  'Mecha', 'Music', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'
]);

function GenreContent({ genre }: { genre: string }) {
  const [page, setPage] = useState(1);
  const [allAnime, setAllAnime] = useState<any[]>([]);
  const [visibleGridCount, setVisibleGridCount] = useState(24);
  const [sort, setSort] = useState<SortOption>('POPULARITY_DESC');

  const genreQueryStr = GENRE_MAP[genre.toLowerCase()] || genre.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const isOfficialGenre = OFFICIAL_ANILIST_GENRES.has(genreQueryStr);

  const { data: rawData, isPending, isError } = useQuery<any[]>({
    queryKey: ['genre-page', genreQueryStr, page, sort],
    queryFn: async ({ signal }) => {
      const query = `
        query ($page: Int, $genre: String, $tag: String, $sort: [MediaSort]) {
          Page(page: $page, perPage: 50) {
            media(type: ANIME, genre: $genre, tag: $tag, sort: $sort, isAdult: false, countryOfOrigin: "JP") {
              id
              idMal
              title { english romaji native }
              coverImage { extraLarge }
              averageScore
              episodes
              status
              description
              genres
            }
          }
        }
      `;
      
      const variables = isOfficialGenre 
        ? { page, genre: genreQueryStr, sort: [sort, 'ID_DESC'] }
        : { page, tag: genreQueryStr, sort: [sort, 'ID_DESC'] };

      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
        signal,
      });
      if (!res.ok) throw new Error('Failed to fetch from AniList');
      const json = await res.json();
      const validMedia = json?.data?.Page?.media || [];
      return Array.from(new Map(validMedia.map((m: any) => [m.idMal || m.id, m])).values());
    },
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (rawData && rawData.length > 0) {
      const newIds = new Set(rawData.map(d => d.idMal || d.id));
      const currentIds = new Set(allAnime.map(d => d.mal_id));
      const isNewData = Array.from(newIds).some(id => !currentIds.has(id));
      
      if (isNewData) {
        setAllAnime(prev => {
          const combined = [...prev, ...rawData.map((m: any) => ({
            anilist_id: m.id,
            mal_id: m.idMal || m.id,
            title: m.title?.english || m.title?.romaji,
            romajiTitle: m.title?.romaji,
            nativeTitle: m.title?.native,
            images: { webp: { large_image_url: m.coverImage?.extraLarge } },
            score: m.averageScore ? (m.averageScore / 10).toFixed(2) : null,
            episodes: m.episodes
          }))];
          return Array.from(new Map(combined.map(item => [item.mal_id, item])).values());
        });
      }
    }
  }, [rawData]);

  const displayList = allAnime.length > 0 ? allAnime : (rawData?.map((m: any) => ({
    anilist_id: m.id,
    mal_id: m.idMal || m.id,
    title: m.title?.english || m.title?.romaji,
    images: { webp: { large_image_url: m.coverImage?.extraLarge } },
    score: m.averageScore ? (m.averageScore / 10).toFixed(2) : null,
    episodes: m.episodes
  })) || []);
  const visibleList = displayList.slice(0, visibleGridCount);

  const handleLoadMore = () => {
    const newVisibleCount = visibleGridCount + 24;
    setVisibleGridCount(newVisibleCount);
    if (allAnime.length < newVisibleCount + 24) {
      setPage(p => p + 1);
    }
  };

  const handleApplyFilter = (_season: string, _year: number, newSort: SortOption) => {
    if (newSort !== sort) {
      setSort(newSort);
      setPage(1);
      setAllAnime([]);
      setVisibleGridCount(24);
    }
  };

  return (
    <>
      {/* Hero Section */}
      <GenreHero genre={genre} allAnimeData={rawData || []} isPending={isPending} />

      <div className="max-w-7xl mx-auto px-2 md:px-4 pb-8">
        {/* Section Title */}
        <div className="flex items-center justify-between mb-6 mt-8 md:mt-12 px-2 md:px-4">
          <h2 className="text-[22px] md:text-2xl font-black text-[var(--md-sys-color-on-surface)] uppercase tracking-tight flex items-center gap-3">
            <div className="w-1.5 h-6 md:h-7 bg-[var(--md-sys-color-primary)] rounded-full"></div>
            EXPLORE {genreQueryStr}
          </h2>
          <div className="flex items-center gap-3">
            <div className="text-[var(--md-sys-color-on-surface-variant)] text-sm font-medium opacity-60 hidden md:block">
              {sort.replace('_DESC', '').replace('TITLE_ENGLISH', 'NAME')}
            </div>
            <FilterSortModal
              currentSort={sort}
              onApply={handleApplyFilter}
            />
          </div>
        </div>

        {isError && visibleList.length === 0 ? (
          <div className="text-center py-20 text-[var(--md-sys-color-error)] font-medium text-lg bg-[var(--md-sys-color-error-container)]/10 rounded-3xl mx-4">
            Failed to load genre catalog. Please try again.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 px-2 md:px-4">
              {visibleList.map((anime: any) => (
                <AnimeCard
                  key={anime.anilist_id}
                  id={anime.anilist_id.toString()}
                  name={anime.title}
                  thumbnail={anime.images?.webp?.large_image_url}
                  score={anime.score}
                  episodeCount={anime.episodes}
                  romajiTitle={anime.romajiTitle}
                  nativeTitle={anime.nativeTitle}
                />
              ))}
              {isPending && (
                <div className="col-span-full">
                  <AnimeGridSkeleton count={12} />
                </div>
              )}
            </div>

            {allAnime.length > 0 && (
              <div className="flex justify-center mt-12 mb-8">
                <button 
                  onClick={handleLoadMore} 
                  className="group flex items-center gap-3 bg-[var(--md-sys-color-surface-container-high)] hover:bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-primary)] px-8 py-3.5 rounded-full transition-all duration-300 font-bold text-sm tracking-widest shadow-sm hover:shadow-md ring-1 ring-white/5"
                >
                  LOAD MORE
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300 group-hover:translate-y-1"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
              </div>
            )}
            
            {/* Footer Area */}
            <div className="mt-16 mb-24 flex flex-col items-center justify-center text-center opacity-60">
              <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm mb-3">
                End of the line for {genreQueryStr} anime! 🍿
              </p>
              <button 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="flex items-center gap-2 text-[var(--md-sys-color-secondary)] text-sm font-bold bg-[var(--md-sys-color-secondary)]/10 px-4 py-2 rounded-full hover:bg-[var(--md-sys-color-secondary)]/20 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7"/>
                </svg>
                Back to Top
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default function GenrePage({ genre }: { genre: string }) {
  return (
    <AppShell>
      <ErrorBoundary>
        <GenreContent genre={genre} />
      </ErrorBoundary>
    </AppShell>
  );
}
