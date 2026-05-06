import { supabase } from './supabase'
import {
  buildEventNotificationPlans,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationDateOptionRow,
  type NotificationEventRow,
  type NotificationPlan,
  type NotificationPreferences,
  type NotificationTone,
  type NotificationType,
  type NotificationUserRow,
  type NotificationVoteRow,
} from './notificationEngine'

export type { NotificationTone, NotificationType } from './notificationEngine'

export type NotificationItem = {
  id: string
  user_id: string
  event_id: string | null
  type: NotificationType
  tone: NotificationTone
  title: string
  body: string
  href: string
  dedupe_key: string
  scheduled_for: string
  created_at: string
  sent_at: string | null
  read_at: string | null
}

export type NotificationPreferenceState = NotificationPreferences

export type PushSubscriptionRow = {
  id?: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  user_agent?: string | null
  created_at?: string
  updated_at?: string
  disabled_at?: string | null
}

const EVENT_NOTIFICATION_TYPES: NotificationType[] = [
  'event_confirmed',
  'event_reminder',
  'vote_needed',
]

function emitNotificationsChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('summer-notifications-changed'))
}

async function deleteNotifications(ids: string[]) {
  if (ids.length === 0) return
  const { error } = await supabase.from('notifications').delete().in('id', ids)
  if (error) throw new Error(error.message)
}

function normalizePreferences(row?: Partial<{
  confirmed_enabled: boolean | null
  vote_needed_enabled: boolean | null
  reminder_timing: string | null
}> | null): NotificationPreferenceState {
  return {
    confirmedEnabled: row?.confirmed_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.confirmedEnabled,
    voteNeededEnabled: row?.vote_needed_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.voteNeededEnabled,
    reminderTiming: (row?.reminder_timing as NotificationPreferenceState['reminderTiming'] | null) ?? DEFAULT_NOTIFICATION_PREFERENCES.reminderTiming,
  }
}

async function loadPreferencesMap(): Promise<Record<string, NotificationPreferenceState>> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('user_id, confirmed_enabled, vote_needed_enabled, reminder_timing')

  if (error) throw new Error(error.message)

  return Object.fromEntries(
    (data ?? []).map((row) => [row.user_id, normalizePreferences(row)]),
  )
}

async function loadEventNotificationContext(eventId: string) {
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, title, status, created_at, confirmed_at, confirmed_date, confirmed_end_date, location_name')
    .eq('id', eventId)
    .maybeSingle()

  if (eventError) throw new Error(eventError.message)
  if (!event) return null

  const [
    { data: users, error: usersError },
    { data: dateOptions, error: dateOptionsError },
    { data: existingNotifications, error: notificationsError },
    preferencesByUserId,
  ] = await Promise.all([
    supabase.from('users').select('id, name'),
    supabase.from('date_options').select('id, event_id, date, end_date, created_at').eq('event_id', eventId),
    supabase.from('notifications').select('id, dedupe_key, type').eq('event_id', eventId),
    loadPreferencesMap(),
  ])

  if (usersError) throw new Error(usersError.message)
  if (dateOptionsError) throw new Error(dateOptionsError.message)
  if (notificationsError) throw new Error(notificationsError.message)

  const optionIds = (dateOptions ?? []).map((option) => option.id)
  const { data: votes, error: votesError } = optionIds.length === 0
    ? { data: [] as NotificationVoteRow[], error: null }
    : await supabase
        .from('votes')
        .select('id, date_option_id, user_id, created_at')
        .in('date_option_id', optionIds)

  if (votesError) throw new Error(votesError.message)

  return {
    event: event as NotificationEventRow,
    users: (users ?? []) as NotificationUserRow[],
    dateOptions: (dateOptions ?? []) as NotificationDateOptionRow[],
    votes: (votes ?? []) as NotificationVoteRow[],
    existingNotifications: (existingNotifications ?? []) as Array<{ id: string; dedupe_key: string; type: NotificationType }>,
    preferencesByUserId,
  }
}

function toNotificationRows(plans: NotificationPlan[]) {
  return plans.map((plan) => ({
    user_id: plan.userId,
    event_id: plan.eventId,
    type: plan.type,
    tone: plan.tone,
    title: plan.title,
    body: plan.body,
    href: plan.href,
    dedupe_key: plan.dedupeKey,
    scheduled_for: plan.scheduledFor,
  }))
}

export async function fetchNotifications(userId: string): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, event_id, type, tone, title, body, href, dedupe_key, scheduled_for, created_at, sent_at, read_at')
    .eq('user_id', userId)
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw new Error(error.message)
  return (data ?? []) as NotificationItem[]
}

export async function markNotificationsRead(userId: string, notificationIds: string[]) {
  if (notificationIds.length === 0) return
  const readAt = new Date().toISOString()
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: readAt })
    .eq('user_id', userId)
    .in('id', notificationIds)

  if (error) throw new Error(error.message)
  emitNotificationsChanged()
}

export async function loadNotificationPreferences(userId: string): Promise<NotificationPreferenceState> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('confirmed_enabled, vote_needed_enabled, reminder_timing')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return normalizePreferences(data)
}

export async function saveNotificationPreferences(userId: string, preferences: NotificationPreferenceState) {
  const payload = {
    user_id: userId,
    confirmed_enabled: preferences.confirmedEnabled,
    vote_needed_enabled: preferences.voteNeededEnabled,
    reminder_timing: preferences.reminderTiming,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) throw new Error(error.message)
}

export async function upsertPushSubscription(row: PushSubscriptionRow) {
  const payload = {
    user_id: row.user_id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    user_agent: row.user_agent ?? null,
    disabled_at: null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(payload, { onConflict: 'endpoint' })

  if (error) throw new Error(error.message)
}

export async function disablePushSubscription(endpoint: string) {
  const { error } = await supabase
    .from('push_subscriptions')
    .update({
      disabled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('endpoint', endpoint)

  if (error) throw new Error(error.message)
}

export async function syncEventNotifications(eventId: string, actorUserId?: string | null) {
  const context = await loadEventNotificationContext(eventId)
  if (!context) return

  const plans = buildEventNotificationPlans({
    event: context.event,
    users: context.users,
    dateOptions: context.dateOptions,
    votes: context.votes,
    preferencesByUserId: context.preferencesByUserId,
    actorUserId,
  })

  const desiredKeys = new Set(plans.map((plan) => plan.dedupeKey))
  const staleIds = context.existingNotifications
    .filter((row) => EVENT_NOTIFICATION_TYPES.includes(row.type) && !desiredKeys.has(row.dedupe_key))
    .map((row) => row.id)

  await deleteNotifications(staleIds)

  const rows = toNotificationRows(plans)
  if (rows.length > 0) {
    const { error } = await supabase
      .from('notifications')
      .upsert(rows, { onConflict: 'dedupe_key' })

    if (error) throw new Error(error.message)
  }

  emitNotificationsChanged()
}

export async function syncAllNotifications(actorUserId?: string | null) {
  const { data, error } = await supabase.from('events').select('id')
  if (error) throw new Error(error.message)

  for (const event of data ?? []) {
    await syncEventNotifications(event.id, actorUserId)
  }
}

export async function dispatchReadyNotifications(eventId?: string) {
  const response = await fetch('/api/notifications/dispatch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventId ? { eventId } : {}),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || 'Could not dispatch notifications.')
  }
}
