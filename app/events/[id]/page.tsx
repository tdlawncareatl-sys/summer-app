'use client'

// Event detail — friendly hero up top, then the scheduling/voting tool below.
// Availability scoring lives in lib/availability.ts; this page composes UI.

import { useEffect, useMemo, useRef, useState, use, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ensureUser } from '@/lib/ensureUser'
import { useName } from '@/lib/useName'
import { categoryFor } from '@/lib/categories'
import { toLocalISODate } from '@/lib/date'
import { compareRankedDateOptions } from '@/lib/dateOptionRanking'
import { dispatchReadyNotifications, syncEventNotifications } from '@/lib/notifications'
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
  lengthLabel,
  normalizeLengthDays,
  normalizeLengthType,
  rangeSubLabel,
} from '@/lib/lengthType'
import {
  TIME_PREFERENCE_LABELS,
  TIME_PREFERENCES,
  type TimePreference,
  type VoteResponse,
  type VoteRow,
  rankOptions,
  recommendationConflictsWithConfirmed,
  tallyOption,
} from '@/lib/voting'
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
import AttendanceCard from '@/app/components/AttendanceCard'
import EventLocationFields from '@/app/components/EventLocationFields'
import Icon from '@/app/components/Icon'
import AddToCalendarButton from '@/app/components/AddToCalendarButton'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// Voting v2 shape: works/pass attendance + optional preferred star + optional
// time block. blocked* comes from the personal availability calendar (separate
// signal from votes — surfaced as info, doesn't drive the recommendation).
type DateOption = {
  id: string
  date: string
  end_date?: string | null
  votes: VoteRow[]
  worksCount: number
  passCount: number
  preferredCount: number
  topTimePreference: TimePreference | null
  blockedCount: number
  blockedNames: string[]
}

type EventRow = {
  id: string
  title: string
  description: string | null
  status: string
  created_by: string | null
  created_at: string | null
  confirmed_at?: string | null
  confirmed_date?: string | null
  confirmed_end_date?: string | null
  confirmation_method?: 'auto' | 'manual' | null
  confirmed_by?: string | null
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
  const router = useRouter()
  const [name] = useName()
  const [event, setEvent] = useState<EventRow | null>(null)
  const [loadingEvent, setLoadingEvent] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [availability, setAvailability] = useState<AvailabilityRow[]>([])
  const [groupBlackouts, setGroupBlackouts] = useState<GroupBlackouts>({})
  const [dateOptions, setDateOptions] = useState<DateOption[]>([])

  const [voting, setVoting] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [addingDate, setAddingDate] = useState(false)
  const [savingDetails, setSavingDetails] = useState(false)
  const [savingLength, setSavingLength] = useState(false)
  const [deletingEvent, setDeletingEvent] = useState(false)

  const [editingDetails, setEditingDetails] = useState(false)
  const [editingLength, setEditingLength] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [showCrew, setShowCrew] = useState(false)
  const [showAllBest, setShowAllBest] = useState(false)
  const [detailDraft, setDetailDraft] = useState<EventDetailsDraft>(() => eventDraftFromRecord())
  const [detailMessage, setDetailMessage] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [lengthDraft, setLengthDraft] = useState<number>(1)
  const [multiDayInput, setMultiDayInput] = useState(2)
  // Two ways to pick a range:
  //   1) Tap a day, tap another → range. `pickPhase = 'pending'` after the first tap.
  //   2) Press and drag across days → range commits on release.
  // Both paths converge on `selectedRange`; the `Add` button submits.
  const [selectedRange, setSelectedRange] = useState<{ start: string; end: string } | null>(null)
  const [pickPhase, setPickPhase] = useState<'idle' | 'pending'>('idle')
  const [dragPreview, setDragPreview] = useState<Set<string>>(new Set())
  const dragRef = useRef<{ startIso: string; didDrag: boolean } | null>(null)
  const wasDragRef = useRef(false)
  const calCardRef = useRef<HTMLDivElement | null>(null)

  const today = useMemo(() => new Date(), [])
  const todayISO = toLocalISODate(today)
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())

  useEffect(() => {
    void loadAll()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset the multi-day stepper when the picker opens, so it starts at the
  // current value (or sensible default of 2 if event isn't multi-day yet).
  useEffect(() => {
    if (editingLength) {
      const nextLength = normalizeLengthType(event?.length_days)
      setLengthDraft(nextLength)
      setMultiDayInput(event?.length_days && event.length_days >= 2 ? event.length_days : 2)
    }
  }, [editingLength, event?.length_days])

  async function loadAll(config?: { blocking?: boolean }) {
    const blocking = config?.blocking ?? true
    if (blocking) {
      setLoadingEvent(true)
    }
    setLoadError(null)

    const [
      { data: ev, error: eventError },
      { data: options },
      { data: votes },
      { data: users },
      { data: avail },
    ] = await Promise.all([
      supabase.from('events').select('*').eq('id', id).single(),
      supabase.from('date_options').select('id, date, end_date').eq('event_id', id).order('date', { ascending: true }),
      supabase.from('votes').select('date_option_id, response, preferred, time_preference, user_id'),
      supabase.from('users').select('id, name').order('name', { ascending: true }),
      supabase.from('availability').select('user_id, date'),
    ])

    if (eventError || !ev) {
      setEvent(null)
      setDateOptions([])
      setLoadError(eventError?.message ?? 'Could not find that event.')
      setLoadingEvent(false)
      return
    }

    setEvent(ev as EventRow)
    setDetailDraft(eventDraftFromRecord(ev))

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
      setLoadingEvent(false)
      return
    }

    const optionIds = new Set(options.map((option) => option.id))
    const relevantVotes = (votes ?? []).filter((vote) => optionIds.has(vote.date_option_id))

    const enriched: DateOption[] = options.map((option) => {
      const optionVotes: VoteRow[] = relevantVotes
        .filter((vote) => vote.date_option_id === option.id)
        .map((vote) => ({
          user_id: vote.user_id,
          user_name: userMap[vote.user_id] ?? '?',
          response: (vote.response === 'pass' ? 'pass' : 'works') as VoteResponse,
          preferred: !!vote.preferred,
          time_preference: (vote.time_preference as TimePreference | null) ?? null,
        }))
      const tally = tallyOption(optionVotes)
      const optionDays = getRange(option.date, option.end_date ?? option.date)
      const blockedSet = new Set<string>()
      for (const day of optionDays) (blackoutsMap[day] ?? []).forEach((n) => blockedSet.add(n))
      const blockedNames = [...blockedSet]
      return {
        ...option,
        votes: optionVotes,
        worksCount: tally.worksCount,
        passCount: tally.passCount,
        preferredCount: tally.preferredCount,
        topTimePreference: tally.topTimePreference,
        blockedCount: blockedNames.length,
        blockedNames,
      }
    })

    enriched.sort(compareRankedDateOptions)
    setDateOptions(enriched)
    setLoadingEvent(false)
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

  // Voting v2: rank by worksCount → preferredCount → date. `ranked` carries a
  // `status` per option ('recommended' | 'tied' | null). The single
  // recommendation (if any) drives the "Recommended" badge and the top-of-page
  // shortcut CTA.
  const ranked = useMemo(() => rankOptions(dateOptions, (option) => option.votes), [dateOptions])
  const recommendedOption = useMemo(() => ranked.find((r) => r.status === 'recommended')?.option ?? null, [ranked])
  const tiedOptionIds = useMemo(() => new Set(ranked.filter((r) => r.status === 'tied').map((r) => r.option.id)), [ranked])
  const showConfirmShortcut = !isConfirmed && !!recommendedOption

  // Identify which proposed option (if any) matches the currently confirmed
  // date so we can compare against the new recommendation and surface a
  // "votes have shifted" warning when they diverge.
  const confirmedOption = useMemo(() => {
    if (!isConfirmed || !event?.confirmed_date) return null
    return dateOptions.find((o) =>
      o.date === event.confirmed_date
      && (o.end_date ?? o.date) === (event.confirmed_end_date ?? event.confirmed_date),
    ) ?? null
  }, [isConfirmed, event?.confirmed_date, event?.confirmed_end_date, dateOptions])

  const recommendationConflicts = useMemo(
    () => recommendationConflictsWithConfirmed(ranked, confirmedOption),
    [ranked, confirmedOption],
  )

  const lengthDaysValue = normalizeLengthDays(event?.length_days)
  // Time blocks only apply to couple-hour events. A full-day plan already
  // implies the whole day; multi-day trips need a date, not a slot.
  const isShortEvent = lengthDaysValue === 0

  const headerLocationLine = event ? shortLocation(event.location_name, event.location_address) : null
  const headerAddressLine = event?.location_address?.trim() && headerLocationLine !== event.location_address?.trim()
    ? event.location_address.trim()
    : null
  const mapUrl = buildAppleMapsUrl(event?.location_name, event?.location_address)
  const summaryText = event?.description?.trim() || null
  const groupNotes = event?.event_notes?.trim() || null
  const locationNotes = event?.location_notes?.trim() || null
  const copyableLocation = event?.location_address?.trim() || event?.location_name?.trim() || null
  const copyLocationLabel = event?.location_address?.trim() ? 'Copy address' : 'Copy location'

  const whenLabel = isConfirmed && event?.confirmed_date
    ? formatRange(event.confirmed_date, event.confirmed_end_date)
    : topOption
      ? formatRange(topOption.date, topOption.end_date)
      : 'Dates still being proposed'

  const timeLabel = event ? formatClockRange(event.start_time, event.end_time) : null
  const placeFullLabel = event?.location_address?.trim() || event?.location_name?.trim() || 'Location not added yet'
  const notesLabel = event?.event_notes?.trim() || 'No notes yet'
  const notesIsPlaceholder = !event?.event_notes?.trim()
  const crewScore = isConfirmed && event?.confirmed_date
    ? scoreRange(event.confirmed_date, event.confirmed_end_date ?? event.confirmed_date, participants, availability)
    : topOption
      ? scoreRange(topOption.date, topOption.end_date ?? topOption.date, participants, availability)
      : null
  const crewFreeNames = crewScore
    ? participants
      .map((participant) => participant.name)
      .filter((participantName) => !crewScore.blockedNames.includes(participantName) && !crewScore.unknownNames.includes(participantName))
      .sort()
    : []

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

  function startEditingDetails() {
    if (!event) return
    setDetailDraft(eventDraftFromRecord(event))
    setDetailError(null)
    setDetailMessage(null)
    setShowOptions(false)
    setEditingDetails(true)
  }

  async function refreshEventNotifications(actorUserId?: string | null, shouldDispatch = false) {
    try {
      await syncEventNotifications(id, actorUserId)
      if (shouldDispatch) {
        await dispatchReadyNotifications(id)
      }
    } catch (error) {
      console.error('Notification sync failed', error)
    }
  }

  async function addDateOption() {
    if (!selectedRange || !name) return
    setAddingDate(true)
    setDetailError(null)
    const actorUserId = await ensureUser(name)
    const payload: Record<string, string> = { event_id: id, date: selectedRange.start, created_by: name }
    if (selectedRange.end !== selectedRange.start) payload.end_date = selectedRange.end
    const { error } = await supabase.from('date_options').insert(payload)
    if (error) {
      setDetailError(error.message)
      setAddingDate(false)
      return
    }
    setSelectedRange(null)
    setDetailMessage('Date option added.')
    setAddingDate(false)
    await loadAll({ blocking: false })
    await refreshEventNotifications(actorUserId, true)
  }

  // Apply a vote write optimistically. The caller passes the full intended row
  // (or null to clear); we replace any existing vote from this user on this
  // option and re-tally locally so the UI reflects the change immediately.
  function applyVoteLocally(
    options: DateOption[],
    currentUserName: string,
    dateOptionId: string,
    nextVote: VoteRow | null,
  ) {
    const next = options.map((option) => {
      if (option.id !== dateOptionId) return option
      const votes = option.votes.filter((row) => row.user_name !== currentUserName)
      if (nextVote) votes.push(nextVote)
      const tally = tallyOption(votes)
      return {
        ...option,
        votes,
        worksCount: tally.worksCount,
        passCount: tally.passCount,
        preferredCount: tally.preferredCount,
        topTimePreference: tally.topTimePreference,
      }
    })
    next.sort(compareRankedDateOptions)
    return next
  }

  // Generic write — upsert the vote row, delete-if-clearing. Used by all three
  // vote actions (toggle works/pass, toggle preferred, set time preference).
  async function writeVote(dateOptionId: string, payload: { response: VoteResponse; preferred: boolean; time_preference: TimePreference | null } | null) {
    if (!name || voting) return
    setVoting(dateOptionId)
    setDetailError(null)
    const previousDateOptions = dateOptions

    const nextLocal: VoteRow | null = payload ? {
      user_id: '__optimistic__',
      user_name: name,
      response: payload.response,
      preferred: payload.preferred,
      time_preference: payload.time_preference,
    } : null
    setDateOptions((current) => applyVoteLocally(current, name, dateOptionId, nextLocal))

    try {
      const userId = await ensureUser(name)
      if (payload === null) {
        const { error } = await supabase
          .from('votes')
          .delete()
          .eq('date_option_id', dateOptionId)
          .eq('user_id', userId)
        if (error) throw error
      } else {
        // `points` is kept on the table for backward compat — set it to 1 for
        // works and 0 for pass so any unmigrated reader still sorts sanely.
        const points = payload.response === 'works' ? 1 : 0
        const { data: existing, error: existingError } = await supabase
          .from('votes')
          .select('id')
          .eq('date_option_id', dateOptionId)
          .eq('user_id', userId)
          .maybeSingle()
        if (existingError) throw existingError

        if (existing) {
          const { error } = await supabase
            .from('votes')
            .update({ ...payload, points })
            .eq('id', existing.id)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('votes')
            .insert({ date_option_id: dateOptionId, user_id: userId, points, ...payload })
          if (error) throw error
        }
      }
      void loadAll({ blocking: false })
      await refreshEventNotifications(userId, true)
    } catch (error) {
      setDateOptions(previousDateOptions)
      setDetailError(error instanceof Error ? error.message : 'Could not save your vote.')
    } finally {
      setVoting(null)
    }
  }

  function myVoteOn(option: DateOption): VoteRow | null {
    return option.votes.find((row) => row.user_name === name) ?? null
  }

  // High-level vote actions called from the UI:
  async function voteWorksPass(option: DateOption, response: VoteResponse) {
    const existing = myVoteOn(option)
    // Tapping the active state clears the vote entirely.
    if (existing && existing.response === response) {
      await writeVote(option.id, null)
      return
    }
    if (response === 'pass') {
      // Pass clears preferred + time preference per spec.
      await writeVote(option.id, { response: 'pass', preferred: false, time_preference: null })
    } else {
      // Works preserves an existing preferred / time preference where possible.
      await writeVote(option.id, {
        response: 'works',
        preferred: existing?.preferred ?? false,
        time_preference: existing?.time_preference ?? null,
      })
    }
  }

  async function togglePreferred(option: DateOption) {
    if (!name || voting) return
    const existing = myVoteOn(option)

    // Toggling OFF is simple — flip preferred to false on this option, leaving
    // the works vote intact. Goes through the shared single-option write path.
    if (existing && existing.preferred) {
      await writeVote(option.id, {
        response: 'works',
        preferred: false,
        time_preference: existing.time_preference,
      })
      return
    }

    // Toggling ON makes this the user's single preferred date for the event.
    // Demote any other preferred=true rows from this user before writing.
    setVoting(option.id)
    setDetailError(null)
    const previousDateOptions = dateOptions

    const nextLocal: VoteRow = {
      user_id: '__optimistic__',
      user_name: name,
      response: 'works',
      preferred: true,
      time_preference: existing?.time_preference ?? null,
    }

    // Optimistic: clear my preferred on every other option's vote, then upsert
    // this option's vote (handles the "promote from missing/pass to works"
    // case via applyVoteLocally).
    setDateOptions((current) => {
      const demoted = current.map((opt) => {
        if (opt.id === option.id) return opt
        const votes = opt.votes.map((row) =>
          row.user_name === name && row.preferred ? { ...row, preferred: false } : row,
        )
        const tally = tallyOption(votes)
        return {
          ...opt,
          votes,
          worksCount: tally.worksCount,
          passCount: tally.passCount,
          preferredCount: tally.preferredCount,
          topTimePreference: tally.topTimePreference,
        }
      })
      return applyVoteLocally(demoted, name, option.id, nextLocal)
    })

    try {
      const userId = await ensureUser(name)
      const otherIds = dateOptions.filter((o) => o.id !== option.id).map((o) => o.id)
      if (otherIds.length > 0) {
        const { error: demoteError } = await supabase
          .from('votes')
          .update({ preferred: false })
          .eq('user_id', userId)
          .eq('preferred', true)
          .in('date_option_id', otherIds)
        if (demoteError) throw demoteError
      }

      const points = 1
      const { data: existingRow, error: existingError } = await supabase
        .from('votes')
        .select('id')
        .eq('date_option_id', option.id)
        .eq('user_id', userId)
        .maybeSingle()
      if (existingError) throw existingError

      const payload = {
        response: 'works' as const,
        preferred: true,
        time_preference: nextLocal.time_preference,
        points,
      }
      if (existingRow) {
        const { error } = await supabase.from('votes').update(payload).eq('id', existingRow.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('votes').insert({
          date_option_id: option.id,
          user_id: userId,
          ...payload,
        })
        if (error) throw error
      }

      void loadAll({ blocking: false })
      await refreshEventNotifications(userId, true)
    } catch (error) {
      setDateOptions(previousDateOptions)
      setDetailError(error instanceof Error ? error.message : 'Could not save your vote.')
    } finally {
      setVoting(null)
    }
  }

  async function setTimePreferenceFor(option: DateOption, slot: TimePreference) {
    const existing = myVoteOn(option)
    if (!existing || existing.response !== 'works') return // gated in UI too
    const next: TimePreference | null = existing.time_preference === slot ? null : slot
    await writeVote(option.id, {
      response: 'works',
      preferred: existing.preferred,
      time_preference: next,
    })
  }

  async function confirmEvent(chosen?: DateOption) {
    if (!event || confirming) return
    // Default to the system recommendation; allow any user to lock in any
    // proposed date manually. `confirmation_method` records which path was
    // taken so we can show why a non-recommended date is locked.
    const winner = chosen ?? recommendedOption ?? dateOptions[0]
    if (!winner) {
      setDetailError('Add at least one date option before confirming the event.')
      return
    }
    if (typeof window !== 'undefined' && chosen && recommendedOption && chosen.id !== recommendedOption.id) {
      if (!window.confirm(`Lock in ${formatRange(chosen.date, chosen.end_date)}? This is different from the recommended date.`)) {
        return
      }
    }
    setConfirming(true)
    setDetailError(null)
    const confirmedAt = new Date().toISOString()
    const isManual = !!chosen
    const actorUserId = name ? await ensureUser(name) : null
    const { error } = await supabase.from('events').update({
      status: 'confirmed',
      confirmed_at: confirmedAt,
      confirmed_date: winner.date,
      confirmed_end_date: winner.end_date ?? null,
      confirmation_method: isManual ? 'manual' : 'auto',
      confirmed_by: name ?? event.created_by ?? null,
    }).eq('id', event.id)
    if (error) {
      setDetailError(error.message)
      setConfirming(false)
      return
    }
    setEvent({
      ...event,
      status: 'confirmed',
      confirmed_at: confirmedAt,
      confirmed_date: winner.date,
      confirmed_end_date: winner.end_date,
      confirmation_method: isManual ? 'manual' : 'auto',
      confirmed_by: name ?? event.created_by ?? null,
    })
    // Silent seed: votes on the winning option become attendance. Only fills
    // gaps — never overwrites an existing attendance row, so re-confirming
    // an event preserves anyone's explicit choice.
    await seedAttendanceFromVotes(event.id, winner)
    setDetailMessage('Event confirmed.')
    setConfirming(false)
    await loadAll({ blocking: false })
    await refreshEventNotifications(actorUserId, true)
  }

  async function seedAttendanceFromVotes(eventId: string, winner: DateOption) {
    const seed = winner.votes
      .filter((vote) => vote.response === 'works' || vote.response === 'pass')
      .map((vote) => ({
        event_id: eventId,
        user_id: vote.user_id,
        status: vote.response === 'works' ? 'going' : 'not_going',
        updated_at: new Date().toISOString(),
      }))
    if (seed.length === 0) return
    // ignoreDuplicates so manual choices win over the seed
    const { error } = await supabase
      .from('attendance')
      .upsert(seed, { onConflict: 'event_id,user_id', ignoreDuplicates: true })
    if (error) console.error('seed attendance:', error)
  }

  async function unconfirmEvent() {
    if (!event || confirming) return
    if (typeof window !== 'undefined' && !window.confirm('Unlock this event so the group can vote on a different date?')) return
    setConfirming(true)
    setDetailError(null)
    setDetailMessage(null)
    const actorUserId = name ? await ensureUser(name) : null
    const { error } = await supabase
      .from('events')
      .update({ status: 'planning', confirmed_at: null, confirmed_date: null, confirmed_end_date: null })
      .eq('id', event.id)
    if (error) {
      setDetailError(error.message)
      setConfirming(false)
      return
    }
    setEvent({ ...event, status: 'planning', confirmed_at: null, confirmed_date: null, confirmed_end_date: null })
    setDetailMessage('Confirmation cleared — pick a new date below.')
    setConfirming(false)
    await refreshEventNotifications(actorUserId, true)
    requestAnimationFrame(focusCalendar)
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

  function commitLengthDraft() {
    const nextLength = lengthDraft >= 2 ? Math.max(2, Math.min(30, multiDayInput)) : lengthDraft
    void saveLength(nextLength)
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

  async function copyLocation() {
    if (typeof window === 'undefined' || !copyableLocation) return
    try {
      await navigator.clipboard?.writeText(copyableLocation)
      setDetailMessage(event?.location_address?.trim() ? 'Address copied.' : 'Location copied.')
      setDetailError(null)
      setShowOptions(false)
    } catch {
      setDetailError('Could not copy the location from this browser.')
    }
  }

  async function deleteEvent() {
    if (!event || !isCreator || deletingEvent) return
    if (typeof window !== 'undefined') {
      const shouldDelete = window.confirm(
        `Delete ${event.title}? This will remove its proposed dates, votes, and related updates.`,
      )
      if (!shouldDelete) return
    }

    setDeletingEvent(true)
    setDetailMessage(null)
    setDetailError(null)
    setShowOptions(false)

    const { error } = await supabase.from('events').delete().eq('id', event.id)

    if (error) {
      setDetailError(error.message)
      setDeletingEvent(false)
      return
    }

    router.replace('/events')
    router.refresh()
  }

  // ─────────── calendar interactions ───────────

  function handleCalendarTap(iso: string) {
    if (iso < todayISO) return
    // Drag just committed — swallow the synthetic click that follows pointerup.
    if (wasDragRef.current) return
    if (pickPhase === 'idle' || !selectedRange) {
      // First tap — anchor a single-day pending selection.
      setSelectedRange({ start: iso, end: iso })
      setPickPhase('pending')
      return
    }
    // Second tap — complete the range (sorted regardless of which day was tapped first).
    const start = iso < selectedRange.start ? iso : selectedRange.start
    const end = iso < selectedRange.start ? selectedRange.start : iso
    setSelectedRange({ start, end })
    setPickPhase('idle')
  }

  function clearSelection() {
    setSelectedRange(null)
    setPickPhase('idle')
  }

  // ─── drag-to-select-range ────────────────────────────────────────────────
  function isoUnderPointer(clientX: number, clientY: number): string | null {
    const el = document.elementFromPoint(clientX, clientY)
    return el?.closest('[data-iso]')?.getAttribute('data-iso') ?? null
  }
  function onGridPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const iso = isoUnderPointer(e.clientX, e.clientY)
    if (!iso || iso < todayISO) return
    dragRef.current = { startIso: iso, didDrag: false }
    setDragPreview(new Set([iso]))
  }
  function onGridPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return
    const iso = isoUnderPointer(e.clientX, e.clientY)
    if (!iso || iso < todayISO) return
    if (iso !== dragRef.current.startIso) dragRef.current.didDrag = true
    setDragPreview(new Set(getRange(dragRef.current.startIso, iso)))
  }
  function onGridPointerUp() {
    if (!dragRef.current) return
    const { didDrag } = dragRef.current
    const days = [...dragPreview].sort()
    dragRef.current = null
    setDragPreview(new Set())
    if (!didDrag) return // single tap — let onClick run handleCalendarTap normally
    // Drag committed: set the range outright, skip the next synthetic click.
    setSelectedRange({ start: days[0], end: days[days.length - 1] })
    setPickPhase('idle')
    wasDragRef.current = true
    setTimeout(() => { wasDragRef.current = false }, 0)
  }
  function onGridPointerCancel() {
    dragRef.current = null
    setDragPreview(new Set())
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

  if (loadingEvent) {
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

  if (!event) {
    return (
      <main className="mx-auto max-w-md px-5">
        <div className="pt-4 pb-2">
          <Link
            href="/events"
            className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:text-ink"
            aria-label="Back to events"
          >
            <Icon name="chevronLeft" size={18} />
          </Link>
        </div>
        <Card className="mt-4">
          <p className="text-lg font-semibold text-ink">This event couldn&apos;t be loaded.</p>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            {loadError ?? 'The link may be stale, or the event may have been removed.'}
          </p>
          <Link
            href="/events"
            className="mt-4 inline-flex items-center gap-2 rounded-[14px] bg-olive px-4 py-2.5 text-sm font-semibold text-white"
          >
            Back to events
          </Link>
        </Card>
      </main>
    )
  }

  const category = categoryFor(event.title)
  const bestSummary = topBest && topBest.buckets.blocked === 0 && topBest.buckets.unknown === 0
    ? summarizeBuckets(topBest.buckets)
    : null
  const hasLengthDraftChanges = lengthDraft >= 2
    ? multiDayInput !== lengthType
    : lengthDraft !== lengthType

  return (
    <main className="mx-auto max-w-md px-5 pb-12 no-select">
      {/* Top nav */}
      <nav className="flex items-center justify-between pt-4 pb-2">
        <Link
          href="/events"
          className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:text-ink"
          aria-label="Back to events"
        >
          <Icon name="chevronLeft" size={18} />
        </Link>
        <button
          type="button"
          onClick={() => setShowOptions(true)}
          className="-mr-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-mute hover:text-ink-soft"
          aria-label="More options"
        >
          <Icon name="more" size={18} />
        </button>
      </nav>

      {/* Hero */}
      <header className="mb-4">
        <div className="flex items-start gap-4">
          <IconTile name={category.iconName} tint={category.tint} size={84} rounded="lg" iconSize={42} />
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
                  <Icon name="mapPin" size={14} />
                  {headerLocationLine}
                </a>
              ) : (
                <span className="mt-1.5 inline-flex items-center gap-1.5 text-[15px] font-semibold text-olive">
                  <Icon name="mapPin" size={14} />
                  {headerLocationLine}
                </span>
              )
            ) : null}
            {headerAddressLine ? (
              <p className="mt-0.5 text-sm text-ink-soft">{headerAddressLine}</p>
            ) : null}
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-ink-soft">
              <Icon name="calendar" size={14} />
              {whenLabel}
            </p>
            {summaryText ? (
              <p className="mt-2 max-w-[28ch] text-sm leading-6 text-ink-soft">{summaryText}</p>
            ) : null}
          </div>
        </div>
      </header>

      {detailMessage ? <FlashCard tone="olive">{detailMessage}</FlashCard> : null}
      {detailError ? <FlashCard tone="blush">{detailError}</FlashCard> : null}

      {/* Action row */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {isConfirmed ? (
          <button
            type="button"
            disabled={!isCreator || confirming}
            onClick={() => void unconfirmEvent()}
            className="flex flex-1 min-w-[110px] items-center justify-center gap-1.5 rounded-[14px] bg-olive px-4 py-3 text-sm font-bold text-white shadow-[var(--shadow-soft)] active:scale-[0.98] disabled:opacity-50"
            title={isCreator ? undefined : 'Only the event creator can change the date'}
          >
            <Icon name="calendar" size={14} />
            {confirming ? 'Unlocking…' : 'Change date'}
          </button>
        ) : (
          <button
            type="button"
            onClick={focusCalendar}
            className="flex flex-1 min-w-[110px] items-center justify-center gap-1.5 rounded-[14px] bg-olive px-4 py-3 text-sm font-bold text-white shadow-[var(--shadow-soft)] active:scale-[0.98]"
          >
            <Icon name="calendar" size={14} />
            Add time
          </button>
        )}
        <button
          type="button"
          disabled={!isCreator}
          onClick={startEditingDetails}
          className="flex flex-1 min-w-[110px] items-center justify-center gap-1.5 rounded-[14px] bg-sand px-4 py-3 text-sm font-semibold text-ink-soft active:scale-[0.98] disabled:opacity-50"
          title={isCreator ? undefined : 'Only the event creator can edit details'}
        >
          <Icon name="pencil" size={14} />
          Edit details
        </button>
        <button
          type="button"
          onClick={() => void shareEvent()}
          className="flex flex-1 min-w-[110px] items-center justify-center gap-1.5 rounded-[14px] bg-sand px-4 py-3 text-sm font-semibold text-ink-soft active:scale-[0.98]"
        >
          <Icon name="share" size={14} />
          Share
        </button>
      </div>

      {/* Details */}
      <Card className="mb-4" padded={false}>
        <div className="px-4 pt-3 pb-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-mute">Details</p>
        </div>
        <DetailRow
          icon={<Icon name="calendar" size={14} />}
          label="When"
          value={whenLabel}
          onTap={focusCalendar}
          editable={!isConfirmed}
        />
        <DetailRow
          icon={<Icon name="mapPin" size={14} />}
          label="Where"
          value={placeFullLabel}
          onTap={isCreator ? startEditingDetails : undefined}
          editable={isCreator}
          muted={!event.location_address?.trim() && !event.location_name?.trim()}
        />
        <DetailRow
          icon={<Icon name="clock" size={14} />}
          label="Length"
          value={lengthLabel(lengthType)}
          chip
          onTap={() => isCreator && setEditingLength(true)}
          editable={isCreator}
        />
        <DetailRow
          icon={<Icon name="note" size={14} />}
          label="Notes"
          value={notesLabel}
          onTap={isCreator ? startEditingDetails : undefined}
          editable={isCreator}
          muted={notesIsPlaceholder}
          last
        />
      </Card>

      {/* Time pill (if set) */}
      {timeLabel ? (
        <div className="mb-4 flex items-center justify-center gap-2 rounded-[14px] bg-cream px-3 py-2 text-sm text-ink-soft border border-stone/50">
          <Icon name="clock" size={14} />
          <span className="font-medium text-ink">{timeLabel}</span>
        </div>
      ) : null}

      {(headerLocationLine || headerAddressLine || locationNotes) ? (
        <Card className="mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-mute">Where</p>
              {headerLocationLine ? (
                <p className="mt-1 text-base font-semibold text-ink">{headerLocationLine}</p>
              ) : null}
              {headerAddressLine || (!headerLocationLine && placeFullLabel !== 'Location not added yet') ? (
                <p className="mt-1 text-sm leading-6 text-ink-soft">{headerAddressLine ?? placeFullLabel}</p>
              ) : null}
            </div>
            {isCreator ? (
              <button
                type="button"
                onClick={startEditingDetails}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sand text-ink-soft"
                aria-label="Edit location details"
              >
                <Icon name="pencil" size={14} />
              </button>
            ) : null}
          </div>
          {(mapUrl || copyableLocation) ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {mapUrl ? (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-[14px] bg-olive px-3.5 py-2 text-sm font-semibold text-white"
                >
                  <Icon name="mapPin" size={14} />
                  Open in Apple Maps
                </a>
              ) : null}
              {copyableLocation ? (
                <button
                  type="button"
                  onClick={() => void copyLocation()}
                  className="inline-flex items-center gap-2 rounded-[14px] bg-sand px-3.5 py-2 text-sm font-semibold text-ink-soft"
                >
                  <Icon name="copy" size={14} />
                  {copyLocationLabel}
                </button>
              ) : null}
            </div>
          ) : null}
          {locationNotes ? (
            <div className="mt-3 rounded-[16px] bg-sand px-3 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-mute">Parking / meetup</p>
              <p className="mt-1 text-sm leading-6 text-ink-soft">{locationNotes}</p>
            </div>
          ) : null}
        </Card>
      ) : null}

      {groupNotes ? (
        <Card className="mb-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-mute">What to know</p>
          <p className="mt-1 text-sm leading-6 text-ink-soft">{groupNotes}</p>
        </Card>
      ) : null}

      {/* Confirmed banner */}
      {isConfirmed && event.confirmed_date ? (
        <Card className="mb-4 bg-olive text-white" padded={false}>
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest opacity-70">
                  <Icon name="check" size={14} />
                  It&apos;s happening
                </p>
                <p className="font-serif text-2xl font-black leading-tight">
                  {formatRange(event.confirmed_date, event.confirmed_end_date)}
                </p>
              </div>
              {isCreator ? (
                <button
                  type="button"
                  onClick={() => void unconfirmEvent()}
                  disabled={confirming}
                  className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white hover:bg-white/25 active:scale-[0.98] disabled:opacity-50"
                >
                  {confirming ? '…' : 'Change date'}
                </button>
              ) : null}
            </div>
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
            <div className="mt-3 flex">
              <AddToCalendarButton
                eventId={event.id}
                variant="onOlive"
                event={{ ...event, confirmed_date: event.confirmed_date }}
              />
            </div>
          </div>
        </Card>
      ) : null}

      {isConfirmed ? (
        <AttendanceCard
          eventId={event.id}
          participants={participants}
          currentUserName={name}
        />
      ) : null}

      {/* Top-of-page shortcut — locks in the system-recommended date. Per-option
          "Lock this date" buttons below let any user pick a different option,
          which is logged as a manual confirmation. */}
      {showConfirmShortcut && recommendedOption ? (
        <button type="button"
          onClick={() => void confirmEvent()}
          disabled={confirming}
          className="mb-4 w-full rounded-[var(--radius-lg)] bg-olive py-3.5 text-sm font-bold text-white shadow-[var(--shadow-soft)] transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {confirming ? 'Confirming…' : `Lock in recommended — ${formatRange(recommendedOption.date, recommendedOption.end_date)}`}
        </button>
      ) : null}

      {/* Warning when a confirmed date is no longer the recommendation. We do
          NOT auto-change the locked date — surfacing the divergence lets the
          group decide whether to unlock and re-lock. */}
      {recommendationConflicts && recommendedOption ? (
        <Card className="mb-4 bg-amber-tint">
          <p className="text-sm font-semibold text-amber">Votes have shifted since this date was locked in</p>
          <p className="mt-1 text-xs text-amber">
            New recommendation: <span className="font-bold">{formatRange(recommendedOption.date, recommendedOption.end_date)}</span>.
            Unlock the event to lock a different date in.
          </p>
        </Card>
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
          <p className="mb-3 text-xs text-ink-soft">Tap a range to seed the calendar, then tap a later day if you want to extend it.</p>
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
              <Icon name="chevronRight" size={14} className={showAllBest ? 'rotate-[270deg]' : 'rotate-90'} />
            </button>
          ) : null}
        </Card>
      ) : null}

      {/* Voting list — only when there are date options */}
      {dateOptions.length > 0 && !isConfirmed ? (
        <div className="mb-4 flex flex-col gap-2.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-mute">Proposed dates</p>
          {dateOptions.map((option) => {
            const myVote = myVoteOn(option)
            const myResponse: VoteResponse | null = myVote?.response ?? null
            const myPreferred = !!myVote?.preferred
            const myTimePref = myVote?.time_preference ?? null
            const isRecommended = recommendedOption?.id === option.id
            const isTied = tiedOptionIds.has(option.id)
            const isRange = !!option.end_date && option.end_date !== option.date
            const cardClass = isRecommended ? 'ring-1 ring-olive' : isTied ? 'ring-1 ring-amber' : ''
            const lockClass = isRecommended ? 'bg-olive text-white' : 'bg-olive-tint text-olive'
            return (
              <Card key={option.id} className={cardClass}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {isRecommended ? (
                      <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wider text-olive">Recommended</p>
                    ) : isTied ? (
                      <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wider text-amber">Tied for top</p>
                    ) : null}
                    <p className="font-bold text-ink">
                      {isRange
                        ? `${formatDay(option.date, { month: 'short', day: 'numeric' })} – ${formatDay(option.end_date!, { month: 'short', day: 'numeric' })}`
                        : formatDay(option.date)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-olive">
                        Works: {option.worksCount}{participants.length ? ` / ${participants.length}` : ''}
                      </span>
                      {option.preferredCount > 0 ? (
                        <span className="text-ink-soft">Preferred: {option.preferredCount}</span>
                      ) : null}
                      {option.passCount > 0 ? (
                        <span className="text-blush">Pass: {option.passCount}</span>
                      ) : null}
                      {isShortEvent && option.topTimePreference ? (
                        <span className="rounded-full bg-sand px-2 py-0.5 font-semibold text-ink-soft">
                          Top time: {TIME_PREFERENCE_LABELS[option.topTimePreference]}
                        </span>
                      ) : null}
                      {option.blockedCount > 0 ? (
                        <span className="rounded-full bg-blush-tint px-2 py-0.5 font-semibold text-blush">
                          {option.blockedCount} on calendar
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {name ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void voteWorksPass(option, 'works')}
                        disabled={voting === option.id}
                        aria-pressed={myResponse === 'works'}
                        className={[
                          'rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all active:scale-95',
                          myResponse === 'works' ? VOTE.works.strong : 'bg-sand text-ink-soft hover:bg-sand-alt',
                        ].join(' ')}
                      >
                        Works
                      </button>
                      <button
                        type="button"
                        onClick={() => void voteWorksPass(option, 'pass')}
                        disabled={voting === option.id}
                        aria-pressed={myResponse === 'pass'}
                        className={[
                          'rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all active:scale-95',
                          myResponse === 'pass' ? VOTE.pass.strong : 'bg-sand text-ink-soft hover:bg-sand-alt',
                        ].join(' ')}
                      >
                        Pass
                      </button>
                      <button
                        type="button"
                        onClick={() => void togglePreferred(option)}
                        disabled={voting === option.id}
                        aria-pressed={myPreferred}
                        aria-label={myPreferred ? 'Remove preferred mark' : 'Mark as preferred (tie-breaker)'}
                        title={myPreferred ? 'Remove preferred mark' : 'Mark as preferred (tie-breaker)'}
                        className={[
                          'inline-flex h-7 w-7 items-center justify-center rounded-full text-base transition-all active:scale-95',
                          myPreferred ? 'bg-amber-tint text-amber' : 'bg-sand text-ink-faint hover:text-ink-soft',
                        ].join(' ')}
                      >
                        {myPreferred ? '★' : '☆'}
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* Time block preference — only for short events, only when I'm marked Works */}
                {isShortEvent && myResponse === 'works' ? (
                  <div className="mt-2 rounded-xl bg-sand-alt/60 px-3 py-2">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-mute">What time works best?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {TIME_PREFERENCES.map((slot) => {
                        const isActive = myTimePref === slot
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => void setTimePreferenceFor(option, slot)}
                            disabled={voting === option.id}
                            className={[
                              'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-95',
                              isActive ? 'bg-olive text-white' : 'bg-cream text-ink-soft border border-stone/50 hover:text-ink',
                            ].join(' ')}
                          >
                            {TIME_PREFERENCE_LABELS[slot]}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                {option.votes.length > 0 ? (
                  <div className="mt-2 border-t border-sand-alt pt-2">
                    <div className="flex flex-wrap gap-1.5">
                      {option.votes.map((row) => {
                        const tone = row.response === 'works' ? VOTE.works : VOTE.pass
                        return (
                          <span
                            key={row.user_name}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tone.tint} ${tone.text}`}
                          >
                            <Avatar name={row.user_name} size={14} />
                            {row.user_name}
                            {row.preferred ? <span className="text-amber">★</span> : null}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                {option.blockedNames.length > 0 ? (
                  <div className="mt-2 border-t border-sand-alt pt-2">
                    <p className="mb-1.5 text-xs text-ink-mute">Blocked on personal calendar ({option.blockedCount})</p>
                    <div className="flex flex-wrap gap-1">
                      {option.blockedNames.map((blockedName) => (
                        <span key={blockedName} className="rounded-full bg-blush-tint px-2 py-0.5 text-xs font-medium text-blush">
                          {blockedName}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {name ? (
                  <div className="mt-3 border-t border-sand-alt pt-3">
                    <button
                      type="button"
                      onClick={() => void confirmEvent(option)}
                      disabled={confirming}
                      className={[
                        'flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-40',
                        lockClass,
                      ].join(' ')}
                    >
                      <Icon name="check" size={12} />
                      Lock this date
                    </button>
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
          <p className="mb-3 text-xs text-ink-soft">Tap one day to start, then tap a later day to fill in every day between.</p>

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

          <div className="mb-3 overflow-hidden rounded-[var(--radius-md)] border border-sand-alt">
            <div className="flex items-center justify-between bg-ink px-3 py-2 text-cream">
              <button type="button"
                onClick={prevMonth}
                className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-white/10"
                aria-label="Previous month"
              >
                <Icon name="chevronLeft" size={16} />
              </button>
              <span className="text-xs font-semibold">{MONTHS[calMonth]} {calYear}</span>
              <button type="button"
                onClick={nextMonth}
                className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-white/10"
                aria-label="Next month"
              >
                <Icon name="chevronRight" size={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 border-b border-sand-alt bg-sand">
              {DAY_LABELS.map((label, idx) => (
                <div key={`${label}-${idx}`} className="py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-ink-mute">{label}</div>
              ))}
            </div>

            <div
              className="calendar-grid grid grid-cols-7 gap-0.5 bg-cream p-2"
              onPointerDown={onGridPointerDown}
              onPointerMove={onGridPointerMove}
              onPointerUp={onGridPointerUp}
              onPointerCancel={onGridPointerCancel}
              onPointerLeave={onGridPointerCancel}
            >
              {calCells.map((iso, idx) => {
                if (!iso) return <div key={`empty-${idx}`} className="aspect-square" />
                const isPast = iso < todayISO
                const isInSelected = !!selectedRange && iso >= selectedRange.start && iso <= selectedRange.end
                const isInDrag = dragPreview.has(iso)
                const isPending = pickPhase === 'pending' && !!selectedRange && iso === selectedRange.start
                const isToday = iso === todayISO
                const blockedCount = groupBlackouts[iso]?.length ?? 0
                const day = parseInt(iso.split('-')[2], 10)
                const density = densityForDay(blockedCount, totalParticipants)

                let cellClass: string
                if (isPast) {
                  cellClass = 'bg-sand-alt text-ink-faint cursor-default'
                } else if (isInDrag) {
                  cellClass = 'bg-olive-soft text-olive font-semibold cursor-pointer'
                } else if (isInSelected) {
                  cellClass = 'bg-olive text-white font-bold cursor-pointer'
                } else {
                  cellClass = `${densityClasses(density)} cursor-pointer`
                }

                return (
                  <button
                    key={iso}
                    type="button"
                    data-iso={iso}
                    disabled={isPast}
                    onClick={() => handleCalendarTap(iso)}
                    className={[
                      'aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-colors',
                      cellClass,
                      isToday && !isInSelected && !isInDrag ? 'ring-1 ring-olive' : '',
                      isPending && !isInDrag ? 'ring-2 ring-olive ring-offset-1 ring-offset-cream' : '',
                    ].join(' ')}
                  >
                    <span className="leading-none">{day}</span>
                    {blockedCount > 0 && !isPast && !isInSelected && !isInDrag ? (
                      <span className="mt-0.5 text-[8px] leading-none opacity-70">{blockedCount}</span>
                    ) : null}
                  </button>
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
                <span className="text-ink-mute">
                  {pickPhase === 'pending' ? 'Tap another day to extend, or Add to confirm' : 'Tap a day, or drag for a range'}
                </span>
              )}
            </div>
            {selectedRange ? (
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-xl bg-sand px-3 py-2.5 text-sm font-semibold text-ink-soft transition-all active:scale-95"
              >
                Clear
              </button>
            ) : null}
            <button type="button"
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
          onClick={() => setShowCrew(true)}
          className="inline-flex items-center gap-2 rounded-full bg-cream px-3 py-1.5 text-left text-xs font-semibold text-ink-soft border border-stone/40"
        >
          <Icon name="users" size={12} />
          <span className="leading-tight">
            <span className="block text-[10px] uppercase tracking-[0.12em] text-ink-mute">Crew status</span>
            <span className="block text-xs text-ink-soft">
              {crewScore ? summarizeBuckets(crewScore.buckets) : totalParticipants > 0 ? `${totalParticipants} in the crew` : 'No crew data yet'}
            </span>
          </span>
          <Icon name="chevronRight" size={12} />
        </button>
      </footer>

      {showOptions ? (
        <Sheet onClose={() => setShowOptions(false)} title="Event options">
          <div className="flex flex-col gap-2">
            <SheetAction
              icon={<Icon name="share" size={14} />}
              title="Share event"
              description="Send the event link to the group."
              onClick={() => void shareEvent().finally(() => setShowOptions(false))}
            />
            {mapUrl ? (
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => setShowOptions(false)}
                className="flex items-start gap-3 rounded-[16px] bg-sand px-4 py-3 text-left"
              >
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-tint text-teal">
                  <Icon name="mapPin" size={14} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">Open in Apple Maps</span>
                  <span className="mt-0.5 block text-xs leading-5 text-ink-soft">Jump straight into directions.</span>
                </span>
              </a>
            ) : null}
            {copyableLocation ? (
              <SheetAction
                icon={<Icon name="copy" size={14} />}
                title={copyLocationLabel}
                description="Copy the location for texts or navigation."
                onClick={() => void copyLocation()}
              />
            ) : null}
            {isCreator ? (
              <SheetAction
                icon={<Icon name="pencil" size={14} />}
                title="Edit details"
                description="Update the name, summary, location, or notes."
                onClick={startEditingDetails}
              />
            ) : null}
            {isCreator ? (
              <SheetAction
                icon={<Icon name="x" size={14} />}
                title={deletingEvent ? 'Deleting event…' : 'Delete event'}
                description="Remove this event and its vote history."
                onClick={() => void deleteEvent()}
                tone="danger"
                disabled={deletingEvent}
              />
            ) : null}
          </div>
        </Sheet>
      ) : null}

      {showCrew ? (
        <Sheet onClose={() => setShowCrew(false)} title="Crew status">
          {crewScore ? (
            <div className="space-y-3">
              <div className="rounded-[16px] bg-sand px-4 py-3">
                <p className="text-sm font-semibold text-ink">{whenLabel}</p>
                <p className="mt-1 text-xs leading-5 text-ink-soft">{summarizeBuckets(crewScore.buckets)}</p>
              </div>
              <CrewStatusBlock
                title="Free"
                tone="olive"
                names={crewFreeNames}
                emptyLabel="Nobody is fully clear yet."
              />
              <CrewStatusBlock
                title="Blocked"
                tone="blush"
                names={crewScore.blockedNames}
                emptyLabel="No one is blocked."
              />
              <CrewStatusBlock
                title="Unknown"
                tone="amber"
                names={crewScore.unknownNames}
                emptyLabel="Everyone has added availability."
              />
            </div>
          ) : (
            <div className="rounded-[16px] bg-sand px-4 py-4">
              <p className="text-sm font-semibold text-ink">No date is in focus yet.</p>
              <p className="mt-1 text-xs leading-5 text-ink-soft">
                Add a proposed date and this sheet will show who&apos;s free, blocked, or still unknown.
              </p>
            </div>
          )}
        </Sheet>
      ) : null}

      {/* Length picker sheet */}
      {editingLength ? (
        <Sheet onClose={() => setEditingLength(false)} title="Event length">
          <p className="mb-4 text-sm text-ink-soft">Changing this updates the Best Available suggestions.</p>
          <div className="flex flex-col gap-2">
            <LengthPickerRow
              active={lengthDraft === 0}
              title="Partial day"
              helper="A short hangout — drinks, dinner, a few hours."
              onClick={() => setLengthDraft(0)}
            />
            <LengthPickerRow
              active={lengthDraft === 1}
              title="One-day event"
              helper="A full day — beach trip, hike, single-day plan."
              onClick={() => setLengthDraft(1)}
            />
            <div
              className={[
                'rounded-[14px] border transition-colors',
                lengthDraft >= 2 ? 'border-olive bg-olive-tint' : 'border-stone/60 bg-cream',
              ].join(' ')}
            >
              <button
                type="button"
                onClick={() => setLengthDraft(Math.max(2, multiDayInput))}
                className="flex w-full items-start gap-3 px-3 py-3 text-left active:scale-[0.99]"
              >
                <span
                  className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                    lengthDraft >= 2 ? 'border-olive bg-olive text-white' : 'border-stone'
                  }`}
                >
                  {lengthDraft >= 2 ? <Icon name="check" size={12} /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">Multi-day trip</span>
                  <span className="mt-0.5 block text-xs text-ink-soft">Pick exactly how many days the group is together.</span>
                </span>
              </button>
              {lengthDraft >= 2 ? (
                <div className="border-t border-stone/40 px-3 py-3">
                  <div className="flex items-center gap-3 rounded-[16px] bg-cream px-3 py-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute">How many days?</span>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMultiDayInput((current) => Math.max(2, current - 1))}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone/60 bg-white text-lg font-bold text-ink"
                        aria-label="Decrease trip length"
                      >
                        -
                      </button>
                      <div className="min-w-[72px] rounded-[14px] bg-sand px-3 py-2 text-center">
                        <span className="block text-lg font-black text-ink">{multiDayInput}</span>
                        <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">days</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMultiDayInput((current) => Math.min(30, current + 1))}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone/60 bg-white text-lg font-bold text-ink"
                        aria-label="Increase trip length"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[2, 3, 4, 5, 7].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setMultiDayInput(days)}
                        className={[
                          'rounded-full px-3 py-1.5 text-xs font-semibold',
                          multiDayInput === days ? 'bg-olive text-white' : 'bg-sand text-ink-soft',
                        ].join(' ')}
                      >
                        {days} days
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={commitLengthDraft}
              disabled={savingLength || !hasLengthDraftChanges}
              className="flex-1 rounded-xl bg-olive py-2.5 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40"
            >
              {savingLength ? 'Saving…' : 'Save length'}
            </button>
            <button
              type="button"
              onClick={() => setEditingLength(false)}
              className="rounded-xl bg-sand px-4 py-2.5 text-sm font-semibold text-ink-soft"
            >
              Cancel
            </button>
          </div>
        </Sheet>
      ) : null}

      {/* Edit details sheet */}
      {editingDetails ? (
        <Sheet
          onClose={() => setEditingDetails(false)}
          title="Edit details"
          footer={
            <div className="flex gap-2">
              <button
                form="edit-details-form"
                type="submit"
                disabled={!detailDraft.title.trim() || savingDetails}
                className="flex-1 rounded-xl bg-olive py-3 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40"
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
                className="rounded-xl bg-sand px-4 py-3 text-sm font-semibold text-ink-soft"
              >
                Cancel
              </button>
            </div>
          }
        >
          <form
            id="edit-details-form"
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
          </form>
        </Sheet>
      ) : null}
    </main>
  )
}

// ─────────── small components ───────────

function SheetAction({
  icon,
  title,
  description,
  onClick,
  tone = 'default',
  disabled = false,
}: {
  icon: ReactNode
  title: string
  description: string
  onClick: () => void
  tone?: 'default' | 'danger'
  disabled?: boolean
}) {
  const containerClasses = tone === 'danger'
    ? 'bg-blush-tint hover:bg-blush-soft'
    : 'bg-sand hover:bg-sand-alt'
  const iconClasses = tone === 'danger'
    ? 'bg-blush-soft text-blush'
    : 'bg-olive-tint text-olive'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-start gap-3 rounded-[16px] px-4 py-3 text-left transition-colors disabled:opacity-60 ${containerClasses}`}
    >
      <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconClasses}`}>
        {icon}
      </span>
      <span>
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-ink-soft">{description}</span>
      </span>
    </button>
  )
}

function CrewStatusBlock({
  title,
  tone,
  names,
  emptyLabel,
}: {
  title: string
  tone: 'olive' | 'blush' | 'amber'
  names: string[]
  emptyLabel: string
}) {
  const toneClasses = tone === 'olive'
    ? 'bg-olive-tint text-olive'
    : tone === 'blush'
      ? 'bg-blush-tint text-blush'
      : 'bg-amber-tint text-amber'

  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-mute">
        {title} {names.length > 0 ? `(${names.length})` : ''}
      </p>
      {names.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {names.map((person) => (
            <span key={person} className={`rounded-full px-2.5 py-1 text-xs font-medium ${toneClasses}`}>
              {person}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs leading-5 text-ink-soft">{emptyLabel}</p>
      )}
    </div>
  )
}

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
            <Icon name="chevronRight" size={12} className="rotate-90" />
          </span>
        ) : (
          <p className={`mt-0.5 truncate text-[14px] font-semibold ${muted ? 'text-ink-mute' : 'text-ink'}`}>{value}</p>
        )}
      </div>
      {editable ? <Icon name="pencil" size={14} className="shrink-0 text-ink-mute" /> : null}
    </Wrapper>
  )
}

function LengthPickerRow({
  active,
  disabled,
  title,
  helper,
  onClick,
}: {
  active: boolean
  disabled?: boolean
  title: string
  helper: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'flex items-start gap-3 rounded-[14px] border px-3 py-3 text-left transition-colors active:scale-[0.99]',
        active ? 'border-olive bg-olive-tint' : 'border-stone/60 bg-cream',
      ].join(' ')}
    >
      <span
        className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border ${
          active ? 'border-olive bg-olive text-white' : 'border-stone'
        }`}
      >
        {active ? <Icon name="check" size={12} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-ink">{title}</span>
        <span className="mt-0.5 block text-xs text-ink-soft">{helper}</span>
      </span>
    </button>
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
        <Icon name="calendar" size={14} />
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
      <Icon name="chevronRight" size={14} className="shrink-0 text-ink-mute" />
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
  footer,
}: {
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
      />
      {/* Header / scrollable body / optional sticky footer. The footer always
          stays in view above the iPhone home indicator so primary actions
          (Save / Cancel / etc.) never get clipped on long forms. */}
      <div className="relative mx-3 mb-3 flex max-h-[85vh] w-full max-w-md flex-col rounded-[24px] bg-cream shadow-[var(--shadow-raised)]">
        <div className="flex shrink-0 items-center justify-between px-5 pt-5 pb-3">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-ink-mute">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sand text-ink-soft"
            aria-label="Close"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
        <div
          className={`flex-1 overflow-y-auto px-5 ${footer ? 'pb-4' : 'pb-[calc(env(safe-area-inset-bottom)+1.25rem)]'}`}
        >
          {children}
        </div>
        {footer ? (
          <div
            className="shrink-0 border-t border-sand-alt bg-cream px-5 pt-4"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
          >
            {footer}
          </div>
        ) : null}
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
