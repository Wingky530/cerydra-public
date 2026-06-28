import type { APIRoute } from 'astro'
import { getScheduleForDay } from '../../lib/schedule/cacheSchedule'

const VALID_DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']

export const GET: APIRoute = async ({ url }) => {
  const day = url.searchParams.get('day')

  if (!day || !VALID_DAYS.includes(day)) {
    return new Response(JSON.stringify({ error: 'Invalid day' }), { status: 400 })
  }

  try {
    const data = await getScheduleForDay(day as any)
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify([]), { status: 500 })
  }
}
