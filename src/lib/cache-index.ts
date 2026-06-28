import client from './turso';

export async function markCacheIndex(key: string, animeId: string, episode: string | null, type: string): Promise<void> {
  try {
    await client.execute({
      sql: `INSERT OR REPLACE INTO cache_index (key, anime_id, episode, type, created_at) VALUES (?, ?, ?, ?, unixepoch())`,
      args: [key, animeId, episode, type],
    });
  } catch (err) {
    console.error(`[CacheIndex] mark error for ${key}:`, (err as Error).message);
  }
}

export async function isCacheIndexed(key: string): Promise<boolean> {
  try {
    const result = await client.execute({
      sql: `SELECT 1 FROM cache_index WHERE key = ?`,
      args: [key],
    });
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

export async function getCachedEpisodes(animeId: string): Promise<string[]> {
  try {
    const result = await client.execute({
      sql: `SELECT episode FROM cache_index WHERE anime_id = ? AND type = 'episode-links' ORDER BY episode`,
      args: [animeId],
    });
    return result.rows.map(r => String(r.episode));
  } catch {
    return [];
  }
}
