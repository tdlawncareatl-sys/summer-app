// Event length — drives Best Available candidate generation and the picker.
// Stored as `events.length_days` (int).
//   0 = couple-hour event (still scheduled as single-day)
//   1 = day-long event
//   N = N-day trip

export const COUPLE_HOURS = 0
export const DAY_LONG = 1

export type LegacyLengthType = 'couple_hours' | 'day_long' | 'three_day_trip'
export type LengthType = number | LegacyLengthType

// Picker options shown in the Length sheet — covers everyday hangouts through
// the full Bald Head Island week. Extend if hosts ever ask for longer.
export const LENGTH_PRESETS: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8]

export function normalizeLengthDays(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clampLengthDays(Math.round(value))
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return clampLengthDays(Math.round(parsed))
    // legacy enum strings from the previous schema iteration
    if (value === 'couple_hours') return 0
    if (value === 'day_long') return 1
    if (value === 'three_day_trip') return 3
  }
  return DAY_LONG
}

export function clampLengthDays(n: number): number {
  if (n < 0) return 0
  if (n > 30) return 30
  return n
}

export function lengthLabel(days: LengthType): string {
  const n = normalizeLengthDays(days)
  if (n === 0) return 'Couple-hour event'
  if (n === 1) return 'Day-long event'
  return `${n}-day trip`
}

export function lengthHelper(days: LengthType): string {
  const n = normalizeLengthDays(days)
  if (n === 0) return 'A short hangout — drinks, dinner, a few hours.'
  if (n === 1) return 'A full day — beach trip, hike, single-day plan.'
  if (n === 2) return 'A weekend — Saturday and Sunday.'
  if (n === 3) return 'A long weekend — three days together.'
  if (n === 7) return 'A full week — the Bald Head Island anchor.'
  return `An ${n}-day trip — multi-day getaway.`
}

export const LENGTH_TYPES: number[] = [...LENGTH_PRESETS]
export const LENGTH_LABELS: Record<number, string> = Object.fromEntries(
  LENGTH_TYPES.map((days) => [days, lengthLabel(days)]),
) as Record<number, string>
export const LENGTH_HELPERS: Record<number, string> = Object.fromEntries(
  LENGTH_TYPES.map((days) => [days, lengthHelper(days)]),
) as Record<number, string>

export function normalizeLengthType(value: unknown): number {
  return normalizeLengthDays(value)
}

export function rangeSubLabel(days: LengthType): string {
  const n = normalizeLengthDays(days)
  if (n === 0) return 'Couple-hour event'
  if (n === 1) return 'Day-long event'
  return `${n} days`
}

/** How many calendar days a candidate range spans (couple-hours still occupies one day). */
export function scheduledDays(days: LengthType): number {
  return Math.max(1, normalizeLengthDays(days))
}
