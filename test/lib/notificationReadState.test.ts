import { describe, expect, it } from 'vitest'
import {
  isNotificationUnread,
  markNotificationsRead,
  parseNotificationReadState,
  unreadNotificationCount,
  type NotificationReadState,
} from '@/lib/notificationReadState'
import type { NotificationItem } from '@/lib/notificationEngine'

function makeItem(overrides?: Partial<NotificationItem>): NotificationItem {
  return {
    id: 'confirmed:event-1',
    type: 'confirmed',
    title: 'Lake Weekend is locked in',
    body: 'Jun 19 – Jun 21',
    href: '/events/event-1',
    timestamp: '2026-06-19',
    tone: 'olive',
    ...overrides,
  }
}

describe('notificationReadState', () => {
  it('falls back to the legacy last-seen string format', () => {
    const state = parseNotificationReadState('2026-04-26T12:00:00.000Z')

    expect(state).toEqual({
      lastSeenAt: '2026-04-26T12:00:00.000Z',
      seenSignatures: [],
    })
  })

  it('marks a future-dated notification as read once the panel is opened', () => {
    const item = makeItem()
    const initialState: NotificationReadState = {
      lastSeenAt: '2026-04-26T12:00:00.000Z',
      seenSignatures: [],
    }

    expect(isNotificationUnread(item, initialState)).toBe(true)

    const nextState = markNotificationsRead(initialState, [item], '2026-04-26T12:05:00.000Z')

    expect(isNotificationUnread(item, nextState)).toBe(false)
    expect(unreadNotificationCount([item], nextState)).toBe(0)
  })

  it('treats a newer version of the same notification as unread again', () => {
    const original = makeItem({ timestamp: '2026-04-24T10:00:00.000Z' })
    const updated = makeItem({ timestamp: '2026-04-24T12:00:00.000Z' })

    const seenState = markNotificationsRead(
      { lastSeenAt: null, seenSignatures: [] },
      [original],
      '2026-04-24T10:05:00.000Z',
    )

    expect(isNotificationUnread(original, seenState)).toBe(false)
    expect(isNotificationUnread(updated, seenState)).toBe(true)
  })
})
