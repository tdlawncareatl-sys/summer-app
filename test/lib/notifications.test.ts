import { describe, expect, it } from 'vitest'
import {
  buildNotifications,
  type DateOptionRow,
  type EventRow,
  type IdeaRow,
  type VoteRow,
} from '@/lib/notificationEngine'

const NOW = new Date('2026-04-24T12:00:00.000Z').getTime()

function buildInput(overrides?: Partial<{
  events: EventRow[]
  dateOptions: DateOptionRow[]
  votes: VoteRow[]
  ideas: IdeaRow[]
}>) {
  return {
    userId: 'user-1',
    name: 'Tad',
    events: overrides?.events ?? [],
    dateOptions: overrides?.dateOptions ?? [],
    votes: overrides?.votes ?? [],
    ideas: overrides?.ideas ?? [],
    now: NOW,
  }
}

describe('buildNotifications', () => {
  it('creates a confirmed notification and suppresses vote noise for confirmed events', () => {
    const items = buildNotifications(buildInput({
      events: [
        {
          id: 'event-1',
          title: 'Lake Weekend',
          status: 'confirmed',
          created_by: 'Tad',
          created_at: '2026-04-20T10:00:00.000Z',
          confirmed_date: '2026-06-19',
          confirmed_end_date: '2026-06-21',
        },
      ],
      dateOptions: [
        { id: 'option-1', event_id: 'event-1', date: '2026-06-19', end_date: '2026-06-21', created_at: '2026-04-21T10:00:00.000Z' },
      ],
      votes: [
        { id: 'vote-1', date_option_id: 'option-1', user_id: 'friend-1', created_at: '2026-04-22T10:00:00.000Z' },
      ],
    }))

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      type: 'confirmed',
      title: 'Lake Weekend is locked in',
      href: '/events/event-1',
      tone: 'olive',
      timestamp: '2026-04-22T10:00:00.000Z',
    })
  })

  it('creates a vote-needed notification when the current user has not voted', () => {
    const items = buildNotifications(buildInput({
      events: [
        {
          id: 'event-1',
          title: 'Pool Day',
          status: 'planning',
          created_by: 'Megan',
          created_at: '2026-04-22T10:00:00.000Z',
        },
      ],
      dateOptions: [
        { id: 'option-1', event_id: 'event-1', date: '2026-05-01', created_at: '2026-04-23T10:00:00.000Z' },
        { id: 'option-2', event_id: 'event-1', date: '2026-05-02', created_at: '2026-04-23T11:00:00.000Z' },
      ],
      votes: [
        { id: 'vote-1', date_option_id: 'option-1', user_id: 'friend-2', created_at: '2026-04-23T12:00:00.000Z' },
      ],
    }))

    expect(items[0]).toMatchObject({
      type: 'vote-needed',
      title: 'Vote on Pool Day',
      body: '2 date options waiting for you',
      href: '/events/event-1',
      tone: 'terracotta',
    })
  })

  it('creates vote-activity for a host on active planning events', () => {
    const items = buildNotifications(buildInput({
      events: [
        {
          id: 'event-1',
          title: 'Cabin Trip',
          status: 'planning',
          created_by: 'Tad',
          created_at: '2026-04-22T10:00:00.000Z',
        },
      ],
      dateOptions: [
        { id: 'option-1', event_id: 'event-1', date: '2026-05-10', created_at: '2026-04-23T09:00:00.000Z' },
        { id: 'option-2', event_id: 'event-1', date: '2026-05-11', created_at: '2026-04-23T09:30:00.000Z' },
      ],
      votes: [
        { id: 'vote-1', date_option_id: 'option-1', user_id: 'friend-1', created_at: '2026-04-23T10:00:00.000Z' },
        { id: 'vote-2', date_option_id: 'option-2', user_id: 'friend-2', created_at: '2026-04-23T11:00:00.000Z' },
      ],
    }))

    expect(items[0]).toMatchObject({
      type: 'vote-activity',
      title: 'Cabin Trip is getting votes',
      body: '2 votes across 2 options',
      href: '/events/event-1',
      tone: 'terracotta',
    })
  })

  it('includes recent and trending ideas from other people only', () => {
    const items = buildNotifications(buildInput({
      ideas: [
        {
          id: 'idea-1',
          title: 'Drive in movie',
          submitted_by: 'Megan',
          likes: 0,
          created_at: '2026-04-23T10:00:00.000Z',
        },
        {
          id: 'idea-2',
          title: 'Fire Pit Night',
          submitted_by: 'Grace',
          likes: 4,
          created_at: '2026-04-10T10:00:00.000Z',
        },
        {
          id: 'idea-3',
          title: 'My own idea',
          submitted_by: 'Tad',
          likes: 12,
          created_at: '2026-04-23T09:00:00.000Z',
        },
      ],
    }))

    expect(items.map((item) => item.id)).toEqual(['idea:idea-1', 'idea:idea-2'])
  })
})
