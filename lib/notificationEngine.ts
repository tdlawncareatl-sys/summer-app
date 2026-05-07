export type NotificationTone = 'olive' | 'terracotta' | 'amber'
export type NotificationType = 'event_confirmed' | 'event_reminder' | 'vote_needed'
export type ReminderTiming = 'smart' | 'day_before' | 'week_before' | 'none'

export type NotificationPreferences = {
  confirmedEnabled: boolean
  voteNeededEnabled: boolean
  reminderTiming: ReminderTiming
}

export type NotificationPlan = {
  userId: string
  eventId: string
  type: NotificationType
  tone: NotificationTone
  title: string
  body: string
  href: string
  dedupeKey: string
  scheduledFor: string
}

export type NotificationEventRow = {
  id: string
  title: string
  status: string
  created_at: string
  confirmed_at?: string | null
  confirmed_date?: string | null
  confirmed_end_date?: string | null
  location_name?: string | null
}

export type NotificationDateOptionRow = {
  id: string
  event_id: string
  date: string
  end_date?: string | null
  created_at: string
}

export type NotificationVoteRow = {
  id: string
  date_option_id: string
  user_id: string
  created_at: string
}

export type NotificationUserRow = {
  id: string
  name: string
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  confirmedEnabled: true,
  voteNeededEnabled: true,
  reminderTiming: 'smart',
}

const MORNING_UTC_HOUR = 13
const CONFIRM_NOTIFICATION_WINDOW_MS = 1000 * 60 * 60 * 24 * 7
const VOTE_NUDGE_DELAY_MINUTES = 20

function parseCalendarDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

function toCalendarISO(date: Date) {
  return date.toISOString().slice(0, 10)
}

function shiftCalendarDate(iso: string, deltaDays: number) {
  const date = parseCalendarDate(iso)
  date.setUTCDate(date.getUTCDate() + deltaDays)
  return toCalendarISO(date)
}

function scheduledIsoForDay(iso: string) {
  return `${iso}T${String(MORNING_UTC_HOUR).padStart(2, '0')}:00:00.000Z`
}

function addMinutesToIso(iso: string, minutes: number) {
  const date = new Date(iso)
  date.setUTCMinutes(date.getUTCMinutes() + minutes)
  return date.toISOString()
}

function nextMorningAfterIso(iso: string) {
  const date = new Date(iso)
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + 1)
  next.setUTCHours(MORNING_UTC_HOUR, 0, 0, 0)
  return next.toISOString()
}

function dayDiffInclusive(start: string, end?: string | null) {
  const startDate = parseCalendarDate(start)
  const endDate = parseCalendarDate(end ?? start)
  return Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1
}

function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso + 'T12:00:00').toLocaleDateString(
    'en-US',
    opts ?? { weekday: 'short', month: 'short', day: 'numeric' },
  )
}

function formatDateRangeShort(start: string, end?: string | null) {
  if (!end || end === start) return formatDate(start, { weekday: 'short', month: 'short', day: 'numeric' })
  return `${formatDate(start, { month: 'short', day: 'numeric' })} – ${formatDate(end, { month: 'short', day: 'numeric' })}`
}

function normalizePreferences(preferences?: Partial<NotificationPreferences> | null): NotificationPreferences {
  const reminderTiming = preferences?.reminderTiming
  const safeReminderTiming: ReminderTiming = reminderTiming === 'day_before'
    || reminderTiming === 'week_before'
    || reminderTiming === 'none'
    || reminderTiming === 'smart'
    ? reminderTiming
    : DEFAULT_NOTIFICATION_PREFERENCES.reminderTiming

  return {
    confirmedEnabled: preferences?.confirmedEnabled ?? DEFAULT_NOTIFICATION_PREFERENCES.confirmedEnabled,
    voteNeededEnabled: preferences?.voteNeededEnabled ?? DEFAULT_NOTIFICATION_PREFERENCES.voteNeededEnabled,
    reminderTiming: safeReminderTiming,
  }
}

function buildReminderMoments(event: NotificationEventRow, reminderTiming: ReminderTiming, nowIso: string) {
  if (!event.confirmed_date || reminderTiming === 'none') return []

  const candidates: Array<{ day: string; title: string; body: string }> = []
  const start = event.confirmed_date
  const end = event.confirmed_end_date ?? event.confirmed_date
  const spanDays = dayDiffInclusive(start, end)

  if (reminderTiming === 'week_before') {
    candidates.push({
      day: shiftCalendarDate(start, -7),
      title: `${event.title} is next week`,
      body: `Coming up ${formatDateRangeShort(start, event.confirmed_end_date)}`,
    })
  } else if (reminderTiming === 'day_before') {
    candidates.push({
      day: shiftCalendarDate(start, -1),
      title: `${event.title} is tomorrow`,
      body: formatDateRangeShort(start, event.confirmed_end_date),
    })
  } else {
    if (spanDays >= 3) {
      candidates.push({
        day: shiftCalendarDate(start, -7),
        title: `${event.title} is next week`,
        body: `Trip ahead ${formatDateRangeShort(start, event.confirmed_end_date)}`,
      })
      candidates.push({
        day: shiftCalendarDate(start, -1),
        title: `${event.title} starts tomorrow`,
        body: formatDateRangeShort(start, event.confirmed_end_date),
      })
    } else {
      const weekday = parseCalendarDate(start).getUTCDay()
      if (weekday === 5 || weekday === 6) {
        candidates.push({
          day: shiftCalendarDate(start, weekday === 5 ? -1 : -2),
          title: `${event.title} is this weekend`,
          body: formatDateRangeShort(start, event.confirmed_end_date),
        })
      } else {
        candidates.push({
          day: shiftCalendarDate(start, -1),
          title: `${event.title} is tomorrow`,
          body: formatDateRangeShort(start, event.confirmed_end_date),
        })
      }
    }
  }

  return [...new Map(
    candidates
      .map((candidate) => ({
        ...candidate,
        scheduledFor: scheduledIsoForDay(candidate.day),
      }))
      .filter((candidate) => candidate.scheduledFor > nowIso)
      .map((candidate) => [candidate.scheduledFor, candidate]),
  ).values()]
}

export function buildEventNotificationPlans(input: {
  event: NotificationEventRow
  users: NotificationUserRow[]
  dateOptions: NotificationDateOptionRow[]
  votes: NotificationVoteRow[]
  preferencesByUserId: Record<string, NotificationPreferences | undefined>
  actorUserId?: string | null
  nowIso?: string
}): NotificationPlan[] {
  const nowIso = input.nowIso ?? new Date().toISOString()
  const event = input.event
  const plans: NotificationPlan[] = []
  const href = `/events/${event.id}`

  if (event.status === 'confirmed' && event.confirmed_date) {
    for (const user of input.users) {
      const preferences = normalizePreferences(input.preferencesByUserId[user.id])

      const recentConfirmation = event.confirmed_at
        && new Date(event.confirmed_at).getTime() >= new Date(nowIso).getTime() - CONFIRM_NOTIFICATION_WINDOW_MS

      if (preferences.confirmedEnabled && event.confirmed_at && recentConfirmation) {
        plans.push({
          userId: user.id,
          eventId: event.id,
          type: 'event_confirmed',
          tone: 'olive',
          title: `${event.title} is set`,
          body: event.location_name?.trim()
            ? `${formatDateRangeShort(event.confirmed_date, event.confirmed_end_date)} · ${event.location_name.trim()}`
            : formatDateRangeShort(event.confirmed_date, event.confirmed_end_date),
          href,
          dedupeKey: `event-confirmed:${event.id}:${user.id}:${event.confirmed_at}`,
          scheduledFor: event.confirmed_at,
        })
      }

      for (const reminder of buildReminderMoments(event, preferences.reminderTiming, nowIso)) {
        plans.push({
          userId: user.id,
          eventId: event.id,
          type: 'event_reminder',
          tone: 'olive',
          title: reminder.title,
          body: event.location_name?.trim()
            ? `${reminder.body} · ${event.location_name.trim()}`
            : reminder.body,
          href,
          dedupeKey: `event-reminder:${event.id}:${user.id}:${reminder.scheduledFor}`,
          scheduledFor: reminder.scheduledFor,
        })
      }
    }

    return plans
  }

  if (input.dateOptions.length === 0) return plans

  const voterIds = new Set(input.votes.map((vote) => vote.user_id))
  const latestOptionAt = input.dateOptions
    .map((option) => option.created_at)
    .sort()
    .at(-1) ?? event.created_at
  const voteNudgeAt = addMinutesToIso(latestOptionAt, VOTE_NUDGE_DELAY_MINUTES)
  const voteFollowUpAt = nextMorningAfterIso(voteNudgeAt)

  for (const user of input.users) {
    const preferences = normalizePreferences(input.preferencesByUserId[user.id])
    if (!preferences.voteNeededEnabled) continue
    if (user.id === input.actorUserId) continue
    if (voterIds.has(user.id)) continue

    plans.push({
      userId: user.id,
      eventId: event.id,
      type: 'vote_needed',
      tone: 'terracotta',
      title: `${event.title} needs your vote`,
      body: `${input.dateOptions.length} date option${input.dateOptions.length === 1 ? ' is' : 's are'} ready for you`,
      href,
      dedupeKey: `vote-needed:${event.id}:${user.id}:${latestOptionAt}:first`,
      scheduledFor: voteNudgeAt,
    })

    plans.push({
      userId: user.id,
      eventId: event.id,
      type: 'vote_needed',
      tone: 'terracotta',
      title: `${event.title} still needs your vote`,
      body: `${input.dateOptions.length} date option${input.dateOptions.length === 1 ? ' is' : 's are'} still waiting on you`,
      href,
      dedupeKey: `vote-needed:${event.id}:${user.id}:${latestOptionAt}:followup`,
      scheduledFor: voteFollowUpAt,
    })
  }

  return plans
}
