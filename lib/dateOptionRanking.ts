// Sort proposed date options by voting v2 rules:
//   1) Highest worksCount wins.
//   2) Tie → highest preferredCount wins.
//   3) Tie → earlier start date wins.
//   4) Tie → earlier end date wins (single-day before a range that starts the same day).
//
// Blocked counts (from the personal availability calendar) are no longer part
// of ranking — votes are canonical now. Density coloring on the calendar grid
// still uses blackouts as a separate UI hint.

type RankedOptionLike = {
  date: string
  end_date?: string | null
  worksCount: number
  preferredCount: number
}

export function compareRankedDateOptions<T extends RankedOptionLike>(a: T, b: T) {
  if (b.worksCount !== a.worksCount) return b.worksCount - a.worksCount
  if (b.preferredCount !== a.preferredCount) return b.preferredCount - a.preferredCount

  const dateCompare = a.date.localeCompare(b.date)
  if (dateCompare !== 0) return dateCompare

  return (a.end_date ?? a.date).localeCompare(b.end_date ?? b.date)
}
