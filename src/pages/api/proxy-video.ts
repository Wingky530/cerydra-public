import type { APIRoute } from 'astro';

const WORKER_URL = typeof import.meta !== 'undefined' ? (import.meta as any).env?.PUBLIC_VIDEO_PROXY_URL || 'https://cerydra-video-proxy.wingky530-id.workers.dev' : 'https://cerydra-video-proxy.wingky530-id.workers.dev';

export const GET: APIRoute = async ({ request }) => {
  const videoUrl = new URL(request.url).searchParams.get('url');
  if (!videoUrl) return new Response('Missing URL', { status: 400 });

  const redirectUrl = `${WORKER_URL}/?url=${encodeURIComponent(videoUrl)}`;
  return Response.redirect(redirectUrl, 302);
};
