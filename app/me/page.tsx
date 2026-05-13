'use client'

// Me — personal dashboard, now centered on availability first.
//  1. Identity (compact)
//  2. Mark availability + view what is currently blocked
//  3. See which planning events those blocks affect
//  4. Hosting + notifications as secondary info

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@/lib/auth'
import { useName } from '@/lib/useName'
import {
  loadPlanData,
  type PlanData,
  type RawAvailability,
  formatDate,
  formatDateRangeShort,
  todayISO,
} from '@/lib/planData'
import { categoryFor } from '@/lib/categories'
import { conflictingDatesForOptions } from '@/lib/availability'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Avatar from '../components/Avatar'
import IconTile from '../components/IconTile'
import StatusChip from '../components/StatusChip'
import NotificationSettingsCard from '../components/NotificationSettingsCard'
import Icon from '../components/Icon'
import type { IconName } from '@/lib/icons'

type AvailabilityRange = {
  start: string
  end: string
  days: string[]
  category?: string | null
}

type ConflictItem = {
  eventId: string
  title: string
  displayStatus: PlanData['events'][number]['displayStatus']
  conflictingDates: string[]
}

function collapseToRanges(records: RawAvailability[]): AvailabilityRange[] {
  if (records.length === 0) return []
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
  const ranges: AvailabilityRange[] = []
  let rangeStart = sorted[0].date
  let rangeDays = [sorted[0].date]
  let rangeCategory = sorted[0].category
  let prev = sorted[0].date

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]
    const diff = (new Date(current.date + 'T12:00:00').getTime() - new Date(prev + 'T12:00:00').getTime()) / 86400000
    const sameCategory = current.category === rangeCategory

    if (diff === 1 && sameCategory) {
      rangeDays.push(current.date)
    } else {
      ranges.push({ start: rangeStart, end: prev, days: rangeDays, category: rangeCategory })
      rangeStart = current.date
      rangeDays = [current.date]
      rangeCategory = current.category
    }

    prev = current.date
  }

  ranges.push({ start: rangeStart, end: prev, days: rangeDays, category: rangeCategory })
  return ranges
}

function rangeLabel(range: AvailabilityRange) {
  return formatDateRangeShort(range.start, range.end)
}

function rangeMeta(range: AvailabilityRange) {
  const parts: string[] = []
  if (range.days.length > 1) parts.push(`${range.days.length} days`)
  if (range.category?.trim()) parts.push(range.category.trim())
  return parts.join(' · ')
}

function conflictDatePreview(dates: string[]) {
  const preview = dates.slice(0, 2).map((date) => formatDate(date, { month: 'short', day: 'numeric' }))
  const extra = dates.length - preview.length
  if (extra > 0) preview.push(`+${extra} more`)
  return preview.join(' · ')
}

export default function MePage() {
  const { authUser, profile, signOut } = useAuth()
  const [name, setName] = useName()
  const [data, setData] = useState<PlanData | null>(null)
  const [editingName, setEditingName] = useState(!name)
  const [draft, setDraft] = useState(name)
  const [savingName, setSavingName] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => { setDraft(name) }, [name])

  useEffect(() => {
    let alive = true
    loadPlanData(name || null).then((nextData) => {
      if (alive) setData(nextData)
    })
    return () => { alive = false }
  }, [name])

  const today = todayISO()
  const myAvailability = data?.availability.filter((row) => data.userMap[row.user_id] === name) ?? []
  const futureAvailability = myAvailability.filter((row) => row.date >= today)
  const futureRanges = collapseToRanges(futureAvailability)
  const futureBlackoutSet = new Set(futureAvailability.map((row) => row.date))

  const availabilityConflicts: ConflictItem[] = (data?.events ?? [])
    .filter((event) => event.status !== 'confirmed')
    .map((event) => ({
      eventId: event.id,
      title: event.title,
      displayStatus: event.displayStatus,
      conflictingDates: conflictingDatesForOptions(event.dateOptions, futureBlackoutSet, today),
    }))
    .filter((event) => event.conflictingDates.length > 0)

  const myEvents = data?.events.filter((event) => event.created_by === name) ?? []
  const nextBlockedRange = futureRanges[0] ?? null

  async function saveName() {
    const trimmed = draft.trim()
    if (!trimmed) return
    setSavingName(true)
    try {
      await setName(trimmed)
      setEditingName(false)
    } finally {
      setSavingName(false)
    }
  }

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <main className="max-w-md mx-auto px-5">
      <PageHeader
        variant="title"
        title="Me"
        subtitle="Keep your availability current and see what it affects."
      />

      <Card className="mb-5 flex items-center gap-4">
        {name ? (
          <Avatar name={name} size={60} />
        ) : (
          <div className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-stone text-xl font-bold text-ink-soft">?</div>
        )}
        <div className="min-w-0 flex-1">
          {editingName ? (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') void saveName() }}
                placeholder="Your name"
                autoFocus
                className="w-full rounded-xl border-0 bg-sand px-3 py-2 text-sm text-ink transition focus:outline-none focus:ring-2 focus:ring-olive"
              />
              <div className="flex gap-2">
                <button type="button"
                  onClick={saveName}
                  disabled={!draft.trim() || savingName}
                  className="flex-1 rounded-xl bg-olive py-2 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-40"
                >
                  {savingName ? 'Saving…' : 'Save'}
                </button>
                {name ? (
                  <button type="button"
                    onClick={() => {
                      setEditingName(false)
                      setDraft(name)
                    }}
                    className="rounded-xl bg-sand px-4 py-2 text-sm font-semibold text-ink-soft transition-transform active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-serif text-[30px] leading-[1.05] font-black tracking-tight text-ink">{name}</h2>
                  <p className="mt-1 text-sm text-ink-soft">Member of the crew</p>
                </div>
                <button type="button"
                  onClick={() => setEditingName(true)}
                  className="shrink-0 text-xs font-semibold text-olive"
                >
                  Change name
                </button>
              </div>
              {authUser?.email ? (
                <p className="mt-2 text-xs text-ink-mute">{authUser.email}</p>
              ) : null}
            </>
          )}
        </div>
      </Card>

      {!name ? (
        <Card className="mb-8">
          <p className="text-sm font-semibold text-ink">Set your name to get started.</p>
          <p className="mt-1 text-sm leading-6 text-ink-soft">
            Once your name is saved, this page will show your blocked dates and how they line up with the group&apos;s plans.
          </p>
        </Card>
      ) : null}

      {name && !data ? (
        <div className="space-y-4">
          <div className="h-44 animate-pulse rounded-[var(--radius-lg)] bg-cream" />
          <div className="h-36 animate-pulse rounded-[var(--radius-lg)] bg-cream" />
          <div className="h-24 animate-pulse rounded-[var(--radius-lg)] bg-cream" />
        </div>
      ) : null}

      {name && data ? (
        <>
          <Card className="mb-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-mute">Availability first</p>
                <h2 className="mt-1 font-serif text-[30px] leading-[1.05] font-black tracking-tight text-ink">
                  Mark your no-go dates
                </h2>
                <p className="mt-2 text-sm leading-6 text-ink-soft">
                  Keep this current so event recommendations and vote choices reflect your real schedule.
                </p>
              </div>
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-olive-tint text-olive">
                <Icon name="calendar" size={18} />
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <SummaryPill
                tone="blush"
                iconName="calendar"
                label={`${futureAvailability.length} blocked date${futureAvailability.length === 1 ? '' : 's'}`}
              />
              <SummaryPill
                tone={availabilityConflicts.length > 0 ? 'amber' : 'olive'}
                iconName={availabilityConflicts.length > 0 ? 'info' : 'check'}
                label={
                  availabilityConflicts.length > 0
                    ? `${availabilityConflicts.length} planning conflict${availabilityConflicts.length === 1 ? '' : 's'}`
                    : 'No current conflicts'
                }
              />
              <SummaryPill
                tone="teal"
                iconName="clock"
                label={nextBlockedRange ? `Next: ${rangeLabel(nextBlockedRange)}` : 'Nothing blocked yet'}
              />
            </div>

            <Link
              href="/availability"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[16px] bg-olive px-4 py-3 text-sm font-bold text-white shadow-[var(--shadow-soft)] transition-transform active:scale-[0.98]"
            >
              Mark availability
              <Icon name="chevronRight" size={16} />
            </Link>
            <p className="mt-2 text-xs leading-5 text-ink-mute">
              Tap a day, tap-tap a range, or drag across the calendar to block off time quickly.
            </p>
          </Card>

          <section className="mb-5">
            <SectionHeading
              title="Your blocked time"
              action={<Link href="/availability" className="text-xs font-semibold text-olive">Open calendar</Link>}
            />
            {futureRanges.length === 0 ? (
              <Card>
                <p className="text-sm font-semibold text-ink">Nothing is blocked yet.</p>
                <p className="mt-1 text-sm leading-6 text-ink-soft">
                  Add your first no-go date so the group doesn&apos;t plan around time you already know is off-limits.
                </p>
              </Card>
            ) : (
              <div className="flex flex-col gap-2.5">
                {futureRanges.slice(0, 4).map((range) => (
                  <Card key={`${range.start}-${range.end}`} className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blush-tint text-blush">
                      <Icon name="calendar" size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{rangeLabel(range)}</p>
                      <p className="mt-0.5 text-xs text-ink-soft">
                        {rangeMeta(range) || 'Blocked off'}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section className="mb-5">
            <SectionHeading
              title="What it affects"
              action={<Link href="/events" className="text-xs font-semibold text-olive">See events</Link>}
            />
            {availabilityConflicts.length === 0 ? (
              <Card>
                <p className="text-sm font-semibold text-ink">You&apos;re clear for the current planning options.</p>
                <p className="mt-1 text-sm leading-6 text-ink-soft">
                  As friends add or move date options, conflicts will show up here automatically.
                </p>
              </Card>
            ) : (
              <div className="flex flex-col gap-2.5">
                {availabilityConflicts.slice(0, 4).map((conflict) => {
                  const category = categoryFor(conflict.title)
                  return (
                    <Link key={conflict.eventId} href={`/events/${conflict.eventId}`}>
                      <Card className="flex items-center gap-3">
                        <IconTile name={category.iconName} tint={category.tint} size={44} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-ink">{conflict.title}</p>
                          <p className="mt-0.5 text-xs text-ink-soft">
                            You&apos;re blocked on {conflictDatePreview(conflict.conflictingDates)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <StatusChip status={conflict.displayStatus} size="xs" />
                          <Icon name="chevronRight" size={18} className="text-ink-faint" />
                        </div>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          {myEvents.length > 0 ? (
            <section className="mb-5">
              <SectionHeading
                title="You&apos;re hosting"
                action={<Link href="/events" className="text-xs font-semibold text-olive">See all</Link>}
              />
              <div className="flex flex-col gap-2.5">
                {myEvents.map((event) => {
                  const category = categoryFor(event.title)
                  return (
                    <Link key={event.id} href={`/events/${event.id}`}>
                      <Card className="flex items-center gap-3">
                        <IconTile name={category.iconName} tint={category.tint} size={44} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-ink">{event.title}</p>
                          <p className="mt-0.5 text-xs text-ink-soft">
                            {event.dateOptions.length} options · {event.voteCount} votes
                          </p>
                        </div>
                        <StatusChip status={event.displayStatus} size="xs" />
                        <Icon name="chevronRight" size={18} className="text-ink-faint" />
                      </Card>
                    </Link>
                  )
                })}
              </div>
            </section>
          ) : null}

          {profile ? <NotificationSettingsCard userId={profile.id} /> : null}

          <button type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="mb-10 w-full rounded-[var(--radius-lg)] bg-stone px-4 py-3 text-sm font-semibold text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </>
      ) : null}
    </main>
  )
}

function SummaryPill({
  tone,
  iconName,
  label,
}: {
  tone: 'olive' | 'teal' | 'amber' | 'blush'
  iconName: IconName
  label: string
}) {
  const toneClasses = {
    olive: 'bg-olive-tint text-olive',
    teal: 'bg-teal-tint text-teal',
    amber: 'bg-amber-tint text-amber',
    blush: 'bg-blush-tint text-blush',
  }[tone]

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${toneClasses}`}>
      <Icon name={iconName} size={13} />
      <span>{label}</span>
    </span>
  )
}

function SectionHeading({
  title,
  action,
}: {
  title: string
  action?: ReactNode
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-serif text-[30px] leading-[1.05] font-black tracking-tight text-ink">{title}</h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
