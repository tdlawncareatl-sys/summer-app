// Event length — drives Best Available calculation and calendar selection rules.
// Stored in events.length_type as one of these enum values.

export type LengthType = 'couple_hours' | 'day_long' | 'three_day_trip'

export const LENGTH_TYPES: LengthType[] = ['couple_hours', 'day_long', 'three_day_trip']

export const LENGTH_LABELS: Record<LengthType, string> = {
  couple_hours: 'Couple-hour event',
  day_long: 'Day-long event',
  three_day_trip: '3-day trip',
}

export const LENGTH_HELPERS: Record<LengthType, string> = {
  couple_hours: 'A short hangout — drinks, dinner, a few hours.',
  day_long: 'A full day — beach trip, hike, single-day plan.',
  three_day_trip: 'A long weekend — Friday through Sunday.',
}

export function isLengthType(value: unknown): value is LengthType {
  return value === 'couple_hours' || value === 'day_long' || value === 'three_day_trip'
}

export function normalizeLengthType(value: string | null | undefined): LengthType {
  return isLengthType(value) ? value : 'day_long'
}

export function rangeDays(lengthType: LengthType): number {
  return lengthType === 'three_day_trip' ? 3 : 1
}

export function rangeSubLabel(lengthType: LengthType): string {
  if (lengthType === 'three_day_trip') return '3 days (Weekend)'
  if (lengthType === 'day_long') return 'Day-long event'
  return 'Couple-hour event'
}
