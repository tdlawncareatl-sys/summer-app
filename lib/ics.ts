// Build an RFC5545 .ics file for a confirmed event.
//
// Day-long or multi-day events are written as all-day blocks
// (DTSTART/DTEND with VALUE=DATE, DTEND exclusive of the last day).
//
// Couple-hour events with start_time/end_time are written as floating
// local time — no TZID, no Z suffix — so the user's calendar app
// interprets the wall clock in their device's timezone. That matches
// how the app already treats times (entered and displayed as local).

import { buildAppleMapsUrl } from './eventDetails'
import { normalizeLengthDays } from './lengthType'

export type IcsEventInput = {
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

const PRODID = '-//Summer Plans//Tentaful//EN'

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

// Fold long lines per RFC5545 §3.1 — split at 75 octets, continuation lines
// begin with a single space.
export function foldLine(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  let remaining = line
  parts.push(remaining.slice(0, 75))
  remaining = remaining.slice(75)
  while (remaining.length > 0) {
    parts.push(' ' + remaining.slice(0, 74))
    remaining = remaining.slice(74)
  }
  return parts.join('\r\n')
}

function formatDateOnly(iso: string): string {
  return iso.replace(/-/g, '')
}

function addOneDayIso(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + 1)
  return dt.toISOString().slice(0, 10)
}

function formatLocalDateTime(dateIso: string, time: string): string {
  const [hh, mm] = time.split(':')
  return `${formatDateOnly(dateIso)}T${hh.padStart(2, '0')}${(mm ?? '00').padStart(2, '0')}00`
}

function formatUtcStamp(d = new Date()): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function cleanLine(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function buildLocation(event: IcsEventInput): string | null {
  const name = cleanLine(event.location_name)
  const address = cleanLine(event.location_address)
  if (name && address) return `${name}, ${address}`
  return name ?? address
}

function buildDescription(event: IcsEventInput): string | null {
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

export function buildIcsEvent(event: IcsEventInput): string {
  const lengthDays = normalizeLengthDays(event.length_days)
  const isCoupleHour = lengthDays === 0
  const hasTimes = isCoupleHour && !!cleanLine(event.start_time) && !!cleanLine(event.end_time)

  const start = event.confirmed_date
  const end = event.confirmed_end_date ?? event.confirmed_date

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:event-${event.id}@summer-app`,
    `DTSTAMP:${formatUtcStamp()}`,
  ]

  if (hasTimes) {
    lines.push(`DTSTART:${formatLocalDateTime(start, event.start_time!)}`)
    lines.push(`DTEND:${formatLocalDateTime(end, event.end_time!)}`)
  } else {
    // All-day: DTEND is exclusive of the last day per RFC5545.
    lines.push(`DTSTART;VALUE=DATE:${formatDateOnly(start)}`)
    lines.push(`DTEND;VALUE=DATE:${formatDateOnly(addOneDayIso(end))}`)
  }

  lines.push(`SUMMARY:${escapeIcsText(event.title)}`)

  const location = buildLocation(event)
  if (location) lines.push(`LOCATION:${escapeIcsText(location)}`)

  const description = buildDescription(event)
  if (description) lines.push(`DESCRIPTION:${escapeIcsText(description)}`)

  const mapsUrl = buildAppleMapsUrl(event.location_name, event.location_address)
  if (mapsUrl) lines.push(`URL:${mapsUrl}`)

  lines.push('END:VEVENT', 'END:VCALENDAR')

  return lines.map(foldLine).join('\r\n') + '\r\n'
}

export function icsFilename(event: Pick<IcsEventInput, 'title'>): string {
  const slug = event.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'event'
  return `${slug}.ics`
}
