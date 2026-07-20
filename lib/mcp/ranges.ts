// Collapse single-date availability rows into human ranges. Pure functions.
//
// The availability table is one row per blocked day; for connector output we
// want "Jun 3 – Jun 9 · School · KSU", not seven rows. Consecutive dates with
// the same category merge into one range.

export type DatedRow = { date: string; category?: string | null }

export type DateRange = {
  startDate: string
  endDate: string
  days: number
  category: string | null
}

export function groupIntoRanges(rows: DatedRow[]): DateRange[] {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))
  const ranges: DateRange[] = []

  for (const row of sorted) {
    const last = ranges[ranges.length - 1]
    const category = row.category ?? null
    if (last && last.category === category && isNextDay(last.endDate, row.date)) {
      last.endDate = row.date
      last.days += 1
    } else if (last && last.endDate === row.date && last.category === category) {
      // duplicate date row — ignore
    } else {
      ranges.push({ startDate: row.date, endDate: row.date, days: 1, category })
    }
  }

  return ranges
}

function isNextDay(a: string, b: string): boolean {
  const d = new Date(a + 'T12:00:00')
  d.setDate(d.getDate() + 1)
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return iso === b
}

export function formatRange(range: DateRange): string {
  const span = range.startDate === range.endDate
    ? range.startDate
    : `${range.startDate} → ${range.endDate} (${range.days} days)`
  return range.category ? `${span} · ${range.category}` : span
}
