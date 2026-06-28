import type { APIRoute } from 'astro';
import { verifySession } from '../../../lib/auth';

export const GET: APIRoute = async ({ request }) => {
  const session = await verifySession(request);
  return new Response(JSON.stringify(session), {
    headers: { 'Content-Type': 'application/json' },
  });
};
