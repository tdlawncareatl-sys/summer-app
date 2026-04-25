import { describe, expect, it } from 'vitest'
import {
  buildAppleMapsUrl,
  compactEventDetails,
  eventDraftFromRecord,
  eventPayloadFromDraft,
  formatClockRange,
  formatClockTime,
  hasEventLogistics,
  locationPrimaryLine,
  locationSecondaryLine,
} from '@/lib/eventDetails'

describe('eventDetails helpers', () => {
  it('builds an Apple Maps link from a name and address', () => {
    expect(buildAppleMapsUrl('Piedmont Park', '400 Park Dr NE, Atlanta, GA')).toBe(
      'https://maps.apple.com/?q=Piedmont%20Park&address=400%20Park%20Dr%20NE%2C%20Atlanta%2C%20GA',
    )
  })

  it('formats clock ranges for event detail cards', () => {
    expect(formatClockTime('18:30:00')).toBe('6:30 PM')
    expect(formatClockRange('18:30', '20:00')).toBe('6:30 PM – 8:00 PM')
  })

  it('normalizes a form draft into a db payload', () => {
    expect(eventPayloadFromDraft({
      title: ' Lake Day ',
      description: '  Bring towels  ',
      location_name: ' Dock ',
      location_address: '  ',
      location_notes: '',
      event_notes: '  Park by the marina ',
      start_time: '09:30',
      end_time: '',
    })).toEqual({
      title: 'Lake Day',
      description: 'Bring towels',
      location_name: 'Dock',
      location_address: null,
      location_notes: null,
      event_notes: 'Park by the marina',
      start_time: '09:30:00',
      end_time: null,
    })
  })

  it('builds compact event summaries from logistics fields', () => {
    const details = {
      location_name: 'Piedmont Park',
      location_address: '400 Park Dr NE, Atlanta, GA',
      start_time: '09:30:00',
      end_time: '11:00:00',
    }

    expect(locationPrimaryLine(details)).toBe('Piedmont Park')
    expect(locationSecondaryLine(details)).toBe('400 Park Dr NE, Atlanta, GA')
    expect(compactEventDetails(details)).toBe('Piedmont Park · 9:30 AM – 11:00 AM')
    expect(hasEventLogistics(details)).toBe(true)
  })

  it('hydrates an editable draft from a partial event record', () => {
    expect(eventDraftFromRecord({
      title: 'Movie Night',
      description: null,
      location_name: 'Backyard',
      start_time: '20:15:00',
    })).toEqual({
      title: 'Movie Night',
      description: '',
      location_name: 'Backyard',
      location_address: '',
      location_notes: '',
      event_notes: '',
      start_time: '20:15',
      end_time: '',
    })
  })
})
