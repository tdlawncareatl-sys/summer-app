import type { NotificationItem } from './notificationEngine'

const MAX_SEEN_SIGNATURES = 100

export type NotificationReadState = {
  lastSeenAt: string | null
  seenSignatures: string[]
}

export function notificationSignature(item: NotificationItem) {
  return `${item.id}::${item.timestamp}`
}

export function parseNotificationReadState(raw: string | null): NotificationReadState {
  if (!raw) {
    return {
      lastSeenAt: null,
      seenSignatures: [],
    }
  }

  try {
    const parsed = JSON.parse(raw) as Partial<NotificationReadState>
    return {
      lastSeenAt: typeof parsed.lastSeenAt === 'string' ? parsed.lastSeenAt : null,
      seenSignatures: Array.isArray(parsed.seenSignatures)
        ? parsed.seenSignatures.filter((value): value is string => typeof value === 'string')
        : [],
    }
  } catch {
    return {
      lastSeenAt: raw,
      seenSignatures: [],
    }
  }
}

export function isNotificationUnread(item: NotificationItem, state: NotificationReadState) {
  const signature = notificationSignature(item)
  if (state.seenSignatures.includes(signature)) return false
  if (!state.lastSeenAt) return true
  return item.timestamp > state.lastSeenAt
}

export function unreadNotificationCount(items: NotificationItem[], state: NotificationReadState) {
  return items.filter((item) => isNotificationUnread(item, state)).length
}

export function markNotificationsRead(
  state: NotificationReadState,
  items: NotificationItem[],
  seenAt = new Date().toISOString(),
): NotificationReadState {
  const nextSignatures = [...new Set([
    ...state.seenSignatures,
    ...items.map((item) => notificationSignature(item)),
  ])]

  return {
    lastSeenAt: seenAt,
    seenSignatures: nextSignatures.slice(-MAX_SEEN_SIGNATURES),
  }
}

export function serializeNotificationReadState(state: NotificationReadState) {
  return JSON.stringify(state)
}
