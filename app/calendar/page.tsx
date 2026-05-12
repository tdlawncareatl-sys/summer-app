'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useName } from '@/lib/useName'
import { categoryFor } from '@/lib/categories'
import { eachDay, toLocalISODate } from '@/lib/date'
import { compactEventDetails } from '@/lib/eventDetails'
import { loadPlanData, type EnrichedEvent, type PlanData, formatDateRangeShort, todayISO } from '@/lib/planData'
import { STATUS, type EventStatus } from '@/lib/status'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import StatusChip from '../components/StatusChip'
import IconTile from '../components/IconTile'
import { AvatarStack } from '../components/Avatar'
import Icon from '../components/Icon'

type ViewMode = 'month' | 'week' | 'list'

type DayMeta = {
  counts: Record<EventStatus, number>
}

type PreviewPointer = {
  centerX: number
  containerWidth: number
}

const STATUS_ORDER: EventStatus[] = ['confirmed', 'voting', 'tentative', 'hosting']

export default function CalendarPage() {
  const [name] = useName()
  const [data, setData] = useState<PlanData | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedMonthDate, setSelectedMonthDate] = useState<string | null>(null)
  const [selectedMonthPointer, setSelectedMonthPointer] = useState<PreviewPointer | null>(null)
  const [activeStatuses, setActiveStatuses] = useState<Record<EventStatus, boolean>>({
    confirmed: true,
    voting: true,
    tentative: true,
    hosting: true,
  })
  const [monthCursor, setMonthCursor] = useState(() => {
    const date = new Date()
    return { year: date.getFullYear(), month: date.getMonth() }
  })
  const [weekCursor, setWeekCursor] = useState(() => startOfWeek(new Date()))

  useEffect(() => {
    let alive = true
    loadPlanData(name || null).then((next) => {
      if (alive) setData(next)
    })
    return () => {
      alive = false
    }
  }, [name])

  const filteredEvents = useMemo(() => {
    return (data?.events ?? []).filter((event) => activeStatuses[event.displayStatus])
  }, [data?.events, activeStatuses])

  const upcomingEvents = useMemo(() => {
    return filteredEvents
      .filter((event) => event.topDate && event.topDate >= todayISO())
      .sort((a, b) => (a.topDate ?? '').localeCompare(b.topDate ?? ''))
  }, [filteredEvents])

  const monthDayMap = useMemo<Record<string, DayMeta>>(() => {
    const map: Record<string, DayMeta> = {}
    for (const event of filteredEvents) {
      const seenDays = new Set<string>()
      for (const range of calendarRangesForEvent(event)) {
        for (const day of daysBetween(range.start, range.end)) {
          if (seenDays.has(day)) continue
          seenDays.add(day)
          const entry = map[day] ?? {
            counts: { confirmed: 0, voting: 0, tentative: 0, hosting: 0 },
          }
          entry.counts[event.displayStatus] += 1
          map[day] = entry
        }
      }
    }
    return map
  }, [filteredEvents])

  const monthPreviewEvents = useMemo(() => {
    if (!selectedMonthDate) return []
    return filteredEvents
      .filter((event) => spansDate(event, selectedMonthDate))
      .sort(compareCalendarEvents)
  }, [selectedMonthDate, filteredEvents])

  const weekDays = buildWeek(weekCursor)
  const weekEvents = weekDays.map((date) => ({
    date,
    events: filteredEvents.filter((event) => spansDate(event, date)),
  }))

  function handleMonthDateActivate(date: string, pointer: PreviewPointer) {
    setSelectedMonthDate(date)
    setSelectedMonthPointer(pointer)
  }

  function clearMonthPreview() {
    setSelectedMonthDate(null)
    setSelectedMonthPointer(null)
  }

  return (
    <main className="max-w-md mx-auto px-5">
      <PageHeader
        variant="title"
        title="Calendar"
        subtitle="See what's planned and when."
        action={(
          <div className="flex justify-end">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 rounded-[18px] bg-olive px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition-transform active:scale-[0.98]"
            >
              <Icon name="plus" size={16} />
              New Event
            </Link>
          </div>
        )}
      />

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <ViewTabs value={viewMode} onChange={setViewMode} />
          <button type="button"
            onClick={() => setFiltersOpen((current) => !current)}
            className="inline-flex items-center gap-1.5 rounded-[16px] bg-sand px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-stone"
          >
            Filters
            <Icon name="chevronDown" size={14} className={filtersOpen ? 'rotate-180' : ''} />
          </button>
        </div>

        {filtersOpen ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {STATUS_ORDER.map((status) => (
              <FilterChip
                key={status}
                status={status}
                active={activeStatuses[status]}
                onClick={() => {
                  setActiveStatuses((current) => ({
                    ...current,
                    [status]: !current[status],
                  }))
                }}
              />
            ))}
          </div>
        ) : null}

        {viewMode === 'list' ? (
          <div className="mt-5">
            <h2 className="text-center font-serif text-xl font-black text-ink">Upcoming list</h2>
          </div>
        ) : (
          <div className="mt-5 flex items-center justify-between gap-3">
            <button type="button"
              onClick={() => {
                if (viewMode === 'month') {
                  setMonthCursor((current) => shiftMonth(current, -1))
                  clearMonthPreview()
                }
                if (viewMode === 'week') setWeekCursor((current) => shiftWeek(current, -7))
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[16px] bg-sand text-ink-soft transition-colors hover:bg-stone"
              aria-label={viewMode === 'month' ? 'Previous month' : 'Previous week'}
            >
              <Icon name="chevronLeft" size={18} />
            </button>
            <h2 className="font-serif text-xl font-black text-ink">
              {viewMode === 'month' ? formatMonthLabel(monthCursor) : formatWeekLabel(weekCursor)}
            </h2>
            <button type="button"
              onClick={() => {
                if (viewMode === 'month') {
                  setMonthCursor((current) => shiftMonth(current, 1))
                  clearMonthPreview()
                }
                if (viewMode === 'week') setWeekCursor((current) => shiftWeek(current, 7))
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[16px] bg-sand text-ink-soft transition-colors hover:bg-stone"
              aria-label={viewMode === 'month' ? 'Next month' : 'Next week'}
            >
              <Icon name="chevronRight" size={18} />
            </button>
          </div>
        )}

        {viewMode === 'month' ? (
          <p className="mt-4 text-xs text-ink-soft">
            Hover a day on desktop or tap a day on mobile to preview what lives on that date.
          </p>
        ) : null}

        <div className="mt-4">
          {viewMode === 'month' ? (
            <MonthView
              year={monthCursor.year}
              month={monthCursor.month}
              dayMap={monthDayMap}
              activeDate={selectedMonthDate}
              onActivateDate={handleMonthDateActivate}
            />
          ) : viewMode === 'week' ? (
            <WeekView days={weekEvents} />
          ) : (
            <ListView events={upcomingEvents.slice(0, 8)} />
          )}
        </div>

        {viewMode === 'month' && selectedMonthDate && selectedMonthPointer ? (
          <MonthDayPreview
            date={selectedMonthDate}
            events={monthPreviewEvents}
            pointer={selectedMonthPointer}
          />
        ) : null}

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-ink-soft">
          <LegendDot status="confirmed" label="Confirmed" />
          <LegendDot status="voting" label="Needs Votes" />
          <LegendDot status="tentative" label="Tentative" />
          <LegendDot status="hosting" label="Hosting" />
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full ring-1 ring-olive bg-cream" />
            Today
          </span>
        </div>
      </Card>

      <section className="mt-7">
        <SectionHeader title="Upcoming Events" href="/events" linkLabel="See all" />
        {upcomingEvents.length === 0 ? (
          <Card className="py-6">
            <p className="text-sm text-ink-soft">
              No filtered events match right now. Try a different filter or create a new event.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {upcomingEvents.slice(0, 4).map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-7 mb-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-sans text-[18px] font-bold tracking-tight text-ink">This Week</h2>
          <button type="button"
            onClick={() => setViewMode('week')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-olive"
          >
            See week view
            <Icon name="chevronRight" size={14} />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hidden -mx-5 px-5 pb-1">
          {buildWeek(startOfWeek(new Date())).map((date) => {
            const dayEvents = filteredEvents.filter((event) => spansDate(event, date))
            return (
              <WeekStripCard key={date} date={date} event={dayEvents[0]} />
            )
          })}
        </div>
      </section>
    </main>
  )
}

function ViewTabs({
  value,
  onChange,
}: {
  value: ViewMode
  onChange: (view: ViewMode) => void
}) {
  return (
    <div className="inline-flex rounded-[18px] border border-stone/70 bg-sand p-1">
      {(['month', 'week', 'list'] as ViewMode[]).map((view) => (
        <button type="button"
          key={view}
          onClick={() => onChange(view)}
          className={[
            'rounded-[14px] px-3.5 py-1.5 text-sm font-semibold transition-colors',
            value === view ? 'bg-cream text-ink shadow-[var(--shadow-soft)]' : 'text-ink-soft',
          ].join(' ')}
        >
          {view.charAt(0).toUpperCase() + view.slice(1)}
        </button>
      ))}
    </div>
  )
}

function FilterChip({
  status,
  active,
  onClick,
}: {
  status: EventStatus
  active: boolean
  onClick: () => void
}) {
  const token = STATUS[status]
  return (
    <button type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-2 rounded-[14px] px-3 py-2 text-sm font-semibold transition-colors',
        active ? `${token.tint} ${token.text}` : 'bg-sand text-ink-soft',
      ].join(' ')}
    >
      <span className={`h-2 w-2 rounded-full ${token.dot}`} />
      {token.label}
    </button>
  )
}

function MonthView({
  year,
  month,
  dayMap,
  activeDate,
  onActivateDate,
}: {
  year: number
  month: number
  dayMap: Record<string, DayMeta>
  activeDate: string | null
  onActivateDate: (date: string, pointer: PreviewPointer) => void
}) {
  const today = todayISO()
  const first = new Date(year, month, 1)
  const firstGridDay = new Date(first)
  firstGridDay.setDate(first.getDate() - first.getDay())
  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstGridDay)
    date.setDate(firstGridDay.getDate() + index)
    const iso = toLocalISODate(date)
    return {
      iso,
      day: date.getDate(),
      currentMonth: date.getMonth() === month,
      meta: dayMap[iso],
    }
  })

  function pointerForCell(target: HTMLButtonElement): PreviewPointer {
    const buttonRect = target.getBoundingClientRect()
    const parentRect = target.parentElement?.getBoundingClientRect()
    const containerWidth = parentRect?.width ?? buttonRect.width
    return {
      centerX: buttonRect.left - (parentRect?.left ?? buttonRect.left) + (buttonRect.width / 2),
      containerWidth,
    }
  }

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const primary = dominantStatus(cell.meta)
          const extraStatuses = cell.meta ? STATUS_ORDER.filter((status) => cell.meta.counts[status] > 0 && status !== primary) : []
          const isToday = cell.iso === today
          const isActive = cell.iso === activeDate
          const eventCount = totalEventCount(cell.meta)
          return (
            <button
              type="button"
              key={cell.iso}
              onClick={(event) => onActivateDate(cell.iso, pointerForCell(event.currentTarget))}
              onMouseEnter={(event) => onActivateDate(cell.iso, pointerForCell(event.currentTarget))}
              onFocus={(event) => onActivateDate(cell.iso, pointerForCell(event.currentTarget))}
              className={[
                'aspect-square rounded-[18px] px-1.5 py-1.5 text-left transition-colors',
                isActive ? 'bg-cream ring-1 ring-olive/30 shadow-[var(--shadow-soft)]' : cell.currentMonth ? 'bg-sand-alt hover:bg-stone/70' : 'bg-sand/70 hover:bg-stone/70',
              ].join(' ')}
              aria-label={dayAriaLabel(cell.iso, eventCount)}
              aria-pressed={isActive}
            >
              <div className="flex h-full flex-col items-center justify-between">
                <span
                  className={[
                    'inline-flex h-8 w-8 items-center justify-center rounded-[14px] text-sm font-semibold',
                    primary ? `${STATUS[primary].tint} ${STATUS[primary].text}` : '',
                    !cell.currentMonth ? 'text-ink-mute' : primary ? '' : 'text-ink',
                    isToday ? 'ring-1 ring-olive' : '',
                    isActive ? 'shadow-[var(--shadow-soft)]' : '',
                  ].join(' ')}
                >
                  {cell.day}
                </span>
                <div className="flex items-center gap-1 pb-0.5">
                  {primary ? <span className={`h-1.5 w-1.5 rounded-full ${STATUS[primary].dot}`} /> : null}
                  {extraStatuses.slice(0, 2).map((status) => (
                    <span key={status} className={`h-1.5 w-1.5 rounded-full ${STATUS[status].dot}`} />
                  ))}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MonthDayPreview({
  date,
  events,
  pointer,
}: {
  date: string
  events: EnrichedEvent[]
  pointer: PreviewPointer
}) {
  const pointerLeft = previewPointerLeft(pointer)
  return (
    <div className="relative mt-4">
      <span
        aria-hidden="true"
        className="absolute -top-2 h-4 w-4 rotate-45 border-l border-t border-stone/70 bg-cream"
        style={{ left: pointerLeft - 8 }}
      />
      <div className="rounded-[18px] border border-stone/70 bg-cream p-4 shadow-[var(--shadow-raised)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
            Date Preview
          </p>
          <h3 className="mt-1 font-serif text-lg font-black text-ink">
            {formatPreviewDate(date)}
          </h3>
        </div>
        <p className="text-xs font-medium text-ink-soft">
          {events.length === 0 ? 'No plans yet' : `${events.length} event${events.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {events.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">
          Nothing is holding this date right now. Try another day to see confirmed plans or tentative events that still need votes.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2.5">
          {events.map((event) => (
            <MonthDayEventLink key={event.id} event={event} previewDate={date} />
          ))}
        </div>
      )}
      </div>
    </div>
  )
}

function MonthDayEventLink({
  event,
  previewDate,
}: {
  event: EnrichedEvent
  previewDate: string
}) {
  const category = categoryFor(event.title)
  const secondary = eventSecondarySummary(event)
  return (
    <Link
      href={`/events/${event.id}`}
      className="block rounded-[16px] border border-stone/70 bg-cream px-3 py-3 transition-colors hover:bg-sand"
    >
      <div className="flex items-start gap-3">
        <IconTile name={category.iconName} tint={category.tint} size={46} rounded="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{event.title}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
                <Icon name="calendar" size={12} />
                <span>{calendarPreviewLabelForDate(event, previewDate)}</span>
              </p>
            </div>
            <StatusChip status={event.displayStatus} size="xs" />
          </div>

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-mute">
            {secondary ? (
              <span className="inline-flex items-center gap-1.5">
                <Icon name={event.displayStatus === 'confirmed' ? 'mapPin' : 'info'} size={12} />
                <span>{secondary}</span>
              </span>
            ) : null}
            {event.displayStatus !== 'confirmed' ? (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="users" size={12} />
                <span>{event.participantNames.length} in the loop</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  )
}

function WeekView({
  days,
}: {
  days: { date: string; events: EnrichedEvent[] }[]
}) {
  return (
    <div className="overflow-x-auto scrollbar-hidden">
      <div className="grid min-w-[560px] grid-cols-7 gap-2">
        {days.map(({ date, events }) => (
          <Card key={date} className="p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">
              {formatWeekday(date)}
            </p>
            <p className="mt-1 text-lg font-bold text-ink">{formatDayNumber(date)}</p>
            <div className="mt-3 flex flex-col gap-2">
              {events.length === 0 ? (
                <p className="text-xs text-ink-mute">No events</p>
              ) : (
                events.slice(0, 2).map((event) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className={`rounded-[14px] px-2.5 py-2 text-xs font-medium ${STATUS[event.displayStatus].tint} ${STATUS[event.displayStatus].text}`}
                  >
                    <p className="line-clamp-2">{event.title}</p>
                  </Link>
                ))
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function ListView({ events }: { events: EnrichedEvent[] }) {
  if (events.length === 0) {
    return (
      <Card className="py-6">
        <p className="text-sm text-ink-soft">Nothing upcoming with the current filters.</p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {events.map((event) => (
        <EventRow key={event.id} event={event} />
      ))}
    </div>
  )
}

function EventRow({ event }: { event: EnrichedEvent }) {
  const category = categoryFor(event.title)
  return (
    <Link href={`/events/${event.id}`}>
      <Card className="overflow-hidden p-0">
        <div className="flex">
          <span className={`w-1.5 shrink-0 ${STATUS[event.displayStatus].dot}`} />
          <div className="flex flex-1 items-center gap-3 px-3 py-3">
            <IconTile name={category.iconName} tint={category.tint} size={50} rounded="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-ink">{event.title}</p>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
                <Icon name="calendar" size={12} />
                <span>{event.topDate ? formatDateRangeShort(event.topDate, event.topEndDate) : 'Date TBD'}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-mute">
                <Icon name="users" size={12} />
                <span>{event.participantNames.length} people in the loop</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusChip status={event.displayStatus} size="xs" />
              <AvatarStack names={event.participantNames} max={4} size={24} />
            </div>
          </div>
        </div>
      </Card>
    </Link>
  )
}

function WeekStripCard({
  date,
  event,
}: {
  date: string
  event?: EnrichedEvent
}) {
  return (
    <Card className="min-w-[104px] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">
        {formatWeekday(date)}
      </p>
      <p className="mt-1 text-lg font-bold text-ink">{formatDayNumber(date)}</p>
      <div className="mt-3">
        {event ? (
          <>
            <div className={`inline-flex h-2.5 w-2.5 rounded-full ${STATUS[event.displayStatus].dot}`} />
            <p className="mt-2 text-sm font-semibold leading-tight text-ink line-clamp-2">{event.title}</p>
            <p className="mt-1 text-[11px] text-ink-soft">{labelForWeekCard(event)}</p>
          </>
        ) : (
          <p className="mt-6 text-xs text-ink-mute">No events</p>
        )}
      </div>
    </Card>
  )
}

function SectionHeader({
  title,
  href,
  linkLabel,
}: {
  title: string
  href: string
  linkLabel: string
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-sans text-[18px] font-bold tracking-tight text-ink">{title}</h2>
      <Link href={href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-olive">
        {linkLabel}
        <Icon name="chevronRight" size={14} />
      </Link>
    </div>
  )
}

function LegendDot({
  status,
  label,
}: {
  status: EventStatus
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${STATUS[status].dot}`} />
      {label}
    </span>
  )
}

function dominantStatus(meta?: DayMeta) {
  if (!meta) return null
  return STATUS_ORDER.find((status) => meta.counts[status] > 0) ?? null
}

function totalEventCount(meta?: DayMeta) {
  if (!meta) return 0
  return STATUS_ORDER.reduce((sum, status) => sum + meta.counts[status], 0)
}

function calendarRangesForEvent(event: EnrichedEvent) {
  if (event.displayStatus === 'confirmed') {
    return event.topDate ? [{ start: event.topDate, end: event.topEndDate }] : []
  }
  if (event.dateOptions.length > 0) {
    return event.dateOptions.map((option) => ({
      start: option.date,
      end: option.end_date ?? null,
    }))
  }
  return event.topDate ? [{ start: event.topDate, end: event.topEndDate }] : []
}

function matchingCalendarRange(event: EnrichedEvent, date: string) {
  return calendarRangesForEvent(event).find((range) => daysBetween(range.start, range.end).includes(date)) ?? null
}

function daysBetween(start: string, end: string | null | undefined) {
  return eachDay(start, end)
}

function spansDate(event: EnrichedEvent, date: string) {
  return calendarRangesForEvent(event).some((range) => daysBetween(range.start, range.end).includes(date))
}

function formatMonthLabel(cursor: { year: number; month: number }) {
  return new Date(cursor.year, cursor.month, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

function formatWeekLabel(date: Date) {
  const start = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endDate = new Date(date)
  endDate.setDate(date.getDate() + 6)
  const end = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${start} – ${end}`
}

function formatWeekday(date: string) {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })
}

function formatDayNumber(date: string) {
  return new Date(date + 'T12:00:00').getDate()
}

function formatPreviewDate(date: string) {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function compareCalendarEvents(a: EnrichedEvent, b: EnrichedEvent) {
  const statusDelta = STATUS_ORDER.indexOf(a.displayStatus) - STATUS_ORDER.indexOf(b.displayStatus)
  if (statusDelta !== 0) return statusDelta
  const dateDelta = (a.topDate ?? '').localeCompare(b.topDate ?? '')
  if (dateDelta !== 0) return dateDelta
  return a.title.localeCompare(b.title)
}

function eventSecondarySummary(event: EnrichedEvent) {
  if (event.displayStatus === 'confirmed') {
    return compactEventDetails(event) ?? 'Confirmed and ready'
  }
  if (event.displayStatus === 'voting') {
    return `${event.voteCount} vote${event.voteCount === 1 ? '' : 's'} · ${event.dateOptions.length} option${event.dateOptions.length === 1 ? '' : 's'}`
  }
  if (event.displayStatus === 'hosting') {
    return event.dateOptions.length > 0 ? 'Waiting on the crew to vote' : 'Add some dates to get this moving'
  }
  return event.dateOptions.length > 0 ? 'Tentative plan that still needs votes' : 'Tentative plan'
}

function calendarPreviewLabelForDate(event: EnrichedEvent, previewDate: string) {
  const matchingRange = matchingCalendarRange(event, previewDate)
  if (matchingRange) {
    return formatDateRangeShort(matchingRange.start, matchingRange.end)
  }
  return event.topDate ? formatDateRangeShort(event.topDate, event.topEndDate) : 'Date TBD'
}

function dayAriaLabel(date: string, eventCount: number) {
  const label = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  if (eventCount === 0) return `${label}. No events.`
  return `${label}. ${eventCount} event${eventCount === 1 ? '' : 's'}.`
}

function previewPointerLeft(pointer: PreviewPointer) {
  return Math.max(18, Math.min(pointer.centerX, pointer.containerWidth - 18))
}

function startOfWeek(date: Date) {
  const next = new Date(date)
  next.setHours(12, 0, 0, 0)
  next.setDate(next.getDate() - next.getDay())
  return next
}

function shiftWeek(date: Date, deltaDays: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + deltaDays)
  return next
}

function buildWeek(start: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return toLocalISODate(date)
  })
}

function shiftMonth(cursor: { year: number; month: number }, delta: number) {
  const next = new Date(cursor.year, cursor.month + delta, 1)
  return { year: next.getFullYear(), month: next.getMonth() }
}

function labelForWeekCard(event: EnrichedEvent) {
  if (event.displayStatus === 'voting') {
    return `${event.voteCount} votes`
  }
  if (event.displayStatus === 'hosting') {
    return event.dateOptions.length > 0 ? 'Needs votes' : 'Add dates'
  }
  return event.topDate ? formatDateRangeShort(event.topDate, event.topEndDate) : 'Date TBD'
}
