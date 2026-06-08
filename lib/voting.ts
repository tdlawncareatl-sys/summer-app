// Voting v2 — pure functions, no Supabase or React. Used by the event page
// to tally a proposed-date's votes and pick a recommended winner.
//
// Model:
//   - Each user marks each date as `works` or `pass`.
//   - On a "works" vote they may also toggle `preferred` (tie-breaker only).
//   - On a "works" vote for a short event they may also pick a time block.
//
// Ranking rules (from the spec):
//   1. Highest worksCount wins.
//   2. If tied on worksCount, highest preferredCount wins.
//   3. If still tied, no single recommendation — mark all top options as tied
//      and let a human lock one in.
//
// "Blocked" (from the personal availability calendar) is still surfaced as
// informational but does not drive the recommendation — votes are canonical.

export type VoteResponse = 'works' | 'pass'

export type TimePreference = 'morning' | 'afternoon' | 'evening' | 'flexible'

export const TIME_PREFERENCES: TimePreference[] = ['morning', 'afternoon', 'evening', 'flexible']

export const TIME_PREFERENCE_LABELS: Record<TimePreference, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  flexible: 'Flexible',
}

export type VoteRow = {
  user_id: string
  user_name: string
  response: VoteResponse
  preferred: boolean
  time_preference: TimePreference | null
}

export type OptionTally = {
  worksCount: number
  passCount: number
  preferredCount: number
  /** Most-popular time preference among "works" voters, or null if no votes
   *  / event isn't a short type. `flexible` is treated as a wildcard and only
   *  wins when no concrete block has more votes. */
  topTimePreference: TimePreference | null
}

export function tallyOption(votes: VoteRow[]): OptionTally {
  let worksCount = 0
  let passCount = 0
  let preferredCount = 0
  const timeCounts: Record<TimePreference, number> = {
    morning: 0,
    afternoon: 0,
    evening: 0,
    flexible: 0,
  }

  for (const vote of votes) {
    if (vote.response === 'works') {
      worksCount++
      if (vote.preferred) preferredCount++
      if (vote.time_preference) timeCounts[vote.time_preference]++
    } else {
      passCount++
    }
  }

  return {
    worksCount,
    passCount,
    preferredCount,
    topTimePreference: pickTopTimePreference(timeCounts),
  }
}

export function pickTopTimePreference(counts: Record<TimePreference, number>): TimePreference | null {
  // Concrete blocks beat flexible; among concrete blocks the highest count
  // wins, with ties resolving to the earlier slot in the day.
  const concrete: TimePreference[] = ['morning', 'afternoon', 'evening']
  let best: TimePreference | null = null
  let bestCount = 0
  for (const slot of concrete) {
    if (counts[slot] > bestCount) {
      bestCount = counts[slot]
      best = slot
    }
  }
  if (best) return best
  // No concrete votes — return flexible only if anyone picked it.
  return counts.flexible > 0 ? 'flexible' : null
}

export type Ranked<TOption> = {
  option: TOption
  tally: OptionTally
  /** 'recommended' = unambiguous winner. 'tied' = part of the top-tier tie set.
   *  null = neither (lower in the ranking). */
  status: 'recommended' | 'tied' | null
}

/**
 * Rank a list of options by worksCount, then preferredCount. Returns the
 * original order along with each option's recommendation status.
 *
 * If no option has any works votes, every option gets `null` — there is no
 * recommendation yet.
 */
export function rankOptions<T>(
  options: T[],
  votesByOption: (option: T) => VoteRow[],
): Ranked<T>[] {
  const tallies = options.map((option) => ({ option, tally: tallyOption(votesByOption(option)) }))
  const maxWorks = tallies.reduce((m, t) => Math.max(m, t.tally.worksCount), 0)
  if (maxWorks === 0) {
    return tallies.map((t) => ({ ...t, status: null }))
  }
  const topWorks = tallies.filter((t) => t.tally.worksCount === maxWorks)
  const maxPreferred = topWorks.reduce((m, t) => Math.max(m, t.tally.preferredCount), 0)
  const topPreferred = topWorks.filter((t) => t.tally.preferredCount === maxPreferred)

  if (topPreferred.length === 1) {
    const winner = topPreferred[0].option
    return tallies.map((t) => ({
      ...t,
      status: t.option === winner ? 'recommended' as const : null,
    }))
  }

  // True tie — mark every tied option as `tied`, no single recommendation.
  const tiedSet = new Set(topPreferred.map((t) => t.option))
  return tallies.map((t) => ({
    ...t,
    status: tiedSet.has(t.option) ? 'tied' as const : null,
  }))
}

/**
 * Convenience: return just the recommended option, or null when tied / no votes.
 */
export function recommendedOption<T>(ranked: Ranked<T>[]): T | null {
  const winner = ranked.find((r) => r.status === 'recommended')
  return winner ? winner.option : null
}

/**
 * True if a previously-confirmed option is no longer the recommended one,
 * meaning votes have shifted since lock-in.
 */
export function recommendationConflictsWithConfirmed<T>(
  ranked: Ranked<T>[],
  confirmed: T | null,
): boolean {
  if (!confirmed) return false
  const winner = recommendedOption(ranked)
  if (!winner) return false // no clear new winner — don't cry wolf
  return winner !== confirmed
}
