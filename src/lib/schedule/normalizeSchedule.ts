import type { ScheduleStatus } from './types'

export function resolveStatus(
  airingTimestamp: number | null,
  mediaStatus: string | null = null,
  episodeAvailable = false,
): ScheduleStatus {
  if (airingTimestamp) {
    const secondsAgo = Date.now() / 1000 - airingTimestamp
    if (secondsAgo >= 0 && secondsAgo <= 7 * 86400) {
      return 'aired' // Aired within the last 7 days
    }
    if (secondsAgo > 7 * 86400) {
      return 'delayed' // More than a week since last aired (Delayed/Ended)
    }
  }

  if (mediaStatus === 'FINISHED' || mediaStatus === 'CANCELLED')
    return 'delayed'

  return 'waiting'
}

export function formatWatchers(n: number | null): string {
  if (!n) return '-'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}
