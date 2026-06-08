import { describe, expect, it } from 'vitest'
import {
  tallyWeeklyDays,
  rankWeeklyDays,
  leadingWeeklyDay,
  topIdeas,
  worksUserIdsForDay,
  weekStartFor,
  weekDays,
  type DayAvailability,
  type TimePreference,
} from '@/lib/weeklyPlans'

type V = { day: string; availability: DayAvailability; is_best_choice: boolean; time_preference?: TimePreference | null }
const works = (day: string, best = false, time: TimePreference | null = null): V => ({
  day,
  availability: 'works',
  is_best_choice: best,
  time_preference: time,
})
const pass = (day: string): V => ({ day, availability: 'pass', is_best_choice: false })

describe('tallyWeeklyDays', () => {
  it('counts works, pass and best per candidate day', () => {
    const days = ['2026-06-09', '2026-06-10']
    const tallies = tallyWeeklyDays(days, [
      works('2026-06-09', true),
      works('2026-06-09'),
      pass('2026-06-10'),
    ])
    expect(tallies[0]).toEqual({ day: '2026-06-09', worksCount: 2, passCount: 0, bestCount: 1, topTimePreference: null })
    expect(tallies[1]).toEqual({ day: '2026-06-10', worksCount: 0, passCount: 1, bestCount: 0, topTimePreference: null })
  })

  it('ignores votes for days not on the ballot', () => {
    const tallies = tallyWeeklyDays(['2026-06-09'], [works('2026-06-11')])
    expect(tallies).toHaveLength(1)
    expect(tallies[0].worksCount).toBe(0)
  })

  it('surfaces the leading time-of-day among works voters', () => {
    const tallies = tallyWeeklyDays(['2026-06-09'], [
      works('2026-06-09', false, 'evening'),
      works('2026-06-09', false, 'evening'),
      works('2026-06-09', false, 'morning'),
    ])
    expect(tallies[0].topTimePreference).toBe('evening')
  })

  it('leaves time-of-day null when no one picked a block', () => {
    const tallies = tallyWeeklyDays(['2026-06-09'], [works('2026-06-09'), pass('2026-06-09')])
    expect(tallies[0].topTimePreference).toBeNull()
  })
})

describe('rankWeeklyDays', () => {
  it('sorts by works desc, then best desc, then pass asc, then earliest day', () => {
    const days = ['2026-06-09', '2026-06-10', '2026-06-11']
    const ranked = rankWeeklyDays(days, [
      // Tue: 2 works, 0 best
      works('2026-06-09'), works('2026-06-09'),
      // Wed: 2 works, 1 best  -> should beat Tue on the best tiebreak
      works('2026-06-10', true), works('2026-06-10'),
      // Thu: 3 works -> should lead outright
      works('2026-06-11'), works('2026-06-11'), works('2026-06-11'),
    ])
    expect(ranked.map((r) => r.day)).toEqual(['2026-06-11', '2026-06-10', '2026-06-09'])
  })

  it('breaks a works+best tie by fewer pass votes', () => {
    const days = ['2026-06-09', '2026-06-10']
    const ranked = rankWeeklyDays(days, [
      works('2026-06-09'), pass('2026-06-09'),
      works('2026-06-10'),
    ])
    expect(ranked[0].day).toBe('2026-06-10') // same works, fewer passes
  })
})

describe('leadingWeeklyDay', () => {
  it('returns null until at least one works vote exists', () => {
    const days = ['2026-06-09', '2026-06-10']
    expect(leadingWeeklyDay(rankWeeklyDays(days, []))).toBeNull()
    expect(leadingWeeklyDay(rankWeeklyDays(days, [pass('2026-06-09')]))).toBeNull()
  })

  it('returns the top day once voting starts', () => {
    const days = ['2026-06-09', '2026-06-10']
    const leader = leadingWeeklyDay(rankWeeklyDays(days, [works('2026-06-10')]))
    expect(leader?.day).toBe('2026-06-10')
  })
})

describe('topIdeas', () => {
  it('rolls up duplicate ideas (case-insensitive) by frequency', () => {
    const ideas = [
      { idea_text: 'Tacos', category: 'dinner' as const },
      { idea_text: 'tacos', category: 'dinner' as const },
      { idea_text: 'Mini golf', category: 'outside' as const },
    ]
    const top = topIdeas(ideas)
    expect(top[0]).toMatchObject({ text: 'Tacos', count: 2 })
    expect(top[1]).toMatchObject({ text: 'Mini golf', count: 1 })
  })
})

describe('worksUserIdsForDay', () => {
  it('returns distinct user ids that marked works on the day', () => {
    const votes = [
      { id: '1', weekly_plan_id: 'p', user_id: 'a', day: '2026-06-09', availability: 'works' as const, is_best_choice: false, time_preference: null },
      { id: '2', weekly_plan_id: 'p', user_id: 'b', day: '2026-06-09', availability: 'pass' as const, is_best_choice: false, time_preference: null },
      { id: '3', weekly_plan_id: 'p', user_id: 'a', day: '2026-06-10', availability: 'works' as const, is_best_choice: false, time_preference: null },
    ]
    expect(worksUserIdsForDay(votes, '2026-06-09')).toEqual(['a'])
    expect(worksUserIdsForDay(votes, null)).toEqual([])
  })
})

describe('week math', () => {
  it('anchors the week to Monday', () => {
    // 2026-06-10 is a Wednesday; its week starts Monday 2026-06-08
    expect(weekStartFor('2026-06-10')).toBe('2026-06-08')
    // Sunday belongs to the week that started the previous Monday
    expect(weekStartFor('2026-06-14')).toBe('2026-06-08')
    // Monday maps to itself
    expect(weekStartFor('2026-06-08')).toBe('2026-06-08')
  })

  it('produces seven ascending days Mon→Sun', () => {
    const days = weekDays('2026-06-08')
    expect(days).toHaveLength(7)
    expect(days[0]).toBe('2026-06-08')
    expect(days[6]).toBe('2026-06-14')
  })
})
