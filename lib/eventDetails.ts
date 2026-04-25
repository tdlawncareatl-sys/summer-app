export type EventDetailsFields = {
  description?: string | null
  location_name?: string | null
  location_address?: string | null
  location_notes?: string | null
  event_notes?: string | null
  start_time?: string | null
  end_time?: string | null
}

export type EventDetailsDraft = {
  title: string
  description: string
  location_name: string
  location_address: string
  location_notes: string
  event_notes: string
  start_time: string
  end_time: string
}

type EventDraftSource = {
  title?: string | null
  description?: string | null
  location_name?: string | null
  location_address?: string | null
  location_notes?: string | null
  event_notes?: string | null
  start_time?: string | null
  end_time?: string | null
}

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function cleanTime(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return trimmed.length === 5 ? `${trimmed}:00` : trimmed
}

function timeParts(value: string | null | undefined) {
  if (!value) return null
  const [hoursText, minutesText = '00'] = value.split(':')
  const hours = Number(hoursText)
  const minutes = Number(minutesText)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return { hours, minutes }
}

export function eventDraftFromRecord(record?: EventDraftSource | null): EventDetailsDraft {
  return {
    title: record?.title ?? '',
    description: record?.description ?? '',
    location_name: record?.location_name ?? '',
    location_address: record?.location_address ?? '',
    location_notes: record?.location_notes ?? '',
    event_notes: record?.event_notes ?? '',
    start_time: toInputTime(record?.start_time),
    end_time: toInputTime(record?.end_time),
  }
}

export function eventPayloadFromDraft(draft: EventDetailsDraft) {
  return {
    title: draft.title.trim(),
    description: cleanText(draft.description),
    location_name: cleanText(draft.location_name),
    location_address: cleanText(draft.location_address),
    location_notes: cleanText(draft.location_notes),
    event_notes: cleanText(draft.event_notes),
    start_time: cleanTime(draft.start_time),
    end_time: cleanTime(draft.end_time),
  }
}

export function toInputTime(value: string | null | undefined) {
  if (!value) return ''
  return value.slice(0, 5)
}

export function formatClockTime(value: string | null | undefined) {
  const parts = timeParts(value)
  if (!parts) return null
  const date = new Date()
  date.setHours(parts.hours, parts.minutes, 0, 0)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatClockRange(start: string | null | undefined, end: string | null | undefined) {
  const startLabel = formatClockTime(start)
  const endLabel = formatClockTime(end)
  if (startLabel && endLabel) return `${startLabel} – ${endLabel}`
  return startLabel ?? endLabel ?? null
}

export function buildAppleMapsUrl(locationName: string | null | undefined, address: string | null | undefined) {
  const name = cleanText(locationName)
  const street = cleanText(address)
  if (!name && !street) return null
  if (name && street) {
    return `https://maps.apple.com/?q=${encodeURIComponent(name)}&address=${encodeURIComponent(street)}`
  }
  return `https://maps.apple.com/?q=${encodeURIComponent(name ?? street ?? '')}`
}

export function locationPrimaryLine(details: EventDetailsFields) {
  return cleanText(details.location_name) ?? cleanText(details.location_address) ?? null
}

export function locationSecondaryLine(details: EventDetailsFields) {
  const name = cleanText(details.location_name)
  const address = cleanText(details.location_address)
  if (name && address) return address
  return null
}

export function compactEventDetails(details: EventDetailsFields) {
  const bits = [locationPrimaryLine(details), formatClockRange(details.start_time, details.end_time)].filter(Boolean)
  return bits.length > 0 ? bits.join(' · ') : null
}

export function hasEventLogistics(details: EventDetailsFields) {
  return Boolean(
    cleanText(details.location_name) ||
    cleanText(details.location_address) ||
    cleanText(details.location_notes) ||
    cleanText(details.event_notes) ||
    cleanText(details.start_time) ||
    cleanText(details.end_time),
  )
}
