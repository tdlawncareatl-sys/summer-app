import { describe, expect, it } from 'vitest'
import { buildGoogleCalendarUrl, buildOutlookCalendarUrl } from '@/lib/calendarLinks'

const base = {
  id: 'abc-123',
  title: 'Beach Day',
  confirmed_date: '2026-08-01',
}

describe('buildGoogleCalendarUrl', () => {
  it('writes an all-day single-day event with end exclusive', () => {
    const url = new URL(buildGoogleCalendarUrl({ ...base, length_days: 1 }))
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('text')).toBe('Beach Day')
    expect(url.searchParams.get('dates')).toBe('20260801/20260802')
  })

  it('writes multi-day all-day with end exclusive', () => {
    const url = new URL(buildGoogleCalendarUrl({
      ...base,
      confirmed_date: '2026-06-19',
      confirmed_end_date: '2026-06-21',
      length_days: 3,
    }))
    expect(url.searchParams.get('dates')).toBe('20260619/20260622')
  })

  it('writes timed events with floating local time for couple-hour events', () => {
    const url = new URL(buildGoogleCalendarUrl({
      ...base,
      length_days: 0,
      start_time: '18:30',
      end_time: '21:00',
    }))
    expect(url.searchParams.get('dates')).toBe('20260801T183000/20260801T210000')
  })

  it('falls back to all-day when couple-hour event is missing times', () => {
    const url = new URL(buildGoogleCalendarUrl({ ...base, length_days: 0 }))
    expect(url.searchParams.get('dates')).toBe('20260801/20260802')
  })

  it('includes location and description when provided', () => {
    const url = new URL(buildGoogleCalendarUrl({
      ...base,
      length_days: 1,
      location_name: 'Plank Sinatra',
      location_address: '1 Lake Rd, Acworth, GA',
      event_notes: 'Bring sunscreen',
    }))
    expect(url.searchParams.get('location')).toBe('Plank Sinatra, 1 Lake Rd, Acworth, GA')
    expect(url.searchParams.get('details')).toContain('Bring sunscreen')
    expect(url.searchParams.get('details')).toContain('Map: https://maps.apple.com/')
  })

  it('handles month boundary in end-exclusive math', () => {
    const url = new URL(buildGoogleCalendarUrl({
      ...base,
      confirmed_date: '2026-08-30',
      confirmed_end_date: '2026-08-31',
      length_days: 2,
    }))
    expect(url.searchParams.get('dates')).toBe('20260830/20260901')
  })
})

describe('buildOutlookCalendarUrl', () => {
  it('writes an all-day single-day event with end exclusive and allday flag', () => {
    const url = new URL(buildOutlookCalendarUrl({ ...base, length_days: 1 }))
    expect(url.origin + url.pathname).toBe('https://outlook.live.com/calendar/0/deeplink/compose')
    expect(url.searchParams.get('rru')).toBe('addevent')
    expect(url.searchParams.get('subject')).toBe('Beach Day')
    expect(url.searchParams.get('startdt')).toBe('2026-08-01T00:00:00')
    expect(url.searchParams.get('enddt')).toBe('2026-08-02T00:00:00')
    expect(url.searchParams.get('allday')).toBe('true')
  })

  it('writes timed events as floating local datetimes', () => {
    const url = new URL(buildOutlookCalendarUrl({
      ...base,
      length_days: 0,
      start_time: '18:30',
      end_time: '21:00',
    }))
    expect(url.searchParams.get('startdt')).toBe('2026-08-01T18:30:00')
    expect(url.searchParams.get('enddt')).toBe('2026-08-01T21:00:00')
    expect(url.searchParams.get('allday')).toBeNull()
  })

  it('includes location and body when provided', () => {
    const url = new URL(buildOutlookCalendarUrl({
      ...base,
      length_days: 1,
      location_name: 'Plank Sinatra',
      event_notes: 'Bring sunscreen',
    }))
    expect(url.searchParams.get('location')).toBe('Plank Sinatra')
    expect(url.searchParams.get('body')).toContain('Bring sunscreen')
  })

  it('URL-encodes commas, semicolons, ampersands in title', () => {
    const raw = buildOutlookCalendarUrl({
      ...base,
      length_days: 1,
      title: 'Grace, Tad & Crew; etc',
    })
    const url = new URL(raw)
    expect(url.searchParams.get('subject')).toBe('Grace, Tad & Crew; etc')
    // Raw URL should have these chars encoded
    expect(raw).toContain('%26')
  })
})
