import { useState, useEffect, useRef } from 'react'
import type { DayKey, ScheduleEntry } from '../../lib/schedule/types'
import { ScheduleCard } from './ScheduleCard'
import AppShell from '../AppShell'
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

interface Props {
  initialDay: DayKey
  initialData: ScheduleEntry[]
  days: DayKey[]
  dayLabels: Record<DayKey, string>
}

const DAY_ORDER: DayKey[] = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
const STATUS_ORDER: Record<string, number> = { aired: 0, waiting: 1, delayed: 2 }

export default function ScheduleClient({ initialDay, initialData, days, dayLabels }: Props) {
  const [activeDay, setActiveDay] = useState<DayKey>(initialDay)
  const [scheduleMap, setScheduleMap] = useState<Record<string, ScheduleEntry[]>>({
    [initialDay]: initialData,
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showFloatingIsland, setShowFloatingIsland] = useState(false)
  const [containerHeight, setContainerHeight] = useState<number | 'auto'>('auto')
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowFloatingIsland(entry.boundingClientRect.top < 0 && !entry.isIntersecting)
      },
      { threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  const today = initialDay

  const getDateForDay = (day: DayKey) => {
    const now = new Date()
    const jsDay = now.getDay()
    const diff = DAY_ORDER.indexOf(day) - jsDay
    const d = new Date(now)
    d.setDate(d.getDate() + diff)
    return d.getDate()
  }

  // Snap-panel swipe navigation
  const scrollRef = useRef<HTMLDivElement>(null)
  const panelRefs = useRef<(HTMLDivElement | null)[]>([])
  const observerRefs = useRef<(HTMLDivElement | null)[]>([])

  const scrollToDay = (day: DayKey) => {
    const idx = DAY_ORDER.indexOf(day)
    const panel = panelRefs.current[idx]
    if (panel && scrollRef.current) scrollRef.current.scrollTo({ left: panel.offsetLeft, behavior: 'smooth' })
  }

  // Fetch data for a day if not cached
  const ensureDayData = (day: DayKey) => {
    if (scheduleMap[day]) return
    fetch(`/api/schedule?day=${day}`)
      .then(res => res.json())
      .then(data => setScheduleMap(prev => ({ ...prev, [day]: data })))
      .catch(() => setScheduleMap(prev => ({ ...prev, [day]: [] })))
  }

  // Preload all days + scroll to initial day
  useEffect(() => {
    const idx = DAY_ORDER.indexOf(initialDay)
    const panel = panelRefs.current[idx]
    if (panel && scrollRef.current) scrollRef.current.scrollLeft = panel.offsetLeft
    DAY_ORDER.forEach(day => { if (!scheduleMap[day]) ensureDayData(day) })
  }, [])

  // Sync activeDay from visible snap panel
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idx = Number(entry.target.getAttribute('data-idx'))
          const day = DAY_ORDER[idx]
          if (day) setActiveDay(day)
        }
      })
    }, { root: el, threshold: 0.5 })
    observerRefs.current.forEach(ref => { if (ref) observer.observe(ref) })
    return () => observer.disconnect()
  }, [])

  const getContentForDay = (day: DayKey) => {
    let entries = scheduleMap[day] ?? []
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase()
      entries = entries.filter(e => e.title.toLowerCase().includes(q))
    }
    return [...entries].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
  }

  // Adjust container height to active panel to prevent empty space
  useEffect(() => {
    const idx = DAY_ORDER.indexOf(activeDay)
    const panel = panelRefs.current[idx]
    if (!panel) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.target.scrollHeight)
      }
    })

    observer.observe(panel)
    return () => observer.disconnect()
  }, [activeDay])

  return (
    <AppShell activeTab="schedule">
      {/* Floating Search Island */}
      <div 
        className={`fixed top-[16px] left-1/2 -translate-x-1/2 z-[60] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] w-[320px] md:w-[400px] ${
          showFloatingIsland
            ? 'opacity-100 translate-y-0 scale-100' 
            : 'opacity-0 -translate-y-8 scale-75 pointer-events-none'
        }`}
      >
        <div className="flex gap-2 w-full">
          <div className="flex-1 flex items-center h-[48px] bg-[var(--md-sys-color-surface-container-high)] shadow-md rounded-full px-2 text-[var(--md-sys-color-on-surface)] overflow-hidden border border-white/5">
            <div className="flex items-center justify-center w-10 h-10 text-[var(--md-sys-color-on-surface-variant)] shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search schedule..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-full bg-transparent text-[var(--md-sys-color-on-surface)] text-[15px] outline-none font-medium placeholder:text-[var(--md-sys-color-on-surface-variant)]"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="w-10 h-10 flex items-center justify-center rounded-full text-[var(--md-sys-color-on-surface-variant)] hover:text-white shrink-0 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Header — SeasonalPage-style inline search */}
      <div ref={sentinelRef} className="max-w-7xl mx-auto px-4 md:px-8 pt-6">
        <div className="flex items-center h-12 w-full relative mb-2">
          <button
            onClick={() => {
              if (showSearch) {
                setShowSearch(false)
                setSearchQuery('')
                setDebouncedSearch('')
              } else {
                import('astro:transitions/client').then(({ navigate }) => navigate('/'))
              }
            }}
            className="absolute left-0 flex items-center justify-center w-10 h-10 rounded-full text-[var(--md-sys-color-on-surface)] hover:bg-white/10 transition-colors z-10"
            aria-label={showSearch ? 'Close search' : 'Back to Home'}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>

          <div className="flex-1 pl-12 pr-12 h-full flex items-center justify-start">
            {showSearch ? (
              <input
                type="text"
                autoFocus
                placeholder="Search schedule..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 bg-transparent text-[var(--md-sys-color-on-surface)] text-lg outline-none placeholder:text-white/50"
              />
            ) : (
              <h1 className="text-xl md:text-2xl font-black text-[var(--md-sys-color-on-surface)] tracking-wide">SCHEDULE</h1>
            )}
          </div>

          {!showSearch && (
            <div className="absolute right-0 flex items-center">
              <button
                onClick={() => setShowSearch(true)}
                className="flex items-center justify-center w-10 h-10 rounded-full text-[var(--md-sys-color-on-surface)] hover:bg-white/10 hover:text-[var(--md-sys-color-primary)] transition-colors"
                aria-label="Search Schedule"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Day selector — sticky */}
      <div className="sticky top-0 z-40 bg-[var(--md-sys-color-background)] py-3 px-4 md:px-8 transition-all duration-300 border-b border-white/5">
        <div className="max-w-4xl mx-auto flex justify-between gap-1 md:gap-4">
            {days.map(day => {
              const isActive = day === activeDay
              const isToday = day === today
              return (
                <button
                  key={day}
                  onClick={() => scrollToDay(day)}
                  className="flex flex-col items-center gap-1 flex-1"
                >
                  <span className={`text-xs ${isActive ? 'text-[var(--md-sys-color-primary)]' : 'text-[var(--md-sys-color-on-surface-variant)]'}`}>
                    {dayLabels[day]}
                  </span>
                  <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold
                    ${isActive ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)]' : 'text-[var(--md-sys-color-on-surface-variant)]'}`}>
                    {getDateForDay(day)}
                  </span>
                  {isToday && (
                    <span className="w-1 h-1 rounded-full bg-[var(--md-sys-color-primary)]" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

      {/* Content — swipeable snap panels */}
      <div 
        ref={scrollRef} 
        className="overflow-x-auto overflow-y-hidden snap-x snap-mandatory scrollbar-hide transition-[height] duration-300 ease-out"
        style={{ height: containerHeight === 'auto' ? 'auto' : `${containerHeight}px` }}
      >
        <div className="flex items-start">
          {DAY_ORDER.map((day, idx) => {
            const dayEntries = getContentForDay(day)
            const isLoading = !scheduleMap[day] && scheduleMap[initialDay] !== undefined
            
            // Lazy load: only render active panel and immediate neighbors
            const activeIdx = DAY_ORDER.indexOf(activeDay)
            const isNearActive = Math.abs(idx - activeIdx) <= 1 || 
              (idx === 0 && activeIdx === 6) || 
              (idx === 6 && activeIdx === 0)

            return (
              <div
                key={day}
                ref={el => { panelRefs.current[idx] = el }}
                className="w-full flex-shrink-0 snap-start snap-always relative"
              >
                {/* Dummy target for IntersectionObserver (fixed height to avoid area ratio issues) */}
                <div 
                  ref={el => { observerRefs.current[idx] = el }}
                  data-idx={idx}
                  className="absolute top-0 left-0 w-full h-10 pointer-events-none"
                />

                <div className="max-w-7xl mx-auto px-4 md:px-8 pb-10">
                  {!isNearActive ? (
                    <div className="min-h-[50vh]" />
                  ) : isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
                      <SkeletonTheme baseColor="var(--md-sys-color-surface-container-high)" highlightColor="var(--md-sys-color-surface-variant)">
                        {Array.from({ length: 12 }).map((_, i) => (
                          <div key={i} className="flex items-center gap-3 bg-[var(--md-sys-color-surface-container)] rounded-xl p-3">
                            <Skeleton width={56} height={20} />
                            <Skeleton width={56} height={80} borderRadius={8} />
                            <div className="flex-1 flex flex-col gap-2">
                              <Skeleton width="70%" height={16} />
                              <Skeleton width="40%" height={12} />
                              <Skeleton width="30%" height={12} />
                            </div>
                          </div>
                        ))}
                      </SkeletonTheme>
                    </div>
                  ) : dayEntries.length === 0 ? (
                    <div className="flex justify-center py-20 text-[var(--md-sys-color-on-surface-variant)] text-sm">
                      {debouncedSearch ? 'No schedule found for this search.' : 'No schedule for this day.'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
                      {dayEntries.map(entry => (
                        <ScheduleCard key={entry.anime_id} entry={entry} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </AppShell>
  )
}
