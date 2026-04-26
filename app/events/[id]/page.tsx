'use client'

// Event detail — friendly hero up top, then the scheduling/voting tool below.
// Availability scoring lives in lib/availability.ts; this page composes UI.

import { useEffect, useMemo, useRef, useState, use, type ReactNode } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ensureUser } from '@/lib/ensureUser'
import { useName } from '@/lib/useName'
import { categoryFor } from '@/lib/categories'
import {
  buildAppleMapsUrl,
  eventDraftFromRecord,
  eventPayloadFromDraft,
  formatClockRange,
  hasEventLogistics,
  type EventDetailsDraft,
} from '@/lib/eventDetails'
import { VOTE } from '@/lib/status'
import {
  type LengthType,
  LENGTH_LABELS,
  LENGTH_HELPERS,
  LENGTH_TYPES,
  normalizeLengthType,
  rangeSubLabel,
} from '@/lib/lengthType'
import {
  type AvailabilityRow,
  type Buckets,
  type Participant,
  type ScoredRange,
  densityForDay,
  findBestRanges,
  getRange,
  scoreRange,
  summarizeBuckets,
} from '@/lib/availability'
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
  MapPinIcon,
  MoreIcon,
  NoteIcon,
  PencilIcon,
  ShareIcon,
  UsersIcon,
  XIcon,
} from '@/app/components/icons'

const RESPONSES = [
  { label: 'Best', value: 'best', points: 3 },
  { label: 'Works', value: 'works', points: 1 },
  { label: 'Pass', value: 'no', points: 0 },
] as const
type ResponseValue = typeof RESPONSES[number]['value']

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
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

type EventRow = {
  id: string
  title: string
  description: string | null
  status: string
  created_by: string | null
  created_at: string | null
  confirmed_date?: string | null
  confirmed_end_date?: string | null
  location_name?: string | null
  location_address?: string | null
  location_notes?: string | null
  event_notes?: string | null
  start_time?: string | null
  end_time?: string | null
  length_days?: number | null
}

type GroupBlackouts = Record<string, string[]>

function formatDay(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', opts ?? { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatRange(start: string, end?: string | null): string {
  if (!end || end === start) return formatDay(start)
  return `${formatDay(start, { weekday: 'short', month: 'short', day: 'numeric' })} – ${formatDay(end, { weekday: 'short', month: 'short', day: 'numeric' })}`
}

function shortLocation(locationName: string | null | undefined, address: string | null | undefined): string | null {
  const trimmedName = locationName?.trim()
  if (trimmedName) return trimmedName
  const trimmedAddress = address?.trim()
  if (!trimmedAddress) return null
  // Try to derive "City, ST" from a US-ish address string
  const parts = trimmedAddress.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const city = parts[parts.length - 2]
    const stateZip = parts[parts.length - 1].split(' ').filter(Boolean)
    const stateAbbrev = stateZip[0] ?? ''
    if (city && stateAbbrev.length === 2) return `${city}, ${stateAbbrev.toUpperCase()}`
  }
  return trimmedAddress
}

function densityClasses(density: ReturnType<typeof densityForDay>): string {
  switch (density) {
    case 'few': return 'bg-amber-tint text-amber'
    case 'some': return 'bg-amber-soft text-amber'
    case 'many': return 'bg-blush-soft text-blush'
    default: return 'bg-cream text-ink hover:bg-sand'
  }
}

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [name] = useName()
  const [event, setEvent] = useState<EventRow | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [availability, setAvailability] = useState<AvailabilityRow[]>([])
  const [groupBlackouts, setGroupBlackouts] = useState<GroupBlackouts>({})
  const [dateOptions, setDateOptions] = useState<DateOption[]>([])

  const [voting, setVoting] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [addingDate, setAddingDate] = useState(false)
  const [savingDetails, setSavingDetails] = useState(false)
  const [savingLength, setSavingLength] = useState(false)

  const [editingDetails, setEditingDetails] = useState(false)
  const [editingLength, setEditingLength] = useState(false)
  const [showAllBest, setShowAllBest] = useState(false)
  const [detailDraft, setDetailDraft] = useState<EventDetailsDraft>(() => eventDraftFromRecord())
  const [detailMessage, setDetailMessage] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [selectedRange, setSelectedRange] = useState<{ start: string; end: string } | null>(null)
  const [calPreview, setCalPreview] = useState<Set<string>>(new Set())
  const calDrag = useRef<string | null>(null)
  const calCardRef = useRef<HTMLDivElement | null>(null)

  const today = useMemo(() => new Date(), [])
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
      supabase.from('users').select('id, name').order('name', { ascending: true }),
      supabase.from('availability').select('user_id, date'),
    ])

    if (eventError) console.error('event load:', eventError)
    if (ev) {
      setEvent(ev as EventRow)
      setDetailDraft(eventDraftFromRecord(ev))
    }

    const userList = ((users ?? []) as Participant[])
    setParticipants(userList)
    const availList = (avail ?? []) as AvailabilityRow[]
    setAvailability(availList)

    const userMap = Object.fromEntries(userList.map((u) => [u.id, u.name]))
    const blackoutsMap: GroupBlackouts = {}
    for (const row of availList) {
      const displayName = userMap[row.user_id]
      if (!displayName) continue
      ;(blackoutsMap[row.date] ??= []).push(displayName)
    }
    setGroupBlackouts(blackoutsMap)

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
      const optionDays = getRange(option.date, option.end_date ?? option.date)
      const blockedSet = new Set<string>()
      for (const day of optionDays) (blackoutsMap[day] ?? []).forEach((n) => blockedSet.add(n))
      const blockedNames = [...blockedSet]
      return {
        ...option,
        votes: optionVotes,
        totalPoints,
        blockedCount: blockedNames.length,
        blockedNames,
        conflictScore: totalPoints - blockedNames.length * 2,
      }
    })

    enriched.sort((a, b) => {
      if (b.conflictScore !== a.conflictScore) return b.conflictScore - a.conflictScore
      return a.blockedCount - b.blockedCount
    })
    setDateOptions(enriched)
  }

  const lengthType: LengthType = normalizeLengthType(event?.length_days)
  const isConfirmed = event?.status === 'confirmed'
  const isCreator = !!name && !!event?.created_by && event.created_by === name

  const bestRanges: ScoredRange[] = useMemo(() => {
    if (!participants.length) return []
    return findBestRanges(lengthType, participants, availability, todayISO).slice(0, 12)
  }, [lengthType, participants, availability, todayISO])

  const topBest = bestRanges[0]
  const visibleBest = showAllBest ? bestRanges : bestRanges.slice(0, 3)
  const totalParticipants = participants.length

  const topOption = dateOptions[0]
  const secondOption = dateOptions[1]
  const hasVotes = (topOption?.votes.length ?? 0) > 0
  const isLeading = hasVotes && (!secondOption || topOption.conflictScore > secondOption.conflictScore)
  const showConfirm = !isConfirmed && isLeading
  const myBestOptionId = dateOptions.find((option) => option.votes.find((voteRow) => voteRow.user_name === name)?.response === 'best')?.id ?? null

  const headerLocationLine = event ? shortLocation(event.location_name, event.location_address) : null
  const headerAddressLine = event?.location_address?.trim() && headerLocationLine !== event.location_address?.trim()
    ? event.location_address.trim()
    : null
  const mapUrl = buildAppleMapsUrl(event?.location_name, event?.location_address)

  const whenLabel = isConfirmed && event?.confirmed_date
    ? formatRange(event.confirmed_date, event.confirmed_end_date)
    : topOption
      ? formatRange(topOption.date, topOption.end_date)
      : 'Dates still being proposed'

  const timeLabel = event ? formatClockRange(event.start_time, event.end_time) : null
  const placeFullLabel = event?.location_address?.trim() || event?.location_name?.trim() || 'Location not added yet'
  const notesLabel = event?.event_notes?.trim() || 'No notes yet'
  const notesIsPlaceholder = !event?.event_notes?.trim()

  const selectedScore: ScoredRange | null = selectedRange && participants.length > 0
    ? scoreRange(selectedRange.start, selectedRange.end, participants, availability)
    : null

  // ─────────── handlers ───────────

  function focusCalendar() {
    calCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function seedFromBest(range: ScoredRange) {
    setSelectedRange({ start: range.startDate, end: range.endDate })
    const next = new Date(range.startDate + 'T12:00:00')
    setCalYear(next.getFullYear())
    setCalMonth(next.getMonth())
    requestAnimationFrame(focusCalendar)
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
          await supabase.from('votes').delete().in('id', previousBest.map((row) => row.id))
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
    const includeExtended = hasEventLogistics(payload) || hasEventLogistics(event)
    const update = includeExtended ? payload : { title: payload.title, description: payload.description }

    const { data, error } = await supabase
      .from('events')
      .update(update)
      .eq('id', event.id)
      .select('*')
      .single()

    if (error) {
      setDetailError(eventSaveError(error.message))
      setSavingDetails(false)
      return
    }

    const next = (data ?? { ...event, ...update }) as EventRow
    setEvent(next)
    setDetailDraft(eventDraftFromRecord(next))
    setEditingDetails(false)
    setSavingDetails(false)
    setDetailMessage('Event details saved.')
  }

  async function saveLength(value: LengthType) {
    if (!event || savingLength) return
    setSavingLength(true)
    const { data, error } = await supabase
      .from('events')
      .update({ length_days: value })
      .eq('id', event.id)
      .select('*')
      .single()
    if (error) {
      setDetailError(eventSaveError(error.message))
      setSavingLength(false)
      return
    }
    setEvent((data ?? { ...event, length_days: value }) as EventRow)
    setSavingLength(false)
    setEditingLength(false)
    setShowAllBest(false) // length change resets the expanded list
  }

  async function shareEvent() {
    if (typeof window === 'undefined' || !event) return
    const url = window.location.href
    const title = event.title || 'Summer Plans event'
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        /* user dismissed — fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard?.writeText(url)
      setDetailMessage('Link copied.')
      setDetailError(null)
    } catch {
      setDetailError('Could not copy the link from this browser.')
    }
  }

  // ─────────── calendar interactions ───────────

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
  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1) } else setCalMonth((m) => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1) } else setCalMonth((m) => m + 1)
  }

  const firstDay = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const calCells: (string | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, idx) => {
      const day = idx + 1
      return `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }),
  ]
  while (calCells.length % 7 !== 0) calCells.push(null)

  // ─────────── render ───────────

  if (!event) {
    return (
      <main className="mx-auto max-w-md px-5">
        <div className="pt-5 pb-2">
          <div className="h-4 w-20 animate-pulse rounded-full bg-stone" />
        </div>
        <div className="mt-4 mb-5 flex animate-pulse items-start gap-3">
          <div className="h-20 w-20 rounded-[18px] bg-stone" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-6 w-3/4 rounded bg-stone" />
            <div className="h-4 w-1/2 rounded bg-stone/60" />
          </div>
        </div>
        <div className="flex animate-pulse flex-col gap-3">
          <div className="h-12 rounded-[var(--radius-md)] bg-stone/60" />
          <div className="h-44 rounded-[var(--radius-lg)] bg-cream" />
          <div className="h-44 rounded-[var(--radius-lg)] bg-cream" />
        </div>
      </main>
    )
  }

  const category = categoryFor(event.title)
  const bestSummary = topBest && topBest.buckets.blocked === 0 && topBest.buckets.unknown === 0
    ? summarizeBuckets(topBest.buckets)
    : null

  return (
    <main className="mx-auto max-w-md px-5 pb-12 no-select">
      {/* Top nav */}
      <nav className="flex items-center justify-between pt-4 pb-2">
        <Link
          href="/events"
          className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:text-ink"
          aria-label="Back to events"
        >
          <ChevronLeftIcon size={18} />
        </Link>
        <button
          type="button"
          className="-mr-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-mute hover:text-ink-soft"
          aria-label="More options"
        >
          <MoreIcon size={18} />
        </button>
      </nav>

      {/* Hero */}
      <header className="mb-4">
        <div className="flex items-start gap-4">
          <IconTile Icon={category.Icon} tint={category.tint} size={84} rounded="lg" iconSize={42} />
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="mb-1">
              <StatusChip
                status={isConfirmed ? 'confirmed' : (dateOptions.length > 0 ? 'voting' : 'tentative')}
                size="xs"
              />
            </div>
            <h1 className="font-serif text-[34px] leading-[1.05] font-black tracking-tight text-ink">{event.title}</h1>
            {headerLocationLine ? (
              mapUrl ? (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1.5 text-[15px] font-semibold text-olive"
                >
                  <MapPinIcon size={14} />
                  {headerLocationLine}
                </a>
              ) : (
                <span className="mt-1.5 inline-flex items-center gap-1.5 text-[15px] font-semibold text-olive">
                  <MapPinIcon size={14} />
                  {headerLocationLine}
                </span>
              )
            ) : null}
            {headerAddressLine ? (
              <p className="mt-0.5 text-sm text-ink-soft">{headerAddressLine}</p>
            ) : null}
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-ink-soft">
              <CalendarIcon size={14} />
              {whenLabel}
            </p>
          </div>
        </div>
      </header>

      {detailMessage ? <FlashCard tone="olive">{detailMessage}</FlashCard> : null}
      {detailError ? <FlashCard tone="blush">{detailError}</FlashCard> : null}

      {/* Action row */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={focusCalendar}
          className="flex flex-1 min-w-[110px] items-center justify-center gap-1.5 rounded-[14px] bg-olive px-4 py-3 text-sm font-bold text-white shadow-[var(--shadow-soft)] active:scale-[0.98]"
        >
          <CalendarIcon size={14} />
          Add time
        </button>
        <button
          type="button"
          disabled={!isCreator}
          onClick={() => {
            setDetailDraft(eventDraftFromRecord(event))
            setDetailError(null)
            setDetailMessage(null)
            setEditingDetails(true)
          }}
          className="flex flex-1 min-w-[110px] items-center justify-center gap-1.5 rounded-[14px] bg-sand px-4 py-3 text-sm font-semibold text-ink-soft active:scale-[0.98] disabled:opacity-50"
          title={isCreator ? undefined : 'Only the event creator can edit details'}
        >
          <PencilIcon size={14} />
          Edit details
        </button>
        <button
          type="button"
          onClick={() => void shareEvent()}
          className="flex flex-1 min-w-[110px] items-center justify-center gap-1.5 rounded-[14px] bg-sand px-4 py-3 text-sm font-semibold text-ink-soft active:scale-[0.98]"
        >
          <ShareIcon size={14} />
          Share
        </button>
      </div>

      {/* Details */}
      <Card className="mb-4" padded={false}>
        <div className="px-4 pt-3 pb-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-mute">Details</p>
        </div>
        <DetailRow
          icon={<CalendarIcon size={14} />}
          label="When"
          value={whenLabel}
          onTap={focusCalendar}
          editable={!isConfirmed}
        />
        <DetailRow
          icon={<MapPinIcon size={14} />}
          label="Where"
          value={placeFullLabel}
          onTap={() => {
            if (!isCreator) return
            setDetailDraft(eventDraftFromRecord(event))
            setEditingDetails(true)
          }}
          editable={isCreator}
          muted={!event.location_address?.trim() && !event.location_name?.trim()}
        />
        <DetailRow
          icon={<ClockIcon size={14} />}
          label="Length"
          value={LENGTH_LABELS[lengthType]}
          chip
          onTap={() => isCreator && setEditingLength(true)}
          editable={isCreator}
        />
        <DetailRow
          icon={<NoteIcon size={14} />}
          label="Notes"
          value={notesLabel}
          onTap={() => {
            if (!isCreator) return
            setDetailDraft(eventDraftFromRecord(event))
            setEditingDetails(true)
          }}
          editable={isCreator}
          muted={notesIsPlaceholder}
          last
        />
      </Card>

      {/* Time pill (if set) */}
      {timeLabel ? (
        <div className="mb-4 flex items-center justify-center gap-2 rounded-[14px] bg-cream px-3 py-2 text-sm text-ink-soft border border-stone/50">
          <ClockIcon size={14} />
          <span className="font-medium text-ink">{timeLabel}</span>
        </div>
      ) : null}

      {/* Confirmed banner */}
      {isConfirmed && event.confirmed_date ? (
        <Card className="mb-4 bg-olive text-white" padded={false}>
          <div className="p-4">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest opacity-70">
              <CheckIcon size={14} />
              It&apos;s happening
            </p>
            <p className="font-serif text-2xl font-black leading-tight">
              {formatRange(event.confirmed_date, event.confirmed_end_date)}
            </p>
            {(() => {
              const score = scoreRange(event.confirmed_date, event.confirmed_end_date ?? event.confirmed_date, participants, availability)
              if (score.buckets.total === 0) return null
              return (
                <p className="mt-2 text-sm text-white/85">
                  {score.buckets.blocked === 0 && score.buckets.unknown === 0
                    ? 'Everyone can make it'
                    : summarizeBuckets(score.buckets)}
                </p>
              )
            })()}
          </div>
        </Card>
      ) : null}

      {/* Confirm button */}
      {showConfirm ? (
        <button
          onClick={confirmEvent}
          disabled={confirming}
          className="mb-4 w-full rounded-[var(--radius-lg)] bg-olive py-3.5 text-sm font-bold text-white shadow-[var(--shadow-soft)] transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {confirming ? 'Confirming…' : `Lock it in — ${formatRange(topOption.date, topOption.end_date)}`}
        </button>
      ) : null}

      {/* Best Available */}
      {!isConfirmed && bestRanges.length > 0 ? (
        <Card className="mb-4">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-mute">Best Available</p>
            {bestSummary ? (
              <p className="text-xs font-bold text-olive">{bestSummary}</p>
            ) : null}
          </div>
          <p className="mb-3 text-xs text-ink-soft">Tap a range to seed the calendar, then drag to extend.</p>
          <div className="flex flex-col gap-1.5">
            {visibleBest.map((range) => (
              <BestRangeRow key={`${range.startDate}_${range.endDate}`} range={range} lengthType={lengthType} onSelect={() => seedFromBest(range)} />
            ))}
          </div>
          {bestRanges.length > 3 ? (
            <button
              type="button"
              onClick={() => setShowAllBest((current) => !current)}
              className="mt-3 flex w-full items-center justify-center gap-1 text-sm font-semibold text-olive"
            >
              {showAllBest ? 'Show top 3 only' : 'View more dates'}
              <ChevronRightIcon size={14} className={showAllBest ? 'rotate-[270deg]' : 'rotate-90'} />
            </button>
          ) : null}
        </Card>
      ) : null}

      {/* Voting list — only when there are date options */}
      {dateOptions.length > 0 && !isConfirmed ? (
        <div className="mb-4 flex flex-col gap-2.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-mute">Proposed dates</p>
          {dateOptions.map((option, index) => {
            const myResponse = option.votes.find((row) => row.user_name === name)?.response ?? null
            const isTop = index === 0 && option.conflictScore > 0
            const isRange = !!option.end_date && option.end_date !== option.date
            return (
              <Card key={option.id} className={isTop ? 'ring-1 ring-olive' : ''}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {isTop ? <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wider text-olive">Leading</p> : null}
                    <p className="font-bold text-ink">
                      {isRange
                        ? `${formatDay(option.date, { month: 'short', day: 'numeric' })} – ${formatDay(option.end_date!, { month: 'short', day: 'numeric' })}`
                        : formatDay(option.date)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-ink-soft">
                        {option.totalPoints}pt · {option.votes.length} vote{option.votes.length !== 1 ? 's' : ''}
                      </span>
                      {option.blockedCount === 0 ? (
                        <span className="rounded-full bg-olive-tint px-2 py-0.5 text-xs font-semibold text-olive">No conflicts</span>
                      ) : (
                        <span className="rounded-full bg-blush-tint px-2 py-0.5 text-xs font-semibold text-blush">
                          {option.blockedCount} blocked
                        </span>
                      )}
                    </div>
                  </div>
                  {name ? (
                    <div className="flex shrink-0 gap-1">
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
                              isActive ? tone.strong : bestTaken ? 'bg-sand text-ink-faint' : 'bg-sand text-ink-soft hover:bg-sand-alt',
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
                      {option.votes.map((row) => {
                        const tone = row.response === 'best' ? VOTE.best : row.response === 'works' ? VOTE.works : VOTE.pass
                        return (
                          <span key={row.user_name} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tone.tint} ${tone.text}`}>
                            <Avatar name={row.user_name} size={14} />
                            {row.user_name}
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
      ) : null}

      {/* Propose dates / calendar */}
      {name && !isConfirmed ? (
        <div ref={calCardRef} className="mb-6 scroll-mt-4">
        <Card>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-mute">Propose Dates</p>
          <p className="mb-3 text-xs text-ink-soft">Tap a day or drag to select a multi-day range.</p>

          <div className="mb-3 flex flex-wrap items-center gap-3">
            {([
              ['bg-cream ring-1 ring-stone', 'Free'],
              ['bg-amber-tint', 'Few blocked'],
              ['bg-amber-soft', 'Some'],
              ['bg-blush-soft', 'Many'],
            ] as const).map(([cls, label]) => (
              <div key={label} className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                <span className={`h-3 w-3 rounded ${cls}`} />
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
                onClick={prevMonth}
                className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-white/10"
                aria-label="Previous month"
              >
                <ChevronLeftIcon size={16} />
              </button>
              <span className="text-xs font-semibold">{MONTHS[calMonth]} {calYear}</span>
              <button
                onClick={nextMonth}
                className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-white/10"
                aria-label="Next month"
              >
                <ChevronRightIcon size={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 border-b border-sand-alt bg-sand">
              {DAY_LABELS.map((label, idx) => (
                <div key={`${label}-${idx}`} className="py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-ink-mute">{label}</div>
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
              {calCells.map((iso, idx) => {
                if (!iso) return <div key={`empty-${idx}`} className="aspect-square" />
                const isPast = iso < todayISO
                const isInPreview = calPreview.has(iso)
                const isInSelected = !!selectedRange && iso >= selectedRange.start && iso <= selectedRange.end
                const isToday = iso === todayISO
                const blockedCount = groupBlackouts[iso]?.length ?? 0
                const day = parseInt(iso.split('-')[2], 10)
                const density = densityForDay(blockedCount, totalParticipants)

                let cellClass: string
                if (isPast) {
                  cellClass = 'bg-sand-alt text-ink-faint cursor-default'
                } else if (isInSelected) {
                  cellClass = 'bg-olive text-white font-bold cursor-pointer'
                } else if (isInPreview) {
                  cellClass = 'bg-olive-soft text-olive font-semibold cursor-pointer'
                } else {
                  cellClass = `${densityClasses(density)} cursor-pointer`
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
              {selectedRange && selectedScore ? (
                <span className="font-medium text-ink">
                  {formatRange(selectedRange.start, selectedRange.end)}
                  {selectedScore.buckets.blocked === 0 && selectedScore.buckets.unknown === 0
                    ? ' · no conflicts'
                    : ` · ${summarizeBuckets(selectedScore.buckets)}`}
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
        </div>
      ) : null}

      {/* Footer metadata */}
      <footer className="mt-2 flex items-center justify-between rounded-[var(--radius-md)] bg-sand-alt/60 px-3 py-2.5 text-xs text-ink-soft">
        <div className="flex items-center gap-2">
          <Avatar name={event.created_by ?? 'Friend'} size={22} />
          <div className="leading-tight">
            <p className="font-semibold text-ink">Created by {event.created_by ?? '—'}</p>
            {event.created_at ? (
              <p className="text-[11px] text-ink-mute">Created {formatDay(event.created_at.split('T')[0], { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={focusCalendar}
          className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-ink-soft border border-stone/40"
        >
          <UsersIcon size={12} />
          {totalParticipants > 0 ? `${totalParticipants} invited` : 'Invite list'}
          <ChevronRightIcon size={12} />
        </button>
      </footer>

      {/* Length picker sheet */}
      {editingLength ? (
        <Sheet onClose={() => setEditingLength(false)} title="Event length">
          <p className="mb-4 text-sm text-ink-soft">Changing this updates the Best Available suggestions.</p>
          <div className="flex flex-col gap-2">
            {LENGTH_TYPES.map((option) => {
              const isActive = lengthType === option
              return (
                <button
                  key={option}
                  type="button"
                  disabled={savingLength}
                  onClick={() => void saveLength(option)}
                  className={[
                    'flex items-start gap-3 rounded-[14px] border px-3 py-3 text-left transition-colors active:scale-[0.99]',
                    isActive ? 'border-olive bg-olive-tint' : 'border-stone/60 bg-cream',
                  ].join(' ')}
                >
                  <span className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border ${isActive ? 'border-olive bg-olive text-white' : 'border-stone'}`}>
                    {isActive ? <CheckIcon size={12} /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-ink">{LENGTH_LABELS[option]}</span>
                    <span className="mt-0.5 block text-xs text-ink-soft">{LENGTH_HELPERS[option]}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </Sheet>
      ) : null}

      {/* Edit details sheet */}
      {editingDetails ? (
        <Sheet onClose={() => setEditingDetails(false)} title="Edit details">
          <form
            onSubmit={(submittedEvent) => {
              submittedEvent.preventDefault()
              void saveDetails()
            }}
          >
            <div className="grid gap-3">
              <input
                type="text"
                value={detailDraft.title}
                onChange={(e) => setDetailDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="Event title"
                className="w-full rounded-xl bg-sand px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive"
              />
              <textarea
                value={detailDraft.description}
                onChange={(e) => setDetailDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Short summary"
                rows={2}
                className="w-full resize-none rounded-xl bg-sand px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive"
              />
              <EventLocationFields
                idPrefix={`event-${event.id}`}
                locationName={detailDraft.location_name}
                locationAddress={detailDraft.location_address}
                onLocationNameChange={(value) => setDetailDraft((d) => ({ ...d, location_name: value }))}
                onLocationAddressChange={(value) => setDetailDraft((d) => ({ ...d, location_address: value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="time"
                  value={detailDraft.start_time}
                  onChange={(e) => setDetailDraft((d) => ({ ...d, start_time: e.target.value }))}
                  className="w-full rounded-xl bg-sand px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive"
                />
                <input
                  type="time"
                  value={detailDraft.end_time}
                  onChange={(e) => setDetailDraft((d) => ({ ...d, end_time: e.target.value }))}
                  className="w-full rounded-xl bg-sand px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive"
                />
              </div>
              <textarea
                value={detailDraft.event_notes}
                onChange={(e) => setDetailDraft((d) => ({ ...d, event_notes: e.target.value }))}
                placeholder="Group notes: cost, what to bring, what the plan is"
                rows={3}
                className="w-full resize-none rounded-xl bg-sand px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive"
              />
              <textarea
                value={detailDraft.location_notes}
                onChange={(e) => setDetailDraft((d) => ({ ...d, location_notes: e.target.value }))}
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
        </Sheet>
      ) : null}
    </main>
  )
}

// ─────────── small components ───────────

function DetailRow({
  icon,
  label,
  value,
  chip,
  onTap,
  editable,
  muted,
  last,
}: {
  icon: ReactNode
  label: string
  value: string
  chip?: boolean
  onTap?: () => void
  editable?: boolean
  muted?: boolean
  last?: boolean
}) {
  const Wrapper = onTap ? 'button' : 'div'
  return (
    <Wrapper
      type={onTap ? 'button' : undefined}
      onClick={onTap}
      className={[
        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
        last ? '' : 'border-b border-sand-alt',
        onTap ? 'active:bg-sand-alt/60' : '',
      ].join(' ')}
    >
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-olive-tint text-olive">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">{label}</p>
        {chip ? (
          <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-olive-tint px-2.5 py-0.5 text-[13px] font-semibold text-olive">
            {value}
            <ChevronRightIcon size={12} className="rotate-90" />
          </span>
        ) : (
          <p className={`mt-0.5 truncate text-[14px] font-semibold ${muted ? 'text-ink-mute' : 'text-ink'}`}>{value}</p>
        )}
      </div>
      {editable ? <PencilIcon size={14} className="shrink-0 text-ink-mute" /> : null}
    </Wrapper>
  )
}

function BestRangeRow({
  range,
  lengthType,
  onSelect,
}: {
  range: ScoredRange
  lengthType: LengthType
  onSelect: () => void
}) {
  const isRange = range.endDate !== range.startDate
  const tone = range.buckets.blocked === 0 && range.buckets.unknown === 0
    ? 'text-olive'
    : range.buckets.blocked > range.buckets.free
      ? 'text-blush'
      : 'text-amber'
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex items-center gap-3 rounded-xl bg-sand px-3 py-2.5 text-left transition-all hover:bg-sand-alt active:scale-[0.99]"
    >
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cream text-olive border border-stone/50">
        <CalendarIcon size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {isRange
            ? `${formatDay(range.startDate, { weekday: 'short', month: 'short', day: 'numeric' })} – ${formatDay(range.endDate, { weekday: 'short', month: 'short', day: 'numeric' })}`
            : formatDay(range.startDate)}
        </p>
        <p className="text-[11px] text-ink-mute">{rangeSubLabel(lengthType)}</p>
      </div>
      <p className={`shrink-0 text-xs font-bold ${tone}`}>{summarizeBuckets(range.buckets)}</p>
      <ChevronRightIcon size={14} className="shrink-0 text-ink-mute" />
    </button>
  )
}

function FlashCard({ tone, children }: { tone: 'olive' | 'blush'; children: ReactNode }) {
  const cls = tone === 'olive' ? 'bg-olive-tint text-olive' : 'bg-blush-tint text-blush'
  return (
    <Card className={`mb-3 ${cls}`}>
      <p className="text-sm font-medium">{children}</p>
    </Card>
  )
}

function Sheet({
  onClose,
  title,
  children,
}: {
  onClose: () => void
  title: string
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
      />
      <div className="relative mx-3 mb-3 w-full max-w-md rounded-[24px] bg-cream p-5 shadow-[var(--shadow-raised)]">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-ink-mute">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sand text-ink-soft"
            aria-label="Close"
          >
            <XIcon size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function eventSaveError(message: string) {
  const lower = message.toLowerCase()
  if (lower.includes('length_days') || lower.includes('length_type')) {
    return 'The length_days column is missing in Supabase. Run supabase/migrations/20260425_add_event_length_type.sql.'
  }
  if (lower.includes('location_') || lower.includes('event_notes') || lower.includes('start_time') || lower.includes('end_time')) {
    return 'The latest event-details SQL migration still needs to be applied in Supabase before those fields can save.'
  }
  return message
}
