'use client'

// Event detail — the heart of the product. Everything the group does to pick
// a date happens here. Restyled to the earthy baseline; logic preserved.
//
// Screens:
//  - Confirmed banner (when locked in)
//  - Event header (title/description/category tile)
//  - Best-available quick picks
//  - Voting key
//  - Ranked date options w/ vote buttons + breakdown
//  - Propose-dates calendar (tap or drag for multi-day ranges)

import { useState, useEffect, use, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ensureUser } from '@/lib/ensureUser'
import { useName } from '@/lib/useName'
import { categoryFor } from '@/lib/categories'
import { VOTE } from '@/lib/status'
import Card from '@/app/components/Card'
import StatusChip from '@/app/components/StatusChip'
import IconTile from '@/app/components/IconTile'
import Avatar from '@/app/components/Avatar'
import { ChevronLeftIcon, ChevronRightIcon, CheckIcon } from '@/app/components/icons'

const TOTAL_FRIENDS = 12

const RESPONSES = [
  { label: 'Best',  value: 'best',  points: 3 },
  { label: 'Works', value: 'works', points: 1 },
  { label: 'Pass',  value: 'no',    points: 0 },
] as const
type ResponseValue = typeof RESPONSES[number]['value']

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_LABELS = ['S','M','T','W','T','F','S']

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
  confirmed_date?: string | null
  confirmed_end_date?: string | null
}

type GroupBlackouts = Record<string, string[]>

type BestDate = { date: string; availableCount: number; blockedCount: number }

function getRange(a: string, b: string): string[] {
  const start = new Date(a + 'T12:00:00')
  const end = new Date(b + 'T12:00:00')
  const [s, e] = start <= end ? [start, end] : [end, start]
  const days: string[] = []
  const cur = new Date(s)
  while (cur <= e) { days.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 1) }
  return days
}

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
  return `${formatDate(start, { month: 'short', day: 'numeric' })} – ${formatDate(end, { month: 'short', day: 'numeric' })} · ${count} days`
}

function scoreFor(totalPoints: number, blockedCount: number): number {
  return totalPoints - blockedCount * 2
}

// Calendar cell tint based on blocked count — warm earthy rather than alarm red.
function calendarCellTint(blockedCount: number): string {
  if (blockedCount === 0) return 'bg-cream text-ink hover:bg-sand'
  const ratio = blockedCount / TOTAL_FRIENDS
  if (ratio < 0.25) return 'bg-amber-tint text-amber hover:bg-amber-soft'
  if (ratio < 0.5)  return 'bg-amber-soft text-amber hover:bg-amber-soft/80'
  return 'bg-blush-soft text-blush hover:bg-blush-soft/80'
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

  const [selectedRange, setSelectedRange] = useState<{ start: string; end: string } | null>(null)
  const [calPreview, setCalPreview] = useState<Set<string>>(new Set())
  const calDrag = useRef<string | null>(null)

  const today = new Date()
  const todayISO = today.toISOString().split('T')[0]
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())

  useEffect(() => { loadAll() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    const [
      { data: ev },
      { data: options },
      { data: votes },
      { data: users },
      { data: avail },
    ] = await Promise.all([
      supabase.from('events').select('id, title, description, status, created_by, confirmed_date, confirmed_end_date').eq('id', id).single(),
      supabase.from('date_options').select('id, date, end_date').eq('event_id', id).order('date', { ascending: true }),
      supabase.from('votes').select('date_option_id, response, points, user_id'),
      supabase.from('users').select('id, name'),
      supabase.from('availability').select('user_id, date'),
    ])

    if (ev) setEvent(ev)
    const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u.name]))

    const blackoutsMap: GroupBlackouts = {}
    for (const row of avail ?? []) {
      const n = userMap[row.user_id]
      if (!n) continue
      ;(blackoutsMap[row.date] ??= []).push(n)
    }
    setGroupBlackouts(blackoutsMap)

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
      const optDays = getDaysInRange(opt.date, opt.end_date)
      const blockedSet = new Set<string>()
      optDays.forEach((d) => (blackoutsMap[d] ?? []).forEach((n) => blockedSet.add(n)))
      const blockedNames = [...blockedSet]
      return {
        ...opt,
        votes: optVotes,
        totalPoints,
        blockedCount: blockedNames.length,
        blockedNames,
        conflictScore: scoreFor(totalPoints, blockedNames.length),
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
    const payload: Record<string, string> = { event_id: id, date: selectedRange.start, created_by: name }
    if (selectedRange.end !== selectedRange.start) payload.end_date = selectedRange.end
    const { error } = await supabase.from('date_options').insert(payload)
    if (error) console.error('addDate:', error)
    setSelectedRange(null)
    setAddingDate(false)
    await loadAll()
  }

  async function vote(dateOptionId: string, response: ResponseValue, points: number) {
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
        await supabase.from('votes').delete().eq('id', existing.id)
      } else {
        await supabase.from('votes').update({ response, points }).eq('id', existing.id)
      }
    } else {
      await supabase.from('votes').insert({ date_option_id: dateOptionId, user_id: userId, response, points })
    }

    setVoting(null)
    await loadAll()
  }

  async function confirmEvent() {
    if (!event || confirming) return
    setConfirming(true)
    const winner = dateOptions[0]
    await supabase.from('events').update({
      status: 'confirmed',
      confirmed_date: winner?.date ?? null,
      confirmed_end_date: winner?.end_date ?? null,
    }).eq('id', event.id)
    setEvent({
      ...event,
      status: 'confirmed',
      confirmed_date: winner?.date,
      confirmed_end_date: winner?.end_date,
    })
    setConfirming(false)
  }

  function myVote(option: DateOption) {
    return option.votes.find((v) => v.user_name === name)?.response ?? null
  }

  // Calendar drag handlers
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
      calDrag.current = null; setCalPreview(new Set()); return
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
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1) } else setCalMonth((m) => m - 1)
  }
  function nextCalMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1) } else setCalMonth((m) => m + 1)
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

  const isConfirmed = event?.status === 'confirmed'
  const topOption = dateOptions[0]
  const secondOption = dateOptions[1]
  const hasVotes = (topOption?.votes.length ?? 0) > 0
  const isLeading = hasVotes && (!secondOption || topOption.conflictScore > secondOption.conflictScore)
  const showConfirm = !isConfirmed && isLeading
  const myBestOptionId = dateOptions.find((o) => myVote(o) === 'best')?.id ?? null

  const confirmedBlockedNames = (() => {
    if (!isConfirmed || !event?.confirmed_date) return []
    const days = getDaysInRange(event.confirmed_date, event.confirmed_end_date)
    const names = new Set<string>()
    days.forEach((d) => (groupBlackouts[d] ?? []).forEach((n) => names.add(n)))
    return [...names].sort()
  })()

  const selectedConflicts = selectedRange
    ? (() => {
        const days = getDaysInRange(selectedRange.start, selectedRange.end)
        const names = new Set<string>()
        days.forEach((d) => (groupBlackouts[d] ?? []).forEach((n) => names.add(n)))
        return names.size
      })()
    : 0

  /* ── Skeleton ───────────────────────────────────────────────── */
  if (!event) return (
    <main className="max-w-md mx-auto px-5">
      <div className="pt-5 pb-2">
        <div className="h-4 w-20 bg-stone rounded-full animate-pulse" />
      </div>
      <div className="flex items-start gap-3 mt-4 mb-5 animate-pulse">
        <div className="w-16 h-16 rounded-[18px] bg-stone" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-6 bg-stone rounded w-3/4" />
          <div className="h-4 bg-stone/60 rounded w-1/2" />
        </div>
      </div>
      <div className="flex flex-col gap-3 animate-pulse">
        <div className="h-24 bg-cream rounded-[var(--radius-lg)]" />
        <div className="h-24 bg-cream rounded-[var(--radius-lg)]" />
        <div className="h-48 bg-cream rounded-[var(--radius-lg)]" />
      </div>
    </main>
  )

  /* ── Real page ──────────────────────────────────────────────── */
  const cat = categoryFor(event.title)

  return (
    <main className="max-w-md mx-auto px-5 no-select">
      {/* Back */}
      <div className="pt-5 pb-2">
        <Link href="/events" className="text-sm text-ink-soft hover:text-ink inline-flex items-center gap-1 transition-colors">
          <ChevronLeftIcon size={14} />
          Events
        </Link>
      </div>

      {/* Header */}
      <header className="flex items-start gap-3 mt-3 mb-5">
        <IconTile Icon={cat.Icon} tint={cat.tint} size={64} rounded="lg" />
        <div className="flex-1 min-w-0">
          <div className="mb-1">
            <StatusChip
              status={isConfirmed ? 'confirmed' : (dateOptions.length > 0 ? 'voting' : 'tentative')}
              size="xs"
            />
          </div>
          <h1 className="font-serif text-[30px] leading-[1.1] font-black text-ink tracking-tight">{event.title}</h1>
          {event.description && (
            <p className="text-sm text-ink-soft mt-1.5">{event.description}</p>
          )}
          {event.created_by && (
            <p className="text-xs text-ink-mute mt-1.5">Created by {event.created_by}</p>
          )}
        </div>
      </header>

      {/* Confirmed banner */}
      {isConfirmed && event.confirmed_date && (
        <Card className="bg-olive text-white mb-5" padded={false}>
          <div className="p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest opacity-70 mb-1 flex items-center gap-1.5">
              <CheckIcon size={14} />
              It&apos;s happening
            </p>
            <p className="font-serif text-2xl font-black leading-tight">
              {formatDateRange(event.confirmed_date, event.confirmed_end_date)}
            </p>
            <div className="mt-4 pt-4 border-t border-white/20">
              {confirmedBlockedNames.length === 0 ? (
                <p className="text-sm font-semibold">Everyone can make it</p>
              ) : (
                <>
                  <p className="text-xs font-semibold opacity-80 mb-2">
                    {TOTAL_FRIENDS - confirmedBlockedNames.length}/{TOTAL_FRIENDS} can make it
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {confirmedBlockedNames.map((n) => (
                      <span key={n} className="text-xs bg-white/15 px-2 py-0.5 rounded-full font-medium">
                        {n} can&apos;t
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Confirm CTA */}
      {showConfirm && (
        <button
          onClick={confirmEvent}
          disabled={confirming}
          className="w-full bg-olive text-white font-bold py-3.5 rounded-[var(--radius-lg)] text-sm hover:opacity-95 active:scale-[0.98] disabled:opacity-50 transition-all shadow-[var(--shadow-soft)] mb-5"
        >
          {confirming ? 'Confirming…' : `Lock it in — ${formatDateRange(topOption.date, topOption.end_date)}`}
        </button>
      )}

      {/* Best available quick picks */}
      {bestDates.length > 0 && !isConfirmed && (
        <Card className="mb-5">
          <p className="text-xs font-bold text-ink-mute uppercase tracking-wider mb-1">Best available</p>
          <p className="text-xs text-ink-soft mb-3">Tap one to seed the calendar, then drag to extend.</p>
          <div className="flex flex-col gap-1.5">
            {bestDates.map((bd) => (
              <button
                key={bd.date}
                onClick={() => {
                  setSelectedRange({ start: bd.date, end: bd.date })
                  const d = new Date(bd.date + 'T12:00:00')
                  setCalYear(d.getFullYear())
                  setCalMonth(d.getMonth())
                }}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-sand hover:bg-sand-alt text-left transition-all active:scale-[0.98]"
              >
                <p className="text-sm font-semibold text-ink">{formatDate(bd.date)}</p>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-xs font-bold text-olive">{bd.availableCount}/{TOTAL_FRIENDS} free</p>
                  {bd.blockedCount > 0 && (
                    <p className="text-xs text-blush">{bd.blockedCount} blocked</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Voting key */}
      {!isConfirmed && (
        <div className="flex flex-wrap gap-2 mb-4">
          {RESPONSES.map((r) => {
            const tone = r.value === 'best' ? VOTE.best : r.value === 'works' ? VOTE.works : VOTE.pass
            return (
              <span key={r.value} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${tone.tint} ${tone.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
                {r.label} · {r.points}pt
              </span>
            )
          })}
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-sand-alt text-ink-soft">
            Ranked by conflict score
          </span>
        </div>
      )}

      {/* Date options */}
      <div className="flex flex-col gap-2.5 mb-6">
        {dateOptions.length === 0 && !isConfirmed && (
          <Card className="text-center py-8">
            <p className="text-sm text-ink-soft">No dates proposed yet.</p>
            <p className="text-xs text-ink-mute mt-1">Add one below to get voting started.</p>
          </Card>
        )}
        {dateOptions.map((option, i) => {
          const my = myVote(option)
          const isTop = i === 0 && option.conflictScore > 0 && !isConfirmed
          const isRange = !!option.end_date && option.end_date !== option.date
          const dayCount = getDaysInRange(option.date, option.end_date).length

          return (
            <Card key={option.id} className={isTop ? 'ring-1 ring-olive' : ''}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  {isTop && (
                    <p className="text-[11px] font-bold text-olive uppercase tracking-wider mb-0.5">Leading</p>
                  )}
                  <p className="font-bold text-ink">
                    {isRange
                      ? `${formatDate(option.date, { month: 'short', day: 'numeric' })} – ${formatDate(option.end_date!, { month: 'short', day: 'numeric' })}`
                      : formatDate(option.date)
                    }
                  </p>
                  {isRange && <p className="text-xs text-ink-mute">{dayCount} days</p>}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-xs text-ink-soft">
                      {option.totalPoints}pt · {option.votes.length} vote{option.votes.length !== 1 ? 's' : ''}
                    </span>
                    {option.blockedCount === 0 ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-olive-tint text-olive">
                        No conflicts
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blush-tint text-blush">
                        {option.blockedCount} blocked
                      </span>
                    )}
                  </div>
                </div>

                {name && !isConfirmed && (
                  <div className="flex gap-1 shrink-0">
                    {RESPONSES.map((r) => {
                      const isActive = my === r.value
                      const bestTaken = r.value === 'best' && myBestOptionId !== null && myBestOptionId !== option.id
                      const tone = r.value === 'best' ? VOTE.best : r.value === 'works' ? VOTE.works : VOTE.pass
                      return (
                        <button
                          key={r.value}
                          onClick={() => vote(option.id, r.value, r.points)}
                          disabled={voting === option.id}
                          title={bestTaken ? 'You already picked Best — click here to move it.' : undefined}
                          className={[
                            'px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95',
                            isActive
                              ? `${tone.strong}`
                              : bestTaken
                                ? 'bg-sand text-ink-faint'
                                : 'bg-sand text-ink-soft hover:bg-sand-alt',
                          ].join(' ')}
                        >
                          {r.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {option.votes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-sand-alt">
                  {option.votes.map((v) => {
                    const tone = v.response === 'best' ? VOTE.best : v.response === 'works' ? VOTE.works : VOTE.pass
                    return (
                      <span key={v.user_name} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${tone.tint} ${tone.text}`}>
                        <Avatar name={v.user_name} size={14} />
                        {v.user_name}
                      </span>
                    )
                  })}
                </div>
              )}

              {option.blockedNames.length > 0 && (
                <div className="mt-2 pt-2 border-t border-sand-alt">
                  <p className="text-xs text-ink-mute mb-1.5">Can&apos;t make it ({option.blockedCount})</p>
                  <div className="flex flex-wrap gap-1">
                    {option.blockedNames.map((n) => (
                      <span key={n} className="text-xs bg-blush-tint text-blush px-2 py-0.5 rounded-full font-medium">
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Propose dates — drag-select calendar */}
      {name && !isConfirmed && (
        <Card className="mb-8">
          <p className="text-xs font-bold text-ink-mute uppercase tracking-wider mb-1">Propose dates</p>
          <p className="text-xs text-ink-soft mb-3">Tap a day or drag to select a multi-day range.</p>

          {/* Tint legend */}
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            {([
              ['bg-cream ring-1 ring-stone', 'Free'],
              ['bg-amber-tint', 'Few blocked'],
              ['bg-amber-soft', 'Some'],
              ['bg-blush-soft', 'Many'],
            ] as const).map(([cls, label]) => (
              <div key={label} className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                <span className={`w-3 h-3 rounded ${cls}`} />
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* Calendar */}
          <div
            className="border border-sand-alt rounded-[var(--radius-md)] overflow-hidden mb-3"
            onMouseUp={calCommitDrag}
            onMouseLeave={calCommitDrag}
          >
            <div className="flex items-center justify-between px-3 py-2 bg-ink text-cream">
              <button
                onClick={prevCalMonth}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition"
                aria-label="Previous month"
              >
                <ChevronLeftIcon size={16} />
              </button>
              <span className="text-xs font-semibold">{MONTH_NAMES[calMonth]} {calYear}</span>
              <button
                onClick={nextCalMonth}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition"
                aria-label="Next month"
              >
                <ChevronRightIcon size={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 bg-sand border-b border-sand-alt">
              {DAY_LABELS.map((d, i) => (
                <div key={i} className="text-center text-[10px] font-bold text-ink-mute py-1.5 uppercase tracking-wider">{d}</div>
              ))}
            </div>

            <div
              className="grid grid-cols-7 gap-0.5 p-2 bg-cream"
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
                  cellClass = 'bg-sand-alt text-ink-faint cursor-default'
                } else if (isInSelected) {
                  cellClass = 'bg-olive text-white font-bold cursor-pointer'
                } else if (isInPreview) {
                  cellClass = 'bg-olive-soft text-olive font-semibold cursor-pointer'
                } else {
                  cellClass = calendarCellTint(blockedCount) + ' cursor-pointer'
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
                      isToday && !isInSelected && !isInPreview ? 'ring-1 ring-olive' : '',
                    ].join(' ')}
                  >
                    <span className="leading-none">{day}</span>
                    {blockedCount > 0 && !isPast && !isInSelected && !isInPreview && (
                      <span className="text-[8px] leading-none mt-0.5 opacity-70">{blockedCount}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Selected range + Add */}
          <div className="flex gap-2 items-center">
            <div className="flex-1 bg-sand rounded-xl px-3 py-2.5 text-sm min-h-[42px] flex items-center">
              {selectedRange ? (
                <span className="font-medium text-ink">
                  {formatDateRange(selectedRange.start, selectedRange.end)}
                  {selectedConflicts > 0
                    ? ` · ${selectedConflicts} blocked`
                    : ' · no conflicts'}
                </span>
              ) : (
                <span className="text-ink-mute">Tap or drag to select</span>
              )}
            </div>
            <button
              onClick={addDateOption}
              disabled={!selectedRange || addingDate}
              className="bg-olive text-white rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-40 active:scale-95 transition-all"
            >
              {addingDate ? '…' : 'Add'}
            </button>
          </div>
        </Card>
      )}
    </main>
  )
}
