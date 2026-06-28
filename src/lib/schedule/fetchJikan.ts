import type { ScheduleEntry, DayKey } from './types'

const JIKAN_URL = 'https://api.jikan.moe/v4'

function convertJSTtoWIB(jst: string): string {
  const [h, m] = jst.split(':').map(Number)
  const totalMin = h * 60 + m - 120
  const wibH = Math.floor(((totalMin % 1440) + 1440) % 1440 / 60)
  const wibM = ((totalMin % 60) + 60) % 60
  return `${String(wibH).padStart(2, '0')}:${String(wibM).padStart(2, '0')}`
}

export async function fetchJikan(day: DayKey): Promise<ScheduleEntry[]> {
  const res = await fetch(`${JIKAN_URL}/schedules?filter=${day}&limit=25`)
  if (!res.ok) throw new Error(`Jikan error: ${res.status}`)
  const json = await res.json()
  const data = json?.data ?? []

  return data.map((a: any): ScheduleEntry => ({
    anime_id: `jikan-${a.mal_id}`,
    title: a.title ?? 'Unknown',
    episode: a.episodes ?? null,
    airing_timestamp: null,
    media_status: null,
    air_time_jst: a.broadcast?.time ?? null,
    air_time_wib: a.broadcast?.time ? convertJSTtoWIB(a.broadcast.time) : null,
    score: a.score ?? null,
    watchers: a.members ?? null,
    cover_url: a.images?.jpg?.large_image_url ?? null,
    status: 'waiting',
    source: 'jikan',
  }))
}
