import { describe, expect, it } from 'vitest'
import { compareRankedDateOptions } from '@/lib/dateOptionRanking'

describe('compareRankedDateOptions', () => {
  it('prioritizes higher conflict scores', () => {
    const ranked = [
      { date: '2026-06-10', conflictScore: 1, blockedCount: 1 },
      { date: '2026-06-11', conflictScore: 5, blockedCount: 3 },
    ].sort(compareRankedDateOptions)

    expect(ranked[0].date).toBe('2026-06-11')
  })

  it('breaks score ties by fewer blocked people, then earlier dates', () => {
    const ranked = [
      { date: '2026-06-14', conflictScore: 3, blockedCount: 1 },
      { date: '2026-06-12', conflictScore: 3, blockedCount: 1 },
      { date: '2026-06-13', conflictScore: 3, blockedCount: 2 },
    ].sort(compareRankedDateOptions)

    expect(ranked.map((option) => option.date)).toEqual([
      '2026-06-12',
      '2026-06-14',
      '2026-06-13',
    ])
  })
})
