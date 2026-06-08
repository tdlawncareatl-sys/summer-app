// This Week — Supabase data layer. Loaders + mutations for the casual weekly
// planning feature. All pure logic (ranking, week math, idea rollups) lives in
// lib/weeklyPlans.ts; this file is the only place that talks to the database.

import { supabase } from './supabase'
import { todayLocalISO } from './date'
import {
  enrichWeeklyPlan,
  isMissingTableError,
  topIdeas,
  weekStartFor,
  worksUserIdsForDay,
  type DayAvailability,
  type EnrichedWeeklyPlan,
  type IdeaCategory,
  type ThisWeekData,
  type WeeklyPlanRow,
  type WeeklyPlanStatus,
  type WeeklyPlanSummary,
  type WeeklyVoteRow,
  type WeeklyIdeaRow,
} from './weeklyPlans'

const PLAN_COLUMNS =
  'id, created_by, title, note, week_start_date, candidate_days, status, confirmed_day, converted_event_id, created_at, updated_at'

function coerceCandidateDays(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  return []
}

function normalizePlanRow(row: Record<string, unknown>): WeeklyPlanRow {
  return {
    id: row.id as string,
    created_by: (row.created_by as string | null) ?? null,
    title: (row.title as string) ?? 'Hang this week?',
    note: (row.note as string | null) ?? null,
    week_start_date: row.week_start_date as string,
    candidate_days: coerceCandidateDays(row.candidate_days),
    status: (row.status as WeeklyPlanStatus) ?? 'open',
    confirmed_day: (row.confirmed_day as string | null) ?? null,
    converted_event_id: (row.converted_event_id as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

/* ── Reads ───────────────────────────────────────────────────────────────── */

/** Load every still-relevant plan (this week or later, not archived) plus its
 *  votes and ideas, enriched with rankings. Newest plan first. */
export async function loadThisWeek(): Promise<ThisWeekData> {
  const currentWeek = weekStartFor(todayLocalISO())

  const { data: planRows, error: planError } = await supabase
    .from('weekly_plans')
    .select(PLAN_COLUMNS)
    .neq('status', 'archived')
    .gte('week_start_date', currentWeek)
    .order('created_at', { ascending: false })

  if (planError) {
    return { tablesMissing: isMissingTableError(planError), plans: [], userMap: {} }
  }

  const plans = (planRows ?? []).map((r) => normalizePlanRow(r as Record<string, unknown>))
  const planIds = plans.map((p) => p.id)

  if (planIds.length === 0) {
    return { tablesMissing: false, plans: [], userMap: {} }
  }

  const [{ data: users }, { data: voteRows }, { data: ideaRows }] = await Promise.all([
    supabase.from('users').select('id, name'),
    supabase
      .from('weekly_plan_votes')
      .select('id, weekly_plan_id, user_id, day, availability, is_best_choice')
      .in('weekly_plan_id', planIds),
    supabase
      .from('weekly_plan_ideas')
      .select('id, weekly_plan_id, user_id, idea_text, category, created_at')
      .in('weekly_plan_id', planIds)
      .order('created_at', { ascending: false }),
  ])

  const userMap: Record<string, string> = Object.fromEntries(
    ((users ?? []) as { id: string; name: string }[]).map((u) => [u.id, u.name]),
  )

  const votesByPlan: Record<string, WeeklyVoteRow[]> = {}
  for (const v of (voteRows ?? []) as WeeklyVoteRow[]) {
    ;(votesByPlan[v.weekly_plan_id] ??= []).push(v)
  }
  const ideasByPlan: Record<string, WeeklyIdeaRow[]> = {}
  for (const i of (ideaRows ?? []) as WeeklyIdeaRow[]) {
    ;(ideasByPlan[i.weekly_plan_id] ??= []).push(i)
  }

  const enriched = plans.map((plan) =>
    enrichWeeklyPlan(plan, votesByPlan[plan.id] ?? [], ideasByPlan[plan.id] ?? []),
  )
  return { tablesMissing: false, plans: enriched, userMap }
}

/** Lightweight summary of the single most relevant plan, for the Home card. */
export async function loadWeeklyPlanSummary(): Promise<WeeklyPlanSummary | null> {
  const { plans } = await loadThisWeek()
  const featured = plans.find((p) => p.status === 'open') ?? plans.find((p) => p.status === 'confirmed') ?? null
  if (!featured) return null

  const focusDay = featured.confirmed_day ?? featured.leadingDay?.day ?? null
  const availableCount = worksUserIdsForDay(featured.votes, focusDay).length

  return {
    id: featured.id,
    title: featured.title,
    status: featured.status,
    leadingDay: featured.leadingDay,
    confirmedDay: featured.confirmed_day,
    availableCount,
    topIdeas: topIdeas(featured.ideas).map(({ text, category }) => ({ text, category })),
  }
}

/* ── Writes ──────────────────────────────────────────────────────────────── */

export async function createWeeklyPlan(input: {
  name: string
  title: string
  note: string
  weekStart: string
  candidateDays: string[]
}): Promise<{ id: string | null; error: string | null }> {
  const title = input.title.trim() || 'Hang this week?'
  const { data, error } = await supabase
    .from('weekly_plans')
    .insert({
      created_by: input.name,
      title,
      note: input.note.trim() || null,
      week_start_date: input.weekStart,
      candidate_days: input.candidateDays,
      status: 'open',
    })
    .select('id')
    .single()
  if (error) return { id: null, error: error.message }
  return { id: (data as { id: string }).id, error: null }
}

/** Toggle a Works/Pass vote. Clicking the already-selected value clears it.
 *  A Pass also drops any Best star on that day. */
export async function castWeeklyVote(input: {
  planId: string
  userId: string
  day: string
  availability: DayAvailability
  existing?: WeeklyVoteRow | null
}): Promise<{ error: string | null }> {
  const { planId, userId, day, availability, existing } = input

  if (existing && existing.availability === availability) {
    const { error } = await supabase.from('weekly_plan_votes').delete().eq('id', existing.id)
    return { error: error?.message ?? null }
  }

  const { error } = await supabase.from('weekly_plan_votes').upsert(
    {
      weekly_plan_id: planId,
      user_id: userId,
      day,
      availability,
      is_best_choice: availability === 'pass' ? false : (existing?.is_best_choice ?? false),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'weekly_plan_id,user_id,day' },
  )
  return { error: error?.message ?? null }
}

/** Mark a day as this user's single Best choice (exclusive within the plan).
 *  Best implies Works. Toggling the current Best off just clears the star. */
export async function setWeeklyBest(input: {
  planId: string
  userId: string
  day: string
  myVotes: WeeklyVoteRow[]
}): Promise<{ error: string | null }> {
  const { planId, userId, day, myVotes } = input
  const current = myVotes.find((v) => v.day === day)

  if (current?.is_best_choice) {
    const { error } = await supabase
      .from('weekly_plan_votes')
      .update({ is_best_choice: false, updated_at: new Date().toISOString() })
      .eq('id', current.id)
    return { error: error?.message ?? null }
  }

  // Demote any existing Best star this user has on this plan first.
  const starred = myVotes.filter((v) => v.is_best_choice).map((v) => v.id)
  if (starred.length > 0) {
    const { error: demoteError } = await supabase
      .from('weekly_plan_votes')
      .update({ is_best_choice: false, updated_at: new Date().toISOString() })
      .in('id', starred)
    if (demoteError) return { error: demoteError.message }
  }

  const { error } = await supabase.from('weekly_plan_votes').upsert(
    {
      weekly_plan_id: planId,
      user_id: userId,
      day,
      availability: 'works', // starring a day means it works for you
      is_best_choice: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'weekly_plan_id,user_id,day' },
  )
  return { error: error?.message ?? null }
}

export async function addWeeklyIdea(input: {
  planId: string
  userId: string | null
  text: string
  category: IdeaCategory | null
}): Promise<{ error: string | null }> {
  const text = input.text.trim()
  if (!text) return { error: 'Idea text is required' }
  const { error } = await supabase.from('weekly_plan_ideas').insert({
    weekly_plan_id: input.planId,
    user_id: input.userId,
    idea_text: text,
    category: input.category,
  })
  return { error: error?.message ?? null }
}

export async function confirmWeeklyPlan(input: { planId: string; day: string }): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('weekly_plans')
    .update({ status: 'confirmed', confirmed_day: input.day, updated_at: new Date().toISOString() })
    .eq('id', input.planId)
  return { error: error?.message ?? null }
}

export async function reopenWeeklyPlan(input: { planId: string }): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('weekly_plans')
    .update({ status: 'open', confirmed_day: null, updated_at: new Date().toISOString() })
    .eq('id', input.planId)
  return { error: error?.message ?? null }
}

/** Promote a confirmed casual plan into a real formal event.
 *  - title/date/notes pre-filled from the plan
 *  - attendance seeded "going" for everyone who marked Works on the day
 *  - plan archived and linked to the new event
 *  Returns the new event id so the caller can navigate to it. */
export async function convertWeeklyPlanToEvent(input: {
  plan: EnrichedWeeklyPlan
  name: string
}): Promise<{ eventId: string | null; error: string | null }> {
  const { plan, name } = input
  const day = plan.confirmed_day
  if (!day) return { eventId: null, error: 'Confirm a day before turning this into an event.' }

  const ideaLine = topIdeas(plan.ideas)
    .map((i) => i.text)
    .join(', ')
  const noteParts = [plan.note?.trim(), ideaLine ? `Ideas: ${ideaLine}` : null].filter(Boolean)
  const eventNotes =
    noteParts.length > 0
      ? `${noteParts.join('\n')}\n\n(Started as a casual This Week plan.)`
      : 'Started as a casual This Week plan.'

  const { data: created, error: insertError } = await supabase
    .from('events')
    .insert({
      title: plan.title === 'Hang this week?' ? 'This week hang' : plan.title,
      description: plan.note?.trim() || null,
      created_by: name,
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      confirmed_date: day,
      confirmed_end_date: null,
      confirmation_method: 'manual',
      confirmed_by: name,
      length_days: 0, // casual couple-hours
      event_notes: eventNotes,
    })
    .select('id')
    .single()

  if (insertError) return { eventId: null, error: insertError.message }
  const eventId = (created as { id: string }).id

  // Seed attendance "going" from everyone who said the confirmed day works.
  const goingUserIds = worksUserIdsForDay(plan.votes, day)
  if (goingUserIds.length > 0) {
    const seed = goingUserIds.map((userId) => ({
      event_id: eventId,
      user_id: userId,
      status: 'going',
      updated_at: new Date().toISOString(),
    }))
    const { error: seedError } = await supabase
      .from('attendance')
      .upsert(seed, { onConflict: 'event_id,user_id', ignoreDuplicates: true })
    if (seedError) console.error('seed attendance from weekly plan:', seedError)
  }

  // Archive + link the plan. Non-fatal if it fails — the event still exists.
  const { error: archiveError } = await supabase
    .from('weekly_plans')
    .update({ status: 'archived', converted_event_id: eventId, updated_at: new Date().toISOString() })
    .eq('id', plan.id)
  if (archiveError) console.error('archive weekly plan after convert:', archiveError)

  return { eventId, error: null }
}
