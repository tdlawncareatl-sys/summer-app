import { supabase } from './supabase'
import {
  buildNotifications,
  type NotificationItem,
  type EventRow,
  type DateOptionRow,
  type VoteRow,
  type IdeaRow,
} from './notificationEngine'

export {
  buildNotifications,
  type NotificationItem,
  type NotificationTone,
  type EventRow,
  type DateOptionRow,
  type VoteRow,
  type IdeaRow,
} from './notificationEngine'

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

  return buildNotifications({
    userId: input.userId,
    name: input.name,
    events: allEvents,
    dateOptions: allOptions,
    votes: allVotes,
    ideas: allIdeas,
  })
}
