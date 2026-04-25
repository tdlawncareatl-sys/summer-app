'use client'

// Event detail — the heart of the product. Voting still matters here, but a
// real event page also needs logistics: where, when, and anything people need
// to know before they show up.

import { useState, useEffect, use, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ensureUser } from '@/lib/ensureUser'
import { useName } from '@/lib/useName'
import { categoryFor } from '@/lib/categories'
import {
  buildAppleMapsUrl,
  compactEventDetails,
  eventDraftFromRecord,
  eventPayloadFromDraft,
  formatClockRange,
  hasEventLogistics,
  locationPrimaryLine,
  locationSecondaryLine,
  type EventDetailsDraft,
} from '@/lib/eventDetails'
import { VOTE } from '@/lib/status'
import Card from '@/app/components/Card'
import StatusChip from '@/app/components/StatusChip'
import IconTile from '@/app/components/IconTile'
import Avatar from '@/app/components/Avatar'
import EventLocationFields from '@/app/components/EventLocationFields'
import {
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  InfoIcon,
  MapPinIcon,
  PencilIcon,
} from '@/app/components/icons'

const TOTAL_FRIENDS = 12

const RESPONSES = [
  { label: 'Best', value: 'best', points: 3 },
  { label: 'Works', value: 'works', points: 1 },
  { label: 'Pass', value: 'no', points: 0 },
] as const
type ResponseValue = typeof RESPONSES[number]['value']

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

type DateOption = {
  id: string
  date: string
  end_date?: string | null
  votes: { response: string; points: number; user_name: string }[]
  totalPoints: number
  blockedCount: number
  blockedNames: string[]
  conflictScore: number
}

type Event = {
  id: string
  title: string
  description: string | null
  status: string
  created_by: string | null
  confirmed_date?: string | null
  confirmed_end_date?: string | null
  location_name?: string | null
  location_address?: string | null
  location_notes?: string | null
  event_notes?: string | null
  start_time?: string | null
  end_time?: string | null
}

type GroupBlackouts = Record<string, string[]>

type BestDate = { date: string; availableCount: number; blockedCount: number }

function getRange(a: string, b: string): string[] {
  const start = new Date(a + 'T12:00:00')
  const end = new Date(b + 'T12:00:00')
  const [s, e] = start <= end ? [start, end] : [end, start]
  const days: string[] = []
  const cur = new Date(s)
  while (cur <= e) {
    days.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

function getDaysInRange(start: string, end?: string | null): string[] {
  if (!end || end === start) return [start]
  return getRange(start, end)
}

function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', opts ?? { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatDateRange(start: string, end?: string | null): string {
  if (!end || end === start) return formatDate(start)
  const count = getDaysInRange(start, end).length
  return `${formatDate(start, { month: 'short', day: 'numeric' })} – ${formatDate(end, { month: 'short', day: 'numeric' })} · ${count} days`
}

function scoreFor(totalPoints: number, blockedCount: number): number {
  return totalPoints - blockedCount * 2
}

function calendarCellTint(blockedCount: number): string {
  if (blockedCount === 0) return 'bg-cream text-ink hover:bg-sand'
  const ratio = blockedCount / TOTAL_FRIENDS
  if (ratio < 0.25) return 'bg-amber-tint text-amber hover:bg-amber-soft'
  if (ratio < 0.5) return 'bg-amber-soft text-amber hover:bg-amber-soft/80'
  return 'bg-blush-soft text-blush hover:bg-blush-soft/80'
}

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [name] = useName()
  const [event, setEvent] = useState<Event | null>(null)
  const [detailDraft, setDetailDraft] = useState<EventDetailsDraft>(() => eventDraftFromRecord())
  const [editingDetails, setEditingDetails] = useState(false)
  const [savingDetails, setSavingDetails] = useState(false)
  const [detailMessage, setDetailMessage] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [dateOptions, setDateOptions] = useState<DateOption[]>([])
  const [groupBlackouts, setGroupBlackouts] = useState<GroupBlackouts>({})
  const [bestDates, setBestDates] = useState<BestDate[]>([])
  const [addingDate, setAddingDate] = useState(false)
  const [voting, setVoting] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const [selectedRange, setSelectedRange] = useState<{ start: string; end: string } | null>(null)
  const [calPreview, setCalPreview] = useState<Set<string>>(new Set())
  const calDrag = useRef<string | null>(null)

  const today = new Date()
  const todayISO = today.toISOString().split('T')[0]
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())

  useEffect(() => {
    void loadAll()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    const [
      { data: ev, error: eventError },
      { data: options },
      { data: votes },
      { data: users },
      { data: avail },
    ] = await Promise.all([
      supabase.from('events').select('*').eq('id', id).single(),
      supabase.from('date_options').select('id, date, end_date').eq('event_id', id).order('date', { ascending: true }),
      supabase.from('votes').select('date_option_id, response, points, user_id'),
      supabase.from('users').select('id, name'),
      supabase.from('availability').select('user_id, date'),
    ])

    if (eventError) {
      console.error('event load:', eventError)
    }

    if (ev) {
      setEvent(ev)
      setDetailDraft(eventDraftFromRecord(ev))
    }

    const userMap = Object.fromEntries((users ?? []).map((user) => [user.id, user.name]))

    const blackoutsMap: GroupBlackouts = {}
    for (const row of avail ?? []) {
      const displayName = userMap[row.user_id]
      if (!displayName) continue
      ;(blackoutsMap[row.date] ??= []).push(displayName)
    }
    setGroupBlackouts(blackoutsMap)

    const ninetyDays: BestDate[] = []
    for (let i = 1; i <= 90; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      const iso = d.toISOString().split('T')[0]
      const blocked = blackoutsMap[iso]?.length ?? 0
      ninetyDays.push({ date: iso, blockedCount: blocked, availableCount: TOTAL_FRIENDS - blocked })
    }
    ninetyDays.sort((a, b) => a.blockedCount - b.blockedCount || a.date.localeCompare(b.date))
    setBestDates(ninetyDays.slice(0, 5))

    if (!options || options.length === 0) {
      setDateOptions([])
      return
    }

    const optionIds = new Set(options.map((option) => option.id))
    const relevantVotes = (votes ?? []).filter((vote) => optionIds.has(vote.date_option_id))

    const enriched: DateOption[] = options.map((option) => {
      const optionVotes = relevantVotes
        .filter((vote) => vote.date_option_id === option.id)
        .map((vote) => ({
          response: vote.response,
          points: vote.points,
          user_name: userMap[vote.user_id] ?? '?',
        }))

      const totalPoints = optionVotes.reduce((sum, vote) => sum + vote.points, 0)
      const optionDays = getDaysInRange(option.date, option.end_date)
      const blockedSet = new Set<string>()
      optionDays.forEach((day) => (blackoutsMap[day] ?? []).forEach((blockedName) => blockedSet.add(blockedName)))
      const blockedNames = [...blockedSet]

      return {
        ...option,
        votes: optionVotes,
        totalPoints,
        blockedCount: blockedNames.length,
        blockedNames,
        conflictScore: scoreFor(totalPoints, blockedNames.length),
      }
    })

    setDateOptions(enriched.sort((a, b) => {
      if (b.conflictScore !== a.conflictScore) return b.conflictScore - a.conflictScore
      return a.blockedCount - b.blockedCount
    }))
  }

  async function addDateOption() {
    if (!selectedRange || !name) return
    setAddingDate(true)
    await ensureUser(name)
    const payload: Record<string, string> = { event_id: id, date: selectedRange.start, created_by: name }
    if (selectedRange.end !== selectedRange.start) payload.end_date = selectedRange.end
    const { error } = await supabase.from('date_options').insert(payload)
    if (error) console.error('addDate:', error)
    setSelectedRange(null)
    setAddingDate(false)
    await loadAll()
  }

  async function vote(dateOptionId: string, response: ResponseValue, points: number) {
    if (!name || voting) return
    setVoting(dateOptionId)
    const userId = await ensureUser(name)

    if (response === 'best') {
      const otherIds = dateOptions.filter((option) => option.id !== dateOptionId).map((option) => option.id)
      if (otherIds.length > 0) {
        const { data: previousBest } = await supabase
          .from('votes')
          .select('id')
          .eq('user_id', userId)
          .eq('response', 'best')
          .in('date_option_id', otherIds)
        if (previousBest && previousBest.length > 0) {
          await supabase.from('votes').delete().in('id', previousBest.map((voteRow) => voteRow.id))
        }
      }
    }

    const { data: existing } = await supabase
      .from('votes')
      .select('id, response')
      .eq('date_option_id', dateOptionId)
      .eq('user_id', userId)
      .single()

    if (existing) {
      if (existing.response === response) {
        await supabase.from('votes').delete().eq('id', existing.id)
      } else {
        await supabase.from('votes').update({ response, points }).eq('id', existing.id)
      }
    } else {
      await supabase.from('votes').insert({ date_option_id: dateOptionId, user_id: userId, response, points })
    }

    setVoting(null)
    await loadAll()
  }

  async function confirmEvent() {
    if (!event || confirming) return
    setConfirming(true)
    const winner = dateOptions[0]
    await supabase.from('events').update({
      status: 'confirmed',
      confirmed_date: winner?.date ?? null,
      confirmed_end_date: winner?.end_date ?? null,
    }).eq('id', event.id)
    setEvent({
      ...event,
      status: 'confirmed',
      confirmed_date: winner?.date,
      confirmed_end_date: winner?.end_date,
    })
    setConfirming(false)
  }

  async function saveDetails() {
    if (!event || !detailDraft.title.trim() || savingDetails) return
    setSavingDetails(true)
    setDetailMessage(null)
    setDetailError(null)

    const payload = eventPayloadFromDraft(detailDraft)
    const includeExtendedDetails = hasEventLogistics(payload) || hasEventLogistics(event)
    const updatePayload = includeExtendedDetails
      ? payload
      : { title: payload.title, description: payload.description }

    const { data, error } = await supabase
      .from('events')
      .update(updatePayload)
      .eq('id', event.id)
      .select('*')
      .single()

    if (error) {
      setDetailError(eventSaveError(error.message))
      setSavingDetails(false)
      return
    }

    const nextEvent = (data ?? { ...event, ...updatePayload }) as Event
    setEvent(nextEvent)
    setDetailDraft(eventDraftFromRecord(nextEvent))
    setEditingDetails(false)
    setSavingDetails(false)
    setDetailMessage('Event details saved.')
  }

  async function copyAddress() {
    const address = event?.location_address?.trim()
    if (!address || !navigator?.clipboard) return
    try {
      await navigator.clipboard.writeText(address)
      setDetailMessage('Address copied.')
      setDetailError(null)
    } catch {
      setDetailError('Could not copy the address from this browser.')
    }
  }

  function updateDraft<K extends keyof EventDetailsDraft>(key: K, value: EventDetailsDraft[K]) {
    setDetailDraft((current) => ({ ...current, [key]: value }))
  }

  function myVote(option: DateOption) {
    return option.votes.find((voteRow) => voteRow.user_name === name)?.response ?? null
  }

  function calStartDrag(iso: string) {
    if (iso < todayISO) return
    calDrag.current = iso
    setCalPreview(new Set([iso]))
    setSelectedRange(null)
  }

  function calMoveDrag(iso: string) {
    if (!calDrag.current || iso < todayISO) return
    setCalPreview(new Set(getRange(calDrag.current, iso)))
  }

  function calCommitDrag() {
    if (!calDrag.current || calPreview.size === 0) {
      calDrag.current = null
      setCalPreview(new Set())
      return
    }
    const days = [...calPreview].sort()
    setSelectedRange({ start: days[0], end: days[days.length - 1] })
    calDrag.current = null
    setCalPreview(new Set())
  }

  function isoFromTouch(touch: { clientX: number; clientY: number }) {
    const target = document.elementFromPoint(touch.clientX, touch.clientY)
    return target?.getAttribute('data-iso') ?? null
  }

  function prevCalMonth() {
    if (calMonth === 0) {
      setCalMonth(11)
      setCalYear((year) => year - 1)
    } else {
      setCalMonth((month) => month - 1)
    }
  }

  function nextCalMonth() {
    if (calMonth === 11) {
      setCalMonth(0)
      setCalYear((year) => year + 1)
    } else {
      setCalMonth((month) => month + 1)
    }
  }

  const firstDay = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const calCells: (string | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1
      return `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }),
  ]
  while (calCells.length % 7 !== 0) calCells.push(null)

  const isConfirmed = event?.status === 'confirmed'
  const topOption = dateOptions[0]
  const secondOption = dateOptions[1]
  const hasVotes = (topOption?.votes.length ?? 0) > 0
  const isLeading = hasVotes && (!secondOption || topOption.conflictScore > secondOption.conflictScore)
  const showConfirm = !isConfirmed && isLeading
  const myBestOptionId = dateOptions.find((option) => myVote(option) === 'best')?.id ?? null
  const canEditDetails = !!name && !!event?.created_by && event.created_by === name
  const mapUrl = buildAppleMapsUrl(event?.location_name, event?.location_address)
  const logisticsSummary = event ? compactEventDetails(event) : null
  const whenDateLabel = isConfirmed && event?.confirmed_date
    ? formatDateRange(event.confirmed_date, event.confirmed_end_date)
    : topOption
      ? formatDateRange(topOption.date, topOption.end_date)
      : null
  const timeLabel = event ? formatClockRange(event.start_time, event.end_time) : null
  const placeLabel = event ? locationPrimaryLine(event) : null
  const placeSubLabel = event ? locationSecondaryLine(event) : null

  const confirmedBlockedNames = (() => {
    if (!isConfirmed || !event?.confirmed_date) return []
    const days = getDaysInRange(event.confirmed_date, event.confirmed_end_date)
    const names = new Set<string>()
    days.forEach((day) => (groupBlackouts[day] ?? []).forEach((blockedName) => names.add(blockedName)))
    return [...names].sort()
  })()

  const selectedConflicts = selectedRange
    ? (() => {
        const days = getDaysInRange(selectedRange.start, selectedRange.end)
        const names = new Set<string>()
        days.forEach((day) => (groupBlackouts[day] ?? []).forEach((blockedName) => names.add(blockedName)))
        return names.size
      })()
    : 0

  if (!event) {
    return (
      <main className="max-w-md mx-auto px-5">
        <div className="pt-5 pb-2">
          <div className="h-4 w-20 rounded-full bg-stone animate-pulse" />
        </div>
        <div className="mt-4 mb-5 flex items-start gap-3 animate-pulse">
          <div className="h-16 w-16 rounded-[18px] bg-stone" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-6 w-3/4 rounded bg-stone" />
            <div className="h-4 w-1/2 rounded bg-stone/60" />
          </div>
        </div>
        <div className="flex flex-col gap-3 animate-pulse">
          <div className="h-28 rounded-[var(--radius-lg)] bg-cream" />
          <div className="h-24 rounded-[var(--radius-lg)] bg-cream" />
          <div className="h-48 rounded-[var(--radius-lg)] bg-cream" />
        </div>
      </main>
    )
  }

  const category = categoryFor(event.title)

  return (
    <main className="max-w-md mx-auto px-5 no-select">
      <div className="pt-5 pb-2">
        <Link href="/events" className="inline-flex items-center gap-1 text-sm text-ink-soft transition-colors hover:text-ink">
          <ChevronLeftIcon size={14} />
          Events
        </Link>
      </div>

      <header className="mt-3 mb-5">
        <div className="flex items-start gap-3">
          <IconTile Icon={category.Icon} tint={category.tint} size={64} rounded="lg" />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <StatusChip
                status={isConfirmed ? 'confirmed' : (dateOptions.length > 0 ? 'voting' : 'tentative')}
                size="xs"
              />
              {canEditDetails ? (
                <button
                  onClick={() => {
                    setDetailDraft(eventDraftFromRecord(event))
                    setEditingDetails((current) => !current)
                    setDetailMessage(null)
                    setDetailError(null)
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-sand px-2.5 py-1 text-[11px] font-semibold text-ink-soft"
                >
                  <PencilIcon size={12} />
                  {editingDetails ? 'Close editor' : 'Edit details'}
                </button>
              ) : null}
            </div>
            <h1 className="font-serif text-[30px] leading-[1.08] font-black tracking-tight text-ink">{event.title}</h1>
            {event.description ? (
              <p className="mt-1.5 text-sm text-ink-soft">{event.description}</p>
            ) : (
              <p className="mt-1.5 text-sm text-ink-mute">No summary added yet.</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {whenDateLabel ? <MetaPill icon={<CalendarIcon size={13} />} label={whenDateLabel} /> : null}
              {timeLabel ? <MetaPill icon={<ClockIcon size={13} />} label={timeLabel} /> : null}
              {placeLabel ? <MetaPill icon={<MapPinIcon size={13} />} label={placeLabel} /> : null}
            </div>
            {event.created_by ? (
              <p className="mt-2 text-xs text-ink-mute">Created by {event.created_by}</p>
            ) : null}
          </div>
        </div>
      </header>

      {detailMessage ? (
        <Card className="mb-4 bg-olive-tint text-olive">
          <p className="text-sm font-medium">{detailMessage}</p>
        </Card>
      ) : null}
      {detailError ? (
        <Card className="mb-4 bg-blush-tint text-blush">
          <p className="text-sm font-medium">{detailError}</p>
        </Card>
      ) : null}

      {editingDetails ? (
        <Card className="mb-5">
          <form
            onSubmit={(submittedEvent) => {
              submittedEvent.preventDefault()
              void saveDetails()
            }}
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-[14px] bg-terracotta-tint text-terracotta">
                <PencilIcon size={16} />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-mute">Edit details</p>
                <p className="text-sm text-ink-soft">Make this feel like a real plan, not just a vote.</p>
              </div>
            </div>

            <div className="grid gap-3">
              <input
                type="text"
                value={detailDraft.title}
                onChange={(e) => updateDraft('title', e.target.value)}
                placeholder="Event title"
                className="w-full rounded-xl bg-sand px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive"
              />
              <textarea
                value={detailDraft.description}
                onChange={(e) => updateDraft('description', e.target.value)}
                placeholder="Short summary"
                rows={2}
                className="w-full resize-none rounded-xl bg-sand px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive"
              />
              <EventLocationFields
                idPrefix={`event-${event?.id ?? 'details'}`}
                locationName={detailDraft.location_name}
                locationAddress={detailDraft.location_address}
                onLocationNameChange={(value) => updateDraft('location_name', value)}
                onLocationAddressChange={(value) => updateDraft('location_address', value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="time"
                  value={detailDraft.start_time}
                  onChange={(e) => updateDraft('start_time', e.target.value)}
                  className="w-full rounded-xl bg-sand px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive"
                />
                <input
                  type="time"
                  value={detailDraft.end_time}
                  onChange={(e) => updateDraft('end_time', e.target.value)}
                  className="w-full rounded-xl bg-sand px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive"
                />
              </div>
              <textarea
                value={detailDraft.event_notes}
                onChange={(e) => updateDraft('event_notes', e.target.value)}
                placeholder="Group notes: cost, what to bring, what the plan is"
                rows={3}
                className="w-full resize-none rounded-xl bg-sand px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive"
              />
              <textarea
                value={detailDraft.location_notes}
                onChange={(e) => updateDraft('location_notes', e.target.value)}
                placeholder="Parking / gate / meetup notes"
                rows={2}
                className="w-full resize-none rounded-xl bg-sand px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive"
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                disabled={!detailDraft.title.trim() || savingDetails}
                type="submit"
                className="flex-1 rounded-xl bg-olive py-2.5 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40"
              >
                {savingDetails ? 'Saving…' : 'Save details'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingDetails(false)
                  setDetailDraft(eventDraftFromRecord(event))
                  setDetailError(null)
                }}
                className="rounded-xl bg-sand px-4 py-2.5 text-sm font-semibold text-ink-soft"
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      ) : !hasEventLogistics(event) && canEditDetails ? (
        <Card className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-mute">Needs details</p>
          <p className="mt-1 text-sm text-ink-soft">
            Add the location, timing, and notes that help everyone actually show up.
          </p>
          <button
            onClick={() => setEditingDetails(true)}
            className="mt-4 inline-flex rounded-xl bg-olive px-4 py-2.5 text-sm font-bold text-white"
          >
            Add details
          </button>
        </Card>
      ) : null}

      <div className="mb-5 flex flex-col gap-3">
        <DetailCard
          icon={<CalendarIcon size={16} />}
          label="When"
          title={whenDateLabel ?? 'Dates still being proposed'}
          body={timeLabel ?? (isConfirmed ? 'No meeting time added yet.' : 'Add a meeting time when you know it.')}
        />

        <DetailCard
          icon={<MapPinIcon size={16} />}
          label="Where"
          title={placeLabel ?? 'Location not added yet'}
          body={placeSubLabel ?? (event.location_notes?.trim() || 'No address or meetup spot yet.')}
          footer={(
            <div className="flex flex-wrap gap-2">
              {mapUrl ? (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-full bg-olive px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Open in Apple Maps
                </a>
              ) : null}
              {event.location_address?.trim() ? (
                <button
                  onClick={() => void copyAddress()}
                  className="inline-flex rounded-full bg-sand px-3 py-1.5 text-xs font-semibold text-ink-soft"
                >
                  Copy address
                </button>
              ) : null}
            </div>
          )}
        />

        <DetailCard
          icon={<InfoIcon size={16} />}
          label="Notes"
          title={event.event_notes?.trim() || event.location_notes?.trim() ? 'What to know' : 'No notes yet'}
          body={event.event_notes?.trim() || 'Nothing added for the group yet.'}
          footer={event.location_notes?.trim() ? (
            <div className="rounded-[16px] bg-sand px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">Getting there</p>
              <p className="mt-1 text-sm text-ink-soft">{event.location_notes}</p>
            </div>
          ) : null}
        />
      </div>

      {isConfirmed && event.confirmed_date ? (
        <Card className="mb-5 bg-olive text-white" padded={false}>
          <div className="p-5">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest opacity-70">
              <CheckIcon size={14} />
              It&apos;s happening
            </p>
            <p className="font-serif text-2xl font-black leading-tight">
              {formatDateRange(event.confirmed_date, event.confirmed_end_date)}
            </p>
            {logisticsSummary ? (
              <p className="mt-1 text-sm text-white/80">{logisticsSummary}</p>
            ) : null}
            <div className="mt-4 border-t border-white/20 pt-4">
              {confirmedBlockedNames.length === 0 ? (
                <p className="text-sm font-semibold">Everyone can make it</p>
              ) : (
                <>
                  <p className="mb-2 text-xs font-semibold opacity-80">
                    {TOTAL_FRIENDS - confirmedBlockedNames.length}/{TOTAL_FRIENDS} can make it
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {confirmedBlockedNames.map((blockedName) => (
                      <span key={blockedName} className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium">
                        {blockedName} can&apos;t
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>
      ) : null}

      {showConfirm ? (
        <button
          onClick={confirmEvent}
          disabled={confirming}
          className="mb-5 w-full rounded-[var(--radius-lg)] bg-olive py-3.5 text-sm font-bold text-white shadow-[var(--shadow-soft)] transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
        >
          {confirming ? 'Confirming…' : `Lock it in — ${formatDateRange(topOption.date, topOption.end_date)}`}
        </button>
      ) : null}

      {bestDates.length > 0 && !isConfirmed ? (
        <Card className="mb-5">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-mute">Best available</p>
          <p className="mb-3 text-xs text-ink-soft">Tap one to seed the calendar, then drag to extend.</p>
          <div className="flex flex-col gap-1.5">
            {bestDates.map((bestDate) => (
              <button
                key={bestDate.date}
                onClick={() => {
                  setSelectedRange({ start: bestDate.date, end: bestDate.date })
                  const nextDate = new Date(bestDate.date + 'T12:00:00')
                  setCalYear(nextDate.getFullYear())
                  setCalMonth(nextDate.getMonth())
                }}
                className="flex items-center justify-between rounded-xl bg-sand px-3 py-2.5 text-left transition-all hover:bg-sand-alt active:scale-[0.98]"
              >
                <p className="text-sm font-semibold text-ink">{formatDate(bestDate.date)}</p>
                <div className="ml-3 shrink-0 text-right">
                  <p className="text-xs font-bold text-olive">{bestDate.availableCount}/{TOTAL_FRIENDS} free</p>
                  {bestDate.blockedCount > 0 ? (
                    <p className="text-xs text-blush">{bestDate.blockedCount} blocked</p>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      {!isConfirmed ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {RESPONSES.map((response) => {
            const tone = response.value === 'best' ? VOTE.best : response.value === 'works' ? VOTE.works : VOTE.pass
            return (
              <span key={response.value} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${tone.tint} ${tone.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                {response.label} · {response.points}pt
              </span>
            )
          })}
          <span className="inline-flex items-center rounded-full bg-sand-alt px-2.5 py-1 text-xs font-semibold text-ink-soft">
            Ranked by conflict score
          </span>
        </div>
      ) : null}

      <div className="mb-6 flex flex-col gap-2.5">
        {dateOptions.length === 0 && !isConfirmed ? (
          <Card className="py-8 text-center">
            <p className="text-sm text-ink-soft">No dates proposed yet.</p>
            <p className="mt-1 text-xs text-ink-mute">Add one below to get voting started.</p>
          </Card>
        ) : null}

        {dateOptions.map((option, index) => {
          const myResponse = myVote(option)
          const isTop = index === 0 && option.conflictScore > 0 && !isConfirmed
          const isRange = !!option.end_date && option.end_date !== option.date
          const dayCount = getDaysInRange(option.date, option.end_date).length

          return (
            <Card key={option.id} className={isTop ? 'ring-1 ring-olive' : ''}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {isTop ? (
                    <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wider text-olive">Leading</p>
                  ) : null}
                  <p className="font-bold text-ink">
                    {isRange
                      ? `${formatDate(option.date, { month: 'short', day: 'numeric' })} – ${formatDate(option.end_date!, { month: 'short', day: 'numeric' })}`
                      : formatDate(option.date)}
                  </p>
                  {isRange ? <p className="text-xs text-ink-mute">{dayCount} days</p> : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-ink-soft">
                      {option.totalPoints}pt · {option.votes.length} vote{option.votes.length !== 1 ? 's' : ''}
                    </span>
                    {option.blockedCount === 0 ? (
                      <span className="rounded-full bg-olive-tint px-2 py-0.5 text-xs font-semibold text-olive">
                        No conflicts
                      </span>
                    ) : (
                      <span className="rounded-full bg-blush-tint px-2 py-0.5 text-xs font-semibold text-blush">
                        {option.blockedCount} blocked
                      </span>
                    )}
                  </div>
                </div>

                {name && !isConfirmed ? (
                  <div className="shrink-0 flex gap-1">
                    {RESPONSES.map((response) => {
                      const isActive = myResponse === response.value
                      const bestTaken = response.value === 'best' && myBestOptionId !== null && myBestOptionId !== option.id
                      const tone = response.value === 'best' ? VOTE.best : response.value === 'works' ? VOTE.works : VOTE.pass
                      return (
                        <button
                          key={response.value}
                          onClick={() => vote(option.id, response.value, response.points)}
                          disabled={voting === option.id}
                          title={bestTaken ? 'You already picked Best — click here to move it.' : undefined}
                          className={[
                            'rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all active:scale-95',
                            isActive
                              ? tone.strong
                              : bestTaken
                                ? 'bg-sand text-ink-faint'
                                : 'bg-sand text-ink-soft hover:bg-sand-alt',
                          ].join(' ')}
                        >
                          {response.label}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>

              {option.votes.length > 0 ? (
                <div className="border-t border-sand-alt pt-2">
                  <div className="flex flex-wrap gap-1.5">
                    {option.votes.map((voteRow) => {
                      const tone = voteRow.response === 'best' ? VOTE.best : voteRow.response === 'works' ? VOTE.works : VOTE.pass
                      return (
                        <span key={voteRow.user_name} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tone.tint} ${tone.text}`}>
                          <Avatar name={voteRow.user_name} size={14} />
                          {voteRow.user_name}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {option.blockedNames.length > 0 ? (
                <div className="mt-2 border-t border-sand-alt pt-2">
                  <p className="mb-1.5 text-xs text-ink-mute">Can&apos;t make it ({option.blockedCount})</p>
                  <div className="flex flex-wrap gap-1">
                    {option.blockedNames.map((blockedName) => (
                      <span key={blockedName} className="rounded-full bg-blush-tint px-2 py-0.5 text-xs font-medium text-blush">
                        {blockedName}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>
          )
        })}
      </div>

      {name && !isConfirmed ? (
        <Card className="mb-8">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-mute">Propose dates</p>
          <p className="mb-3 text-xs text-ink-soft">Tap a day or drag to select a multi-day range.</p>

          <div className="mb-3 flex flex-wrap items-center gap-3">
            {([
              ['bg-cream ring-1 ring-stone', 'Free'],
              ['bg-amber-tint', 'Few blocked'],
              ['bg-amber-soft', 'Some'],
              ['bg-blush-soft', 'Many'],
            ] as const).map(([className, label]) => (
              <div key={label} className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                <span className={`h-3 w-3 rounded ${className}`} />
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div
            className="mb-3 overflow-hidden rounded-[var(--radius-md)] border border-sand-alt"
            onMouseUp={calCommitDrag}
            onMouseLeave={calCommitDrag}
          >
            <div className="flex items-center justify-between bg-ink px-3 py-2 text-cream">
              <button
                onClick={prevCalMonth}
                className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-white/10"
                aria-label="Previous month"
              >
                <ChevronLeftIcon size={16} />
              </button>
              <span className="text-xs font-semibold">{MONTH_NAMES[calMonth]} {calYear}</span>
              <button
                onClick={nextCalMonth}
                className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-white/10"
                aria-label="Next month"
              >
                <ChevronRightIcon size={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 border-b border-sand-alt bg-sand">
              {DAY_LABELS.map((label, index) => (
                <div key={`${label}-${index}`} className="py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-ink-mute">{label}</div>
              ))}
            </div>

            <div
              className="grid grid-cols-7 gap-0.5 bg-cream p-2"
              onTouchStart={(e) => {
                const iso = isoFromTouch(e.touches[0])
                if (iso) calStartDrag(iso)
              }}
              onTouchMove={(e) => {
                e.preventDefault()
                const iso = isoFromTouch(e.touches[0])
                if (iso) calMoveDrag(iso)
              }}
              onTouchEnd={calCommitDrag}
            >
              {calCells.map((iso, index) => {
                if (!iso) return <div key={`empty-${index}`} className="aspect-square" />
                const isPast = iso < todayISO
                const isInPreview = calPreview.has(iso)
                const isInSelected = !!selectedRange && iso >= selectedRange.start && iso <= selectedRange.end
                const isToday = iso === todayISO
                const blockedCount = groupBlackouts[iso]?.length ?? 0
                const day = parseInt(iso.split('-')[2], 10)

                let cellClass: string
                if (isPast) {
                  cellClass = 'bg-sand-alt text-ink-faint cursor-default'
                } else if (isInSelected) {
                  cellClass = 'bg-olive text-white font-bold cursor-pointer'
                } else if (isInPreview) {
                  cellClass = 'bg-olive-soft text-olive font-semibold cursor-pointer'
                } else {
                  cellClass = `${calendarCellTint(blockedCount)} cursor-pointer`
                }

                return (
                  <div
                    key={iso}
                    data-iso={iso}
                    onMouseDown={() => calStartDrag(iso)}
                    onMouseEnter={() => calMoveDrag(iso)}
                    className={[
                      'aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-colors',
                      cellClass,
                      isToday && !isInSelected && !isInPreview ? 'ring-1 ring-olive' : '',
                    ].join(' ')}
                  >
                    <span className="leading-none">{day}</span>
                    {blockedCount > 0 && !isPast && !isInSelected && !isInPreview ? (
                      <span className="mt-0.5 text-[8px] leading-none opacity-70">{blockedCount}</span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex min-h-[42px] flex-1 items-center rounded-xl bg-sand px-3 py-2.5 text-sm">
              {selectedRange ? (
                <span className="font-medium text-ink">
                  {formatDateRange(selectedRange.start, selectedRange.end)}
                  {selectedConflicts > 0 ? ` · ${selectedConflicts} blocked` : ' · no conflicts'}
                </span>
              ) : (
                <span className="text-ink-mute">Tap or drag to select</span>
              )}
            </div>
            <button
              onClick={addDateOption}
              disabled={!selectedRange || addingDate}
              className="rounded-xl bg-olive px-4 py-2.5 text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-40"
            >
              {addingDate ? '…' : 'Add'}
            </button>
          </div>
        </Card>
      ) : null}
    </main>
  )
}

function DetailCard({
  icon,
  label,
  title,
  body,
  footer,
}: {
  icon: ReactNode
  label: string
  title: string
  body: string
  footer?: ReactNode
}) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-sand text-olive">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-mute">{label}</p>
          <p className="mt-1 text-[16px] font-bold leading-tight text-ink">{title}</p>
          <p className="mt-1 text-sm leading-6 text-ink-soft">{body}</p>
        </div>
      </div>
      {footer ? <div className="mt-4">{footer}</div> : null}
    </Card>
  )
}

function MetaPill({
  icon,
  label,
}: {
  icon: ReactNode
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sand px-2.5 py-1 text-xs font-semibold text-ink-soft">
      {icon}
      {label}
    </span>
  )
}

function eventSaveError(message: string) {
  const lower = message.toLowerCase()
  if (lower.includes('location_') || lower.includes('event_notes') || lower.includes('start_time') || lower.includes('end_time')) {
    return 'The app code is ready for event details, but the latest event-details SQL migration still needs to be applied in Supabase before those fields can save.'
  }
  return message
}
