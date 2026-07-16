// School semester schedules. Pure functions + data — no Supabase, no React.
//
// The year-round problem: during a semester, friends who live away at college
// are gone by default and only home for breaks — the opposite of summer, where
// everyone is free by default and blocks exceptions. Rather than invent a new
// availability model, we expand a school's academic calendar into ordinary
// blackout rows ("away at school") and leave the breaks free. Everything
// downstream — event scoring, the group heatmap, This Week — keeps working
// because these are just normal availability rows.
//
// Data rules (kept deliberately simple):
//   • Break windows are the *home* windows, already extended through adjacent
//     weekends (a break that ends Friday with classes resuming Monday means
//     you're home through Sunday).
//   • Only multi-weekday breaks are included (fall break, Thanksgiving,
//     spring break, Hillsdale's Easter travel days). Single-Monday holidays
//     like Labor Day or MLK are skipped — a 3-day weekend is rarely a trip
//     home, and the user can hand-tweak days on the calendar afterwards.
//   • `awayStart` = first day of classes, `awayEnd` = last final exam day.
//     Move-in and post-finals lingering vary per person; the review step and
//     the calendar exist for those adjustments.
//
// Dates verified 2026-07-15 from each registrar's published 2026–27 calendar.
// ASU's break details came from an unofficial aggregator (their registrar page
// is a JS app) — the review step is the backstop. Update this file once a year
// when registrars publish the next cycle.

import { eachDay, toLocalISODate } from './date'

export type SchoolBreak = {
  name: string
  start: string // first day home (inclusive)
  end: string // last day home (inclusive)
}

export type SchoolTerm = {
  name: string // 'Fall 2026'
  awayStart: string // first day of classes
  awayEnd: string // last final exam day
  breaks: SchoolBreak[]
}

export type School = {
  id: string
  name: string
  short: string // label used in the blackout category, e.g. 'KSU'
  city: string
  terms: SchoolTerm[]
}

// Blackout rows written by the school import carry this category prefix so
// they can be found, re-imported, and cleared as a unit without touching
// manually-entered blocks.
export const SCHOOL_CATEGORY_PREFIX = 'School · '

export function schoolCategoryLabel(school: School): string {
  return `${SCHOOL_CATEGORY_PREFIX}${school.short}`
}

export function isSchoolCategory(category: string | null | undefined): boolean {
  return !!category && category.startsWith(SCHOOL_CATEGORY_PREFIX)
}

export const SCHOOLS: School[] = [
  {
    id: 'ksu',
    name: 'Kennesaw State University',
    short: 'KSU',
    city: 'Kennesaw, GA',
    terms: [
      {
        name: 'Fall 2026',
        awayStart: '2026-08-24',
        awayEnd: '2026-12-14',
        breaks: [
          // Break is Mon Nov 23 – Sun Nov 29; classes end Fri Nov 20.
          { name: 'Thanksgiving break', start: '2026-11-21', end: '2026-11-29' },
        ],
      },
      {
        name: 'Spring 2027',
        awayStart: '2027-01-11',
        awayEnd: '2027-05-03',
        breaks: [
          // Break is Mon Mar 1 – Sun Mar 7; home from the Saturday before.
          { name: 'Spring break', start: '2027-02-27', end: '2027-03-07' },
        ],
      },
    ],
  },
  {
    id: 'wheaton',
    name: 'Wheaton College',
    short: 'Wheaton',
    city: 'Wheaton, IL',
    terms: [
      {
        name: 'Fall 2026',
        awayStart: '2026-08-26',
        awayEnd: '2026-12-17',
        breaks: [
          { name: 'Fall break', start: '2026-10-17', end: '2026-10-21' },
          { name: 'Thanksgiving break', start: '2026-11-25', end: '2026-11-29' },
        ],
      },
      {
        name: 'Spring 2027',
        awayStart: '2027-01-11',
        awayEnd: '2027-05-06',
        breaks: [{ name: 'Spring break', start: '2027-03-06', end: '2027-03-14' }],
      },
    ],
  },
  {
    id: 'asu',
    name: 'Arizona State University',
    short: 'ASU',
    city: 'Tempe, AZ',
    terms: [
      {
        name: 'Fall 2026',
        awayStart: '2026-08-20',
        awayEnd: '2026-12-12',
        breaks: [
          { name: 'Fall break', start: '2026-10-10', end: '2026-10-13' },
          // Officially classes are excused Thu–Fri; Wed is not confirmed off.
          { name: 'Thanksgiving break', start: '2026-11-26', end: '2026-11-29' },
        ],
      },
      {
        name: 'Spring 2027',
        awayStart: '2027-01-11',
        awayEnd: '2027-05-08',
        breaks: [{ name: 'Spring break', start: '2027-03-06', end: '2027-03-14' }],
      },
    ],
  },
  {
    id: 'hillsdale',
    name: 'Hillsdale College',
    short: 'Hillsdale',
    city: 'Hillsdale, MI',
    terms: [
      {
        name: 'Fall 2026',
        awayStart: '2026-08-26',
        awayEnd: '2026-12-12',
        breaks: [
          { name: 'Fall break', start: '2026-10-01', end: '2026-10-04' },
          // Hillsdale housing closes over Thanksgiving/Christmas/spring
          // breaks, so students are genuinely home for these.
          { name: 'Thanksgiving break', start: '2026-11-25', end: '2026-11-29' },
        ],
      },
      {
        name: 'Spring 2027',
        awayStart: '2027-01-13',
        awayEnd: '2027-05-05',
        breaks: [
          // Spring break begins 5pm Fri Feb 26; classes resume Mon Mar 8.
          { name: 'Spring break', start: '2027-02-27', end: '2027-03-07' },
          // Classes end noon Good Friday; Mon Mar 29 is a named travel day.
          { name: 'Easter break', start: '2027-03-26', end: '2027-03-29' },
        ],
      },
    ],
  },
  {
    id: 'samford',
    name: 'Samford University',
    short: 'Samford',
    city: 'Birmingham, AL',
    terms: [
      {
        name: 'Fall 2026',
        awayStart: '2026-08-24',
        awayEnd: '2026-12-10',
        breaks: [
          // Break is Mon Oct 12 – Tue Oct 13; home from the Saturday before.
          { name: 'Fall break', start: '2026-10-10', end: '2026-10-13' },
          // No class Wed Nov 25, university closed Thu–Fri.
          { name: 'Thanksgiving break', start: '2026-11-25', end: '2026-11-29' },
        ],
      },
      {
        name: 'Spring 2027',
        awayStart: '2027-01-11',
        awayEnd: '2027-04-29',
        breaks: [
          // Break is Mon Mar 8 – Fri Mar 12; both weekends attach.
          { name: 'Spring break', start: '2027-03-06', end: '2027-03-14' },
        ],
      },
    ],
  },
]

export function schoolById(id: string): School | undefined {
  return SCHOOLS.find((s) => s.id === id)
}

// ─── segments ────────────────────────────────────────────────────────────────

export type ScheduleSegment = {
  kind: 'away' | 'home'
  label: string // 'At school', 'Thanksgiving break', 'Winter break', …
  termName: string
  start: string
  end: string
}

export type SchoolSchedule = {
  segments: ScheduleSegment[]
  summerFrom: string // day after the last final of spring — home for summer
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return toLocalISODate(d)
}

/**
 * Split one term into alternating away/home segments. Breaks are assumed
 * to be inside the term, ascending, and non-overlapping (tested).
 */
export function termSegments(term: SchoolTerm): ScheduleSegment[] {
  const segments: ScheduleSegment[] = []
  let cursor = term.awayStart
  for (const brk of term.breaks) {
    if (cursor <= shiftDate(brk.start, -1)) {
      segments.push({
        kind: 'away',
        label: 'At school',
        termName: term.name,
        start: cursor,
        end: shiftDate(brk.start, -1),
      })
    }
    segments.push({
      kind: 'home',
      label: brk.name,
      termName: term.name,
      start: brk.start,
      end: brk.end,
    })
    cursor = shiftDate(brk.end, 1)
  }
  if (cursor <= term.awayEnd) {
    segments.push({
      kind: 'away',
      label: 'At school',
      termName: term.name,
      start: cursor,
      end: term.awayEnd,
    })
  }
  return segments
}

/**
 * Full-year view of a school's schedule: each term split around its breaks,
 * with the between-term gap surfaced as a home "Winter break" segment so the
 * review list reads as one continuous story.
 */
export function schoolYearSchedule(school: School): SchoolSchedule {
  const segments: ScheduleSegment[] = []
  const terms = [...school.terms].sort((a, b) => a.awayStart.localeCompare(b.awayStart))
  terms.forEach((term, i) => {
    segments.push(...termSegments(term))
    const next = terms[i + 1]
    if (next) {
      segments.push({
        kind: 'home',
        label: 'Winter break',
        termName: `${term.name} → ${next.name}`,
        start: shiftDate(term.awayEnd, 1),
        end: shiftDate(next.awayStart, -1),
      })
    }
  })
  return { segments, summerFrom: shiftDate(terms[terms.length - 1].awayEnd, 1) }
}

/**
 * Expand the enabled away segments into the individual blackout dates to
 * write, skipping the past and anything already blocked (the availability
 * table has a unique (user_id, date) constraint, and manually-entered blocks
 * should keep their own labels).
 */
export function expandBlockedDays(
  segments: ScheduleSegment[],
  enabled: Set<number>, // indexes into `segments`
  todayISO: string,
  alreadyBlocked: Set<string>,
): string[] {
  const days = new Set<string>()
  segments.forEach((segment, i) => {
    if (segment.kind !== 'away' || !enabled.has(i)) return
    for (const day of eachDay(segment.start, segment.end)) {
      if (day >= todayISO && !alreadyBlocked.has(day)) days.add(day)
    }
  })
  return [...days].sort()
}
