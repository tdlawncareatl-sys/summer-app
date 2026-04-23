'use client'

// Events list — a simple directory of every event. The real action lives inside
// each event detail; this page is the index. Use the floating "+" FAB to create.

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useName } from '@/lib/useName'
import { ensureUser } from '@/lib/ensureUser'
import { categoryFor } from '@/lib/categories'
import { inferEventStatus } from '@/lib/status'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import StatusChip from '../components/StatusChip'
import IconTile from '../components/IconTile'
import { ChevronRightIcon, PlusIcon, XIcon } from '../components/icons'

type Event = {
  id: string
  title: string
  description: string | null
  status: string
  created_by: string | null
  created_at: string
  dateCount: number
  voteCount: number
  myConflictCount: number
}

export default function EventsPage() {
  const [name] = useName()
  const [events, setEvents] = useState<Event[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadEvents() }, [name]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadEvents() {
    setLoading(true)
    const { data } = await supabase
      .from('events')
      .select('id, title, description, status, created_by, created_at')
      .order('created_at', { ascending: false })

    if (!data) { setLoading(false); return }

    const [{ data: dateOptions }, { data: votes }] = await Promise.all([
      supabase.from('date_options').select('id, event_id, date'),
      supabase.from('votes').select('id, date_option_id'),
    ])

    const optionsByEvent: Record<string, { id: string; date: string }[]> = {}
    for (const opt of dateOptions ?? []) {
      ;(optionsByEvent[opt.event_id] ??= []).push({ id: opt.id, date: opt.date })
    }
    const votesByOption: Record<string, number> = {}
    for (const v of votes ?? []) {
      votesByOption[v.date_option_id] = (votesByOption[v.date_option_id] ?? 0) + 1
    }

    let myBlackouts: Set<string> = new Set()
    if (name) {
      const userId = await ensureUser(name)
      const { data: avail } = await supabase
        .from('availability')
        .select('date')
        .eq('user_id', userId)
      myBlackouts = new Set((avail ?? []).map((r) => r.date))
    }

    const enriched: Event[] = data.map((ev) => {
      const opts = optionsByEvent[ev.id] ?? []
      const totalVotes = opts.reduce((sum, o) => sum + (votesByOption[o.id] ?? 0), 0)
      const myConflictCount = name ? opts.filter((o) => myBlackouts.has(o.date)).length : 0
      return { ...ev, dateCount: opts.length, voteCount: totalVotes, myConflictCount }
    })

    setEvents(enriched)
    setLoading(false)
  }

  async function createEvent() {
    if (!title.trim() || !name) return
    setSubmitting(true)
    await supabase
      .from('events')
      .insert({ title: title.trim(), description: description.trim() || null, created_by: name })
    setTitle('')
    setDescription('')
    setShowForm(false)
    setSubmitting(false)
    await loadEvents()
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
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center gap-3 text-left"
            >
              <span className="w-10 h-10 rounded-xl bg-terracotta-tint text-terracotta flex items-center justify-center shrink-0">
                <PlusIcon size={18} />
              </span>
              <span className="flex-1">
                <span className="block font-semibold text-ink">Start a new event</span>
                <span className="block text-xs text-ink-soft mt-0.5">Propose dates, let the group vote</span>
              </span>
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <p className="text-xs font-bold text-ink-mute uppercase tracking-wider">New event</p>
                <button
                  onClick={() => { setShowForm(false); setTitle(''); setDescription('') }}
                  className="text-ink-faint hover:text-ink-soft transition-colors"
                  aria-label="Cancel"
                >
                  <XIcon size={16} />
                </button>
              </div>
              <input
                type="text"
                placeholder="Event name (e.g. Lake weekend)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                className="w-full bg-sand border-0 rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive transition"
              />
              <textarea
                placeholder="Details (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-sand border-0 rounded-xl px-3 py-2.5 text-sm text-ink resize-none focus:outline-none focus:ring-2 focus:ring-olive transition"
              />
              <button
                onClick={createEvent}
                disabled={!title.trim() || submitting}
                className="w-full bg-olive text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                {submitting ? 'Creating…' : 'Create event'}
              </button>
            </div>
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

      {/* Events list */}
      <div className="flex flex-col gap-2.5">
        {events.map((ev) => {
          const cat = categoryFor(ev.title)
          const status = inferEventStatus({
            status: ev.status,
            hasDateOptions: ev.dateCount > 0,
            voteCount: ev.voteCount,
            createdByCurrentUser: !!name && ev.created_by === name,
          })
          return (
            <Link key={ev.id} href={`/events/${ev.id}`}>
              <Card className="flex items-center gap-3">
                <IconTile Icon={cat.Icon} tint={cat.tint} size={48} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <StatusChip status={status} size="xs" />
                  </div>
                  <p className="font-semibold text-ink truncate">{ev.title}</p>
                  <p className="text-xs text-ink-soft mt-0.5 truncate">
                    {ev.dateCount > 0
                      ? `${ev.dateCount} option${ev.dateCount !== 1 ? 's' : ''} · ${ev.voteCount} vote${ev.voteCount !== 1 ? 's' : ''}`
                      : 'No dates proposed yet'}
                  </p>
                  {ev.myConflictCount > 0 && (
                    <p className="text-xs font-semibold text-amber mt-1">
                      You&apos;re blocked on {ev.myConflictCount} of these
                    </p>
                  )}
                </div>
                <ChevronRightIcon size={18} className="text-ink-faint" />
              </Card>
            </Link>
          )
        })}
      </div>
    </main>
  )
}
