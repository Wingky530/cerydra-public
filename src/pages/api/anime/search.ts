import type { APIRoute } from 'astro';
import { ALLANIME_API, AGENT, REFERER } from '../../../lib/allanime';
import { getCache, setCache } from '../../../lib/anime-cache';

export const prerender = false;

const SEARCH_QUERY = `
  query($search: SearchInput, $limit: Int, $page: Int, $translationType: VaildTranslationTypeEnumType, $countryOrigin: VaildCountryOriginEnumType) {
    shows(search: $search, limit: $limit, page: $page, translationType: $translationType, countryOrigin: $countryOrigin) {
      edges {
        _id
        name
        thumbnail
        availableEpisodes
        aniListId
      }
    }
  }
`;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const q = url.searchParams.get('q');
  const pageStr = url.searchParams.get('page');
  const page = pageStr ? parseInt(pageStr, 10) : 1;

  if (!q) {
    return new Response(JSON.stringify({ error: 'Query parameter q is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cacheKey = `search_v2:${q.toLowerCase()}:page:${page}`;
  const nocache = url.searchParams.get('nocache') === '1';

  if (!nocache) {
    const cached = await getCache<any>(cacheKey, 600000);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

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
          search: { allowAdult: false, allowUnknown: false, query: q },
          limit: 40,
          page: page,
          translationType: 'sub',
          countryOrigin: 'ALL',
        },
        query: SEARCH_QUERY,
      }),
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch search results from source API' }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    await setCache(cacheKey, data, 600_000);
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
