import { describe, expect, it } from 'vitest'
import {
  buildEventNotificationPlans,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationDateOptionRow,
  type NotificationEventRow,
  type NotificationPreferences,
  type NotificationUserRow,
  type NotificationVoteRow,
} from '@/lib/notificationEngine'

const USERS: NotificationUserRow[] = [
  { id: 'user-1', name: 'Tad' },
  { id: 'user-2', name: 'Megan' },
  { id: 'user-3', name: 'Grace' },
]

function buildPreferencesMap(overrides?: Record<string, Partial<NotificationPreferences>>) {
  return Object.fromEntries(
    USERS.map((user) => [
      user.id,
      {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...(overrides?.[user.id] ?? {}),
      },
    ]),
  )
}

describe('buildEventNotificationPlans', () => {
  it('creates vote-needed notifications only for people who have not voted', () => {
    const event: NotificationEventRow = {
      id: 'event-1',
      title: 'Pool Day',
      status: 'planning',
      created_at: '2026-05-01T12:00:00.000Z',
    }

    const dateOptions: NotificationDateOptionRow[] = [
      { id: 'option-1', event_id: 'event-1', date: '2026-05-10', created_at: '2026-05-02T10:00:00.000Z' },
      { id: 'option-2', event_id: 'event-1', date: '2026-05-11', created_at: '2026-05-02T11:00:00.000Z' },
    ]

    const votes: NotificationVoteRow[] = [
      { id: 'vote-1', date_option_id: 'option-1', user_id: 'user-2', created_at: '2026-05-02T12:00:00.000Z' },
    ]

    const plans = buildEventNotificationPlans({
      event,
      users: USERS,
      dateOptions,
      votes,
      preferencesByUserId: buildPreferencesMap(),
      actorUserId: 'user-2',
      nowIso: '2026-05-02T12:05:00.000Z',
    })

    expect(plans).toHaveLength(4)
    expect(plans.filter((plan) => plan.userId === 'user-1')).toHaveLength(2)
    expect(plans.filter((plan) => plan.userId === 'user-3')).toHaveLength(2)
    expect(plans[0]).toMatchObject({
      type: 'vote_needed',
      title: 'Pool Day needs your vote',
      scheduledFor: '2026-05-02T11:20:00.000Z',
    })
    expect(plans[1]).toMatchObject({
      type: 'vote_needed',
      title: 'Pool Day still needs your vote',
      scheduledFor: '2026-05-03T13:00:00.000Z',
    })
  })

  it('creates a recent confirmed notification plus smart reminders for confirmed events', () => {
    const event: NotificationEventRow = {
      id: 'event-2',
      title: 'Lake Weekend',
      status: 'confirmed',
      created_at: '2026-05-01T12:00:00.000Z',
      confirmed_at: '2026-05-03T15:00:00.000Z',
      confirmed_date: '2026-05-16',
      confirmed_end_date: '2026-05-18',
      location_name: 'Lake House',
    }

    const plans = buildEventNotificationPlans({
      event,
      users: USERS,
      dateOptions: [],
      votes: [],
      preferencesByUserId: buildPreferencesMap(),
      actorUserId: 'user-1',
      nowIso: '2026-05-03T15:05:00.000Z',
    })

    expect(plans.filter((plan) => plan.type === 'event_confirmed')).toHaveLength(3)
    expect(plans.filter((plan) => plan.type === 'event_reminder')).toHaveLength(6)
    expect(plans.filter((plan) => plan.type === 'event_confirmed')[0]).toMatchObject({
      title: 'Lake Weekend is set',
    })
    expect(plans[0]?.body).toContain('Lake House')
  })

  it('respects per-user preferences when creating reminders and vote nudges', () => {
    const event: NotificationEventRow = {
      id: 'event-3',
      title: 'Friday Dinner',
      status: 'confirmed',
      created_at: '2026-05-01T12:00:00.000Z',
      confirmed_at: '2026-05-03T15:00:00.000Z',
      confirmed_date: '2026-05-15',
      confirmed_end_date: null,
    }

    const plans = buildEventNotificationPlans({
      event,
      users: USERS,
      dateOptions: [],
      votes: [],
      preferencesByUserId: buildPreferencesMap({
        'user-2': { reminderTiming: 'none' },
        'user-3': { confirmedEnabled: false, reminderTiming: 'week_before' },
      }),
      nowIso: '2026-05-03T15:05:00.000Z',
    })

    const user2 = plans.filter((plan) => plan.userId === 'user-2')
    const user3 = plans.filter((plan) => plan.userId === 'user-3')

    expect(user2.some((plan) => plan.type === 'event_reminder')).toBe(false)
    expect(user3.some((plan) => plan.type === 'event_confirmed')).toBe(false)
    expect(user3.filter((plan) => plan.type === 'event_reminder')).toHaveLength(1)
  })

  it('uses a weekend heads-up for smart reminders on friday and saturday plans', () => {
    const event: NotificationEventRow = {
      id: 'event-4',
      title: 'Pickleball Saturday',
      status: 'confirmed',
      created_at: '2026-05-01T12:00:00.000Z',
      confirmed_at: '2026-05-03T15:00:00.000Z',
      confirmed_date: '2026-05-16',
      confirmed_end_date: null,
      location_name: 'Central Courts',
    }

    const plans = buildEventNotificationPlans({
      event,
      users: USERS,
      dateOptions: [],
      votes: [],
      preferencesByUserId: buildPreferencesMap(),
      nowIso: '2026-05-03T15:05:00.000Z',
    })

    const reminders = plans.filter((plan) => plan.type === 'event_reminder' && plan.userId === 'user-1')
    expect(reminders).toHaveLength(1)
    expect(reminders[0]).toMatchObject({
      title: 'Pickleball Saturday is this weekend',
      scheduledFor: '2026-05-14T13:00:00.000Z',
    })
  })
})
