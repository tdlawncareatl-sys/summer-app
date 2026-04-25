'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useName } from '@/lib/useName'
import { categoryFor, type CategoryTint } from '@/lib/categories'
import { compactEventDetails } from '@/lib/eventDetails'
import { loadPlanData, type EnrichedEvent, type PlanData, formatDateRangeShort, todayISO } from '@/lib/planData'
import PageHeader from './components/PageHeader'
import Card from './components/Card'
import IconTile from './components/IconTile'
import { AvatarStack } from './components/Avatar'
import {
  type AppIconName,
  ArrowRightIcon,
  ChevronRightIcon,
  UsersIcon,
} from './components/icons'

type FeatureCard = {
  href: string
  title: string
  description: string
  tint: CategoryTint
  icon: AppIconName
}

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
  const ideas = data?.ideas ?? []
  const today = todayISO()

  const votingEvents = [...events]
    .filter((event) => event.displayStatus === 'voting')
    .sort((a, b) => {
      const dateRank = (a.topDate ?? '9999-12-31').localeCompare(b.topDate ?? '9999-12-31')
      if (dateRank !== 0) return dateRank
      return b.voteCount - a.voteCount
    })

  const hostingEvents = [...events]
    .filter((event) => event.displayStatus === 'hosting')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  const upcomingPlans = [...events]
    .filter((event) => event.displayStatus === 'confirmed' && event.topDate && event.topDate >= today)
    .sort((a, b) => (a.topDate ?? '').localeCompare(b.topDate ?? ''))

  const topIdeas = [...ideas]
    .sort((a, b) => {
      if (b.likes !== a.likes) return b.likes - a.likes
      return (b.created_at ?? '').localeCompare(a.created_at ?? '')
    })
    .slice(0, 6)

  const jumpBackIn = votingEvents[0] ?? hostingEvents[0] ?? upcomingPlans[0] ?? events[0]

  const featureCards: FeatureCard[] = [
    {
      href: '/availability',
      title: 'Availability',
      description: 'Mark blackout dates and see the group.',
      tint: 'sage',
      icon: 'calendar',
    },
    {
      href: '/events',
      title: 'Event Voting',
      description: 'Vote on dates for upcoming events.',
      tint: 'terracotta',
      icon: 'people',
    },
    {
      href: '/ideas',
      title: 'Ideas Hub',
      description: 'Suggest and browse activity ideas.',
      tint: 'olive',
      icon: 'lightbulb',
    },
  ]

  return (
    <main className="max-w-md mx-auto px-5">
      <PageHeader variant="greeting" />

      {!data ? (
        <HomeSkeleton />
      ) : (
        <>
          <section className="grid grid-cols-3 gap-3">
            {featureCards.map((card) => (
              <FeatureRouteCard key={card.href} {...card} />
            ))}
          </section>

          {jumpBackIn && (
            <section className="mt-7">
              <SectionHeader title="Jump back in" href="/events" linkLabel="See all" />
              <JumpBackInCard event={jumpBackIn} />
            </section>
          )}

          <section className="mt-7">
            <SectionHeader title="Upcoming Plans" href="/calendar" linkLabel="See all" />
            {upcomingPlans.length === 0 ? (
              <Card className="py-5">
                <p className="text-sm text-ink-soft">
                  Nothing is locked yet. Head to <Link href="/events" className="font-semibold text-olive">Event Voting</Link> and help land the next one.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {upcomingPlans.slice(0, 4).map((event) => (
                  <UpcomingPlanCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </section>

          {topIdeas.length > 0 && (
            <section className="mt-7 mb-4">
              <SectionHeader title="Ideas For You" href="/ideas" linkLabel="See all" />
              <div className="flex gap-3 overflow-x-auto scrollbar-hidden -mx-5 px-5 pb-1">
                {topIdeas.map((idea) => (
                  <IdeaSuggestionCard
                    key={idea.id}
                    title={idea.title}
                    likes={idea.likes}
                  />
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
    <div className="mt-4 animate-pulse">
      <div className="grid grid-cols-3 gap-3">
        <div className="h-48 rounded-[var(--radius-lg)] bg-cream" />
        <div className="h-48 rounded-[var(--radius-lg)] bg-cream" />
        <div className="h-48 rounded-[var(--radius-lg)] bg-cream" />
      </div>
      <div className="mt-7 h-40 rounded-[var(--radius-lg)] bg-cream" />
      <div className="mt-7 grid grid-cols-2 gap-3">
        <div className="h-44 rounded-[var(--radius-lg)] bg-cream" />
        <div className="h-44 rounded-[var(--radius-lg)] bg-cream" />
      </div>
    </div>
  )
}

function FeatureRouteCard({
  href,
  title,
  description,
  tint,
  icon,
}: FeatureCard) {
  return (
    <Link href={href}>
      <Card className="flex h-full min-h-[180px] flex-col gap-4 p-4">
        <IconTile icon={icon} tint={tint} size={58} rounded="lg" />
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold leading-tight text-ink">{title}</h2>
          <p className="mt-2 text-[13px] leading-5 text-ink-soft">{description}</p>
        </div>
        <div className="mt-auto flex justify-end">
          <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${strongTintCircle(tint)}`}>
            <ArrowRightIcon size={16} />
          </span>
        </div>
      </Card>
    </Link>
  )
}

function JumpBackInCard({ event }: { event: EnrichedEvent }) {
  const category = categoryFor(event.title)
  const metaLabel = jumpBackInLabel(event)
  const daysLabel = event.topDate ? relativeDateLabel(event.topDate) : 'Keep it moving'

  return (
    <Link href={`/events/${event.id}`}>
      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-4 px-4 py-4">
          <IconTile icon={category.icon} tint={category.tint} size={86} rounded="full" />
          <div className="min-w-0 flex-1">
            <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${statusAccent(event.displayStatus)}`}>
              {event.displayStatus === 'voting' ? 'Event Voting' : event.displayStatus === 'hosting' ? 'Hosting' : 'Upcoming Plan'}
            </p>
            <h3 className="mt-1 text-[18px] font-bold leading-tight tracking-tight text-ink sm:text-[22px]">
              {event.title}
            </h3>
            <p className="mt-1 text-sm text-ink-soft">
              {metaLabel} · {daysLabel}
            </p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <AvatarStack names={event.participantNames} max={5} size={28} />
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sage-tint text-sage">
                <ArrowRightIcon size={18} />
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  )
}

function UpcomingPlanCard({ event }: { event: EnrichedEvent }) {
  const category = categoryFor(event.title)
  const detailSummary = compactEventDetails(event)
  return (
    <Link href={`/events/${event.id}`}>
      <Card className="h-full p-3.5">
        <IconTile icon={category.icon} tint={category.tint} size={64} rounded="full" />
        <h3 className="mt-3 text-[16px] font-bold leading-tight text-ink">{event.title}</h3>
        <p className="mt-1 text-xs text-ink-soft">
          {event.topDate ? formatDateRangeShort(event.topDate, event.topEndDate) : 'Date TBD'}
        </p>
        {detailSummary ? (
          <p className="mt-1 text-[11px] text-ink-mute line-clamp-2">{detailSummary}</p>
        ) : null}
        <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-mute">
          <UsersIcon size={13} />
          <span>{event.participantNames.length}</span>
        </div>
      </Card>
    </Link>
  )
}

function IdeaSuggestionCard({
  title,
  likes,
}: {
  title: string
  likes: number
}) {
  const category = categoryFor(title)
  return (
    <Link href="/ideas" className="min-w-[164px] max-w-[164px] shrink-0">
      <Card className="h-full p-3">
        <div className="flex items-center gap-2.5">
          <IconTile icon={category.icon} tint={category.tint} size={42} rounded="full" />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight text-ink line-clamp-2">{title}</p>
            <div className="mt-1 flex items-center gap-1 text-[11px] text-ink-mute">
              <UsersIcon size={12} />
              <span>{likes} interested</span>
            </div>
          </div>
        </div>
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
        <ChevronRightIcon size={14} />
      </Link>
    </div>
  )
}

function jumpBackInLabel(event: EnrichedEvent) {
  if (event.displayStatus === 'voting') {
    return 'Vote on dates'
  }
  if (event.displayStatus === 'hosting') {
    return event.dateOptions.length > 0 ? 'Keep the plan moving' : 'Add dates and start the vote'
  }
  return event.topDate ? formatDateRangeShort(event.topDate, event.topEndDate) : 'Keep planning'
}

function relativeDateLabel(dateIso: string) {
  const today = new Date(todayISO() + 'T12:00:00')
  const target = new Date(dateIso + 'T12:00:00')
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff < 7) return `${diff}d out`
  return `${Math.ceil(diff / 7)}w out`
}

function strongTintCircle(tint: CategoryTint) {
  switch (tint) {
    case 'sage':
      return 'bg-sage text-white'
    case 'olive':
      return 'bg-olive text-white'
    case 'terracotta':
      return 'bg-terracotta text-white'
    case 'teal':
      return 'bg-teal text-white'
    case 'lavender':
      return 'bg-lavender text-white'
    case 'amber':
      return 'bg-amber text-white'
    case 'blush':
      return 'bg-blush text-white'
  }
}

function statusAccent(status: EnrichedEvent['displayStatus']) {
  if (status === 'confirmed') return 'text-olive'
  if (status === 'hosting') return 'text-teal'
  if (status === 'tentative') return 'text-lavender'
  return 'text-terracotta'
}
