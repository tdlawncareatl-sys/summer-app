'use client'

// Events list — a simple directory of every event. The real action lives inside
// each event detail; this page is the index. Use the floating "+" FAB to create.

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useName } from '@/lib/useName'
import { categoryFor } from '@/lib/categories'
import { compactEventDetails, eventDraftFromRecord, eventPayloadFromDraft, hasEventLogistics, type EventDetailsDraft } from '@/lib/eventDetails'
import { loadPlanData, type EnrichedEvent } from '@/lib/planData'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import StatusChip from '../components/StatusChip'
import IconTile from '../components/IconTile'
import EventLocationFields from '../components/EventLocationFields'
import Icon from '../components/Icon'
import { eachDay } from '@/lib/date'

export default function EventsPage() {
  const [name] = useName()
  const [events, setEvents] = useState<EnrichedEvent[]>([])
  const [myBlackouts, setMyBlackouts] = useState<Set<string>>(new Set())
  const [form, setForm] = useState<EventDetailsDraft>(() => eventDraftFromRecord())
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [showPast, setShowPast] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [name]) // eslint-disable-line react-hooks/exhaustive-deps

  // One enrichment path now — the shared loader that Home/Calendar/Me use too.
  async function load() {
    setLoading(true)
    const data = await loadPlanData(name || null)
    setEvents(data.events)
    setMyBlackouts(
      new Set(data.availability.filter((row) => row.user_id === data.me.userId).map((row) => row.date)),
    )
    setLoading(false)
  }

  // Live events float votable ones to the top; completed events collapse away.
  const liveEvents = [...events]
    .filter((ev) => !ev.isPast)
    .sort((a, b) => Number(b.needsMyVote) - Number(a.needsMyVote))
  const pastEvents = events.filter((ev) => ev.isPast)

  async function createEvent() {
    if (!form.title.trim() || !name) return
    setSubmitting(true)
    setFormError(null)

    const payload = eventPayloadFromDraft(form)
    const includeExtendedDetails = hasEventLogistics(payload)
    const insertPayload = includeExtendedDetails
      ? { ...payload, created_by: name }
      : { title: payload.title, description: payload.description, created_by: name }

    const { error } = await supabase
      .from('events')
      .insert(insertPayload)

    if (error) {
      setFormError(eventSaveError(error.message))
      setSubmitting(false)
      return
    }

    setForm(eventDraftFromRecord())
    setShowDetails(false)
    setShowForm(false)
    setSubmitting(false)
    await load()
  }

  function updateForm<K extends keyof EventDetailsDraft>(key: K, value: EventDetailsDraft[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <main className="max-w-md mx-auto px-5">
      <PageHeader
        variant="title"
        title="Events"
        subtitle="Every plan the group is cooking up."
      />

      {name && (
        <Card className="mb-5">
          {!showForm ? (
            <button type="button"
              onClick={() => setShowForm(true)}
              className="w-full flex items-center gap-3 text-left"
            >
              <span className="w-10 h-10 rounded-xl bg-terracotta-tint text-terracotta flex items-center justify-center shrink-0">
                <Icon name="plus" size={18} />
              </span>
              <span className="flex-1">
                <span className="block font-semibold text-ink">Start a new event</span>
                <span className="block text-xs text-ink-soft mt-0.5">Propose dates, add a place, and give people the details.</span>
              </span>
            </button>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                void createEvent()
              }}
            >
              <div className="flex items-start justify-between">
                <p className="text-xs font-bold text-ink-mute uppercase tracking-wider">New event</p>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setShowDetails(false)
                    setForm(eventDraftFromRecord())
                    setFormError(null)
                  }}
                  className="text-ink-faint hover:text-ink-soft transition-colors"
                  aria-label="Cancel"
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
              <input
                type="text"
                placeholder="Event name (e.g. Lake weekend)"
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
                autoFocus
                className="w-full bg-sand border-0 rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive transition"
              />
              <textarea
                placeholder="Short summary (optional)"
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
                rows={2}
                className="w-full bg-sand border-0 rounded-xl px-3 py-2.5 text-sm text-ink resize-none focus:outline-none focus:ring-2 focus:ring-olive transition"
              />
              <button
                type="button"
                onClick={() => setShowDetails((current) => !current)}
                className="inline-flex items-center justify-center rounded-xl bg-sand px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-sand-alt"
              >
                {showDetails ? 'Hide details' : 'Add details'}
              </button>
              {showDetails ? (
                <div className="grid gap-3 rounded-[18px] border border-sand-alt bg-cream px-3 py-3">
                  <EventLocationFields
                    idPrefix="new-event"
                    locationName={form.location_name}
                    locationAddress={form.location_address}
                    onLocationNameChange={(value) => updateForm('location_name', value)}
                    onLocationAddressChange={(value) => updateForm('location_address', value)}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="time"
                      value={form.start_time}
                      onChange={(e) => updateForm('start_time', e.target.value)}
                      className="w-full rounded-xl bg-sand px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive"
                    />
                    <input
                      type="time"
                      value={form.end_time}
                      onChange={(e) => updateForm('end_time', e.target.value)}
                      className="w-full rounded-xl bg-sand px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive"
                    />
                  </div>
                  <textarea
                    placeholder="Group notes: what to bring, cost, timing, etc."
                    value={form.event_notes}
                    onChange={(e) => updateForm('event_notes', e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-xl bg-sand px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive"
                  />
                  <textarea
                    placeholder="Parking / gate / meetup notes"
                    value={form.location_notes}
                    onChange={(e) => updateForm('location_notes', e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-xl bg-sand px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive"
                  />
                </div>
              ) : null}
              {formError ? (
                <p className="text-sm font-medium text-blush">{formError}</p>
              ) : null}
              <button
                disabled={!form.title.trim() || submitting}
                type="submit"
                className="w-full bg-olive text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                {submitting ? 'Creating…' : 'Create event'}
              </button>
            </form>
          )}
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col gap-3 animate-pulse">
          <div className="h-20 bg-cream rounded-[var(--radius-lg)]" />
          <div className="h-20 bg-cream rounded-[var(--radius-lg)]" />
          <div className="h-20 bg-cream rounded-[var(--radius-lg)]" />
        </div>
      )}

      {/* Empty */}
      {!loading && events.length === 0 && (
        <Card className="text-center py-10">
          <p className="font-semibold text-ink">No events yet</p>
          <p className="text-sm text-ink-soft mt-1">Propose one to get planning started.</p>
        </Card>
      )}

      {/* Live events — votable ones first */}
      <div className="flex flex-col gap-2.5">
        {liveEvents.map((ev) => (
          <EventRow key={ev.id} event={ev} conflicts={conflictCount(ev, myBlackouts)} />
        ))}
      </div>

      {/* Past plans — collapsed so completed stuff stops crowding the list */}
      {pastEvents.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            className="flex w-full items-center justify-between rounded-[var(--radius-lg)] border border-stone/70 bg-cream px-4 py-3 text-sm font-semibold text-ink-soft"
          >
            <span>Past plans · {pastEvents.length}</span>
            <Icon name="chevronDown" size={16} className={showPast ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
          {showPast && (
            <div className="mt-2.5 flex flex-col gap-2.5">
              {pastEvents.map((ev) => (
                <EventRow key={ev.id} event={ev} conflicts={0} muted />
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  )
}

function EventRow({ event, conflicts, muted = false }: { event: EnrichedEvent; conflicts: number; muted?: boolean }) {
  const cat = categoryFor(event.title)
  const details = compactEventDetails(event)
  const dateCount = event.dateOptions.length
  const countsLine = dateCount > 0
    ? `${dateCount} option${dateCount !== 1 ? 's' : ''} · ${event.voteCount} vote${event.voteCount !== 1 ? 's' : ''}`
    : 'No dates proposed yet'
  return (
    <Link href={`/events/${event.id}`}>
      <Card className={`flex items-center gap-3 ${muted ? 'opacity-70' : ''}`}>
        <IconTile name={cat.iconName} tint={cat.tint} size={48} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <StatusChip status={event.displayStatus} size="xs" />
          </div>
          <p className="font-semibold text-ink truncate">{event.title}</p>
          <p className="text-xs text-ink-soft mt-0.5 truncate">{details ?? countsLine}</p>
          {details ? <p className="text-[11px] text-ink-mute mt-1 truncate">{countsLine}</p> : null}
          {!muted && conflicts > 0 && (
            <p className="text-xs font-semibold text-amber mt-1">You&apos;re blocked on {conflicts} of these</p>
          )}
        </div>
        <Icon name="chevronRight" size={18} className="text-ink-faint" />
      </Card>
    </Link>
  )
}

// An option conflicts if ANY day in its range overlaps one of my blackout dates.
function conflictCount(event: EnrichedEvent, blackouts: Set<string>): number {
  if (blackouts.size === 0) return 0
  return event.dateOptions.filter((o) => eachDay(o.date, o.end_date ?? null).some((d) => blackouts.has(d))).length
}

function eventSaveError(message: string) {
  const lower = message.toLowerCase()
  if (lower.includes('location_') || lower.includes('event_notes') || lower.includes('start_time') || lower.includes('end_time')) {
    return 'This app still needs the latest event-details SQL migration before location, notes, and time fields can be saved.'
  }
  return message
}
