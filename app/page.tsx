'use client'

// Home — three sections, no casual "This Week" voting card (that's been pulled
// off home while it's refined; it still lives on the + menu):
//   1. This Week — any event with a date (confirmed OR a proposed option still
//      being voted on) landing this calendar week
//   2. Needs your vote — votable events whose dates are NOT this week (the
//      in-week ones already show above, with a Vote button)
//   3. Coming up later — confirmed plans beyond this week

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useName } from '@/lib/useName'
import { categoryFor } from '@/lib/categories'
import { loadPlanData, type EnrichedEvent, type PlanData, formatDateRangeShort, todayISO } from '@/lib/planData'
import { weekStartFor, weekDays } from '@/lib/weeklyPlans'
import PageHeader from './components/PageHeader'
import Card from './components/Card'
import IconTile from './components/IconTile'
import Icon from './components/Icon'
import StatusChip from './components/StatusChip'

export default function Home() {
  const [name] = useName()
  const [data, setData] = useState<PlanData | null>(null)

  useEffect(() => {
    let alive = true
    loadPlanData(name || null).then((next) => {
      if (alive) setData(next)
    })
    return () => {
      alive = false
    }
  }, [name])

  const events = data?.events ?? []
  const today = todayISO()
  const weekEnd = weekDays(weekStartFor(today))[6]

  // Anything with a date — confirmed or a proposed option — landing this week.
  const weekAhead = events
    .map((event) => ({ event, date: earliestInWeekDate(event, today, weekEnd) }))
    .filter((entry): entry is { event: EnrichedEvent; date: string } => entry.date !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
  const weekAheadIds = new Set(weekAhead.map((entry) => entry.event.id))

  // Votable events that aren't already surfaced in This Week above.
  const needsVote = events
    .filter((event) => event.needsMyVote && !weekAheadIds.has(event.id))
    .sort((a, b) => (a.topDate ?? '9999-12-31').localeCompare(b.topDate ?? '9999-12-31'))

  // Confirmed plans further out than this week.
  const comingUpLater = events
    .filter((event) => event.displayStatus === 'confirmed' && event.topDate && event.topDate > weekEnd)
    .sort((a, b) => (a.topDate ?? '').localeCompare(b.topDate ?? ''))

  return (
    <main className="max-w-md mx-auto px-5">
      <PageHeader variant="greeting" />

      {!data ? (
        <HomeSkeleton />
      ) : (
        <>
          <section>
            <SectionHeader title="This Week" href="/events" linkLabel="See all" />
            {weekAhead.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {weekAhead.map(({ event, date }) => (
                  <WeekAheadCard key={event.id} event={event} date={date} />
                ))}
              </div>
            ) : (
              <Card className="py-6 text-center">
                <p className="text-sm font-semibold text-ink">Nothing on the calendar this week yet</p>
                <p className="mt-1 text-sm text-ink-soft">
                  Propose dates in <Link href="/events" className="font-semibold text-olive">Events</Link> to get one going.
                </p>
              </Card>
            )}
          </section>

          {needsVote.length > 0 && (
            <section className="mt-7">
              <SectionHeader title="Needs your vote" href="/events" linkLabel="See all" />
              <div className="flex flex-col gap-2.5">
                {needsVote.map((event) => (
                  <NeedsVoteCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}

          {comingUpLater.length > 0 && (
            <section className="mt-7 mb-4">
              <SectionHeader title="Coming up later" href="/calendar" linkLabel="Calendar" />
              <div className="flex gap-3 overflow-x-auto scrollbar-hidden -mx-5 px-5 pb-1">
                {comingUpLater.map((event) => (
                  <ComingUpLaterCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}

// Earliest date this event has landing within [today, weekEnd] — the confirmed
// date if confirmed, otherwise any proposed option still up for a vote. Returns
// null when the event has no date touching this week.
function earliestInWeekDate(event: EnrichedEvent, today: string, weekEnd: string): string | null {
  let best: string | null = null
  const consider = (start?: string | null, end?: string | null) => {
    if (!start) return
    const last = end ?? start
    if (start <= weekEnd && last >= today && (best === null || start < best)) best = start
  }
  if (event.displayStatus === 'confirmed') {
    consider(event.topDate, event.topEndDate)
  } else {
    for (const option of event.dateOptions) consider(option.date, option.end_date ?? null)
  }
  return best
}

function HomeSkeleton() {
  return (
    <div className="mt-4 flex flex-col gap-3 animate-pulse">
      <div className="h-5 w-24 rounded-full bg-cream" />
      <div className="h-20 rounded-[var(--radius-lg)] bg-cream" />
      <div className="h-20 rounded-[var(--radius-lg)] bg-cream" />
      <div className="mt-4 h-5 w-28 rounded-full bg-cream" />
      <div className="h-28 rounded-[var(--radius-lg)] bg-cream" />
    </div>
  )
}

function WeekAheadCard({ event, date }: { event: EnrichedEvent; date: string }) {
  const category = categoryFor(event.title)
  // Show the full range only for confirmed events; voting options show their day.
  const endDate = event.displayStatus === 'confirmed' ? event.topEndDate : null
  return (
    <Link href={`/events/${event.id}`}>
      <Card className="flex items-center gap-3">
        <IconTile name={category.iconName} tint={category.tint} size={48} />
        <div className="min-w-0 flex-1">
          <div className="mb-0.5">
            <StatusChip status={event.displayStatus} size="xs" />
          </div>
          <p className="truncate font-semibold text-ink">{event.title}</p>
          <p className="mt-0.5 text-xs text-ink-soft">{formatDateRangeShort(date, endDate)}</p>
        </div>
        {event.needsMyVote ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-terracotta px-3 py-1.5 text-xs font-bold text-white">
            Vote
            <Icon name="arrowRight" size={13} />
          </span>
        ) : (
          <Icon name="chevronRight" size={18} className="text-ink-faint" />
        )}
      </Card>
    </Link>
  )
}

function NeedsVoteCard({ event }: { event: EnrichedEvent }) {
  const category = categoryFor(event.title)
  return (
    <Link href={`/events/${event.id}`}>
      <Card className="flex items-center gap-3">
        <IconTile name={category.iconName} tint={category.tint} size={48} />
        <div className="min-w-0 flex-1">
          <div className="mb-0.5">
            <StatusChip status="voting" size="xs" />
          </div>
          <p className="truncate font-semibold text-ink">{event.title}</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {event.voteCount > 0
              ? `${event.dateOptions.length} date${event.dateOptions.length !== 1 ? 's' : ''} · ${event.voteCount} vote${event.voteCount !== 1 ? 's' : ''} so far`
              : 'Be the first to vote'}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-terracotta px-3 py-1.5 text-xs font-bold text-white">
          Vote
          <Icon name="arrowRight" size={13} />
        </span>
      </Card>
    </Link>
  )
}

function ComingUpLaterCard({ event }: { event: EnrichedEvent }) {
  const category = categoryFor(event.title)
  return (
    <Link href={`/events/${event.id}`} className="min-w-[158px] max-w-[158px] shrink-0">
      <Card className="h-full p-3.5">
        <IconTile name={category.iconName} tint={category.tint} size={44} rounded="full" />
        <p className="mt-3 truncate text-sm font-bold text-ink">{event.title}</p>
        <p className="mt-1 text-xs text-ink-soft">
          {event.topDate ? formatDateRangeShort(event.topDate, event.topEndDate) : 'Date TBD'}
        </p>
      </Card>
    </Link>
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
