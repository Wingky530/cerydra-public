import type { APIRoute } from 'astro';
import { ALLANIME_API, AGENT, REFERER } from '../../../lib/allanime';
import client from '../../../lib/turso';

export const prerender = false;

const SEARCH_QUERY = `
  query($search: SearchInput, $limit: Int) {
    shows(search: $search, limit: $limit, translationType: sub, countryOrigin: ALL) {
      edges {
        _id
        name
        availableEpisodes
      }
    }
  }
`;

function cleanTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

function getSimilarity(s1: string, s2: string): number {
  let longer = s1;
  let shorter = s2;
  if (s1.length < s2.length) {
    longer = s2;
    shorter = s1;
  }
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;

  const costs = new Array();
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= shorter.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) costs[shorter.length] = lastValue;
  }
  return (longerLength - costs[shorter.length]) / longerLength;
}

async function searchAllAnime(query: string, year?: number) {
  if (!query) return [];
  try {
    const searchObj: any = { allowAdult: false, allowUnknown: false, query };
    if (year) searchObj.year = year;
    
    const res = await fetch(ALLANIME_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': AGENT,
        'Referer': REFERER,
      },
      body: JSON.stringify({
        variables: {
          search: searchObj,
          limit: 40,
        },
        query: SEARCH_QUERY,
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json?.data?.shows?.edges || [];
  } catch {
    return [];
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { anilistId, titleRomaji, titleEnglish, year } = await request.json();
    if (!anilistId) return new Response(JSON.stringify({ error: 'anilistId required' }), { status: 400 });

    const cacheKey = `mapping:${anilistId}`;

    const hardcodedMappings: Record<number, string> = {
      21: 'ReooPAxPMsHM4KPMY', // One Piece -> 1P
      187260: 'OTAKU_187260', // I Want to Love You Till Your Dying Day -> Otakudesu only
    };

    if (hardcodedMappings[anilistId]) {
      return new Response(JSON.stringify({ allanimeId: hardcodedMappings[anilistId] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }


    if (client) {
      const cached = await client.execute({ sql: 'SELECT anime_id, created_at FROM cache_index WHERE key = ?', args: [cacheKey] });
      if (cached.rows.length > 0) {
        const id = cached.rows[0].anime_id;
        const createdAt = cached.rows[0].created_at as number;
        const now = Math.floor(Date.now() / 1000);
        
        // Expire NOT_FOUND cache after 24 hours (86400 seconds)
        if (id === 'NOT_FOUND' && (now - createdAt > 86400)) {
          await client.execute({ sql: 'DELETE FROM cache_index WHERE key = ?', args: [cacheKey] });
        } else {
          const badMappings = [
            { anilistId: 19, badId: 'H7Wy64gbe5i6zZdjc' }, // Monster Strike instead of Monster
            { anilistId: 137667, badId: '8KE2siFvbELsuv5DF' }, // Specials instead of main series
            { anilistId: 137667, badId: 'NOT_FOUND' }
          ];
          
          const isBad = badMappings.some(b => b.anilistId === anilistId && b.badId === id);
          
          if (!isBad) {
            return new Response(JSON.stringify({ allanimeId: id === 'NOT_FOUND' ? null : id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
        }
      }
    }

    const queries = [titleEnglish, titleRomaji].filter(Boolean);
    if (titleRomaji) {
      queries.push(titleRomaji.replace(/\s+(no|wa|ga|ni|wo|de|to|ka|na)\s+/gi, ' ').trim());
    }

    let bestMatch: any = null;
    let highestScore = 0;

    for (const q of queries) {
      if (!q) continue;
      const results = await searchAllAnime(q, year);
      
      for (const res of results) {
        if (!res.name) continue;
        const scoreRomaji = getSimilarity(cleanTitle(res.name), cleanTitle(titleRomaji || ''));
        const scoreEnglish = getSimilarity(cleanTitle(res.name), cleanTitle(titleEnglish || ''));
        let score = Math.max(scoreRomaji, scoreEnglish);
        
        // Boost score if one string is a subset of the other (handles cases like "Title" vs "Title: Season 2")
        const cleanResName = cleanTitle(res.name);
        const cleanRomaji = cleanTitle(titleRomaji || '---');
        const cleanEnglish = cleanTitle(titleEnglish || '---');
        
        if (cleanRomaji.length > 5 && (cleanResName.includes(cleanRomaji) || cleanRomaji.includes(cleanResName))) {
          score = Math.max(score, 0.85);
        }
        if (cleanEnglish.length > 5 && (cleanResName.includes(cleanEnglish) || cleanEnglish.includes(cleanResName))) {
          score = Math.max(score, 0.85);
        }
        
        let currentEps = bestMatch?.availableEpisodes?.sub || 0;
        let newEps = res?.availableEpisodes?.sub || 0;

        if (score > highestScore || (score === highestScore && newEps > currentEps)) {
          highestScore = score;
          bestMatch = res;
        }
      }
      
      // Early exit if we find a very good match
      if (highestScore > 0.85) break;
    }

    const resultId = highestScore > 0.7 && bestMatch ? bestMatch._id : null;

    if (client) {
      // Save to cache even if null to prevent constant retries for non-existent anime
      await client.execute({
        sql: `INSERT OR REPLACE INTO cache_index (key, anime_id, type) VALUES (?, ?, 'mapping')`,
        args: [cacheKey, resultId || 'NOT_FOUND']
      });
    }

    return new Response(JSON.stringify({ allanimeId: resultId }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
