import client from '../turso'
import { fetchAnilist } from './fetchAnilist'
import { fetchJikan } from './fetchJikan'
import { resolveStatus } from './normalizeSchedule'
import { fetchAllAnimeTimestamps } from './fetchAllAnimeStatus'
import type { DayKey, ScheduleEntry } from './types'

const STALE_SECONDS = 1800 // 30 minutes
const JST_OFFSET = 9 * 60 * 60 * 1000

export async function getScheduleForDay(day: DayKey): Promise<ScheduleEntry[]> {
  const cached = await client.execute({
    sql: `SELECT * FROM schedule_cache WHERE day_of_week = ? ORDER BY air_time_wib ASC`,
    args: [day],
  })

  const firstRow = cached.rows[0]
  const isStale =
    !firstRow ||
    Date.now() / 1000 - Number(firstRow.cached_at) > STALE_SECONDS

  if (!isStale) {
    return cached.rows.map(rowToEntry)
  }

  let fresh: ScheduleEntry[] = []
  try {
    fresh = await fetchAnilist(day)
  } catch {
    try {
      fresh = await fetchJikan(day)
    } catch {
      if (cached.rows.length) return cached.rows.map(rowToEntry)
      return []
    }
  }

  const now = Date.now() / 1000
  const withStatus = fresh.map(e => ({
    ...e,
    status: resolveStatus(e.airing_timestamp, e.media_status),
  }))

  await client.execute({
    sql: `DELETE FROM schedule_cache WHERE day_of_week = ?`,
    args: [day],
  })

  const insertStmts = withStatus.map(entry => ({
    sql: `
      INSERT INTO schedule_cache
        (day_of_week, anime_id, title, romaji_title, episode, air_time_jst, air_time_wib,
         status, score, watchers, cover_url, source, cached_at,
         airing_timestamp, media_status, available_on_cerydra)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(day_of_week, anime_id) DO UPDATE SET
        title=excluded.title, romaji_title=excluded.romaji_title, episode=excluded.episode,
        air_time_jst=excluded.air_time_jst, air_time_wib=excluded.air_time_wib,
        status=excluded.status, score=excluded.score, watchers=excluded.watchers,
        cover_url=excluded.cover_url, source=excluded.source,
        cached_at=excluded.cached_at,
        airing_timestamp=excluded.airing_timestamp,
        media_status=excluded.media_status,
        available_on_cerydra=excluded.available_on_cerydra
    `,
    args: [
      day, entry.anime_id, entry.title, entry.romaji_title ?? null, entry.episode ?? null,
      entry.air_time_jst, entry.air_time_wib, entry.status,
      entry.score ?? null, entry.watchers ?? null,
      entry.cover_url ?? null, entry.source, Math.floor(now),
      entry.airing_timestamp, entry.media_status, 0,
    ],
  }))

  if (insertStmts.length > 0) {
    await client.batch(insertStmts)
  }

  // ponytail: sequential AllAnime lookups per title, fails silently
  const titles = [...new Set(withStatus.map(e => e.title))]
  const allAnimeInfo = await fetchAllAnimeTimestamps(titles)
  const updateStmts = []
  for (const entry of withStatus) {
    const info = allAnimeInfo.get(entry.title.toLowerCase())
    if (!info) continue

    if (entry.airing_timestamp && info.timestamp >= entry.airing_timestamp) {
      entry.available_on_cerydra = true
      entry.airing_timestamp = info.timestamp
      const jstTime = new Date((info.timestamp * 1000) + JST_OFFSET)
      entry.air_time_jst = `${String(jstTime.getUTCHours()).padStart(2, '0')}:${String(jstTime.getUTCMinutes()).padStart(2, '0')}`
    }

    updateStmts.push({
      sql: `UPDATE schedule_cache SET title = ?, available_on_cerydra = ?, airing_timestamp = ?, air_time_jst = ? WHERE day_of_week = ? AND anime_id = ?`,
      args: [entry.title, entry.available_on_cerydra ? 1 : 0, entry.airing_timestamp, entry.air_time_jst, day, entry.anime_id],
    })
  }

  if (updateStmts.length > 0) {
    await client.batch(updateStmts)
  }

  return withStatus
}

function rowToEntry(row: any): ScheduleEntry {
  return {
    anime_id: row.anime_id,
    title: row.title,
    romaji_title: row.romaji_title ?? null,
    episode: row.episode,
    airing_timestamp: row.airing_timestamp ?? null,
    media_status: row.media_status ?? null,
    air_time_jst: row.air_time_jst,
    air_time_wib: row.air_time_wib,
    status: row.status,
    score: row.score,
    watchers: row.watchers,
    cover_url: row.cover_url,
    source: row.source,
    available_on_cerydra: !!row.available_on_cerydra,
  }
}
