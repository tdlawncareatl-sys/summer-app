type RankedOptionLike = {
  date: string
  end_date?: string | null
  conflictScore: number
  blockedCount: number
}

export function compareRankedDateOptions<T extends RankedOptionLike>(a: T, b: T) {
  if (b.conflictScore !== a.conflictScore) return b.conflictScore - a.conflictScore
  if (a.blockedCount !== b.blockedCount) return a.blockedCount - b.blockedCount

  const dateCompare = a.date.localeCompare(b.date)
  if (dateCompare !== 0) return dateCompare

  return (a.end_date ?? a.date).localeCompare(b.end_date ?? b.date)
}
