export type NotificationTone = 'olive' | 'terracotta' | 'amber'

export type NotificationItem = {
  id: string
  type: 'confirmed' | 'vote-activity' | 'vote-needed' | 'idea'
  title: string
  body: string
  href: string
  timestamp: string
  tone: NotificationTone
}

export type EventRow = {
  id: string
  title: string
  status: string
  created_by: string | null
  created_at: string
  confirmed_date?: string | null
  confirmed_end_date?: string | null
}

export type DateOptionRow = {
  id: string
  event_id: string
  date: string
  end_date?: string | null
  created_at: string
}

export type VoteRow = {
  id: string
  date_option_id: string
  user_id: string
  created_at: string
}

export type IdeaRow = {
  id: string
  title: string
  submitted_by: string | null
  likes: number
  created_at: string
}

function maxIso(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).sort().at(-1) ?? new Date(0).toISOString()
}

function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', opts ?? { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatDateRangeShort(start: string, end?: string | null): string {
  if (!end || end === start) return formatDate(start, { weekday: 'short', month: 'short', day: 'numeric' })
  return `${formatDate(start, { month: 'short', day: 'numeric' })} – ${formatDate(end, { month: 'short', day: 'numeric' })}`
}

export function buildNotifications(input: {
  userId: string
  name: string
  events: EventRow[]
  dateOptions: DateOptionRow[]
  votes: VoteRow[]
  ideas: IdeaRow[]
  now?: number
}): NotificationItem[] {
  const optionsByEvent: Record<string, DateOptionRow[]> = {}
  for (const option of input.dateOptions) {
    ;(optionsByEvent[option.event_id] ??= []).push(option)
  }

  const votesByOption: Record<string, VoteRow[]> = {}
  for (const vote of input.votes) {
    ;(votesByOption[vote.date_option_id] ??= []).push(vote)
  }

  const notifications: NotificationItem[] = []

  for (const event of input.events) {
    const options = optionsByEvent[event.id] ?? []
    const eventVotes = options.flatMap((option) => votesByOption[option.id] ?? [])
    const latestVoteAt = eventVotes.map((vote) => vote.created_at).sort().at(-1)
    const userHasVote = eventVotes.some((vote) => vote.user_id === input.userId)
    const isConfirmed = event.status === 'confirmed' && !!event.confirmed_date

    if (isConfirmed) {
      notifications.push({
        id: `confirmed:${event.id}`,
        type: 'confirmed',
        title: `${event.title} is locked in`,
        body: formatDateRangeShort(event.confirmed_date!, event.confirmed_end_date),
        href: `/events/${event.id}`,
        timestamp: maxIso(latestVoteAt, event.created_at, event.confirmed_date),
        tone: 'olive',
      })
      continue
    }

    if (event.created_by === input.name && eventVotes.length > 0) {
      notifications.push({
        id: `vote-activity:${event.id}`,
        type: 'vote-activity',
        title: `${event.title} is getting votes`,
        body: `${eventVotes.length} vote${eventVotes.length === 1 ? '' : 's'} across ${options.length} option${options.length === 1 ? '' : 's'}`,
        href: `/events/${event.id}`,
        timestamp: maxIso(latestVoteAt, event.created_at),
        tone: 'terracotta',
      })
    } else if (options.length > 0 && !userHasVote) {
      const latestOptionAt = options.map((option) => option.created_at).sort().at(-1)
      notifications.push({
        id: `vote-needed:${event.id}`,
        type: 'vote-needed',
        title: `Vote on ${event.title}`,
        body: `${options.length} date option${options.length === 1 ? '' : 's'} waiting for you`,
        href: `/events/${event.id}`,
        timestamp: maxIso(latestVoteAt, latestOptionAt, event.created_at),
        tone: 'terracotta',
      })
    }
  }

  const recentIdeaCutoff = (input.now ?? Date.now()) - 1000 * 60 * 60 * 24 * 7
  for (const idea of input.ideas) {
    if (idea.submitted_by === input.name) continue
    const createdAt = new Date(idea.created_at).getTime()
    const isRecent = Number.isFinite(createdAt) && createdAt >= recentIdeaCutoff
    const isTrending = idea.likes >= 3
    if (!isRecent && !isTrending) continue

    notifications.push({
      id: `idea:${idea.id}`,
      type: 'idea',
      title: isTrending ? `${idea.title} is getting traction` : `New idea: ${idea.title}`,
      body: isTrending
        ? `${idea.likes} likes so far`
        : `${idea.submitted_by ?? 'Someone'} added a new idea`,
      href: '/ideas',
      timestamp: idea.created_at,
      tone: 'amber',
    })
  }

  return notifications
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 8)
}
