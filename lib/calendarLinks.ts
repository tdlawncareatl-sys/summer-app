// Deep-link URL builders for Google Calendar and Outlook Web Calendar.
//
// Both providers accept query-string event details — no OAuth, no API key.
// The user is sent to a pre-filled "create event" page they can save in one tap.
//
// Date semantics mirror the ICS builder so behavior is consistent across providers:
//   - all-day for `length_days >= 1`, end exclusive
//   - floating local time for couple-hour events with start_time + end_time

import { buildAppleMapsUrl } from './eventDetails'
import { normalizeLengthDays } from './lengthType'

export type CalendarLinkEvent = {
  id: string
  title: string
  description?: string | null
  confirmed_date: string
  confirmed_end_date?: string | null
  location_name?: string | null
  location_address?: string | null
  location_notes?: string | null
  event_notes?: string | null
  start_time?: string | null
  end_time?: string | null
  length_days?: number | null
}

function cleanLine(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function formatCompactDate(iso: string): string {
  return iso.replace(/-/g, '')
}

function addOneDayIso(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + 1)
  return dt.toISOString().slice(0, 10)
}

function formatCompactLocalDateTime(dateIso: string, time: string): string {
  const [hh, mm] = time.split(':')
  return `${formatCompactDate(dateIso)}T${hh.padStart(2, '0')}${(mm ?? '00').padStart(2, '0')}00`
}

function formatIsoLocalDateTime(dateIso: string, time: string): string {
  const [hh, mm] = time.split(':')
  return `${dateIso}T${hh.padStart(2, '0')}:${(mm ?? '00').padStart(2, '0')}:00`
}

function buildLocation(event: CalendarLinkEvent): string | null {
  const name = cleanLine(event.location_name)
  const address = cleanLine(event.location_address)
  if (name && address) return `${name}, ${address}`
  return name ?? address
}

function buildDescription(event: CalendarLinkEvent): string | null {
  const parts: string[] = []
  const notes = cleanLine(event.event_notes)
  const description = cleanLine(event.description)
  const locationNotes = cleanLine(event.location_notes)
  const mapsUrl = buildAppleMapsUrl(event.location_name, event.location_address)

  if (notes) parts.push(notes)
  if (description && description !== notes) parts.push(description)
  if (locationNotes) parts.push(`Parking / meetup: ${locationNotes}`)
  if (mapsUrl) parts.push(`Map: ${mapsUrl}`)

  if (parts.length === 0) return null
  return parts.join('\n\n')
}

function isAllDay(event: CalendarLinkEvent): boolean {
  const lengthDays = normalizeLengthDays(event.length_days)
  if (lengthDays >= 1) return true
  return !cleanLine(event.start_time) || !cleanLine(event.end_time)
}

/* ── Google Calendar ────────────────────────────────────────────────── */

export function buildGoogleCalendarUrl(event: CalendarLinkEvent): string {
  const start = event.confirmed_date
  const end = event.confirmed_end_date ?? event.confirmed_date

  const params = new URLSearchParams()
  params.set('action', 'TEMPLATE')
  params.set('text', event.title)

  if (isAllDay(event)) {
    // All-day: YYYYMMDD/YYYYMMDD with end exclusive.
    params.set('dates', `${formatCompactDate(start)}/${formatCompactDate(addOneDayIso(end))}`)
  } else {
    // Timed: YYYYMMDDTHHMMSS/YYYYMMDDTHHMMSS, floating local time.
    params.set(
      'dates',
      `${formatCompactLocalDateTime(start, event.start_time!)}/${formatCompactLocalDateTime(end, event.end_time!)}`,
    )
  }

  const description = buildDescription(event)
  if (description) params.set('details', description)

  const location = buildLocation(event)
  if (location) params.set('location', location)

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/* ── Outlook Web ────────────────────────────────────────────────────── */

export function buildOutlookCalendarUrl(event: CalendarLinkEvent): string {
  const start = event.confirmed_date
  const end = event.confirmed_end_date ?? event.confirmed_date

  const params = new URLSearchParams()
  params.set('path', '/calendar/action/compose')
  params.set('rru', 'addevent')
  params.set('subject', event.title)

  if (isAllDay(event)) {
    // Outlook all-day: ISO datetimes at midnight, end exclusive, allday=true.
    params.set('startdt', `${start}T00:00:00`)
    params.set('enddt', `${addOneDayIso(end)}T00:00:00`)
    params.set('allday', 'true')
  } else {
    params.set('startdt', formatIsoLocalDateTime(start, event.start_time!))
    params.set('enddt', formatIsoLocalDateTime(end, event.end_time!))
  }

  const description = buildDescription(event)
  if (description) params.set('body', description)

  const location = buildLocation(event)
  if (location) params.set('location', location)

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}
