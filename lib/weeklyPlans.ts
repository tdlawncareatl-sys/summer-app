// This Week — casual weekly hangout planning. PURE logic only: types, week
// math, tallying, ranking, idea rollups. No Supabase, no React — so it stays
// unit-testable (test/lib/weeklyPlans.test.ts) the same way lib/voting.ts and
// lib/notificationEngine.ts are. The data layer lives in lib/weeklyPlansData.ts.
//
// Ranking rule (from the spec): for each candidate day sort by
//   1) Works votes  (descending)
//   2) Best votes   (descending)
//   3) Pass votes   (ascending)
// ...then earliest day as a final, deterministic tiebreak.

import { toLocalISODate } from './date'
import { scoreRange, type AvailabilityRow, type Participant } from './availability'
import { pickTopTimePreference, type TimePreference } from './voting'
import type { CategoryTint } from './categories'
import type { IconName } from './icons'

export type { TimePreference } from './voting'

/* ── Types ───────────────────────────────────────────────────────────────── */

export type WeeklyPlanStatus = 'open' | 'confirmed' | 'archived'
export type DayAvailability = 'works' | 'pass'
export type IdeaCategory = 'dinner' | 'drinks' | 'movie' | 'game' | 'outside' | 'other'

export type WeeklyPlanRow = {
  id: string
  created_by: string | null
  title: string
  note: string | null
  week_start_date: string
  candidate_days: string[]
  status: WeeklyPlanStatus
  confirmed_day: string | null
  converted_event_id: string | null
  created_at: string
  updated_at: string
}

export type WeeklyVoteRow = {
  id: string
  weekly_plan_id: string
  user_id: string
  day: string
  availability: DayAvailability
  is_best_choice: boolean
  time_preference: TimePreference | null
}

export type WeeklyIdeaRow = {
  id: string
  weekly_plan_id: string
  user_id: string | null
  idea_text: string
  category: IdeaCategory | null
  created_at: string
}

/** One candidate day with its vote tally. */
export type DayTally = {
  day: string
  worksCount: number
  passCount: number
  bestCount: number
  /** Most-popular time block among this day's Works voters, or null. */
  topTimePreference: TimePreference | null
}

/** Per-day availability rollup from the blackout calendar (the "who's in town"
 *  overlay). Mirrors the free/blocked/unknown model used everywhere else. */
export type DayAvailabilitySummary = {
  inTown: number
  outOfTown: number
  unknown: number
  total: number
  /** Names marked out of town (blocked) that day. */
  outNames: string[]
}

export type EnrichedWeeklyPlan = WeeklyPlanRow & {
  ranked: DayTally[]
  leadingDay: DayTally | null
  votes: WeeklyVoteRow[]
  ideas: WeeklyIdeaRow[]
  /** distinct users who cast at least one vote on this plan */
  participantCount: number
  /** day ISO → who's in town / out of town that day */
  availabilityByDay: Record<string, DayAvailabilitySummary>
}

export type WeeklyPlanSummary = {
  id: string
  title: string
  status: WeeklyPlanStatus
  leadingDay: DayTally | null
  confirmedDay: string | null
  /** people who marked Works on the leading (or confirmed) day */
  availableCount: number
  topIdeas: { text: string; category: IdeaCategory | null }[]
}

export type ThisWeekData = {
  tablesMissing: boolean
  plans: EnrichedWeeklyPlan[]
  userMap: Record<string, string>
}

/* ── Idea categories ─────────────────────────────────────────────────────── */

export const IDEA_CATEGORIES: {
  key: IdeaCategory
  label: string
  iconName: IconName
  tint: CategoryTint
}[] = [
  { key: 'dinner', label: 'Dinner', iconName: 'pizza', tint: 'terracotta' },
  { key: 'drinks', label: 'Drinks', iconName: 'cocktail', tint: 'lavender' },
  { key: 'movie', label: 'Movie', iconName: 'clapper', tint: 'blush' },
  { key: 'game', label: 'Game Night', iconName: 'game', tint: 'olive' },
  { key: 'outside', label: 'Outside', iconName: 'picnic', tint: 'sage' },
  { key: 'other', label: 'Other', iconName: 'star', tint: 'amber' },
]

export function ideaCategoryMeta(category: IdeaCategory | null | undefined) {
  return IDEA_CATEGORIES.find((c) => c.key === category) ?? null
}

/* ── Week / day math ─────────────────────────────────────────────────────── */

/** Monday-anchored start of the week containing `iso` (local). */
export function weekStartFor(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  const offset = (d.getDay() + 6) % 7 // 0 = Mon … 6 = Sun
  d.setDate(d.getDate() - offset)
  return toLocalISODate(d)
}

/** The seven ISO dates (Mon→Sun) of the week starting at `weekStartIso`. */
export function weekDays(weekStartIso: string): string[] {
  const start = new Date(weekStartIso + 'T12:00:00')
  const out: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    out.push(toLocalISODate(d))
  }
  return out
}

export function shiftWeek(weekStartIso: string, weeks: number): string {
  const d = new Date(weekStartIso + 'T12:00:00')
  d.setDate(d.getDate() + weeks * 7)
  return toLocalISODate(d)
}

export function dayWeekday(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })
}

export function dayLabel(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function dayLong(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

/* ── Tally & ranking ─────────────────────────────────────────────────────── */

type VoteLike = {
  day: string
  availability: DayAvailability
  is_best_choice: boolean
  time_preference?: TimePreference | null
}

function emptyTimeCounts(): Record<TimePreference, number> {
  return { morning: 0, afternoon: 0, evening: 0, flexible: 0 }
}

export function tallyWeeklyDays(candidateDays: string[], votes: VoteLike[]): DayTally[] {
  const byDay: Record<string, DayTally> = {}
  const timeByDay: Record<string, Record<TimePreference, number>> = {}
  for (const day of candidateDays) {
    byDay[day] = { day, worksCount: 0, passCount: 0, bestCount: 0, topTimePreference: null }
    timeByDay[day] = emptyTimeCounts()
  }
  for (const vote of votes) {
    const tally = byDay[vote.day]
    if (!tally) continue // ignore votes for days no longer on the ballot
    if (vote.availability === 'works') {
      tally.worksCount++
      if (vote.is_best_choice) tally.bestCount++
      if (vote.time_preference) timeByDay[vote.day][vote.time_preference]++
    } else {
      tally.passCount++
    }
  }
  for (const day of candidateDays) {
    byDay[day].topTimePreference = pickTopTimePreference(timeByDay[day])
  }
  return candidateDays.map((day) => byDay[day])
}

/** Works desc → Best desc → Pass asc → earliest day. */
export function compareWeeklyDay(a: DayTally, b: DayTally): number {
  if (b.worksCount !== a.worksCount) return b.worksCount - a.worksCount
  if (b.bestCount !== a.bestCount) return b.bestCount - a.bestCount
  if (a.passCount !== b.passCount) return a.passCount - b.passCount
  return a.day.localeCompare(b.day)
}

export function rankWeeklyDays(candidateDays: string[], votes: VoteLike[]): DayTally[] {
  return tallyWeeklyDays(candidateDays, votes).sort(compareWeeklyDay)
}

/** Top-ranked day, but only once at least one Works vote exists. */
export function leadingWeeklyDay(ranked: DayTally[]): DayTally | null {
  const top = ranked[0]
  if (!top || top.worksCount === 0) return null
  return top
}

/** Roll free-text ideas up by (case-insensitive) text, most-suggested first. */
export function topIdeas(
  ideas: { idea_text: string; category: IdeaCategory | null }[],
  limit = 3,
): { text: string; category: IdeaCategory | null; count: number }[] {
  const groups: Record<string, { text: string; category: IdeaCategory | null; count: number }> = {}
  for (const idea of ideas) {
    const key = idea.idea_text.trim().toLowerCase()
    if (!key) continue
    if (!groups[key]) {
      groups[key] = { text: idea.idea_text.trim(), category: idea.category, count: 0 }
    }
    groups[key].count++
  }
  return Object.values(groups)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

/** Distinct users who marked Works on a specific day. */
export function worksUserIdsForDay(votes: WeeklyVoteRow[], day: string | null): string[] {
  if (!day) return []
  const ids = new Set<string>()
  for (const v of votes) {
    if (v.day === day && v.availability === 'works') ids.add(v.user_id)
  }
  return [...ids]
}

/** Enrich a plan with rankings, participant count, and the per-day "who's in
 *  town" overlay. Pure — reused by the loader and unit-testable. */
export function enrichWeeklyPlan(
  plan: WeeklyPlanRow,
  votes: WeeklyVoteRow[],
  ideas: WeeklyIdeaRow[],
  participants: Participant[] = [],
  availability: AvailabilityRow[] = [],
): EnrichedWeeklyPlan {
  const ranked = rankWeeklyDays(plan.candidate_days, votes)
  const leadingDay = leadingWeeklyDay(ranked)
  const participantCount = new Set(votes.map((v) => v.user_id)).size

  const availabilityByDay: Record<string, DayAvailabilitySummary> = {}
  for (const day of plan.candidate_days) {
    const scored = scoreRange(day, day, participants, availability)
    availabilityByDay[day] = {
      inTown: scored.buckets.free,
      outOfTown: scored.buckets.blocked,
      unknown: scored.buckets.unknown,
      total: scored.buckets.total,
      outNames: scored.blockedNames,
    }
  }

  return { ...plan, ranked, leadingDay, votes, ideas, participantCount, availabilityByDay }
}

/* ── Misc ────────────────────────────────────────────────────────────────── */

/** True when an error is "these tables don't exist yet" — i.e. the migration
 *  hasn't been applied. Lets the UI degrade gracefully instead of crashing. */
export function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  const msg = (error.message ?? '').toLowerCase()
  return msg.includes('does not exist') || msg.includes('could not find the table') || msg.includes('schema cache')
}
