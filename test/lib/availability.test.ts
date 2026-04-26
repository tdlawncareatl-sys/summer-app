import { describe, expect, it } from 'vitest'
import { densityForDay, findBestRanges, scoreRange, summarizeBuckets } from '@/lib/availability'

const PARTICIPANTS = [
  { id: 'u1', name: 'Alice' },
  { id: 'u2', name: 'Bob' },
  { id: 'u3', name: 'Cara' },
  { id: 'u4', name: 'Dan' },
]

// All four have submitted at least one row → none are "unknown" by default.
const SUBMITTED_BASELINE = [
  { user_id: 'u1', date: '2026-12-31' },
  { user_id: 'u2', date: '2026-12-31' },
  { user_id: 'u3', date: '2026-12-31' },
  { user_id: 'u4', date: '2026-12-31' },
]

describe('scoreRange', () => {
  it('reports all-free when nobody is blocked in the range', () => {
    const result = scoreRange('2026-05-23', '2026-05-25', PARTICIPANTS, SUBMITTED_BASELINE)
    expect(result.buckets).toEqual({ free: 4, blocked: 0, unknown: 0, total: 4 })
  })

  it('counts a participant blocked once even if they have multiple conflicting days', () => {
    const result = scoreRange('2026-05-23', '2026-05-25', PARTICIPANTS, [
      ...SUBMITTED_BASELINE,
      { user_id: 'u1', date: '2026-05-23' },
      { user_id: 'u1', date: '2026-05-24' },
    ])
    expect(result.buckets.blocked).toBe(1)
    expect(result.buckets.free).toBe(3)
  })

  it('treats users with no availability rows as unknown, not free', () => {
    const result = scoreRange('2026-05-23', '2026-05-23', PARTICIPANTS, [
      { user_id: 'u1', date: '2026-12-31' },
      { user_id: 'u2', date: '2026-12-31' },
    ])
    expect(result.buckets).toEqual({ free: 2, blocked: 0, unknown: 2, total: 4 })
  })

  it('blocks a participant if any single day in the range is blocked for them', () => {
    const result = scoreRange('2026-05-23', '2026-05-25', PARTICIPANTS, [
      ...SUBMITTED_BASELINE,
      { user_id: 'u3', date: '2026-05-24' },
    ])
    expect(result.buckets.blocked).toBe(1)
    expect(result.blockedNames).toEqual(['Cara'])
  })
})

describe('findBestRanges', () => {
  it('produces single-day candidates for day_long events', () => {
    const ranges = findBestRanges('day_long', PARTICIPANTS, SUBMITTED_BASELINE, '2026-05-01', 7)
    expect(ranges.length).toBeGreaterThan(0)
    for (const range of ranges) expect(range.startDate).toBe(range.endDate)
  })

  it('produces only Friday-anchored 3-day ranges for the legacy three_day_trip string', () => {
    const ranges = findBestRanges('three_day_trip', PARTICIPANTS, SUBMITTED_BASELINE, '2026-05-01', 30)
    expect(ranges.length).toBeGreaterThan(0)
    for (const range of ranges) {
      expect(new Date(range.startDate + 'T12:00:00').getDay()).toBe(5) // Friday
      const days = (new Date(range.endDate + 'T12:00:00').getTime() - new Date(range.startDate + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24)
      expect(days).toBe(2)
    }
  })

  it('produces N-day rolling windows for an arbitrary length_days value', () => {
    const ranges = findBestRanges(5, PARTICIPANTS, SUBMITTED_BASELINE, '2026-05-01', 14)
    expect(ranges.length).toBeGreaterThan(0)
    for (const range of ranges) {
      const ms = new Date(range.endDate + 'T12:00:00').getTime() - new Date(range.startDate + 'T12:00:00').getTime()
      expect(ms / (1000 * 60 * 60 * 24)).toBe(4) // 5-day range = 4-day delta
    }
  })

  it('treats couple_hours (0) like a single-day candidate generator', () => {
    const ranges = findBestRanges(0, PARTICIPANTS, SUBMITTED_BASELINE, '2026-05-01', 5)
    expect(ranges.length).toBeGreaterThan(0)
    for (const range of ranges) expect(range.startDate).toBe(range.endDate)
  })

  it('ranks higher-free candidates above lower-free ones', () => {
    const ranges = findBestRanges('day_long', PARTICIPANTS, [
      ...SUBMITTED_BASELINE,
      { user_id: 'u1', date: '2026-05-02' },
      { user_id: 'u2', date: '2026-05-02' },
    ], '2026-05-01', 5)
    expect(ranges[0].buckets.free).toBeGreaterThanOrEqual(ranges[ranges.length - 1].buckets.free)
    expect(ranges[ranges.length - 1].startDate === '2026-05-02' || ranges[0].startDate !== '2026-05-02').toBe(true)
  })
})

describe('densityForDay', () => {
  it('zero blocked is free regardless of total', () => {
    expect(densityForDay(0, 12)).toBe('free')
  })
  it('1/12 falls in the few bucket', () => {
    expect(densityForDay(1, 12)).toBe('few')
  })
  it('majority blocked is many', () => {
    expect(densityForDay(8, 12)).toBe('many')
  })
})

describe('summarizeBuckets', () => {
  it('omits zero buckets to keep the line short', () => {
    expect(summarizeBuckets({ free: 12, blocked: 0, unknown: 0, total: 12 })).toBe('12/12 free')
    expect(summarizeBuckets({ free: 10, blocked: 2, unknown: 0, total: 12 })).toBe('10/12 free · 2 blocked')
    expect(summarizeBuckets({ free: 8, blocked: 1, unknown: 3, total: 12 })).toBe('8/12 free · 1 blocked · 3 unknown')
  })
})
