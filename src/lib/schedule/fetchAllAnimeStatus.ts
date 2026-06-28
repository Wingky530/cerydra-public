import { ALLANIME_API, AGENT, REFERER } from '../allanime'

const SEARCH_QUERY = `
  query($search: SearchInput, $limit: Int) {
    shows(search: $search, limit: $limit, translationType: sub, countryOrigin: ALL) {
      edges {
        _id
        name
        lastEpisodeTimestamp
      }
    }
  }
`

interface AllAnimeInfo {
  timestamp: number
  name?: string
}

async function searchSingle(query: string): Promise<{ timestamp: number; name: string } | null> {
  try {
    const res = await fetch(ALLANIME_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': AGENT,
        'Referer': REFERER,
      },
      body: JSON.stringify({
        variables: {
          search: { allowAdult: false, allowUnknown: false, query },
          limit: 1,
        },
        query: SEARCH_QUERY,
      }),
    })
    if (!res.ok) return null
    const json = await res.json()
    const edge = json?.data?.shows?.edges?.[0]
    const ts = edge?.lastEpisodeTimestamp?.sub
    if (ts && typeof ts === 'number' && ts > 0) {
      return { timestamp: ts, name: edge.name }
    }
  } catch {
    // skip
  }
  return null
}

export async function fetchAllAnimeTimestamps(
  titles: string[]
): Promise<Map<string, AllAnimeInfo>> {
  const result = new Map<string, AllAnimeInfo>()
  const unique = [...new Set(titles.map(t => t.toLowerCase()))]

  const chunkSize = 5;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    
    await Promise.all(chunk.map(async (query) => {
      let found = await searchSingle(query)

      // Fallback: strip common Japanese particles for romaji titles
      if (!found) {
        const simplified = query.replace(/\s+(no|wa|ga|ni|wo|de|to|ka|na)\s+/gi, ' ').trim()
        if (simplified !== query) {
          found = await searchSingle(simplified)
        }
      }

      if (found) {
        result.set(query, {
          timestamp: found.timestamp,
          name: found.name || undefined,
        })
      }
    }));
  }

  return result
}
