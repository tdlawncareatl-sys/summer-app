import { describe, expect, it } from 'vitest'
import { compareRankedDateOptions } from '@/lib/dateOptionRanking'

describe('compareRankedDateOptions', () => {
  it('prioritizes higher worksCount', () => {
    const ranked = [
      { date: '2026-06-10', worksCount: 1, preferredCount: 5 },
      { date: '2026-06-11', worksCount: 4, preferredCount: 0 },
    ].sort(compareRankedDateOptions)

    expect(ranked[0].date).toBe('2026-06-11')
  })

  it('breaks worksCount ties by higher preferredCount, then earlier dates', () => {
    const ranked = [
      { date: '2026-06-14', worksCount: 3, preferredCount: 1 },
      { date: '2026-06-12', worksCount: 3, preferredCount: 1 },
      { date: '2026-06-13', worksCount: 3, preferredCount: 2 },
    ].sort(compareRankedDateOptions)

    expect(ranked.map((option) => option.date)).toEqual([
      '2026-06-13', // most preferred
      '2026-06-12', // tied on works+preferred, earlier
      '2026-06-14',
    ])
  })
})
