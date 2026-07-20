// The MCP tool set — what an AI assistant connected to Summer Plans can do.
//
// Identity comes from currentFriend() (set by the route's key check), so every
// write lands as the connected friend, same as if they tapped it in the app.
// Write paths deliberately mirror the app's own writes (see app/events/[id]
// voting, app/availability blocks, AttendanceCard) so both surfaces stay
// consistent with each other.

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getServerSupabase } from '../serverSupabase'
import { currentFriend } from './context'
import { groupIntoRanges, formatRange } from './ranges'
import { eachDay, todayLocalISO } from '../date'
import { scoreRange, findBestRanges, summarizeBuckets, type Participant, type AvailabilityRow } from '../availability'
import { compareRankedDateOptions } from '../dateOptionRanking'
import { inferEventStatus } from '../status'
import { loadThisWeek, castWeeklyVote, setWeeklyBest } from '../weeklyPlansData'
import type { SupabaseClient } from '@supabase/supabase-js'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')

/** Hard cap so a typo like "2027" for "2026-07-27" can't insert a year of rows. */
const MAX_RANGE_DAYS = 120

function text(body: string) {
  return { content: [{ type: 'text' as const, text: body }] }
}

function daysBetween(startISO: string, endISO: string): string[] {
  const days = eachDay(startISO, endISO)
  if (days.length === 0) throw new Error(`End date ${endISO} is before start date ${startISO}.`)
  if (days.length > MAX_RANGE_DAYS) {
    throw new Error(`That range is ${days.length} days — the connector caps ranges at ${MAX_RANGE_DAYS}. Split it up if you really mean it.`)
  }
  return days
}

type UserRow = { id: string; name: string; email: string }
type EventRow = {
  id: string
  title: string
  description: string | null
  status: string
  created_by: string | null
  confirmed_date: string | null
  confirmed_end_date: string | null
  location_name: string | null
  start_time: string | null
  end_time: string | null
  created_at: string
}
type OptionRow = { id: string; event_id: string; date: string; end_date: string | null }
type VoteRow = {
  id: string
  date_option_id: string
  user_id: string
  response: string
  preferred: boolean
  time_preference: string | null
}

async function loadUsers(sb: SupabaseClient): Promise<UserRow[]> {
  const { data, error } = await sb.from('users').select('id, name, email')
  if (error) throw new Error(error.message)
  return (data ?? []) as UserRow[]
}

async function loadAvailability(sb: SupabaseClient): Promise<AvailabilityRow[]> {
  const { data, error } = await sb.from('availability').select('user_id, date, category')
  if (error) throw new Error(error.message)
  return (data ?? []) as (AvailabilityRow & { category: string | null })[]
}

const EVENT_COLUMNS =
  'id, title, description, status, created_by, confirmed_date, confirmed_end_date, location_name, start_time, end_time, created_at'

/** Accepts an event id or a (partial, case-insensitive) title. */
async function resolveEvent(sb: SupabaseClient, ref: string): Promise<EventRow> {
  const uuidish = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidish.test(ref.trim())) {
    const { data, error } = await sb.from('events').select(EVENT_COLUMNS).eq('id', ref.trim()).maybeSingle()
    if (error) throw new Error(error.message)
    if (data) return data as EventRow
  }
  const { data, error } = await sb.from('events').select(EVENT_COLUMNS).ilike('title', `%${ref.trim()}%`)
  if (error) throw new Error(error.message)
  const matches = (data ?? []) as EventRow[]
  if (matches.length === 1) return matches[0]
  if (matches.length === 0) throw new Error(`No event matches "${ref}". Use list_events to see what exists.`)
  throw new Error(`"${ref}" matches ${matches.length} events: ${matches.map((m) => `${m.title} (${m.id})`).join(', ')}. Be more specific or pass the id.`)
}

async function loadOptionsWithVotes(sb: SupabaseClient, eventId: string) {
  const [{ data: options, error: optError }, { data: votes, error: voteError }] = await Promise.all([
    sb.from('date_options').select('id, event_id, date, end_date').eq('event_id', eventId),
    sb.from('votes').select('id, date_option_id, user_id, response, preferred, time_preference'),
  ])
  if (optError) throw new Error(optError.message)
  if (voteError) throw new Error(voteError.message)
  const optionRows = (options ?? []) as OptionRow[]
  const optionIds = new Set(optionRows.map((o) => o.id))
  const voteRows = ((votes ?? []) as VoteRow[]).filter((v) => optionIds.has(v.date_option_id))
  return { options: optionRows, votes: voteRows }
}

export function registerSummerTools(server: McpServer) {
  const sb = () => getServerSupabase()

  /* ── Identity & people ─────────────────────────────────────────────── */

  server.registerTool(
    'whoami',
    {
      title: 'Who am I',
      description: 'Which friend this connector link belongs to, plus their upcoming blocked dates.',
      inputSchema: {},
    },
    async () => {
      const me = currentFriend()
      const rows = await loadAvailability(sb())
      const today = todayLocalISO()
      const mine = rows.filter((r) => r.user_id === me.id && r.date >= today)
      const ranges = groupIntoRanges(mine as { date: string; category?: string | null }[])
      const blocks = ranges.length === 0 ? 'No upcoming blocked dates.' : ranges.map(formatRange).join('\n')
      return text(`You are ${me.name} (${me.email}).\n\nUpcoming blocked dates:\n${blocks}`)
    },
  )

  server.registerTool(
    'list_friends',
    {
      title: 'List friends',
      description: 'Everyone in the group, and whether they have filled in any availability yet.',
      inputSchema: {},
    },
    async () => {
      const [users, rows] = await Promise.all([loadUsers(sb()), loadAvailability(sb())])
      const submitted = new Set(rows.map((r) => r.user_id))
      const lines = users
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((u) => `- ${u.name}${submitted.has(u.id) ? '' : ' (no availability submitted yet)'}`)
      return text(`${users.length} friends:\n${lines.join('\n')}`)
    },
  )

  /* ── Availability ──────────────────────────────────────────────────── */

  server.registerTool(
    'get_availability',
    {
      title: 'Get availability',
      description: "Blocked (out of town / busy) date ranges — the whole group's, or one person's.",
      inputSchema: {
        person: z.string().optional().describe('Friend name; omit for everyone'),
        from: isoDate.optional().describe('Default today'),
        to: isoDate.optional().describe('Default 120 days out'),
      },
    },
    async ({ person, from, to }) => {
      const users = await loadUsers(sb())
      const rows = await loadAvailability(sb())
      const start = from ?? todayLocalISO()
      const end = to ?? addDays(start, 120)
      const nameById = new Map(users.map((u) => [u.id, u.name]))

      let targets = users
      if (person) {
        targets = users.filter((u) => u.name.toLowerCase().includes(person.toLowerCase()))
        if (targets.length === 0) throw new Error(`Nobody named "${person}". Friends: ${users.map((u) => u.name).join(', ')}`)
      }
      const targetIds = new Set(targets.map((u) => u.id))

      const sections: string[] = []
      for (const id of targetIds) {
        const mine = rows.filter((r) => r.user_id === id && r.date >= start && r.date <= end)
        if (mine.length === 0) continue
        const ranges = groupIntoRanges(mine as { date: string; category?: string | null }[])
        sections.push(`${nameById.get(id)}:\n${ranges.map((r) => `  ${formatRange(r)}`).join('\n')}`)
      }
      if (sections.length === 0) return text(`No blocked dates between ${start} and ${end}.`)
      return text(`Blocked dates ${start} → ${end}:\n\n${sections.join('\n\n')}`)
    },
  )

  server.registerTool(
    'whos_free',
    {
      title: "Who's free",
      description: 'For a date range: who is free, who is blocked, who has never filled in availability.',
      inputSchema: {
        start_date: isoDate,
        end_date: isoDate.optional().describe('Default: same as start_date'),
      },
    },
    async ({ start_date, end_date }) => {
      const users = await loadUsers(sb())
      const rows = await loadAvailability(sb())
      daysBetween(start_date, end_date ?? start_date)
      const participants: Participant[] = users.map((u) => ({ id: u.id, name: u.name }))
      const scored = scoreRange(start_date, end_date ?? start_date, participants, rows)
      const lines = [
        `${start_date}${end_date && end_date !== start_date ? ` → ${end_date}` : ''}: ${summarizeBuckets(scored.buckets)}`,
      ]
      if (scored.blockedNames.length > 0) lines.push(`Blocked: ${scored.blockedNames.join(', ')}`)
      if (scored.unknownNames.length > 0) lines.push(`Unknown (never submitted): ${scored.unknownNames.join(', ')}`)
      return text(lines.join('\n'))
    },
  )

  server.registerTool(
    'find_best_dates',
    {
      title: 'Find best dates',
      description: 'Rank upcoming dates (or weekend windows) by how many friends are free.',
      inputSchema: {
        length_days: z.number().int().min(0).max(8).optional()
          .describe('0 = a couple hours, 1 = full day, 3 = Fri–Sun weekend trip. Default 1.'),
        horizon_days: z.number().int().min(7).max(180).optional().describe('How far ahead to look. Default 60.'),
        top: z.number().int().min(1).max(15).optional().describe('How many results. Default 5.'),
      },
    },
    async ({ length_days, horizon_days, top }) => {
      const users = await loadUsers(sb())
      const rows = await loadAvailability(sb())
      const participants: Participant[] = users.map((u) => ({ id: u.id, name: u.name }))
      const length = length_days ?? 1
      const ranked = findBestRanges(length === 3 ? 'three_day_trip' : length, participants, rows, todayLocalISO(), horizon_days ?? 60)
      const lines = ranked.slice(0, top ?? 5).map((r, i) => {
        const span = r.startDate === r.endDate ? r.startDate : `${r.startDate} → ${r.endDate}`
        const detail = r.blockedNames.length > 0 ? ` — blocked: ${r.blockedNames.join(', ')}` : ''
        return `${i + 1}. ${span}: ${summarizeBuckets(r.buckets)}${detail}`
      })
      return text(`Best upcoming ${length === 3 ? 'Fri–Sun windows' : length <= 1 ? 'days' : `${length}-day windows`}:\n${lines.join('\n')}`)
    },
  )

  server.registerTool(
    'block_dates',
    {
      title: 'Block dates',
      description: 'Mark yourself unavailable (out of town / busy) for a date or range.',
      inputSchema: {
        start_date: isoDate,
        end_date: isoDate.optional().describe('Default: just the one day'),
        label: z.string().max(60).optional().describe('Optional label, e.g. "Beach trip" or "Work travel"'),
      },
    },
    async ({ start_date, end_date, label }) => {
      const me = currentFriend()
      const days = daysBetween(start_date, end_date ?? start_date)
      const { error } = await sb()
        .from('availability')
        .upsert(
          days.map((date) => ({ user_id: me.id, date, category: label?.trim() || null })),
          { onConflict: 'user_id,date', ignoreDuplicates: true },
        )
      if (error) throw new Error(error.message)
      return text(`Blocked ${days.length} day${days.length === 1 ? '' : 's'} (${start_date}${end_date && end_date !== start_date ? ` → ${end_date}` : ''}) for ${me.name}${label ? ` · ${label}` : ''}. Days already blocked were left as they were.`)
    },
  )

  server.registerTool(
    'unblock_dates',
    {
      title: 'Unblock dates',
      description: 'Remove your blocked days in a date range (only affects your own calendar).',
      inputSchema: {
        start_date: isoDate,
        end_date: isoDate.optional().describe('Default: just the one day'),
      },
    },
    async ({ start_date, end_date }) => {
      const me = currentFriend()
      const days = daysBetween(start_date, end_date ?? start_date)
      const { data, error } = await sb()
        .from('availability')
        .delete()
        .eq('user_id', me.id)
        .in('date', days)
        .select('date')
      if (error) throw new Error(error.message)
      const removed = data?.length ?? 0
      return text(removed === 0
        ? `Nothing to remove — ${me.name} had no blocked days in that range.`
        : `Unblocked ${removed} day${removed === 1 ? '' : 's'} for ${me.name}.`)
    },
  )

  /* ── Events & voting ───────────────────────────────────────────────── */

  server.registerTool(
    'list_events',
    {
      title: 'List events',
      description: 'All events with status, leading date, and whether your vote is still needed.',
      inputSchema: {
        include_past: z.boolean().optional().describe('Also show events that already happened. Default false.'),
      },
    },
    async ({ include_past }) => {
      const me = currentFriend()
      const client = sb()
      const { data: events, error } = await client.from('events').select(EVENT_COLUMNS).order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      const eventRows = (events ?? []) as EventRow[]
      if (eventRows.length === 0) return text('No events yet. create_event starts one.')

      const [{ data: allOptions }, { data: allVotes }] = await Promise.all([
        client.from('date_options').select('id, event_id, date, end_date'),
        client.from('votes').select('id, date_option_id, user_id, response, preferred, time_preference'),
      ])
      const optionRows = (allOptions ?? []) as OptionRow[]
      const voteRows = (allVotes ?? []) as VoteRow[]
      const today = todayLocalISO()

      const lines = eventRows.map((ev) => {
        const options = optionRows.filter((o) => o.event_id === ev.id)
        const optionIds = new Set(options.map((o) => o.id))
        const votes = voteRows.filter((v) => optionIds.has(v.date_option_id))
        const status = inferEventStatus({
          status: ev.status,
          hasDateOptions: options.length > 0,
          voteCount: votes.length,
          createdByCurrentUser: ev.created_by === me.name,
        })
        const iVoted = votes.some((v) => v.user_id === me.id)
        const endDate = ev.confirmed_end_date ?? ev.confirmed_date
        const isPast = !!endDate && endDate < today
        if (isPast && !include_past) return null

        const ranked = options
          .map((o) => ({
            ...o,
            worksCount: votes.filter((v) => v.date_option_id === o.id && v.response === 'works').length,
            preferredCount: votes.filter((v) => v.date_option_id === o.id && v.preferred).length,
          }))
          .sort(compareRankedDateOptions)
        const topDate = ev.confirmed_date ?? ranked[0]?.date ?? null
        const needsVote = status === 'voting' && !iVoted && ev.status !== 'confirmed'
        const bits = [
          `- ${ev.title} [${status}${isPast ? ', past' : ''}]`,
          topDate ? `date: ${topDate}${ev.confirmed_date ? ' (confirmed)' : ' (leading)'}` : 'no dates proposed yet',
          needsVote ? '⚠ needs your vote' : null,
          `id: ${ev.id}`,
        ].filter(Boolean)
        return bits.join(' · ')
      }).filter(Boolean)

      return text(lines.join('\n'))
    },
  )

  server.registerTool(
    'get_event',
    {
      title: 'Get event',
      description: 'Full detail for one event: proposed dates ranked by votes, who voted what, logistics.',
      inputSchema: { event: z.string().describe('Event title (partial ok) or id') },
    },
    async ({ event }) => {
      const me = currentFriend()
      const client = sb()
      const ev = await resolveEvent(client, event)
      const [users, { options, votes }, { data: attendance }] = await Promise.all([
        loadUsers(client),
        loadOptionsWithVotes(client, ev.id),
        client.from('attendance').select('user_id, status').eq('event_id', ev.id),
      ])
      const nameById = new Map(users.map((u) => [u.id, u.name]))

      const header: string[] = [`${ev.title} — status: ${ev.status}`]
      if (ev.description) header.push(ev.description)
      if (ev.created_by) header.push(`Created by ${ev.created_by}`)
      if (ev.confirmed_date) header.push(`Confirmed: ${ev.confirmed_date}${ev.confirmed_end_date ? ` → ${ev.confirmed_end_date}` : ''}`)
      if (ev.location_name) header.push(`Where: ${ev.location_name}`)
      if (ev.start_time) header.push(`Time: ${ev.start_time}${ev.end_time ? `–${ev.end_time}` : ''}`)

      const ranked = options
        .map((o) => {
          const optionVotes = votes.filter((v) => v.date_option_id === o.id)
          return {
            ...o,
            worksCount: optionVotes.filter((v) => v.response === 'works').length,
            preferredCount: optionVotes.filter((v) => v.preferred).length,
            optionVotes,
          }
        })
        .sort(compareRankedDateOptions)

      const optionLines = ranked.map((o) => {
        const span = o.end_date && o.end_date !== o.date ? `${o.date} → ${o.end_date}` : o.date
        const works = o.optionVotes.filter((v) => v.response === 'works').map((v) => `${nameById.get(v.user_id) ?? '?'}${v.preferred ? '★' : ''}`)
        const pass = o.optionVotes.filter((v) => v.response === 'pass').map((v) => nameById.get(v.user_id) ?? '?')
        const mine = o.optionVotes.find((v) => v.user_id === me.id)
        const myState = mine ? ` — your vote: ${mine.response}${mine.preferred ? ' ★' : ''}` : ' — you have not voted'
        return `- ${span}: ${o.worksCount} works (${works.join(', ') || 'none'})${pass.length ? `, pass: ${pass.join(', ')}` : ''}${myState}\n  option id: ${o.id}`
      })

      const attendanceRows = (attendance ?? []) as { user_id: string; status: string }[]
      const going = attendanceRows.filter((a) => a.status === 'going').map((a) => nameById.get(a.user_id) ?? '?')
      const notGoing = attendanceRows.filter((a) => a.status === 'not_going').map((a) => nameById.get(a.user_id) ?? '?')

      const parts = [header.join('\n')]
      parts.push(options.length === 0 ? 'No dates proposed yet — propose_dates adds some.' : `Proposed dates (ranked):\n${optionLines.join('\n')}`)
      if (going.length || notGoing.length) {
        parts.push(`Attendance — going: ${going.join(', ') || 'nobody yet'}${notGoing.length ? ` · not going: ${notGoing.join(', ')}` : ''}`)
      }
      parts.push(`event id: ${ev.id}`)
      return text(parts.join('\n\n'))
    },
  )

  server.registerTool(
    'create_event',
    {
      title: 'Create event',
      description: 'Create a new event, optionally proposing date options for voting right away.',
      inputSchema: {
        title: z.string().min(1).max(120),
        description: z.string().max(500).optional(),
        dates: z.array(z.object({
          date: isoDate,
          end_date: isoDate.optional().describe('For multi-day options like a weekend'),
        })).max(12).optional().describe('Date options friends will vote on'),
      },
    },
    async ({ title, description, dates }) => {
      const me = currentFriend()
      const client = sb()
      const { data: created, error } = await client
        .from('events')
        .insert({ title: title.trim(), description: description?.trim() || null, created_by: me.name })
        .select('id')
        .single()
      if (error) throw new Error(error.message)

      let dateNote = 'No date options yet.'
      if (dates && dates.length > 0) {
        const { error: optionError } = await client.from('date_options').insert(
          dates.map((d) => ({ event_id: created.id, date: d.date, end_date: d.end_date ?? null, created_by: me.name })),
        )
        if (optionError) throw new Error(`Event created (id ${created.id}) but adding dates failed: ${optionError.message}`)
        dateNote = `${dates.length} date option${dates.length === 1 ? '' : 's'} open for voting.`
      }
      return text(`Created "${title.trim()}" (id ${created.id}). ${dateNote}`)
    },
  )

  server.registerTool(
    'propose_dates',
    {
      title: 'Propose dates',
      description: 'Add date options to an existing event for friends to vote on.',
      inputSchema: {
        event: z.string().describe('Event title (partial ok) or id'),
        dates: z.array(z.object({
          date: isoDate,
          end_date: isoDate.optional(),
        })).min(1).max(12),
      },
    },
    async ({ event, dates }) => {
      const me = currentFriend()
      const client = sb()
      const ev = await resolveEvent(client, event)
      const { options } = await loadOptionsWithVotes(client, ev.id)
      const existing = new Set(options.map((o) => `${o.date}|${o.end_date ?? ''}`))
      const fresh = dates.filter((d) => !existing.has(`${d.date}|${d.end_date ?? ''}`))
      if (fresh.length === 0) return text('All of those dates are already proposed on this event.')
      const { error } = await client.from('date_options').insert(
        fresh.map((d) => ({ event_id: ev.id, date: d.date, end_date: d.end_date ?? null, created_by: me.name })),
      )
      if (error) throw new Error(error.message)
      return text(`Added ${fresh.length} date option${fresh.length === 1 ? '' : 's'} to "${ev.title}"${fresh.length < dates.length ? ` (${dates.length - fresh.length} already existed)` : ''}.`)
    },
  )

  server.registerTool(
    'vote',
    {
      title: 'Vote on a date',
      description: "Vote works/pass on an event's proposed date. Optionally star it as your one Best date for that event (moves your existing star).",
      inputSchema: {
        event: z.string().describe('Event title (partial ok) or id'),
        date: z.string().describe('The proposed date (YYYY-MM-DD) or the option id'),
        response: z.enum(['works', 'pass', 'clear']).describe('"clear" removes your vote'),
        best: z.boolean().optional().describe('Star this as your single Best date (only with works)'),
        time_preference: z.enum(['morning', 'afternoon', 'evening', 'flexible']).optional(),
      },
    },
    async ({ event, date, response, best, time_preference }) => {
      const me = currentFriend()
      const client = sb()
      const ev = await resolveEvent(client, event)
      const { options } = await loadOptionsWithVotes(client, ev.id)
      const option = options.find((o) => o.id === date) ?? options.find((o) => o.date === date)
      if (!option) {
        throw new Error(`"${ev.title}" has no proposed date ${date}. Options: ${options.map((o) => o.date).join(', ') || 'none'}`)
      }

      const { data: existing, error: existingError } = await client
        .from('votes')
        .select('id, preferred, time_preference')
        .eq('date_option_id', option.id)
        .eq('user_id', me.id)
        .maybeSingle()
      if (existingError) throw new Error(existingError.message)

      if (response === 'clear') {
        if (!existing) return text('You had no vote on that date anyway.')
        const { error } = await client.from('votes').delete().eq('id', existing.id)
        if (error) throw new Error(error.message)
        return text(`Cleared your vote on ${option.date} for "${ev.title}".`)
      }

      if (best && response === 'pass') throw new Error('A Best star only goes with a works vote.')

      // Starring is exclusive per event — demote any other starred vote first,
      // same as the app's togglePreferred.
      if (best) {
        const otherIds = options.filter((o) => o.id !== option.id).map((o) => o.id)
        if (otherIds.length > 0) {
          const { error } = await client
            .from('votes')
            .update({ preferred: false })
            .eq('user_id', me.id)
            .eq('preferred', true)
            .in('date_option_id', otherIds)
          if (error) throw new Error(error.message)
        }
      }

      // `points` is kept for backward compat with unmigrated readers — same as the app.
      const payload = {
        response,
        preferred: response === 'pass' ? false : (best ?? existing?.preferred ?? false),
        time_preference: response === 'pass' ? null : (time_preference ?? existing?.time_preference ?? null),
        points: response === 'works' ? 1 : 0,
      }
      if (existing) {
        const { error } = await client.from('votes').update(payload).eq('id', existing.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await client.from('votes').insert({ date_option_id: option.id, user_id: me.id, ...payload })
        if (error) throw new Error(error.message)
      }
      return text(`Recorded: ${option.date} ${response}${payload.preferred ? ' ★ Best' : ''}${payload.time_preference ? ` (${payload.time_preference})` : ''} on "${ev.title}" as ${me.name}.`)
    },
  )

  server.registerTool(
    'set_attendance',
    {
      title: 'Set attendance',
      description: 'Mark yourself going / not going to an event (the commitment, separate from date voting).',
      inputSchema: {
        event: z.string().describe('Event title (partial ok) or id'),
        status: z.enum(['going', 'not_going']),
      },
    },
    async ({ event, status }) => {
      const me = currentFriend()
      const client = sb()
      const ev = await resolveEvent(client, event)
      const { error } = await client.from('attendance').upsert(
        { event_id: ev.id, user_id: me.id, status, updated_at: new Date().toISOString() },
        { onConflict: 'event_id,user_id' },
      )
      if (error) throw new Error(error.message)
      return text(`${me.name} is ${status === 'going' ? 'going' : 'not going'} to "${ev.title}".`)
    },
  )

  /* ── Ideas ─────────────────────────────────────────────────────────── */

  server.registerTool(
    'list_ideas',
    {
      title: 'List ideas',
      description: 'The shared idea hub — things the group might do, with like counts.',
      inputSchema: {},
    },
    async () => {
      const { data, error } = await sb()
        .from('ideas')
        .select('title, description, submitted_by, likes, created_at')
        .order('likes', { ascending: false })
      if (error) throw new Error(error.message)
      const ideas = (data ?? []) as { title: string; description: string | null; submitted_by: string | null; likes: number }[]
      if (ideas.length === 0) return text('No ideas yet — add_idea starts the list.')
      const lines = ideas.map((i) => `- ${i.title}${i.likes ? ` (${i.likes} ❤)` : ''}${i.submitted_by ? ` — ${i.submitted_by}` : ''}${i.description ? `\n  ${i.description}` : ''}`)
      return text(lines.join('\n'))
    },
  )

  server.registerTool(
    'add_idea',
    {
      title: 'Add idea',
      description: 'Drop a new idea into the shared hub.',
      inputSchema: {
        title: z.string().min(1).max(120),
        description: z.string().max(500).optional(),
      },
    },
    async ({ title, description }) => {
      const me = currentFriend()
      const { error } = await sb()
        .from('ideas')
        .insert({ title: title.trim(), description: description?.trim() || null, submitted_by: me.name })
      if (error) throw new Error(error.message)
      return text(`Idea added: "${title.trim()}" (from ${me.name}).`)
    },
  )

  /* ── This Week ─────────────────────────────────────────────────────── */

  server.registerTool(
    'this_week',
    {
      title: 'This Week',
      description: 'The casual weekly plan: day-by-day works/pass tallies, who is in town, leading day, ideas.',
      inputSchema: {},
    },
    async () => {
      const data = await loadThisWeek()
      if (data.tablesMissing || data.plans.length === 0) return text('No weekly plan is open right now.')
      const sections = data.plans.map((plan) => {
        const lines = [`${plan.title} — week of ${plan.week_start_date} [${plan.status}${plan.confirmed_day ? `, confirmed ${plan.confirmed_day}` : ''}]`]
        for (const day of plan.ranked) {
          const avail = plan.availabilityByDay[day.day]
          const town = avail ? ` · ${avail.inTown}/${avail.total} in town${avail.outNames.length ? ` (out: ${avail.outNames.join(', ')})` : ''}` : ''
          lines.push(`  ${day.day}: ${day.worksCount} works, ${day.passCount} pass${day.bestCount ? `, ${day.bestCount}★` : ''}${town}`)
        }
        if (plan.leadingDay) lines.push(`  Leading day: ${plan.leadingDay.day}`)
        if (plan.ideas.length > 0) lines.push(`  Ideas: ${plan.ideas.map((i) => i.idea_text).join(' · ')}`)
        lines.push(`  plan id: ${plan.id}`)
        return lines.join('\n')
      })
      return text(sections.join('\n\n'))
    },
  )

  server.registerTool(
    'vote_this_week',
    {
      title: 'Vote on This Week',
      description: 'Mark a day of the current weekly plan works/pass for you, optionally starring it as your Best day.',
      inputSchema: {
        day: isoDate.describe('A day within the open weekly plan'),
        response: z.enum(['works', 'pass']),
        best: z.boolean().optional().describe('Star as your single Best day (implies works)'),
      },
    },
    async ({ day, response, best }) => {
      const me = currentFriend()
      const data = await loadThisWeek()
      const plan = data.plans.find((p) => p.status === 'open' && p.candidate_days.includes(day))
      if (!plan) throw new Error(`No open weekly plan includes ${day}. Check this_week first.`)
      const myVotes = plan.votes.filter((v) => v.user_id === me.id)
      const existing = myVotes.find((v) => v.day === day) ?? null

      if (best) {
        const { error } = await setWeeklyBest({ planId: plan.id, userId: me.id, day, myVotes })
        if (error) throw new Error(error)
        return text(`Starred ${day} as your Best day on "${plan.title}".`)
      }
      // castWeeklyVote toggles: re-sending the same value clears it. For the
      // connector we want plain "set" semantics, so skip the write when the
      // vote already says what was asked.
      if (existing && existing.availability === response) {
        return text(`${day} was already marked ${response} for you.`)
      }
      const { error } = await castWeeklyVote({ planId: plan.id, userId: me.id, day, availability: response, existing })
      if (error) throw new Error(error)
      return text(`Marked ${day} as ${response} for ${me.name} on "${plan.title}".`)
    },
  )
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
