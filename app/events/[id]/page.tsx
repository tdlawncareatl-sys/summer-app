'use client'

import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'
import { ensureUser } from '@/lib/ensureUser'
import { useName } from '@/lib/useName'

const FRIENDS = [
  'Tad', 'Grace', 'Liam', 'Mcguire', 'Carter', 'Storm',
  'Megan', 'Margaret', 'Mary Hannah', 'Jonah', 'Katie', 'Eston & Irelynn',
]

const RESPONSE_OPTIONS = [
  { label: 'Best', value: 'best', points: 3, light: 'bg-green-100 text-green-700 border-green-300' },
  { label: 'Works', value: 'works', points: 1, light: 'bg-amber-100 text-amber-700 border-amber-300' },
  { label: 'No', value: 'no', points: 0, light: 'bg-red-100 text-red-600 border-red-300' },
]

type DateOption = {
  id: string
  date: string
  votes: { response: string; points: number; user_name: string }[]
  totalPoints: number
}

type Event = {
  id: string
  title: string
  description: string | null
  status: string
  created_by: string | null
}

function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [name, setName] = useName()
  const [event, setEvent] = useState<Event | null>(null)
  const [dateOptions, setDateOptions] = useState<DateOption[]>([])
  const [newDate, setNewDate] = useState('')
  const [addingDate, setAddingDate] = useState(false)
  const [voting, setVoting] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => { loadEvent() }, [id])

  async function loadEvent() {
    const { data: ev, error } = await supabase
      .from('events')
      .select('id, title, description, status, created_by')
      .eq('id', id)
      .single()
    if (error) console.error('loadEvent:', error)
    if (ev) setEvent(ev)

    const { data: options } = await supabase
      .from('date_options')
      .select('id, date')
      .eq('event_id', id)
      .order('date', { ascending: true })
    if (!options || options.length === 0) { setDateOptions([]); return }

    const { data: votes } = await supabase
      .from('votes')
      .select('date_option_id, response, points, user_id')
      .in('date_option_id', options.map((o) => o.id))

    const { data: users } = await supabase.from('users').select('id, name')
    const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u.name]))

    const enriched: DateOption[] = options.map((opt) => {
      const optVotes = (votes ?? [])
        .filter((v) => v.date_option_id === opt.id)
        .map((v) => ({ response: v.response, points: v.points, user_name: userMap[v.user_id] ?? '?' }))
      return { ...opt, votes: optVotes, totalPoints: optVotes.reduce((sum, v) => sum + v.points, 0) }
    })

    setDateOptions(enriched.sort((a, b) => b.totalPoints - a.totalPoints))
  }

  async function addDateOption() {
    if (!newDate || !name) return
    setAddingDate(true)
    await ensureUser(name)
    const { error } = await supabase
      .from('date_options')
      .insert({ event_id: id, date: newDate, created_by: name })
    if (error) console.error('addDate:', error)
    setNewDate('')
    setAddingDate(false)
    await loadEvent()
  }

  async function vote(dateOptionId: string, response: string, points: number) {
    if (!name || voting) return
    setVoting(dateOptionId)
    const userId = await ensureUser(name)

    const { data: existing } = await supabase
      .from('votes')
      .select('id, response')
      .eq('date_option_id', dateOptionId)
      .eq('user_id', userId)
      .single()

    if (existing) {
      if (existing.response === response) {
        await supabase.from('votes').delete().eq('id', existing.id)
      } else {
        await supabase.from('votes').update({ response, points }).eq('id', existing.id)
      }
    } else {
      const { error } = await supabase
        .from('votes')
        .insert({ date_option_id: dateOptionId, user_id: userId, response, points })
      if (error) console.error('vote:', error)
    }

    setVoting(null)
    await loadEvent()
  }

  async function confirmEvent() {
    if (!event || confirming) return
    setConfirming(true)
    await supabase.from('events').update({ status: 'confirmed' }).eq('id', event.id)
    setEvent({ ...event, status: 'confirmed' })
    setConfirming(false)
  }

  function myVote(option: DateOption) {
    return option.votes.find((v) => v.user_name === name)?.response ?? null
  }

  // Show confirm button if: not already confirmed, there are votes, and top option is clearly leading
  const topOption = dateOptions[0]
  const secondOption = dateOptions[1]
  const hasVotes = (topOption?.votes.length ?? 0) > 0
  const isLeading =
    hasVotes &&
    (!secondOption || topOption.totalPoints > secondOption.totalPoints)
  const showConfirm = event?.status !== 'confirmed' && isLeading

  if (!event) return (
    <main className="min-h-screen bg-gray-50 p-5 max-w-md mx-auto">
      <p className="text-sm text-gray-400 pt-10 text-center">Loading...</p>
    </main>
  )

  const statusConfig: Record<string, { label: string; classes: string }> = {
    planning: { label: 'Planning', classes: 'bg-amber-100 text-amber-700' },
    confirmed: { label: 'Confirmed', classes: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelled', classes: 'bg-red-100 text-red-500' },
  }
  const statusCfg = statusConfig[event.status] ?? { label: event.status, classes: 'bg-gray-100 text-gray-500' }

  return (
    <main className="min-h-screen bg-gray-50 pb-10">
      <div className="max-w-md mx-auto px-5">
        <div className="pt-5 pb-1">
          <a href="/events" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Events</a>
        </div>

        {/* Event header */}
        <div className="mt-4 mb-5">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">{event.title}</h1>
              {event.description && (
                <p className="text-sm text-gray-500 mt-1">{event.description}</p>
              )}
              <p className="text-xs text-gray-300 mt-1.5">Created by {event.created_by}</p>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 mt-1 ${statusCfg.classes}`}>
              {statusCfg.label}
            </span>
          </div>

          {/* Confirm button */}
          {showConfirm && (
            <button
              onClick={confirmEvent}
              disabled={confirming}
              className="mt-4 w-full bg-green-600 text-white font-bold py-3 rounded-2xl text-sm hover:bg-green-700 active:scale-[0.98] disabled:opacity-50 transition-all shadow-sm"
            >
              {confirming ? 'Confirming...' : `Mark as Confirmed — ${formatDate(topOption.date)}`}
            </button>
          )}
        </div>

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

        {/* Voting key */}
        <div className="flex gap-2 mb-4">
          {RESPONSE_OPTIONS.map((r) => (
            <div
              key={r.value}
              className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border ${r.light}`}
            >
              {r.label}
              <span className="opacity-60">= {r.points}pt{r.points !== 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>

        {/* Date options */}
        <div className="flex flex-col gap-3 mb-5">
          {dateOptions.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">No dates proposed yet.</p>
              <p className="text-gray-300 text-xs mt-1">Add one below to get voting started.</p>
            </div>
          )}
          {dateOptions.map((option, i) => {
            const my = myVote(option)
            const isTop = i === 0 && option.totalPoints > 0
            return (
              <div
                key={option.id}
                className={`bg-white rounded-2xl border shadow-sm p-4 transition-all ${
                  isTop ? 'border-green-200 shadow-green-50' : 'border-gray-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    {isTop && (
                      <span className="text-xs font-bold text-green-600 block mb-0.5">Leading</span>
                    )}
                    <p className="font-bold text-gray-900">{formatDate(option.date)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {option.totalPoints} pts · {option.votes.length} vote{option.votes.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {name && (
                    <div className="flex gap-1.5 shrink-0">
                      {RESPONSE_OPTIONS.map((r) => (
                        <button
                          key={r.value}
                          onClick={() => vote(option.id, r.value, r.points)}
                          disabled={voting === option.id}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                            my === r.value
                              ? `${r.light} scale-105`
                              : 'bg-gray-50 text-gray-400 border-gray-100 hover:border-gray-300'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {option.votes.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2 border-t border-gray-50">
                    {option.votes.map((v) => {
                      const ro = RESPONSE_OPTIONS.find((r) => r.value === v.response)
                      return (
                        <span
                          key={v.user_name}
                          className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ro?.light ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}
                        >
                          {v.user_name}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Add date */}
        {name && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Propose a date</p>
            <div className="flex gap-2">
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
              />
              <button
                onClick={addDateOption}
                disabled={!newDate || addingDate}
                className="bg-purple-600 text-white rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-40 hover:bg-purple-700 active:scale-95 transition-all"
              >
                {addingDate ? '...' : 'Add'}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
