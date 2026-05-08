// Shared data loader. One query batch, everyone reuses the result.
// Home / Calendar / Me / Ideas all need overlapping slices of this.

import { supabase } from './supabase'
import { eachDay, todayLocalISO } from './date'
import { compareRankedDateOptions } from './dateOptionRanking'
import { EventStatus, inferEventStatus } from './status'

export type UserRow = { id: string; name: string }

export type RawEvent = {
  id: string
  title: string
  description: string | null
  status: string
  created_by: string | null
  created_at: string
  confirmed_date?: string | null
  confirmed_end_date?: string | null
}

export type RawDateOption = {
  id: string
  event_id: string
  date: string
  end_date?: string | null
}

export type RawVote = {
  id: string
  date_option_id: string
  response: 'best' | 'works' | 'no' | string
  points: number
  user_id: string
}

export type RawAvailability = { user_id: string; date: string; category?: string | null }

export type RawIdea = {
  id: string
  title: string
  description: string | null
  submitted_by: string | null
  likes: number
  created_at: string
}

export type EnrichedEvent = RawEvent & {
  dateOptions: RawDateOption[]
  voteCount: number
  status: string
  displayStatus: EventStatus
  topDate: string | null
  topEndDate: string | null
  /** Names of people attending (or likely attending — everyone not blocked) */
  availableNames: string[]
  blockedNames: string[]
  participantNames: string[]
}

export type PlanData = {
  me: { name: string | null; userId: string | null }
  users: UserRow[]
  userMap: Record<string, string> // id → name
  events: EnrichedEvent[]
  ideas: RawIdea[]
  availability: RawAvailability[]
  /** Map of date-iso → list of blocked names (for any date) */
  blackoutsByDate: Record<string, string[]>
  totalFriends: number
}

export async function loadPlanData(myName: string | null): Promise<PlanData> {
  const [
    { data: users },
    { data: events },
    { data: dateOptions },
    { data: votes },
    { data: availability },
    { data: ideas },
  ] = await Promise.all([
    supabase.from('users').select('id, name'),
    supabase.from('events').select('id, title, description, status, created_by, created_at, confirmed_date, confirmed_end_date').order('created_at', { ascending: false }),
    supabase.from('date_options').select('id, event_id, date, end_date'),
    supabase.from('votes').select('id, date_option_id, response, points, user_id'),
    supabase.from('availability').select('user_id, date, category'),
    supabase.from('ideas').select('id, title, description, submitted_by, likes, created_at').order('created_at', { ascending: false }),
  ])

  const userList = (users ?? []) as UserRow[]
  const userMap: Record<string, string> = Object.fromEntries(userList.map((u) => [u.id, u.name]))
  const myUserId = userList.find((u) => u.name === myName)?.id ?? null

  // Build blackouts by date
  const blackoutsByDate: Record<string, string[]> = {}
  for (const row of (availability ?? []) as RawAvailability[]) {
    const n = userMap[row.user_id]
    if (!n) continue
    ;(blackoutsByDate[row.date] ??= []).push(n)
  }

  // Group date_options by event
  const optionsByEvent: Record<string, RawDateOption[]> = {}
  for (const opt of (dateOptions ?? []) as RawDateOption[]) {
    ;(optionsByEvent[opt.event_id] ??= []).push(opt)
  }

  const votesByOption: Record<string, RawVote[]> = {}
  const voteCountByOption: Record<string, number> = {}
  for (const v of (votes ?? []) as RawVote[]) {
    ;(votesByOption[v.date_option_id] ??= []).push(v)
    voteCountByOption[v.date_option_id] = (voteCountByOption[v.date_option_id] ?? 0) + 1
  }

  // Enrich events
  const enriched: EnrichedEvent[] = ((events ?? []) as RawEvent[]).map((ev) => {
    const opts = optionsByEvent[ev.id] ?? []
    const voteCount = opts.reduce((sum, o) => sum + (voteCountByOption[o.id] ?? 0), 0)
    const displayStatus = inferEventStatus({
      status: ev.status,
      hasDateOptions: opts.length > 0,
      voteCount,
      createdByCurrentUser: !!myName && ev.created_by === myName,
    })

    const rankedOptions = opts
      .map((option) => {
        const totalPoints = (votesByOption[option.id] ?? []).reduce((sum, vote) => sum + vote.points, 0)
        const blockedNames = new Set<string>()
        for (const day of daysBetween(option.date, option.end_date ?? option.date)) {
          ;(blackoutsByDate[day] ?? []).forEach((name) => blockedNames.add(name))
        }
        return {
          ...option,
          totalPoints,
          blockedCount: blockedNames.size,
          conflictScore: totalPoints - blockedNames.size * 2,
        }
      })
      .sort(compareRankedDateOptions)

    // Decide the "top" date — confirmed if present, otherwise the current leading option.
    let topDate: string | null = ev.confirmed_date ?? null
    let topEndDate: string | null = ev.confirmed_end_date ?? null
    if (!topDate && rankedOptions.length > 0) {
      topDate = rankedOptions[0].date
      topEndDate = rankedOptions[0].end_date ?? null
    }

    // Availability across the winning dates (for display)
    const daysInRange = topDate ? daysBetween(topDate, topEndDate) : []
    const blockedSet = new Set<string>()
    daysInRange.forEach((d) => (blackoutsByDate[d] ?? []).forEach((n) => blockedSet.add(n)))
    const blockedNames = [...blockedSet].sort()
    const availableNames = userList.map((u) => u.name).filter((n) => !blockedSet.has(n))
    // Participant names = for display on cards, anyone not blocked (proxy for "going")
    const participantNames = availableNames

    return {
      ...ev,
      dateOptions: opts,
      voteCount,
      displayStatus,
      topDate,
      topEndDate,
      blockedNames,
      availableNames,
      participantNames,
    }
  })

  return {
    me: { name: myName, userId: myUserId },
    users: userList,
    userMap,
    events: enriched,
    ideas: (ideas ?? []) as RawIdea[],
    availability: (availability ?? []) as RawAvailability[],
    blackoutsByDate,
    totalFriends: userList.length,
  }
}

function daysBetween(startIso: string, endIso: string | null | undefined): string[] {
  return eachDay(startIso, endIso)
}

/* ── Date helpers exported for consumers ─────────────────────────────── */

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', opts ?? { weekday: 'short', month: 'short', day: 'numeric' })
}

export function formatDateRange(start: string, end?: string | null): string {
  if (!end || end === start) return formatDate(start)
  const days = daysBetween(start, end).length
  return `${formatDate(start, { month: 'short', day: 'numeric' })} – ${formatDate(end, { month: 'short', day: 'numeric' })} · ${days} days`
}

export function formatDateRangeShort(start: string, end?: string | null): string {
  if (!end || end === start) return formatDate(start, { weekday: 'short', month: 'short', day: 'numeric' })
  return `${formatDate(start, { month: 'short', day: 'numeric' })} – ${formatDate(end, { month: 'short', day: 'numeric' })}`
}

export function todayISO() {
  return todayLocalISO()
}
