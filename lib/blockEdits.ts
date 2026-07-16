// Editing a blocked range. Pure functions — no Supabase, no React.
//
// A "block" in the My Blocks list is a contiguous run of same-category
// availability rows. Editing its boundaries means diffing two day sets:
// the days the range used to cover vs the days it covers now. The diff
// respects two rules:
//   • the past is untouchable — days before today are never added or removed
//   • other blocks are untouchable — expanding into a day that's already
//     blocked by a different range leaves that row (and its label) alone

import { eachDay } from './date'

export type BlockEditDiff = {
  toRemove: string[] // rows to delete (were in the range, no longer are)
  toKeep: string[] // rows that stay (used for a label-only update)
  toInsert: string[] // new rows to create
}

export function diffBlockEdit(opts: {
  originalDays: string[]
  newStart: string
  newEnd: string
  todayISO: string
  blockedElsewhere: Set<string> // days blocked by other ranges
}): BlockEditDiff {
  const { originalDays, newStart, newEnd, todayISO, blockedElsewhere } = opts
  const newDays = new Set(eachDay(newStart, newEnd).filter((d) => d >= todayISO))
  const originalFuture = originalDays.filter((d) => d >= todayISO)
  const originalSet = new Set(originalFuture)

  const toRemove = originalFuture.filter((d) => !newDays.has(d))
  const toKeep = originalFuture.filter((d) => newDays.has(d))
  const toInsert = [...newDays].filter((d) => !originalSet.has(d) && !blockedElsewhere.has(d)).sort()

  return { toRemove, toKeep, toInsert }
}
