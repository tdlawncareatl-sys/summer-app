import { describe, expect, it } from 'vitest'
import { buildIcsEvent, escapeIcsText, foldLine, icsFilename } from '@/lib/ics'

describe('escapeIcsText', () => {
  it('escapes backslash, semicolon, comma, and newlines', () => {
    expect(escapeIcsText('a, b; c\\nd\ne')).toBe('a\\, b\\; c\\\\nd\\ne')
  })
})

describe('foldLine', () => {
  it('leaves short lines alone', () => {
    expect(foldLine('short')).toBe('short')
  })

  it('folds long lines at 75 octets with leading space continuation', () => {
    const long = 'X'.repeat(160)
    const folded = foldLine(long)
    const parts = folded.split('\r\n')
    expect(parts[0]).toHaveLength(75)
    expect(parts[1].startsWith(' ')).toBe(true)
    expect(parts.length).toBeGreaterThan(1)
  })
})

describe('buildIcsEvent', () => {
  const base = {
    id: 'abc-123',
    title: 'Beach Day',
    confirmed_date: '2026-08-01',
  }

  it('writes an all-day single-day event with DTEND exclusive of the last day', () => {
    const ics = buildIcsEvent({ ...base, length_days: 1 })
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('UID:event-abc-123@summer-app')
    expect(ics).toContain('DTSTART;VALUE=DATE:20260801')
    expect(ics).toContain('DTEND;VALUE=DATE:20260802')
    expect(ics).toContain('SUMMARY:Beach Day')
    expect(ics).toContain('END:VCALENDAR')
  })

  it('handles multi-day trips as a single all-day block', () => {
    const ics = buildIcsEvent({
      ...base,
      confirmed_date: '2026-08-01',
      confirmed_end_date: '2026-08-08',
      length_days: 7,
    })
    expect(ics).toContain('DTSTART;VALUE=DATE:20260801')
    expect(ics).toContain('DTEND;VALUE=DATE:20260809')
  })

  it('handles month boundary in DTEND exclusive math', () => {
    const ics = buildIcsEvent({
      ...base,
      confirmed_date: '2026-08-30',
      confirmed_end_date: '2026-08-31',
      length_days: 2,
    })
    expect(ics).toContain('DTEND;VALUE=DATE:20260901')
  })

  it('uses floating local time for couple-hour events with start/end times', () => {
    const ics = buildIcsEvent({
      ...base,
      length_days: 0,
      start_time: '18:30',
      end_time: '21:00',
    })
    expect(ics).toContain('DTSTART:20260801T183000')
    expect(ics).toContain('DTEND:20260801T210000')
    // No Z suffix, no TZID — floating local time
    expect(ics).not.toMatch(/DTSTART:20260801T183000Z/)
  })

  it('falls back to all-day when couple-hour event is missing times', () => {
    const ics = buildIcsEvent({ ...base, length_days: 0 })
    expect(ics).toContain('DTSTART;VALUE=DATE:20260801')
  })

  it('escapes commas and semicolons in summary, location, and description', () => {
    const ics = buildIcsEvent({
      ...base,
      length_days: 1,
      title: 'Grace, Tad; & Crew',
      location_name: 'Plank Sinatra',
      location_address: '1 Lake Rd, Acworth, GA',
      event_notes: 'Bring sunscreen; and snacks',
    })
    expect(ics).toContain('SUMMARY:Grace\\, Tad\\; & Crew')
    expect(ics).toContain('LOCATION:Plank Sinatra\\, 1 Lake Rd\\, Acworth\\, GA')
    expect(ics).toContain('DESCRIPTION:Bring sunscreen\\; and snacks')
  })

  it('includes an Apple Maps URL when location is present', () => {
    const ics = buildIcsEvent({
      ...base,
      length_days: 1,
      location_name: 'Plank Sinatra',
      location_address: '1 Lake Rd',
    })
    expect(ics).toMatch(/URL:https:\/\/maps\.apple\.com\//)
  })

  it('omits LOCATION and URL when no location info is present', () => {
    const ics = buildIcsEvent({ ...base, length_days: 1 })
    expect(ics).not.toContain('LOCATION:')
    expect(ics).not.toContain('URL:')
  })

  it('joins event_notes, description, and location_notes into DESCRIPTION', () => {
    const ics = buildIcsEvent({
      ...base,
      length_days: 1,
      event_notes: 'Bring chairs',
      description: 'Annual summer kickoff',
      location_notes: 'Park in the south lot',
    })
    // Unfold per RFC5545: continuation lines start with CRLF + single space.
    const unfolded = ics.replace(/\r\n /g, '')
    const descLine = unfolded.split('\r\n').find((l) => l.startsWith('DESCRIPTION:'))
    expect(descLine).toBeDefined()
    expect(descLine!).toContain('Bring chairs')
    expect(descLine!).toContain('Annual summer kickoff')
    expect(descLine!).toContain('Parking / meetup: Park in the south lot')
  })

  it('uses CRLF line endings', () => {
    const ics = buildIcsEvent({ ...base, length_days: 1 })
    expect(ics).toContain('\r\n')
    expect(ics.endsWith('\r\n')).toBe(true)
  })
})

describe('icsFilename', () => {
  it('slugs the title and adds .ics', () => {
    expect(icsFilename({ title: 'Beach Day!' })).toBe('beach-day.ics')
  })

  it('falls back to event.ics for empty-ish titles', () => {
    expect(icsFilename({ title: '!!!' })).toBe('event.ics')
  })
})
