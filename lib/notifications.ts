import { supabase } from './supabase'
import { formatDateRangeShort } from './planData'

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

type EventRow = {
  id: string
  title: string
  status: string
  created_by: string | null
  created_at: string
  confirmed_date?: string | null
  confirmed_end_date?: string | null
}

type DateOptionRow = {
  id: string
  event_id: string
  date: string
  end_date?: string | null
  created_at: string
}

type VoteRow = {
  id: string
  date_option_id: string
  user_id: string
  created_at: string
}

type IdeaRow = {
  id: string
  title: string
  submitted_by: string | null
  likes: number
  created_at: string
}

function maxIso(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).sort().at(-1) ?? new Date(0).toISOString()
}

export async function fetchNotifications(input: {
  userId: string
  name: string
}): Promise<NotificationItem[]> {
  const [
    { data: events, error: eventsError },
    { data: dateOptions, error: optionsError },
    { data: votes, error: votesError },
    { data: ideas, error: ideasError },
  ] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, status, created_by, created_at, confirmed_date, confirmed_end_date')
      .order('created_at', { ascending: false }),
    supabase
      .from('date_options')
      .select('id, event_id, date, end_date, created_at'),
    supabase
      .from('votes')
      .select('id, date_option_id, user_id, created_at'),
    supabase
      .from('ideas')
      .select('id, title, submitted_by, likes, created_at')
      .order('created_at', { ascending: false }),
  ])

  if (eventsError) throw new Error(eventsError.message)
  if (optionsError) throw new Error(optionsError.message)
  if (votesError) throw new Error(votesError.message)
  if (ideasError) throw new Error(ideasError.message)

  const allEvents = (events ?? []) as EventRow[]
  const allOptions = (dateOptions ?? []) as DateOptionRow[]
  const allVotes = (votes ?? []) as VoteRow[]
  const allIdeas = (ideas ?? []) as IdeaRow[]

  const optionsByEvent: Record<string, DateOptionRow[]> = {}
  for (const option of allOptions) {
    ;(optionsByEvent[option.event_id] ??= []).push(option)
  }

  const votesByOption: Record<string, VoteRow[]> = {}
  for (const vote of allVotes) {
    ;(votesByOption[vote.date_option_id] ??= []).push(vote)
  }

  const notifications: NotificationItem[] = []

  for (const event of allEvents) {
    const options = optionsByEvent[event.id] ?? []
    const eventVotes = options.flatMap((option) => votesByOption[option.id] ?? [])
    const latestVoteAt = eventVotes.map((vote) => vote.created_at).sort().at(-1)
    const userHasVote = eventVotes.some((vote) => vote.user_id === input.userId)

    if (event.status === 'confirmed' && event.confirmed_date) {
      notifications.push({
        id: `confirmed:${event.id}`,
        type: 'confirmed',
        title: `${event.title} is locked in`,
        body: formatDateRangeShort(event.confirmed_date, event.confirmed_end_date),
        href: `/events/${event.id}`,
        timestamp: maxIso(latestVoteAt, event.created_at, event.confirmed_date),
        tone: 'olive',
      })
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
    } else if (event.status !== 'confirmed' && options.length > 0 && !userHasVote) {
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

  const recentIdeaCutoff = Date.now() - 1000 * 60 * 60 * 24 * 7
  for (const idea of allIdeas) {
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
