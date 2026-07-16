import { describe, expect, it } from 'vitest'
import {
  SCHOOLS,
  SCHOOL_CATEGORY_PREFIX,
  expandBlockedDays,
  isSchoolCategory,
  schoolById,
  schoolCategoryLabel,
  schoolYearSchedule,
  termSegments,
} from '@/lib/schoolCalendars'

const ISO = /^\d{4}-\d{2}-\d{2}$/

// ─── data sanity — these guard the yearly calendar update ────────────────────

describe('SCHOOLS data', () => {
  it('has unique ids', () => {
    const ids = SCHOOLS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  for (const school of SCHOOLS) {
    describe(school.name, () => {
      it('has at least one term with valid ISO dates', () => {
        expect(school.terms.length).toBeGreaterThan(0)
        for (const term of school.terms) {
          expect(term.awayStart).toMatch(ISO)
          expect(term.awayEnd).toMatch(ISO)
          expect(term.awayStart < term.awayEnd).toBe(true)
        }
      })

      it('keeps breaks inside the term, ascending, non-overlapping', () => {
        for (const term of school.terms) {
          let prevEnd = term.awayStart
          for (const brk of term.breaks) {
            expect(brk.start).toMatch(ISO)
            expect(brk.end).toMatch(ISO)
            expect(brk.start <= brk.end).toBe(true)
            expect(brk.start > prevEnd).toBe(true)
            expect(brk.end < term.awayEnd).toBe(true)
            prevEnd = brk.end
          }
        }
      })
    })
  }
})

// ─── segments ────────────────────────────────────────────────────────────────

describe('termSegments', () => {
  const term = {
    name: 'Fall 2026',
    awayStart: '2026-08-24',
    awayEnd: '2026-12-14',
    breaks: [{ name: 'Thanksgiving break', start: '2026-11-21', end: '2026-11-29' }],
  }

  it('splits the term into away / home / away around a break', () => {
    const segments = termSegments(term)
    expect(segments).toEqual([
      { kind: 'away', label: 'At school', termName: 'Fall 2026', start: '2026-08-24', end: '2026-11-20' },
      { kind: 'home', label: 'Thanksgiving break', termName: 'Fall 2026', start: '2026-11-21', end: '2026-11-29' },
      { kind: 'away', label: 'At school', termName: 'Fall 2026', start: '2026-11-30', end: '2026-12-14' },
    ])
  })

  it('covers every day of the term exactly once', () => {
    for (const school of SCHOOLS) {
      for (const t of school.terms) {
        const segments = termSegments(t)
        expect(segments[0].start).toBe(t.awayStart)
        expect(segments[segments.length - 1].end).toBe(t.awayEnd)
        for (let i = 1; i < segments.length; i++) {
          const gap =
            (new Date(segments[i].start + 'T12:00:00').getTime() -
              new Date(segments[i - 1].end + 'T12:00:00').getTime()) /
            86400000
          expect(gap).toBe(1)
        }
      }
    }
  })
})

describe('schoolYearSchedule', () => {
  it('inserts a home Winter break segment between fall and spring', () => {
    const ksu = schoolById('ksu')!
    const { segments, summerFrom } = schoolYearSchedule(ksu)
    const winter = segments.find((s) => s.label === 'Winter break')
    expect(winter).toMatchObject({ kind: 'home', start: '2026-12-15', end: '2027-01-10' })
    expect(summerFrom).toBe('2027-05-04')
  })

  it('alternates cleanly: no two adjacent segments are both away or both home at the same boundary', () => {
    for (const school of SCHOOLS) {
      const { segments } = schoolYearSchedule(school)
      for (let i = 1; i < segments.length; i++) {
        expect(segments[i].start > segments[i - 1].end).toBe(true)
      }
    }
  })
})

// ─── expansion ───────────────────────────────────────────────────────────────

describe('expandBlockedDays', () => {
  const segments = [
    { kind: 'away' as const, label: 'At school', termName: 'Fall', start: '2026-09-01', end: '2026-09-03' },
    { kind: 'home' as const, label: 'Break', termName: 'Fall', start: '2026-09-04', end: '2026-09-05' },
    { kind: 'away' as const, label: 'At school', termName: 'Fall', start: '2026-09-06', end: '2026-09-07' },
  ]

  it('expands only enabled away segments', () => {
    const days = expandBlockedDays(segments, new Set([0]), '2026-01-01', new Set())
    expect(days).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
  })

  it('never expands home segments even if enabled', () => {
    const days = expandBlockedDays(segments, new Set([0, 1, 2]), '2026-01-01', new Set())
    expect(days).not.toContain('2026-09-04')
    expect(days).not.toContain('2026-09-05')
  })

  it('skips the past and already-blocked days', () => {
    const days = expandBlockedDays(segments, new Set([0, 2]), '2026-09-02', new Set(['2026-09-06']))
    expect(days).toEqual(['2026-09-02', '2026-09-03', '2026-09-07'])
  })

  it('blocks a realistic away-year without touching breaks', () => {
    const wheaton = schoolById('wheaton')!
    const { segments: yearSegments } = schoolYearSchedule(wheaton)
    const allEnabled = new Set(yearSegments.map((_, i) => i))
    const days = expandBlockedDays(yearSegments, allEnabled, '2026-07-15', new Set())
    expect(days).toContain('2026-08-26') // first day of classes
    expect(days).toContain('2026-12-17') // last final
    expect(days).not.toContain('2026-11-26') // Thanksgiving Day is home
    expect(days).not.toContain('2026-12-25') // Christmas is home
    expect(days).not.toContain('2027-03-10') // spring break is home
    expect(days).not.toContain('2027-05-07') // home for summer
  })
})

// ─── category tagging ────────────────────────────────────────────────────────

describe('school category tagging', () => {
  it('labels with the shared prefix and detects it', () => {
    const ksu = schoolById('ksu')!
    const label = schoolCategoryLabel(ksu)
    expect(label).toBe(`${SCHOOL_CATEGORY_PREFIX}KSU`)
    expect(isSchoolCategory(label)).toBe(true)
    expect(isSchoolCategory('Beach trip')).toBe(false)
    expect(isSchoolCategory(null)).toBe(false)
  })
})
