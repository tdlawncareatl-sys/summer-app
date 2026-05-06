import { describe, expect, it } from 'vitest'
import { toLocalISODate } from '@/lib/date'

describe('toLocalISODate', () => {
  it('uses the local calendar day instead of UTC rollover strings', () => {
    const date = new Date(2026, 4, 5, 23, 30, 0)
    expect(toLocalISODate(date)).toBe('2026-05-05')
  })
})
