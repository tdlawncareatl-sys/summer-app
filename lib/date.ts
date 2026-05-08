export function toLocalISODate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayLocalISO() {
  return toLocalISODate(new Date())
}

/**
 * Inclusive list of YYYY-MM-DD strings between two ISO dates.
 *
 * Single canonical date-range walker for the whole app — every page that
 * shows availability, voting, or calendar density needs to expand a
 * `{ start, end }` shape into individual days, and they all need to agree
 * on edge cases (null end, reversed inputs, DST transitions).
 *
 * - `end === null/undefined` or equal to start → `[start]`
 * - reversed inputs are normalized so the result is always ascending
 * - noon-local anchoring + setDate dodges DST jumps
 */
export function eachDay(startISO: string, endISO?: string | null): string[] {
  if (!endISO || endISO === startISO) return [startISO]
  const start = new Date(startISO + 'T12:00:00')
  const end = new Date(endISO + 'T12:00:00')
  const [s, e] = start <= end ? [start, end] : [end, start]
  const out: string[] = []
  const cur = new Date(s)
  while (cur <= e) {
    out.push(toLocalISODate(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}
