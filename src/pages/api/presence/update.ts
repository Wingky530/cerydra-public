import type { APIRoute } from 'astro';
import client from '../../../lib/turso';
import { verifySession } from '../../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  const session = await verifySession(request);
  if (!session) return new Response('Unauthorized', { status: 401 });

  const body = await request.json();
  const { activity_type, anime_title, episode_number, episode_title, duration, position, search_query } = body;

  const resolvedTitle = activity_type === 'searching' ? search_query : anime_title;

  await client.execute({
    sql: `INSERT INTO presence (user_id, username, avatar, activity_type, anime_title, episode_number, episode_title, duration, position, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            username = excluded.username,
            avatar = excluded.avatar,
            activity_type = excluded.activity_type,
            anime_title = excluded.anime_title,
            episode_number = excluded.episode_number,
            episode_title = excluded.episode_title,
            duration = excluded.duration,
            position = excluded.position,
            status = 'active',
            updated_at = excluded.updated_at`,
    args: [
      session.user_id,
      session.username,
      session.avatar_hash,
      activity_type,
      resolvedTitle || null,
      episode_number ?? null,
      episode_title || null,
      duration ?? null,
      position ?? null,
      Date.now(),
    ],
  });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
