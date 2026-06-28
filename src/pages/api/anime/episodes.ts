import type { APIRoute } from 'astro';
import { ALLANIME_API, AGENT, REFERER } from '../../../lib/allanime';
import { getCache, setCache } from '../../../lib/anime-cache';

export const prerender = false;

const EPISODES_QUERY = `
  query ($showId: String!) {
    show( _id: $showId ) {
      _id
      name
      englishName
      thumbnail
      availableEpisodesDetail
    }
  }
`;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return new Response(JSON.stringify({ error: 'Parameter id is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cacheKey = `episodes:${id}`;
  const nocache = url.searchParams.get('nocache') === '1';
  
  if (!nocache) {
    const cached = await getCache<any>(cacheKey, 900_000);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    if (id.startsWith('OTAKU_')) {
      const anilistId = id.replace('OTAKU_', '');
      const aniRes = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query($id: Int) { Media(id: $id, type: ANIME) { title { english romaji } coverImage { extraLarge } } }`,
          variables: { id: parseInt(anilistId, 10) }
        })
      });
      const aniJson = await aniRes.json();
      const media = aniJson?.data?.Media;
      const fakeData = {
        data: {
          show: {
            _id: id,
            name: media?.title?.romaji || 'Unknown Title',
            englishName: media?.title?.english || media?.title?.romaji || 'Unknown Title',
            thumbnail: media?.coverImage?.extraLarge || '',
            availableEpisodesDetail: {
              sub: Array.from({ length: 12 }, (_, i) => String(i + 1))
            }
          }
        }
      };
      await setCache(cacheKey, fakeData, 900_000);
      return new Response(JSON.stringify(fakeData), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch(ALLANIME_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': AGENT,
        'Referer': REFERER,
      },
      body: JSON.stringify({
        variables: { showId: id },
        query: EPISODES_QUERY,
      }),
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch episodes from source API' }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    
    // Supplement with Anichin episodes for Donghua or delayed releases
    try {
      const show = data?.data?.show;
      if (show) {
        const titles = [show.name, show.englishName].filter(Boolean);
        const { checkAnichinMaxEpisodes } = await import('../../../lib/anichin');
        const anichinMax = await checkAnichinMaxEpisodes(titles);
        if (anichinMax > 0) {
          if (!show.availableEpisodesDetail) show.availableEpisodesDetail = { sub: [] };
          if (!show.availableEpisodesDetail.sub) show.availableEpisodesDetail.sub = [];
          
          const currentEps = show.availableEpisodesDetail.sub.map((e: string) => parseInt(e, 10)).filter((e: number) => !isNaN(e));
          const currentMax = currentEps.length > 0 ? Math.max(...currentEps) : 0;
          
          if (anichinMax > currentMax) {
            const newSub = Array.from({ length: anichinMax }, (_, i) => String(i + 1));
            // Keep any specials/OVAs that might not be numbers, just merge the numeric sequence
            const nonNumeric = show.availableEpisodesDetail.sub.filter((e: string) => isNaN(parseInt(e, 10)));
            show.availableEpisodesDetail.sub = [...new Set([...newSub, ...nonNumeric])];
          }
        }
      }
    } catch (err) {
      console.error('[episodes.ts] Failed to supplement Anichin episodes', err);
    }

    await setCache(cacheKey, data, 900_000);
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Upstream fetch failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
