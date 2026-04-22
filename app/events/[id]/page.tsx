'use client'

import { useState, useEffect, use, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { ensureUser } from '@/lib/ensureUser'
import { useName } from '@/lib/useName'

const TOTAL_FRIENDS = 12

const RESPONSE_OPTIONS = [
  { label: 'Best', value: 'best', points: 3, light: 'bg-green-100 text-green-700 border-green-300' },
  { label: 'Works', value: 'works', points: 1, light: 'bg-amber-100 text-amber-700 border-amber-300' },
  { label: 'No', value: 'no', points: 0, light: 'bg-red-100 text-red-600 border-red-300' },
]

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa']

type DateOption = {
  id: string
  date: string
  end_date?: string | null
  votes: { response: string; points: number; user_name: string }[]
  totalPoints: number
  blockedCount: number
  blockedNames: string[]
  conflictScore: number
}

type Event = {
  id: string
  title: string
  description: string | null
  status: string
  created_by: string | null
}

type GroupBlackouts = Record<string, string[]>

type BestDate = {
  date: string
  availableCount: number
  blockedCount: number
}

// Generate all ISO dates between a and b (inclusive), handles either order
function getRange(a: string, b: string): string[] {
  const start = new Date(a + 'T12:00:00')
  const end = new Date(b + 'T12:00:00')
  const [s, e] = start <= end ? [start, end] : [end, start]
  const days: string[] = []
  const cur = new Date(s)
  while (cur <= e) {
    days.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

// All days covered by a date option (single day if no end_date)
function getDaysInRange(start: string, end?: string | null): string[] {
  if (!end || end === start) return [start]
  return getRange(start, end)
}

function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', opts ?? { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatDateRange(start: string, end?: string | null): string {
  if (!end || end === start) return formatDate(start)
  const count = getDaysInRange(start, end).length
  return `${formatDate(start, { month: 'short', day: 'numeric' })} – ${formatDate(end, { month: 'short', day: 'numeric' })} (${count} days)`
}

function conflictScore(totalPoints: number, blockedCount: number): number {
  return totalPoints - blockedCount * 2
}

function conflictColor(blockedCount: number): { bg: string; text: string; label: string } {
  const ratio = blockedCount / TOTAL_FRIENDS
  if (blockedCount === 0) return { bg: 'bg-green-100', text: 'text-green-700', label: 'No conflicts' }
  if (ratio < 0.25) return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: `${blockedCount} blocked` }
  if (ratio < 0.5) return { bg: 'bg-amber-200', text: 'text-amber-800', label: `${blockedCount} blocked` }
  return { bg: 'bg-red-100', text: 'text-red-700', label: `${blockedCount} blocked` }
}

function calendarCellColor(blockedCount: number): string {
  if (blockedCount === 0) return 'bg-white text-gray-800 hover:bg-gray-50'
  const ratio = blockedCount / TOTAL_FRIENDS
  if (ratio < 0.25) return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
  if (ratio < 0.5) return 'bg-yellow-300 text-yellow-900 hover:bg-yellow-400'
  return 'bg-red-400 text-white hover:bg-red-500'
}

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [name] = useName()
  const [event, setEvent] = useState<Event | null>(null)
  const [dateOptions, setDateOptions] = useState<DateOption[]>([])
  const [groupBlackouts, setGroupBlackouts] = useState<GroupBlackouts>({})
  const [bestDates, setBestDates] = useState<BestDate[]>([])
  const [addingDate, setAddingDate] = useState(false)
  const [voting, setVoting] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  // Range selection state
  const [selectedRange, setSelectedRange] = useState<{ start: string; end: string } | null>(null)
  const [calPreview, setCalPreview] = useState<Set<string>>(new Set())
  const calDrag = useRef<string | null>(null)

  const today = new Date()
  const todayISO = today.toISOString().split('T')[0]
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    const [
      { data: ev },
      { data: options },
      { data: votes },
      { data: users },
      { data: avail },
    ] = await Promise.all([
      supabase.from('events').select('id, title, description, status, created_by').eq('id', id).single(),
      supabase.from('date_options').select('id, date, end_date').eq('event_id', id).order('date', { ascending: true }),
      supabase.from('votes').select('date_option_id, response, points, user_id'),
      supabase.from('users').select('id, name'),
      supabase.from('availability').select('user_id, date'),
    ])

    if (ev) setEvent(ev)

    const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u.name]))

    const blackoutsMap: GroupBlackouts = {}
    for (const row of avail ?? []) {
      const friendName = userMap[row.user_id]
      if (!friendName) continue
      if (!blackoutsMap[row.date]) blackoutsMap[row.date] = []
      blackoutsMap[row.date].push(friendName)
    }
    setGroupBlackouts(blackoutsMap)

    // Best single days in the next 90 days (fewest conflicts)
    const ninetyDays: BestDate[] = []
    for (let i = 1; i <= 90; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      const iso = d.toISOString().split('T')[0]
      const blocked = blackoutsMap[iso]?.length ?? 0
      ninetyDays.push({ date: iso, blockedCount: blocked, availableCount: TOTAL_FRIENDS - blocked })
    }
    ninetyDays.sort((a, b) => a.blockedCount - b.blockedCount || a.date.localeCompare(b.date))
    setBestDates(ninetyDays.slice(0, 5))

    if (!options || options.length === 0) { setDateOptions([]); return }

    const optionIds = new Set(options.map((o) => o.id))
    const relevantVotes = (votes ?? []).filter((v) => optionIds.has(v.date_option_id))

    const enriched: DateOption[] = options.map((opt) => {
      const optVotes = relevantVotes
        .filter((v) => v.date_option_id === opt.id)
        .map((v) => ({ response: v.response, points: v.points, user_name: userMap[v.user_id] ?? '?' }))
      const totalPoints = optVotes.reduce((sum, v) => sum + v.points, 0)

      // Conflict check spans every day in the range
      const optDays = getDaysInRange(opt.date, opt.end_date)
      const blockedNamesSet = new Set<string>()
      optDays.forEach((day) => {
        ;(blackoutsMap[day] ?? []).forEach((n) => blockedNamesSet.add(n))
      })
      const blockedNames = [...blockedNamesSet]
      const blockedCount = blockedNames.length

      return {
        ...opt,
        votes: optVotes,
        totalPoints,
        blockedCount,
        blockedNames,
        conflictScore: conflictScore(totalPoints, blockedCount),
      }
    })

    setDateOptions(enriched.sort((a, b) => {
      if (b.conflictScore !== a.conflictScore) return b.conflictScore - a.conflictScore
      return a.blockedCount - b.blockedCount
    }))
  }

  async function addDateOption() {
    if (!selectedRange || !name) return
    setAddingDate(true)
    await ensureUser(name)
    const payload: Record<string, string> = {
      event_id: id,
      date: selectedRange.start,
      created_by: name,
    }
    if (selectedRange.end !== selectedRange.start) {
      payload.end_date = selectedRange.end
    }
    const { error } = await supabase.from('date_options').insert(payload)
    if (error) console.error('addDate:', error)
    setSelectedRange(null)
    setAddingDate(false)
    await loadAll()
  }

  async function vote(dateOptionId: string, response: string, points: number) {
    if (!name || voting) return
    setVoting(dateOptionId)
    const userId = await ensureUser(name)

    // "Best" is exclusive — clear it from every other option first
    if (response === 'best') {
      const otherIds = dateOptions.filter((o) => o.id !== dateOptionId).map((o) => o.id)
      if (otherIds.length > 0) {
        const { data: prevBest } = await supabase
          .from('votes')
          .select('id')
          .eq('user_id', userId)
          .eq('response', 'best')
          .in('date_option_id', otherIds)
        if (prevBest && prevBest.length > 0) {
          await supabase.from('votes').delete().in('id', prevBest.map((v) => v.id))
        }
      }
    }

    const { data: existing } = await supabase
      .from('votes')
      .select('id, response')
      .eq('date_option_id', dateOptionId)
      .eq('user_id', userId)
      .single()

    if (existing) {
      if (existing.response === response) {
        // Clicking same response again removes it
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
    await loadAll()
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

  // ── Calendar drag handlers ──────────────────────────────────────────────────
  function calStartDrag(iso: string) {
    if (iso < todayISO) return
    calDrag.current = iso
    setCalPreview(new Set([iso]))
    setSelectedRange(null)
  }

  function calMoveDrag(iso: string) {
    if (!calDrag.current || iso < todayISO) return
    setCalPreview(new Set(getRange(calDrag.current, iso)))
  }

  function calCommitDrag() {
    if (!calDrag.current || calPreview.size === 0) {
      calDrag.current = null
      setCalPreview(new Set())
      return
    }
    const days = [...calPreview].sort()
    setSelectedRange({ start: days[0], end: days[days.length - 1] })
    calDrag.current = null
    setCalPreview(new Set())
  }

  function isoFromTouch(touch: React.Touch): string | null {
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    return el?.getAttribute('data-iso') ?? null
  }

  function prevCalMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1) }
    else setCalMonth((m) => m - 1)
  }
  function nextCalMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1) }
    else setCalMonth((m) => m + 1)
  }

  const firstDay = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const calCells: (string | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      return `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }),
  ]
  while (calCells.length % 7 !== 0) calCells.push(null)

  const topOption = dateOptions[0]
  const secondOption = dateOptions[1]
  const hasVotes = (topOption?.votes.length ?? 0) > 0
  const isLeading = hasVotes && (!secondOption || topOption.conflictScore > secondOption.conflictScore)
  const showConfirm = event?.status !== 'confirmed' && isLeading

  // The option where the current user has voted "Best" (only one allowed)
  const myBestOptionId = dateOptions.find((o) => myVote(o) === 'best')?.id ?? null

  // Conflict count across all days in selected range
  const selectedConflicts = selectedRange
    ? (() => {
        const days = getDaysInRange(selectedRange.start, selectedRange.end)
        const names = new Set<string>()
        days.forEach((d) => (groupBlackouts[d] ?? []).forEach((n) => names.add(n)))
        return names.size
      })()
    : 0

  if (!event) return (
    <main className="min-h-screen bg-gray-50 pb-10">
      <div className="max-w-md mx-auto px-5 animate-pulse">
        {/* Back link */}
        <div className="pt-5 pb-1">
          <div className="h-4 w-16 bg-gray-200 rounded-full" />
        </div>

        {/* Event header skeleton */}
        <div className="mt-4 mb-5">
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-2.5">
              <div className="h-7 bg-gray-200 rounded-xl w-3/4" />
              <div className="h-4 bg-gray-100 rounded-lg w-full" />
              <div className="h-3 bg-gray-100 rounded-lg w-1/3" />
            </div>
            <div className="h-6 w-20 bg-gray-200 rounded-full shrink-0 mt-1" />
          </div>
        </div>

        {/* Voting key skeleton */}
        <div className="flex gap-2 mb-4">
          {[56, 64, 48, 96].map((w) => (
            <div key={w} className="h-7 bg-gray-200 rounded-lg" style={{ width: w }} />
          ))}
        </div>

        {/* Date option cards skeleton */}
        <div className="flex flex-col gap-3 mb-5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-gray-200 rounded-lg w-40" />
                  <div className="flex gap-2">
                    <div className="h-4 bg-gray-100 rounded-full w-20" />
                    <div className="h-4 bg-gray-100 rounded-full w-24" />
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {[1, 2, 3].map((b) => (
                    <div key={b} className="h-8 w-12 bg-gray-100 rounded-xl" />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Propose dates card skeleton */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="h-3 w-28 bg-gray-200 rounded-full mb-1" />
          <div className="h-3 w-48 bg-gray-100 rounded-full mb-4" />
          <div className="h-[260px] bg-gray-100 rounded-xl mb-3" />
          <div className="h-11 bg-gray-100 rounded-xl" />
        </div>
      </div>
    </main>
  )

  const statusConfig: Record<string, { label: string; classes: string }> = {
    planning: { label: 'Planning', classes: 'bg-amber-100 text-amber-700' },
    confirmed: { label: 'Confirmed', classes: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelled', classes: 'bg-red-100 text-red-500' },
  }
  const statusCfg = statusConfig[event.status] ?? { label: event.status, classes: 'bg-gray-100 text-gray-500' }

  return (
    <main className="min-h-screen bg-gray-50 pb-10 select-none">
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

          {showConfirm && (
            <button
              onClick={confirmEvent}
              disabled={confirming}
              className="mt-4 w-full bg-green-600 text-white font-bold py-3 rounded-2xl text-sm hover:bg-green-700 active:scale-[0.98] disabled:opacity-50 transition-all shadow-sm"
            >
              {confirming ? 'Confirming...' : `Mark as Confirmed — ${formatDateRange(topOption.date, topOption.end_date)}`}
            </button>
          )}
        </div>

        {/* Best available dates */}
        {bestDates.length > 0 && (
          <div className="mb-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              📊 Best Available Dates
            </p>
            <p className="text-xs text-gray-400 mb-3">Tap to start a selection, then drag to extend</p>
            <div className="flex flex-col gap-2">
              {bestDates.map((bd) => {
                const conflict = conflictColor(bd.blockedCount)
                return (
                  <button
                    key={bd.date}
                    onClick={() => {
                      setSelectedRange({ start: bd.date, end: bd.date })
                      const d = new Date(bd.date + 'T12:00:00')
                      setCalYear(d.getFullYear())
                      setCalMonth(d.getMonth())
                    }}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all active:scale-[0.98] hover:border-purple-200 hover:bg-purple-50 ${conflict.bg} border-transparent`}
                  >
                    <p className={`text-sm font-semibold ${conflict.text}`}>{formatDate(bd.date)}</p>
                    <div className="text-right shrink-0 ml-3">
                      <p className={`text-xs font-bold ${conflict.text}`}>
                        {bd.availableCount}/{TOTAL_FRIENDS} available
                      </p>
                      {bd.blockedCount > 0 && (
                        <p className={`text-xs ${conflict.text} opacity-70`}>{bd.blockedCount} blocked</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Voting key */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {RESPONSE_OPTIONS.map((r) => (
            <div
              key={r.value}
              className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border ${r.light}`}
            >
              {r.label}
              <span className="opacity-60">= {r.points}pt{r.points !== 1 ? 's' : ''}</span>
            </div>
          ))}
          <div className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border bg-gray-100 text-gray-500 border-gray-200">
            Ranked by conflict score
          </div>
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
            const isTop = i === 0 && option.conflictScore > 0
            const conflict = conflictColor(option.blockedCount)
            const isRange = option.end_date && option.end_date !== option.date
            const dayCount = getDaysInRange(option.date, option.end_date).length
            return (
              <div
                key={option.id}
                className={`bg-white rounded-2xl border shadow-sm p-4 transition-all ${
                  isTop ? 'border-green-200 shadow-green-50' : 'border-gray-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    {isTop && (
                      <span className="text-xs font-bold text-green-600 block mb-0.5">Leading</span>
                    )}
                    <p className="font-bold text-gray-900">
                      {isRange
                        ? `${formatDate(option.date, { month: 'short', day: 'numeric' })} – ${formatDate(option.end_date!, { month: 'short', day: 'numeric' })}`
                        : formatDate(option.date)
                      }
                    </p>
                    {isRange && (
                      <p className="text-xs text-gray-400">{dayCount} days</p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-gray-400">
                        {option.totalPoints} pts · {option.votes.length} vote{option.votes.length !== 1 ? 's' : ''}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${conflict.bg} ${conflict.text}`}>
                        {option.blockedCount === 0 ? '✓ No conflicts' : `⚠ ${conflict.label}`}
                      </span>
                      <span className="text-xs text-gray-300">score: {option.conflictScore}</span>
                    </div>
                  </div>
                  {name && (
                    <div className="flex gap-1.5 shrink-0">
                      {RESPONSE_OPTIONS.map((r) => {
                        const isActive = my === r.value
                        // "Best" is locked to one option — dim it everywhere else once picked
                        const bestTaken = r.value === 'best' && myBestOptionId !== null && myBestOptionId !== option.id
                        return (
                          <button
                            key={r.value}
                            onClick={() => vote(option.id, r.value, r.points)}
                            disabled={voting === option.id}
                            title={bestTaken ? 'You already picked Best for another date — click to move it here' : undefined}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                              isActive
                                ? `${r.light} scale-105`
                                : bestTaken
                                  ? 'bg-gray-50 text-gray-200 border-gray-100 cursor-pointer'
                                  : 'bg-gray-50 text-gray-400 border-gray-100 hover:border-gray-300'
                            }`}
                          >
                            {r.label}
                          </button>
                        )
                      })}
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

                {option.blockedNames.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-50">
                    <p className="text-xs text-gray-400 mb-1">
                      Can&apos;t make it ({option.blockedCount}):
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {option.blockedNames.map((n) => (
                        <span
                          key={n}
                          className="text-xs bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full font-medium"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Propose dates — drag-select calendar */}
        {name && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Propose dates</p>
            <p className="text-xs text-gray-400 mb-3">Tap a day or drag to select a multi-day range</p>

            {/* Conflict color legend */}
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              {([
                ['bg-white border border-gray-200', 'Free'],
                ['bg-yellow-100', 'Few blocked'],
                ['bg-yellow-300', 'Some'],
                ['bg-red-400', 'Many'],
              ] as const).map(([cls, label]) => (
                <div key={label} className="flex items-center gap-1 text-xs text-gray-500">
                  <div className={`w-3 h-3 rounded ${cls}`} />
                  <span>{label}</span>
                </div>
              ))}
            </div>

            {/* Mini calendar with drag-select */}
            <div
              className="border border-gray-100 rounded-xl overflow-hidden mb-3"
              onMouseUp={calCommitDrag}
              onMouseLeave={calCommitDrag}
            >
              <div className="flex items-center justify-between px-3 py-2 bg-gray-900 text-white">
                <button
                  onClick={prevCalMonth}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition text-base"
                >‹</button>
                <span className="text-xs font-semibold">{MONTH_NAMES[calMonth]} {calYear}</span>
                <button
                  onClick={nextCalMonth}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition text-base"
                >›</button>
              </div>

              <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
                {DAY_LABELS.map((d) => (
                  <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1.5">{d}</div>
                ))}
              </div>

              <div
                className="grid grid-cols-7 gap-0.5 p-2"
                onTouchStart={(e) => { const iso = isoFromTouch(e.touches[0]); if (iso) calStartDrag(iso) }}
                onTouchMove={(e) => { e.preventDefault(); const iso = isoFromTouch(e.touches[0]); if (iso) calMoveDrag(iso) }}
                onTouchEnd={calCommitDrag}
              >
                {calCells.map((iso, i) => {
                  if (!iso) return <div key={`empty-${i}`} className="aspect-square" />
                  const isPast = iso < todayISO
                  const isInPreview = calPreview.has(iso)
                  const isInSelected = !!selectedRange && iso >= selectedRange.start && iso <= selectedRange.end
                  const isToday = iso === todayISO
                  const blockedCount = groupBlackouts[iso]?.length ?? 0
                  const day = parseInt(iso.split('-')[2])

                  let cellClass: string
                  if (isPast) {
                    cellClass = 'bg-gray-50 text-gray-200 cursor-default'
                  } else if (isInSelected) {
                    cellClass = 'bg-purple-500 text-white font-bold cursor-pointer'
                  } else if (isInPreview) {
                    cellClass = 'bg-purple-200 text-purple-800 cursor-pointer'
                  } else {
                    cellClass = calendarCellColor(blockedCount) + ' cursor-pointer'
                  }

                  return (
                    <div
                      key={iso}
                      data-iso={iso}
                      onMouseDown={() => calStartDrag(iso)}
                      onMouseEnter={() => calMoveDrag(iso)}
                      className={[
                        'aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-colors',
                        cellClass,
                        isToday && !isInSelected && !isInPreview ? 'ring-2 ring-blue-400 ring-offset-1' : '',
                      ].join(' ')}
                    >
                      <span className="leading-none">{day}</span>
                      {blockedCount > 0 && !isPast && !isInSelected && !isInPreview && (
                        <span className="text-[8px] leading-none mt-0.5 opacity-80">{blockedCount}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Selected range summary + add button */}
            <div className="flex gap-2 items-center">
              <div className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 bg-gray-50 min-h-[42px] flex items-center">
                {selectedRange ? (
                  <span className="font-medium">
                    {formatDateRange(selectedRange.start, selectedRange.end)}
                    {selectedConflicts > 0
                      ? ` — ${selectedConflicts} conflict${selectedConflicts !== 1 ? 's' : ''}`
                      : ' — no conflicts'}
                  </span>
                ) : (
                  <span className="text-gray-400">Tap or drag to select</span>
                )}
              </div>
              <button
                onClick={addDateOption}
                disabled={!selectedRange || addingDate}
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
