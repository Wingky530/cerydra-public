import type { ScheduleEntry, DayKey } from './types'

const ANILIST_URL = 'https://graphql.anilist.co'
const JST_OFFSET = 9 * 60 * 60 * 1000
const DAY_ORDER: DayKey[] = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']

function getDayTimestampRange(day: DayKey): { start: number; end: number } {
  const now = Date.now()
  const nowJST = now + JST_OFFSET
  const jstDate = new Date(nowJST)
  const diff = DAY_ORDER.indexOf(day) - jstDate.getUTCDay()

  const targetDate = new Date(Date.UTC(
    jstDate.getUTCFullYear(), jstDate.getUTCMonth(), jstDate.getUTCDate() + diff
  ))

  return {
    start: Math.floor((targetDate.getTime() - JST_OFFSET) / 1000),
    end:   Math.floor((targetDate.getTime() - JST_OFFSET + 86400000 - 1000) / 1000),
  }
}

export async function fetchAnilist(day: DayKey): Promise<ScheduleEntry[]> {
  const { start, end } = getDayTimestampRange(day)

  const res = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      query: `
        query ($gt: Int, $lt: Int) {
          Page(perPage: 100) {
            airingSchedules(airingAt_greater: $gt, airingAt_lesser: $lt, sort: TIME) {
              airingAt
              episode
              media {
                id
                title { romaji english }
                idMal
                format
                countryOfOrigin
                episodes
                status
                averageScore
                popularity
                coverImage { large }
              }
            }
          }
        }
      `,
      variables: { gt: start, lt: end }
    })
  })

  if (!res.ok) throw new Error(`AniList error: ${res.status}`)
  const json = await res.json()
  const schedules = json?.data?.Page?.airingSchedules ?? []

  return schedules
    .filter((s: any) => {
      if (!['TV', 'ONA'].includes(s.media?.format)) return false
      if (s.media?.countryOfOrigin !== 'JP') return false
      
      const score = s.media?.averageScore ?? 0;
      const pop = s.media?.popularity ?? 0;
      const totalEps = s.media?.episodes;
      const currEp = s.episode ?? 0;

      // Filter out low quality / obscure ONAs
      if (s.media?.format === 'ONA' && score < 65 && pop < 5000) return false;
      
      // Filter out obscure TV shows
      if (score < 60 && pop < 1000) return false;
      
      // Filter out long running kids shows (Doraemon, Shinchan etc usually have > 100 eps or null total eps but high current ep)
      if ((totalEps !== null && totalEps > 150 && score < 75) || (currEp > 150 && score < 75)) return false;

      return true
    })
    .map((s: any): ScheduleEntry => {
      const jstTime = new Date((s.airingAt * 1000) + JST_OFFSET)
      const airJST = `${String(jstTime.getUTCHours()).padStart(2, '0')}:${String(jstTime.getUTCMinutes()).padStart(2, '0')}`

      return {
        anime_id: String(s.media.id),
        title: s.media.title.english ?? s.media.title.romaji ?? 'Unknown',
        romaji_title: s.media.title.romaji ?? null,
        episode: s.episode ?? null,
        airing_timestamp: s.airingAt ?? null,
        media_status: s.media.status ?? null,
        air_time_jst: airJST,
        air_time_wib: null,
        score: s.media.averageScore ? s.media.averageScore / 10 : null,
        watchers: s.media.popularity ?? null,
        cover_url: s.media.coverImage?.large ?? null,
        status: 'waiting',
        source: 'anilist',
      }
    })
}
