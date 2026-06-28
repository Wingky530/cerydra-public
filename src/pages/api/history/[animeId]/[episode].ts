import type { APIRoute } from 'astro';
import client from '../../../../lib/turso';

export const GET: APIRoute = async ({ params }) => {
  try {
    if (!client) return new Response(null, { status: 404 });
    const { animeId, episode } = params;
    const result = await client.execute({
      sql: 'SELECT * FROM watch_history WHERE anime_id = ? AND episode = ?',
      args: [animeId as string, episode as string],
    });
    if (result.rows.length === 0) return new Response(null, { status: 404 });
    const row = result.rows[0];
    return new Response(JSON.stringify({
      animeId: row.anime_id,
      animeName: row.anime_name,
      episode: row.episode,
      thumbnail: row.thumbnail,
      currentTime: row.current_time,
      duration: row.duration,
      progressSeconds: row.progress_seconds,
      timestamp: row.timestamp,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('GET /api/history/:animeId/:episode error:', e);
    return new Response(null, { status: 500 });
  }
};
