export type ScheduleStatus = 'aired' | 'waiting' | 'delayed'

export interface ScheduleEntry {
  anime_id: string
  title: string
  romaji_title?: string | null
  episode: number | null
  airing_timestamp: number | null
  media_status: string | null
  air_time_jst: string | null
  air_time_wib: string | null
  status: ScheduleStatus
  score: number | null
  watchers: number | null
  cover_url: string | null
  source: 'anilist' | 'jikan'
  available_on_cerydra?: boolean
}

export type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
