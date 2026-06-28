import type { APIRoute } from 'astro';
import { extractOkru, extractMp4upload, extractStreamwish, extractListeamed, extractGeneric, fetchEmbed } from '../../../lib/embed-extract';

export const prerender = false;

function normalizeUrl(url: string): string {
  if (url.startsWith('//')) return 'https:' + url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return 'https://' + url;
  return url;
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const embedUrl = url.searchParams.get('url');
  const sourceName = url.searchParams.get('sourceName') || '';

  if (!embedUrl) {
    return new Response(JSON.stringify({ error: 'Parameter url is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const targetUrl = normalizeUrl(embedUrl);
  console.log(`[resolve-source] Resolving ${sourceName} from ${targetUrl}`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const name = sourceName.toLowerCase();
    let videoUrl: string | null = null;

    try {
      const html = await fetchEmbed(targetUrl, controller.signal);

      if (name.includes('ok')) {
        videoUrl = extractOkru(html);
      } else if (name.includes('mp4')) {
        videoUrl = extractMp4upload(html);
      } else if (name.includes('wish') || targetUrl.includes('wish')) {
        videoUrl = extractStreamwish(html);
      } else if (name.includes('listeamed') || targetUrl.includes('listeamed')) {
        videoUrl = extractListeamed(html);
      } else {
        videoUrl = extractGeneric(html);
      }
    } finally {
      clearTimeout(timeout);
    }

    if (!videoUrl) {
      console.warn(`[resolve-source] Failed to extract URL for ${sourceName} from ${targetUrl}`);
      return new Response(JSON.stringify({ error: 'Could not extract video URL from embed page' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[resolve-source] Success: ${videoUrl.slice(0, 80)}...`);
    return new Response(JSON.stringify({ url: videoUrl }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error(`[resolve-source] Error for ${sourceName}:`, err.message);
    return new Response(JSON.stringify({ error: err.message || 'Failed to resolve source' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
