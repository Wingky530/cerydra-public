import type { APIRoute } from 'astro';
import client from '../../../lib/turso';

export const GET: APIRoute = async ({ params }) => {
  const { username } = params;
  if (!username) return new Response('Not found', { status: 404 });

  const result = await client.execute({
    sql: 'SELECT * FROM presence WHERE username = ?',
    args: [username],
  });

  if (result.rows.length === 0) {
    return new Response(JSON.stringify({ status: 'idle' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const row = result.rows[0];
  const updatedAt = Number(row.updated_at);
  if (updatedAt < Date.now() - 5 * 60 * 1000) {
    return new Response(JSON.stringify({ status: 'idle' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    user_id: row.user_id,
    username: row.username,
    avatar: row.avatar,
    activity_type: row.activity_type,
    anime_title: row.anime_title,
    episode_number: row.episode_number,
    episode_title: row.episode_title,
    duration: row.duration,
    position: row.position,
    updated_at: updatedAt,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
