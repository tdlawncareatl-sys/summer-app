'use client'

// Home — intentionally lean. The bottom nav + FAB handle navigation, so the
// home screen is just two focused sections:
//   1. This Week — confirmed plans landing this week + the casual Quick Plan
//   2. Needs your vote — a live "inbox" of every event awaiting my vote

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useName } from '@/lib/useName'
import { categoryFor } from '@/lib/categories'
import { loadPlanData, type EnrichedEvent, type PlanData, formatDateRangeShort, todayISO } from '@/lib/planData'
import { dayWeekday, dayLong, ideaCategoryMeta, weekStartFor, weekDays, type WeeklyPlanSummary } from '@/lib/weeklyPlans'
import { loadWeeklyPlanSummary } from '@/lib/weeklyPlansData'
import PageHeader from './components/PageHeader'
import Card from './components/Card'
import IconTile from './components/IconTile'
import { AvatarStack } from './components/Avatar'
import Icon from './components/Icon'
import StatusChip from './components/StatusChip'

export default function Home() {
  const [name] = useName()
  const [data, setData] = useState<PlanData | null>(null)
  const [week, setWeek] = useState<WeeklyPlanSummary | null>(null)

  useEffect(() => {
    let alive = true
    loadPlanData(name || null).then((next) => {
      if (alive) setData(next)
    })
    loadWeeklyPlanSummary().then((next) => {
      if (alive) setWeek(next)
    })
    return () => {
      alive = false
    }
  }, [name])

  const events = data?.events ?? []
  const today = todayISO()
  const weekEnd = weekDays(weekStartFor(today))[6]

  // Confirmed plans landing this week (today → Sunday), soonest first.
  const thisWeekEvents = [...events]
    .filter(
      (event) =>
        event.displayStatus === 'confirmed' &&
        event.topDate &&
        event.topDate <= weekEnd &&
        (event.topEndDate ?? event.topDate) >= today,
    )
    .sort((a, b) => (a.topDate ?? '').localeCompare(b.topDate ?? ''))

  // Everything awaiting my vote — the home "inbox".
  const needsVote = [...events]
    .filter((event) => event.needsMyVote)
    .sort((a, b) => (a.topDate ?? '9999-12-31').localeCompare(b.topDate ?? '9999-12-31'))

  // Confirmed plans further out than this week — a light horizontal strip.
  const comingUpLater = [...events]
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
            <SectionHeader title="This Week" href="/this-week" linkLabel="Open" />
            {thisWeekEvents.length > 0 && (
              <div className="mb-3 flex flex-col gap-2.5">
                {thisWeekEvents.map((event) => (
                  <ScheduledEventCard key={event.id} event={event} />
                ))}
              </div>
            )}
            <ThisWeekCard week={week} />
          </section>

          <section className="mt-7">
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

function HomeSkeleton() {
  return (
    <div className="mt-4 flex flex-col gap-3 animate-pulse">
      <div className="h-5 w-24 rounded-full bg-cream" />
      <div className="h-28 rounded-[var(--radius-lg)] bg-cream" />
      <div className="mt-4 h-5 w-32 rounded-full bg-cream" />
      <div className="h-20 rounded-[var(--radius-lg)] bg-cream" />
      <div className="h-20 rounded-[var(--radius-lg)] bg-cream" />
    </div>
  )
}

function ScheduledEventCard({ event }: { event: EnrichedEvent }) {
  const category = categoryFor(event.title)
  return (
    <Link href={`/events/${event.id}`}>
      <Card className="flex items-center gap-3">
        <IconTile name={category.iconName} tint={category.tint} size={48} />
        <div className="min-w-0 flex-1">
          <div className="mb-0.5">
            <StatusChip status="confirmed" size="xs" />
          </div>
          <p className="truncate font-semibold text-ink">{event.title}</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {event.topDate ? formatDateRangeShort(event.topDate, event.topEndDate) : 'Date TBD'}
          </p>
        </div>
        <AvatarStack names={event.participantNames} max={4} size={26} />
      </Card>
    </Link>
  )
}

function ThisWeekCard({ week }: { week: WeeklyPlanSummary | null }) {
  if (!week) {
    return (
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <IconTile name="calendar" tint="teal" size={48} rounded="lg" />
          <div className="min-w-0">
            <p className="font-semibold text-ink">No plan going yet</p>
            <p className="mt-0.5 text-xs text-ink-soft">Find the best night for a casual hang.</p>
          </div>
        </div>
        <Link
          href="/this-week?new=1"
          className="w-full rounded-xl bg-olive py-2.5 text-center text-sm font-bold text-white active:scale-[0.98]"
        >
          Start Quick Plan
        </Link>
      </Card>
    )
  }

  const confirmed = week.status === 'confirmed'
  const focusDay = week.confirmedDay ?? week.leadingDay?.day ?? null

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <IconTile name="calendar" tint={confirmed ? 'olive' : 'teal'} size={48} rounded="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{week.title}</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {confirmed && focusDay
              ? `Locked · ${dayLong(focusDay)}`
              : week.leadingDay
                ? `${dayWeekday(week.leadingDay.day)} leading · ${week.availableCount} in`
                : 'No votes yet — be the first'}
          </p>
        </div>
      </div>

      {week.topIdeas.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {week.topIdeas.map((idea) => {
            const meta = ideaCategoryMeta(idea.category)
            return (
              <span
                key={idea.text}
                className="inline-flex items-center gap-1.5 rounded-full bg-sand px-2.5 py-1 text-[11px] font-semibold text-ink-soft"
              >
                {meta ? <Icon name={meta.iconName} size={12} /> : null}
                {idea.text}
              </span>
            )
          })}
        </div>
      ) : null}

      <div className="flex gap-2">
        <Link
          href="/this-week"
          className="flex-1 rounded-xl bg-olive py-2.5 text-center text-sm font-bold text-white active:scale-[0.98]"
        >
          {confirmed ? 'View plan' : 'Vote This Week'}
        </Link>
        <Link
          href="/this-week?new=1"
          className="rounded-xl border border-stone/70 bg-cream px-4 py-2.5 text-center text-sm font-semibold text-ink-soft active:scale-[0.98]"
        >
          New
        </Link>
      </div>
    </Card>
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
