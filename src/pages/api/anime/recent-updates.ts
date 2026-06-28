import type { APIRoute } from 'astro';
import { getCache, setCache } from '../../../lib/anime-cache';

const ANILIST_RECENT_QUERY = `
query {
  Page(page: 1, perPage: 30) {
    airingSchedules(
      notYetAired: false
      sort: TIME_DESC
    ) {
      episode
      airingAt
      media {
        id
        title {
          romaji
          english
        }
        coverImage {
          extraLarge
        }
        averageScore
        countryOfOrigin
        format
        isAdult
      }
    }
  }
}
`;

export const prerender = false;

export const GET: APIRoute = async () => {
  const cached = await getCache<any>('recent-updates-anilist-v3', 900_000);
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: ANILIST_RECENT_QUERY,
      }),
    });

    if (!res.ok) throw new Error(`AniList error: ${res.status}`);
    const json = await res.json();
    const schedules = json?.data?.Page?.airingSchedules ?? [];

    const uniqueMediaIds = new Set<number>();

    const data = schedules
      .filter((s: any) => {
        const m = s.media;
        if (!m) return false;
        if (m.isAdult) return false;
        if (m.countryOfOrigin !== 'JP') return false;
        if (m.format && m.format !== 'TV' && m.format !== 'ONA') return false;
        
        // Deduplicate so we only show one episode per anime
        if (uniqueMediaIds.has(m.id)) return false;
        uniqueMediaIds.add(m.id);
        
        return true;
      })
      .slice(0, 15) // Limit to top 15 after filtering
      .map((s: any) => {
        const m = s.media;
        return {
          id: m.id.toString(),
          title: m.title.english || m.title.romaji,
          thumbnail: m.coverImage.extraLarge,
          episode: s.episode,
          updatedAt: s.airingAt, // Unix timestamp in seconds
          score: m.averageScore ? (m.averageScore / 10).toFixed(2) : null,
        };
      });

    await setCache('recent-updates-anilist-v3', data, 900_000);
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch recent updates from AniList', error);
    return new Response(JSON.stringify([]), { status: 500 });
  }
}
