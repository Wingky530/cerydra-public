import { useState, useEffect } from 'react';

export interface LibraryEntry {
  animeId: string;
  anilistId?: number;
  animeName: string;
  thumbnail: string;
  categoryIds: string[];
  dateAdded: number;
  score?: number;
  popularity?: number;
  episodeCount?: number;
  englishName?: string;
  lastUpdated?: number;
}

export interface Category {
  id: string;
  name: string;
  order: number;
}

const STORAGE_KEY_ENTRIES = 'cerydra_library';
const STORAGE_KEY_CATEGORIES = 'cerydra_library_categories';

export function useLibrary() {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const storedEntries = localStorage.getItem(STORAGE_KEY_ENTRIES);
      const storedCategories = localStorage.getItem(STORAGE_KEY_CATEGORIES);
      
      if (storedCategories) setCategories(JSON.parse(storedCategories));
      
      // Fallback migration from old bookmarks
      if (storedEntries) {
        setEntries(JSON.parse(storedEntries));
      } else {
        const oldBookmarks = localStorage.getItem('cerydra_bookmarks');
        if (oldBookmarks) {
          const parsed = JSON.parse(oldBookmarks);
          const migrated: LibraryEntry[] = parsed.map((b: any) => ({
            ...b,
            categoryIds: [],
            dateAdded: Date.now()
          }));
          setEntries(migrated);
          localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(migrated));
        }
      }
    } catch (e) {
      console.error('Failed to load library', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const saveEntries = (newEntries: LibraryEntry[]) => {
    setEntries(newEntries);
    localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(newEntries));
  };

  const saveCategories = (newCategories: Category[]) => {
    setCategories(newCategories);
    localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(newCategories));
  };

  const toggleLibrary = (entry: Omit<LibraryEntry, 'categoryIds' | 'dateAdded'>) => {
    const exists = entries.some(e => e.animeId === entry.animeId);
    if (exists) {
      saveEntries(entries.filter(e => e.animeId !== entry.animeId));
    } else {
      saveEntries([...entries, { ...entry, categoryIds: [], dateAdded: Date.now() }]);
    }
  };

  const syncLibrary = async (onProgress?: (current: number, total: number) => void) => {
    let updatedEntries = [...entries];
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    for (let i = 0; i < updatedEntries.length; i++) {
      const entry = updatedEntries[i];
      try {
        const cleanTitle = entry.animeName.trim();
        let res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(cleanTitle)}&limit=1`);
        
        // Handle rate limit
        if (res.status === 429) {
          await delay(2000);
          res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(cleanTitle)}&limit=1`);
        }

        if (res.ok) {
          const json = await res.json();
          const anime = json.data?.[0];
          if (anime) {
            updatedEntries[i] = {
              ...entry,
              englishName: anime.title_english || anime.title || entry.animeName,
              score: anime.score,
              popularity: anime.popularity,
              episodeCount: anime.episodes,
              lastUpdated: Date.now()
            };
          }
        }
      } catch (e) {
        console.error('Sync failed for', entry.animeName);
      }
      if (onProgress) onProgress(i + 1, updatedEntries.length);
      // Respect Jikan's 3 requests per second limit
      await delay(400);
    }
    saveEntries(updatedEntries);
  };

  const isInLibrary = (animeId: string) => entries.some(e => e.animeId === animeId);

  const removeFromLibrary = (animeIds: string[]) => {
    saveEntries(entries.filter(e => !animeIds.includes(e.animeId)));
  };

  const setCategoriesForEntries = (animeIds: string[], categoryIds: string[]) => {
    const updated = entries.map(e => {
      if (animeIds.includes(e.animeId)) {
        return { ...e, categoryIds: [...categoryIds] };
      }
      return e;
    });
    saveEntries(updated);
  };

  const addCategory = (name: string) => {
    const id = 'cat_' + Date.now().toString(36);
    const newCat = { id, name, order: categories.length };
    saveCategories([...categories, newCat]);
    return id;
  };

  const removeCategory = (categoryId: string, deleteEntries: boolean = false) => {
    saveCategories(categories.filter(c => c.id !== categoryId));
    
    const updatedEntries = entries.map(e => ({
      ...e,
      categoryIds: e.categoryIds.filter(id => id !== categoryId)
    }));

    if (deleteEntries) {
      saveEntries(updatedEntries.filter(e => !entries.find(orig => orig.animeId === e.animeId)?.categoryIds.includes(categoryId)));
    } else {
      saveEntries(updatedEntries);
    }
  };

  const renameCategory = (categoryId: string, newName: string) => {
    saveCategories(categories.map(c => c.id === categoryId ? { ...c, name: newName } : c));
  };

  const reorderCategories = (newOrderIds: string[]) => {
    const reordered = newOrderIds.map((id, index) => {
      const cat = categories.find(c => c.id === id);
      return cat ? { ...cat, order: index } : null;
    }).filter(Boolean) as Category[];
    saveCategories(reordered);
  };

  return {
    entries,
    categories,
    isLoaded,
    toggleLibrary,
    isInLibrary,
    removeFromLibrary,
    setCategoriesForEntries,
    addCategory,
    removeCategory,
    renameCategory,
    reorderCategories,
    syncLibrary
  };
}
