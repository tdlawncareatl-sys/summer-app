// Availability scoring. Pure functions — no Supabase, no React.
// "Free / blocked / unknown" model:
//   - free    = participant has submitted availability AND is not blocked on any day in range
//   - blocked = participant has submitted availability AND is blocked on ≥1 day in range
//   - unknown = participant has not submitted any availability rows yet
//
// The "submitted" signal is: at least one row in the availability table for that user
// (any date, past or future). Treating no-rows as "unknown" prevents the page from
// claiming "12/12 free" when nobody has actually opened the app yet.

import { LengthType } from './lengthType'

export type Participant = { id: string; name: string }
export type AvailabilityRow = { user_id: string; date: string }

export type Buckets = {
  free: number
  blocked: number
  unknown: number
  total: number
}

export type ScoredRange = {
  startDate: string
  endDate: string
  buckets: Buckets
  blockedNames: string[]
  unknownNames: string[]
}

export function getRange(startISO: string, endISO: string): string[] {
  if (endISO === startISO) return [startISO]
  const start = new Date(startISO + 'T12:00:00')
  const end = new Date(endISO + 'T12:00:00')
  const [s, e] = start <= end ? [start, end] : [end, start]
  const out: string[] = []
  const cur = new Date(s)
  while (cur <= e) {
    out.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

export function scoreRange(
  startISO: string,
  endISO: string,
  participants: Participant[],
  availability: AvailabilityRow[],
): ScoredRange {
  const dayset = new Set(getRange(startISO, endISO))

  const submittedUserIds = new Set<string>()
  const blockedUserIds = new Set<string>()
  for (const row of availability) {
    submittedUserIds.add(row.user_id)
    if (dayset.has(row.date)) blockedUserIds.add(row.user_id)
  }

  let free = 0
  let blocked = 0
  let unknown = 0
  const blockedNames: string[] = []
  const unknownNames: string[] = []

  for (const p of participants) {
    if (!submittedUserIds.has(p.id)) {
      unknown++
      unknownNames.push(p.name)
    } else if (blockedUserIds.has(p.id)) {
      blocked++
      blockedNames.push(p.name)
    } else {
      free++
    }
  }

  return {
    startDate: startISO,
    endDate: endISO,
    buckets: { free, blocked, unknown, total: participants.length },
    blockedNames: blockedNames.sort(),
    unknownNames: unknownNames.sort(),
  }
}

/**
 * Generate ranked candidate ranges starting after `todayISO`, looking ahead
 * `horizonDays`. For three_day_trip, candidates are Fri–Sun weekend windows.
 * For couple_hours / day_long, candidates are individual days.
 *
 * Ranking: highest free → lowest blocked → lowest unknown → earliest date.
 */
export function findBestRanges(
  lengthType: LengthType,
  participants: Participant[],
  availability: AvailabilityRow[],
  todayISO: string,
  horizonDays = 90,
): ScoredRange[] {
  const candidates: { startDate: string; endDate: string }[] = []
  const start = new Date(todayISO + 'T12:00:00')

  if (lengthType === 'three_day_trip') {
    for (let i = 1; i <= horizonDays; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      if (d.getDay() !== 5) continue // Fridays only
      const startDate = d.toISOString().split('T')[0]
      d.setDate(d.getDate() + 2)
      const endDate = d.toISOString().split('T')[0]
      candidates.push({ startDate, endDate })
    }
  } else {
    for (let i = 1; i <= horizonDays; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const iso = d.toISOString().split('T')[0]
      candidates.push({ startDate: iso, endDate: iso })
    }
  }

  return candidates
    .map((c) => scoreRange(c.startDate, c.endDate, participants, availability))
    .sort((a, b) => {
      if (b.buckets.free !== a.buckets.free) return b.buckets.free - a.buckets.free
      if (a.buckets.blocked !== b.buckets.blocked) return a.buckets.blocked - b.buckets.blocked
      if (a.buckets.unknown !== b.buckets.unknown) return a.buckets.unknown - b.buckets.unknown
      return a.startDate.localeCompare(b.startDate)
    })
}

/**
 * Conflict density label for a single calendar day. Used to color cells.
 * Thresholds: free / few (1–20%) / some (21–50%) / many (51%+).
 */
export type Density = 'free' | 'few' | 'some' | 'many'

export function densityForDay(blockedCount: number, totalParticipants: number): Density {
  if (totalParticipants <= 0 || blockedCount <= 0) return 'free'
  const ratio = blockedCount / totalParticipants
  if (ratio <= 0.2) return 'few'
  if (ratio <= 0.5) return 'some'
  return 'many'
}

/**
 * "10/12 free · 2 blocked · 1 unknown" — collapses zero-buckets so the line stays short.
 */
export function summarizeBuckets(buckets: Buckets): string {
  const parts: string[] = [`${buckets.free}/${buckets.total} free`]
  if (buckets.blocked > 0) parts.push(`${buckets.blocked} blocked`)
  if (buckets.unknown > 0) parts.push(`${buckets.unknown} unknown`)
  return parts.join(' · ')
}
