'use client'

// Home — lean. The bottom nav + FAB handle navigation. Two sections:
//   1. Needs your vote — a live "inbox" of every event awaiting my vote
//   2. Upcoming — a strip of confirmed plans (this week and beyond)
//
// The casual "This Week" planner is intentionally NOT featured here for now —
// it's still reachable from the + menu ("Plan this week").

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useName } from '@/lib/useName'
import { categoryFor } from '@/lib/categories'
import { loadPlanData, type EnrichedEvent, type PlanData, formatDateRangeShort, todayISO } from '@/lib/planData'
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

  // Everything awaiting my vote — the home "inbox".
  const needsVote = [...events]
    .filter((event) => event.needsMyVote)
    .sort((a, b) => (a.topDate ?? '9999-12-31').localeCompare(b.topDate ?? '9999-12-31'))

  // Confirmed plans from today onward (this week + later), soonest first.
  const upcoming = [...events]
    .filter(
      (event) =>
        event.displayStatus === 'confirmed' && event.topDate && (event.topEndDate ?? event.topDate) >= today,
    )
    .sort((a, b) => (a.topDate ?? '').localeCompare(b.topDate ?? ''))

  return (
    <main className="max-w-md mx-auto px-5">
      <PageHeader variant="greeting" />

      {!data ? (
        <HomeSkeleton />
      ) : (
        <>
          <section>
            <SectionHeader title="Needs your vote" href="/events" linkLabel="See all" />
            {needsVote.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {needsVote.map((event) => (
                  <NeedsVoteCard key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <Card className="py-6 text-center">
                <p className="text-sm font-semibold text-ink">You&apos;re all caught up</p>
                <p className="mt-1 text-sm text-ink-soft">No events need your vote right now.</p>
              </Card>
            )}
          </section>

          {upcoming.length > 0 && (
            <section className="mt-7 mb-4">
              <SectionHeader title="Upcoming" href="/calendar" linkLabel="Calendar" />
              <div className="flex gap-3 overflow-x-auto scrollbar-hidden -mx-5 px-5 pb-1">
                {upcoming.map((event) => (
                  <UpcomingCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}

function HomeSkeleton() {
  return (
    <div className="mt-4 flex flex-col gap-3 animate-pulse">
      <div className="h-5 w-32 rounded-full bg-cream" />
      <div className="h-20 rounded-[var(--radius-lg)] bg-cream" />
      <div className="h-20 rounded-[var(--radius-lg)] bg-cream" />
      <div className="mt-4 h-5 w-24 rounded-full bg-cream" />
      <div className="h-28 rounded-[var(--radius-lg)] bg-cream" />
    </div>
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

function UpcomingCard({ event }: { event: EnrichedEvent }) {
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
