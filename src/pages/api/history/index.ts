import type { APIRoute } from 'astro';
import client from '../../../lib/turso';

function getUserId(request: Request): string {
  return request.headers.get('X-User-Id') || '';
}

export const GET: APIRoute = async ({ request }) => {
  try {
    if (!client) return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const userId = getUserId(request);
    const result = await client.execute({
      sql: 'SELECT * FROM watch_history WHERE user_id = ? ORDER BY timestamp DESC',
      args: [userId],
    });
    return new Response(JSON.stringify(result.rows.map(mapRow)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('GET /api/history error:', e);
    return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!client) return new Response(null, { status: 204 });
    const body = await request.json();
    const url = new URL(request.url);
    const isDelete = url.searchParams.get('_method') === 'delete';
    const userId = getUserId(request);

    if (!userId) {
      return new Response(null, { status: 400 });
    }

    if (isDelete) {
      const animeId = body.animeId;
      const ids = body.ids;
      if (animeId) {
        await client.execute({ sql: 'DELETE FROM watch_history WHERE user_id = ? AND anime_id = ?', args: [userId, animeId] });
      } else if (ids?.length) {
        const processed = new Set<string>();
        for (const key of ids) {
          const [aid] = key.split('|');
          if (aid && !processed.has(aid)) {
            processed.add(aid);
            await client.execute({ sql: 'DELETE FROM watch_history WHERE user_id = ? AND anime_id = ?', args: [userId, aid] });
          }
        }
      } else {
        await client.execute({ sql: 'DELETE FROM watch_history WHERE user_id = ?', args: [userId] });
      }
      return new Response(null, { status: 204 });
    }

    const { animeId, anilistId, animeName, episode, thumbnail, currentTime, duration, progressSeconds, timestamp } = body;
    await client.execute({
      sql: `INSERT INTO watch_history (user_id, anime_id, anilist_id, anime_name, episode, thumbnail, current_time, duration, progress_seconds, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, anime_id, episode) DO UPDATE SET
              anilist_id = IFNULL(excluded.anilist_id, watch_history.anilist_id),
              anime_name = excluded.anime_name,
              thumbnail = excluded.thumbnail,
              current_time = excluded.current_time,
              duration = excluded.duration,
              progress_seconds = excluded.progress_seconds,
              timestamp = excluded.timestamp`,
      args: [
        userId,
        animeId,
        anilistId ?? null,
        animeName,
        episode,
        thumbnail ?? '',
        currentTime ?? 0,
        duration ?? 0,
        progressSeconds ?? 0,
        timestamp ?? Date.now(),
      ],
    });
    return new Response(null, { status: 204 });
  } catch (e) {
    console.error('POST /api/history error:', e);
    return new Response(null, { status: 500 });
  }
};

function mapRow(row: any) {
  return {
    animeId: row.anime_id,
    anilistId: row.anilist_id,
    animeName: row.anime_name,
    episode: row.episode,
    thumbnail: row.thumbnail,
    currentTime: row.current_time,
    duration: row.duration,
    progressSeconds: row.progress_seconds,
    timestamp: row.timestamp,
  };
}