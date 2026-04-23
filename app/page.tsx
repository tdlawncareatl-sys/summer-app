'use client'

// Home — the "what's happening this summer" snapshot.
//  1. Greeting header
//  2. Four-tile summary (Confirmed / Voting / Ideas / My next)
//  3. Up Next — the featured confirmed or top-voting event
//  4. Votes in Progress — what needs my attention
//  5. New Ideas strip — recent ideas the group tossed out
//  6. Availability Snapshot — how many friends free / blocked this week
//
// Everything flows from loadPlanData() so the numbers always agree.

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useName } from '@/lib/useName'
import { loadPlanData, PlanData, formatDateRangeShort, todayISO } from '@/lib/planData'
import { categoryFor } from '@/lib/categories'
import PageHeader from './components/PageHeader'
import Card from './components/Card'
import StatusChip from './components/StatusChip'
import IconTile from './components/IconTile'
import SummaryTile from './components/SummaryTile'
import { AvatarStack } from './components/Avatar'
import {
  CalendarIcon,
  LightbulbIcon,
  StarIcon,
  UsersIcon,
  ArrowRightIcon,
  ChevronRightIcon,
} from './components/icons'

export default function Home() {
  const [name] = useName()
  const [data, setData] = useState<PlanData | null>(null)

  useEffect(() => {
    let alive = true
    loadPlanData(name || null).then((d) => { if (alive) setData(d) })
    return () => { alive = false }
  }, [name])

  const confirmedEvents = data?.events.filter((e) => e.displayStatus === 'confirmed') ?? []
  const votingEvents    = data?.events.filter((e) => e.displayStatus === 'voting') ?? []
  const ideas           = data?.ideas ?? []

  // Featured "Up Next" — soonest confirmed, else the one with most votes in progress.
  const featured =
    [...confirmedEvents]
      .filter((e) => e.topDate && e.topDate >= todayISO())
      .sort((a, b) => (a.topDate ?? '').localeCompare(b.topDate ?? ''))[0]
    ??
    [...votingEvents].sort((a, b) => b.voteCount - a.voteCount)[0]
    ??
    data?.events[0]

  return (
    <main className="max-w-md mx-auto px-5">
      <PageHeader variant="greeting" />

      {/* 4-up summary */}
      <section className="grid grid-cols-2 gap-3">
        <SummaryTile
          Icon={CalendarIcon}
          tint="olive"
          title={`${confirmedEvents.length} confirmed`}
          description="plans locked in"
          href="/calendar"
        />
        <SummaryTile
          Icon={StarIcon}
          tint="terracotta"
          title={`${votingEvents.length} voting`}
          description="need your input"
          href="/events"
        />
        <SummaryTile
          Icon={LightbulbIcon}
          tint="amber"
          title={`${ideas.length} ideas`}
          description="in the hopper"
          href="/ideas"
        />
        <SummaryTile
          Icon={UsersIcon}
          tint="teal"
          title={`${data?.totalFriends ?? 12} friends`}
          description="in the crew"
          href="/me"
        />
      </section>

      {/* Up Next */}
      {data && featured && (
        <section className="mt-6">
          <SectionHeader title="Up next" href="/calendar" linkLabel="View all" />
          <FeaturedEventCard event={featured} />
        </section>
      )}

      {/* Votes in progress */}
      {data && votingEvents.length > 0 && (
        <section className="mt-6">
          <SectionHeader title="Votes in progress" href="/events" linkLabel={`${votingEvents.length} open`} />
          <div className="flex flex-col gap-2.5">
            {votingEvents.slice(0, 3).map((ev) => {
              const cat = categoryFor(ev.title)
              return (
                <Link key={ev.id} href={`/events/${ev.id}`}>
                  <Card className="flex items-center gap-3">
                    <IconTile Icon={cat.Icon} tint={cat.tint} size={44} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink truncate">{ev.title}</p>
                      <p className="text-xs text-ink-soft mt-0.5 truncate">
                        {ev.dateOptions.length} options · {ev.voteCount} votes
                      </p>
                    </div>
                    <StatusChip status="voting" size="xs" />
                    <ChevronRightIcon size={18} className="text-ink-faint" />
                  </Card>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Ideas strip */}
      {data && ideas.length > 0 && (
        <section className="mt-6">
          <SectionHeader title="Fresh ideas" href="/ideas" linkLabel="See all" />
          <div className="flex gap-3 overflow-x-auto scrollbar-hidden -mx-5 px-5 pb-1">
            {ideas.slice(0, 6).map((idea) => {
              const cat = categoryFor(idea.title)
              return (
                <Link
                  key={idea.id}
                  href="/ideas"
                  className="min-w-[180px] max-w-[180px] shrink-0"
                >
                  <Card className="h-full flex flex-col gap-2">
                    <IconTile Icon={cat.Icon} tint={cat.tint} size={40} />
                    <p className="font-semibold text-ink text-sm leading-snug line-clamp-2">
                      {idea.title}
                    </p>
                    <div className="mt-auto flex items-center gap-1.5 text-xs text-ink-soft">
                      <StarIcon size={12} />
                      <span>{idea.likes}</span>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Availability snapshot */}
      {data && (
        <section className="mt-6 mb-4">
          <SectionHeader title="Who's around" href="/availability" linkLabel="Edit yours" />
          <AvailabilitySnapshot data={data} />
        </section>
      )}

      {/* Skeleton for first paint */}
      {!data && (
        <div className="mt-6 flex flex-col gap-3 animate-pulse">
          <div className="h-32 bg-cream rounded-[var(--radius-lg)]" />
          <div className="h-24 bg-cream rounded-[var(--radius-lg)]" />
          <div className="h-24 bg-cream rounded-[var(--radius-lg)]" />
        </div>
      )}
    </main>
  )
}

/* ─────────────────────────────────────────────────────────────── */

function SectionHeader({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <h2 className="font-serif text-2xl font-black text-ink tracking-tight">{title}</h2>
      {href && linkLabel && (
        <Link href={href} className="text-xs font-semibold text-olive flex items-center gap-1">
          {linkLabel}
          <ArrowRightIcon size={12} />
        </Link>
      )}
    </div>
  )
}

function FeaturedEventCard({ event }: { event: PlanData['events'][number] }) {
  const cat = categoryFor(event.title)
  const when = event.topDate ? formatDateRangeShort(event.topDate, event.topEndDate) : 'Date TBD'
  return (
    <Link href={`/events/${event.id}`}>
      <Card className="relative overflow-hidden" padded={false}>
        <div className="p-5 flex gap-4">
          <IconTile Icon={cat.Icon} tint={cat.tint} size={56} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StatusChip status={event.displayStatus} size="xs" />
            </div>
            <h3 className="font-serif text-[22px] font-black text-ink leading-tight truncate">
              {event.title}
            </h3>
            <p className="text-sm text-ink-soft mt-0.5">{when}</p>
          </div>
        </div>
        <div className="px-5 pb-4 pt-1 flex items-center justify-between">
          <AvatarStack names={event.participantNames} max={5} size={26} />
          <span className="text-xs font-medium text-ink-soft">
            {event.participantNames.length} likely in
          </span>
        </div>
      </Card>
    </Link>
  )
}

function AvailabilitySnapshot({ data }: { data: PlanData }) {
  // Count: next 7 days, how many friends are blocked on at least one day.
  const today = new Date()
  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    days.push(d.toISOString().split('T')[0])
  }
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex justify-between gap-1.5">
        {days.map((d) => {
          const blocked = data.blackoutsByDate[d]?.length ?? 0
          const free = Math.max(0, data.totalFriends - blocked)
          const pct = data.totalFriends ? free / data.totalFriends : 1
          const dayOfWeek = new Date(d + 'T12:00:00').getDay()
          const label = dayLabels[dayOfWeek]
          const dayNum = new Date(d + 'T12:00:00').getDate()
          const tintClass =
            pct >= 0.75 ? 'bg-olive-soft text-olive' :
            pct >= 0.5  ? 'bg-amber-soft text-amber' :
                          'bg-blush-soft text-blush'
          return (
            <div key={d} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-semibold text-ink-mute">{label}</span>
              <span className={`w-9 h-9 rounded-full text-xs font-bold flex items-center justify-center ${tintClass}`}>
                {dayNum}
              </span>
              <span className="text-[10px] text-ink-soft">{free}</span>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-ink-soft text-center">
        Circles show how many friends are free each day this week.
      </p>
    </Card>
  )
}
