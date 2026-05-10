import { describe, expect, it } from 'vitest'
import {
  rankOptions,
  recommendationConflictsWithConfirmed,
  recommendedOption,
  tallyOption,
  type VoteRow,
} from '@/lib/voting'

function vote(user: string, response: 'works' | 'pass', preferred = false, timePreference: VoteRow['time_preference'] = null): VoteRow {
  return {
    user_id: user,
    user_name: user,
    response,
    preferred,
    time_preference: timePreference,
  }
}

describe('tallyOption', () => {
  it('counts works, pass, and preferred separately', () => {
    expect(tallyOption([
      vote('a', 'works', true),
      vote('b', 'works', false),
      vote('c', 'pass'),
    ])).toEqual({
      worksCount: 2,
      passCount: 1,
      preferredCount: 1,
      topTimePreference: null,
    })
  })

  it('only counts preferred when the vote is works', () => {
    // A pass vote with preferred=true (shouldn't happen via UI, defensive)
    expect(tallyOption([
      vote('a', 'pass', true),
    ]).preferredCount).toBe(0)
  })

  it('picks the top concrete time block over flexible', () => {
    const tally = tallyOption([
      vote('a', 'works', false, 'morning'),
      vote('b', 'works', false, 'morning'),
      vote('c', 'works', false, 'flexible'),
      vote('d', 'works', false, 'flexible'),
      vote('e', 'works', false, 'flexible'),
    ])
    expect(tally.topTimePreference).toBe('morning')
  })

  it('returns flexible only when no concrete block has votes', () => {
    const tally = tallyOption([
      vote('a', 'works', false, 'flexible'),
      vote('b', 'works', false, 'flexible'),
    ])
    expect(tally.topTimePreference).toBe('flexible')
  })
})

describe('rankOptions', () => {
  type Opt = { id: string; votes: VoteRow[] }
  const votesByOption = (o: Opt) => o.votes

  it('picks the option with more works votes regardless of preferred', () => {
    // Spec example: A has 6 works + 1 preferred, B has 5 works + 4 preferred.
    // A wins because availability beats preference.
    const A: Opt = {
      id: 'A',
      votes: [
        vote('u1', 'works', true),
        vote('u2', 'works'),
        vote('u3', 'works'),
        vote('u4', 'works'),
        vote('u5', 'works'),
        vote('u6', 'works'),
      ],
    }
    const B: Opt = {
      id: 'B',
      votes: [
        vote('u1', 'works', true),
        vote('u2', 'works', true),
        vote('u3', 'works', true),
        vote('u4', 'works', true),
        vote('u5', 'works'),
      ],
    }
    const ranked = rankOptions([A, B], votesByOption)
    expect(recommendedOption(ranked)).toBe(A)
  })

  it('uses preferred as the tie-breaker', () => {
    const A: Opt = {
      id: 'A',
      votes: [vote('u1', 'works'), vote('u2', 'works'), vote('u3', 'works')],
    }
    const B: Opt = {
      id: 'B',
      votes: [
        vote('u1', 'works', true),
        vote('u2', 'works', true),
        vote('u3', 'works', true),
      ],
    }
    expect(recommendedOption(rankOptions([A, B], votesByOption))).toBe(B)
  })

  it('marks all tied options when works and preferred are both tied', () => {
    const A: Opt = { id: 'A', votes: [vote('u1', 'works', true), vote('u2', 'works')] }
    const B: Opt = { id: 'B', votes: [vote('u3', 'works', true), vote('u4', 'works')] }
    const ranked = rankOptions([A, B], votesByOption)
    expect(ranked.find((r) => r.option === A)?.status).toBe('tied')
    expect(ranked.find((r) => r.option === B)?.status).toBe('tied')
    expect(recommendedOption(ranked)).toBeNull()
  })

  it('returns no recommendation when no option has works votes', () => {
    const A: Opt = { id: 'A', votes: [vote('u1', 'pass')] }
    const B: Opt = { id: 'B', votes: [] }
    const ranked = rankOptions([A, B], votesByOption)
    for (const r of ranked) expect(r.status).toBeNull()
    expect(recommendedOption(ranked)).toBeNull()
  })
})

describe('recommendationConflictsWithConfirmed', () => {
  type Opt = { id: string; votes: VoteRow[] }
  const votesByOption = (o: Opt) => o.votes

  it('is true when the recommended option differs from the confirmed one', () => {
    const A: Opt = { id: 'A', votes: [vote('u1', 'works')] }
    const B: Opt = { id: 'B', votes: [vote('u1', 'works'), vote('u2', 'works')] }
    const ranked = rankOptions([A, B], votesByOption)
    expect(recommendationConflictsWithConfirmed(ranked, A)).toBe(true)
  })

  it('is false when the confirmed option is still the recommendation', () => {
    const A: Opt = { id: 'A', votes: [vote('u1', 'works'), vote('u2', 'works')] }
    const B: Opt = { id: 'B', votes: [vote('u1', 'works')] }
    const ranked = rankOptions([A, B], votesByOption)
    expect(recommendationConflictsWithConfirmed(ranked, A)).toBe(false)
  })

  it('is false when there is no clear recommendation yet (tie)', () => {
    const A: Opt = { id: 'A', votes: [vote('u1', 'works')] }
    const B: Opt = { id: 'B', votes: [vote('u2', 'works')] }
    const ranked = rankOptions([A, B], votesByOption)
    expect(recommendationConflictsWithConfirmed(ranked, A)).toBe(false)
  })
})
