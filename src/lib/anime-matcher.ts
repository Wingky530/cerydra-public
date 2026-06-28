// Simple Sørensen-Dice coefficient for string similarity
function diceCoefficient(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length < 2 || str2.length < 2) return 0;

  const bigrams = (str: string) => {
    const s = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      s.add(str.substring(i, i + 2));
    }
    return s;
  };

  const bg1 = bigrams(str1);
  const bg2 = bigrams(str2);
  let intersection = 0;
  for (const bg of bg1) {
    if (bg2.has(bg)) intersection++;
  }
  return (2.0 * intersection) / (bg1.size + bg2.size);
}

const normalizeTitle = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

// Hardcoded map for notorious anime that are impossible to fuzzy match correctly
const HARDCODED_MAP: Record<string, string> = {
  'monster': 'nwzocDyuTsx9GCtrt',
  'one piece': 'ReooPAxPMsHM4KPMY',
};

export const trySearchAnimeId = async (
  englishTitle?: string | null,
  romajiTitle?: string | null,
  nativeTitle?: string | null
): Promise<string | null> => {
  const tryFetch = async (query: string): Promise<any[]> => {
    try {
      const res = await fetch(`/api/anime/search?q=${encodeURIComponent(query)}`, {
        signal: AbortSignal.timeout(8000)
      });
      const data = await res.json();
      return data?.data?.shows?.edges ?? [];
    } catch {
      return [];
    }
  };

  const cleanEnglish = englishTitle ? englishTitle.replace(/^#\d+\s+/, '').trim() : '';
  const normEng = cleanEnglish ? normalizeTitle(cleanEnglish) : '';
  const normRom = romajiTitle ? normalizeTitle(romajiTitle) : '';
  
  if (normEng && HARDCODED_MAP[normEng]) return HARDCODED_MAP[normEng];
  if (normRom && HARDCODED_MAP[normRom]) return HARDCODED_MAP[normRom];

  const matchQueries = [cleanEnglish, romajiTitle].filter(Boolean) as string[];
  const normalizedMatchQueries = matchQueries.map(normalizeTitle).filter(Boolean);

  const evaluateResults = (results: any[]) => {
    let bestMatch: any = null;
    let highestScore = 0;

    for (const res of results) {
      const resNorm = normalizeTitle(res.name);
      
      for (const q of normalizedMatchQueries) {
        if (resNorm === q) return res._id; // Exact match = instant win
        if (resNorm.startsWith(`${q} `) || resNorm.includes(` ${q} `)) {
          // Strong substring match
          if (highestScore < 0.9) {
            highestScore = 0.9;
            bestMatch = res;
          }
        }
        
        // Fuzzy match
        const score = diceCoefficient(q, resNorm);
        if (score > highestScore) {
          highestScore = score;
          bestMatch = res;
        }
      }
    }

    // Threshold for acceptable match is 0.65 (e.g. "Shingeki no Kyojin 3 Part 2" vs "Shingeki no Kyojin Season 3 Part 2")
    if (highestScore > 0.65 && bestMatch) {
      return bestMatch._id;
    }
    return null;
  };

  // Try fetching using English/Romaji
  if (cleanEnglish) {
    const results = await tryFetch(cleanEnglish);
    const found = evaluateResults(results);
    if (found) return found;
  }
  
  if (romajiTitle && romajiTitle !== cleanEnglish) {
    const results = await tryFetch(romajiTitle);
    const found = evaluateResults(results);
    if (found) return found;
  }

  // Try Native Title as a last resort
  if (nativeTitle) {
    const results = await tryFetch(nativeTitle);
    const found = evaluateResults(results);
    if (found) return found;
  }

  return null;
};
