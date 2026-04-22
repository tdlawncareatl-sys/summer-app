'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useName } from '@/lib/useName'

const FRIENDS = [
  'Tad', 'Grace', 'Liam', 'Mcguire', 'Carter', 'Storm',
  'Megan', 'Margaret', 'Mary Hannah', 'Jonah', 'Katie', 'Eston & Irelynn',
]

type Event = {
  id: string
  title: string
  description: string | null
  status: string
  created_by: string | null
  created_at: string
  dateCount?: number
  voteCount?: number
}

export default function EventsPage() {
  const [name, setName] = useName()
  const [events, setEvents] = useState<Event[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadEvents() }, [])

  async function loadEvents() {
    setLoading(true)
    const { data, error } = await supabase
      .from('events')
      .select('id, title, description, status, created_by, created_at')
      .order('created_at', { ascending: false })
    if (error) console.error('loadEvents:', error)

    if (!data) { setLoading(false); return }

    // Fetch date option and vote counts
    const { data: dateOptions } = await supabase
      .from('date_options')
      .select('id, event_id')

    const { data: votes } = await supabase
      .from('votes')
      .select('id, date_option_id')

    const optionsByEvent: Record<string, string[]> = {}
    for (const opt of dateOptions ?? []) {
      if (!optionsByEvent[opt.event_id]) optionsByEvent[opt.event_id] = []
      optionsByEvent[opt.event_id].push(opt.id)
    }

    const votesByOption: Record<string, number> = {}
    for (const v of votes ?? []) {
      votesByOption[v.date_option_id] = (votesByOption[v.date_option_id] ?? 0) + 1
    }

    const enriched: Event[] = data.map((ev) => {
      const optIds = optionsByEvent[ev.id] ?? []
      const totalVotes = optIds.reduce((sum, oid) => sum + (votesByOption[oid] ?? 0), 0)
      return { ...ev, dateCount: optIds.length, voteCount: totalVotes }
    })

    setEvents(enriched)
    setLoading(false)
  }

  async function createEvent() {
    if (!title.trim() || !name) return
    setSubmitting(true)
    const { error } = await supabase
      .from('events')
      .insert({ title: title.trim(), description: description.trim() || null, created_by: name })
    if (error) { console.error('createEvent:', error); setSubmitting(false); return }
    setTitle('')
    setDescription('')
    setShowForm(false)
    setSubmitting(false)
    await loadEvents()
  }

  const statusConfig: Record<string, { label: string; classes: string }> = {
    planning: { label: 'Planning', classes: 'bg-amber-100 text-amber-700' },
    confirmed: { label: 'Confirmed', classes: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelled', classes: 'bg-red-100 text-red-500' },
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-10">
      <div className="max-w-md mx-auto px-5">
        <div className="pt-5 pb-1">
          <a href="/" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Back</a>
        </div>

        <div className="flex items-center justify-between mt-4 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">Event Voting</h1>
          {name && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-purple-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-purple-700 active:scale-95 transition-all shadow-sm"
            >
              + New
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-5">Vote on dates for upcoming events.</p>

        {/* Name picker */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Who are you?</p>
          <div className="flex flex-wrap gap-2">
            {FRIENDS.map((f) => (
              <button
                key={f}
                onClick={() => setName(f)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  name === f
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-600'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Create form */}
        {showForm && name && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">New Event</p>
            <input
              type="text"
              placeholder="Event name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
            />
            <textarea
              placeholder="Details (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none transition"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-200 text-gray-500 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={createEvent}
                disabled={!title.trim() || submitting}
                className="flex-1 bg-purple-600 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40 hover:bg-purple-700 active:scale-95 transition-all"
              >
                {submitting ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {/* Events list */}
        {loading && (
          <div className="text-center py-12 text-gray-300 text-sm">Loading...</div>
        )}

        {!loading && events.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🗳️</div>
            <p className="text-gray-500 font-medium">No events yet</p>
            <p className="text-gray-400 text-sm mt-1">Create one to start planning!</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {events.map((event) => {
            const cfg = statusConfig[event.status] ?? { label: event.status, classes: 'bg-gray-100 text-gray-500' }
            return (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-purple-200 hover:shadow-md transition-all active:scale-[0.98]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900 truncate">{event.title}</p>
                    {event.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{event.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      {(event.dateCount ?? 0) > 0 ? (
                        <>
                          <span className="text-xs text-gray-400">
                            {event.dateCount} date{event.dateCount !== 1 ? 's' : ''}
                          </span>
                          <span className="text-gray-200">·</span>
                          <span className="text-xs text-gray-400">
                            {event.voteCount} vote{event.voteCount !== 1 ? 's' : ''}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-300">No dates proposed yet</span>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize shrink-0 ${cfg.classes}`}>
                    {cfg.label}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </main>
  )
}
