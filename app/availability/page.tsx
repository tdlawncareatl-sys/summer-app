'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { ensureUser } from '@/lib/ensureUser'
import { useName } from '@/lib/useName'

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa']

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

function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', opts ?? { weekday: 'short', month: 'short', day: 'numeric' })
}

type DateRange = { start: string; end: string; days: string[] }
type GroupBlackouts = Record<string, string[]>
type EventConflict = { id: string; title: string; conflictingDates: string[] }

function collapseToRanges(dates: string[]): DateRange[] {
  if (dates.length === 0) return []
  const sorted = [...dates].sort()
  const ranges: DateRange[] = []
  let rangeStart = sorted[0]
  let rangeDays = [sorted[0]]
  let prev = sorted[0]
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]
    const diff = (new Date(cur + 'T12:00:00').getTime() - new Date(prev + 'T12:00:00').getTime()) / 86400000
    if (diff === 1) {
      rangeDays.push(cur)
    } else {
      ranges.push({ start: rangeStart, end: prev, days: rangeDays })
      rangeStart = cur
      rangeDays = [cur]
    }
    prev = cur
  }
  ranges.push({ start: rangeStart, end: prev, days: rangeDays })
  return ranges
}

export default function AvailabilityPage() {
  const today = new Date()
  const todayISO = today.toISOString().split('T')[0]

  const [name] = useName()
  const [userId, setUserId] = useState<string | null>(null)
  const [blackouts, setBlackouts] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState(false)
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [previewDays, setPreviewDays] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'mine' | 'list' | 'group'>('mine')

  const [groupBlackouts, setGroupBlackouts] = useState<GroupBlackouts>({})
  const [groupLoading, setGroupLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const [eventConflicts, setEventConflicts] = useState<EventConflict[]>([])
  const [removingRange, setRemovingRange] = useState<string | null>(null)
  const [clearingAll, setClearingAll] = useState(false)

  const drag = useRef<{ mode: 'add' | 'remove'; start: string } | null>(null)

  useEffect(() => {
    if (!name) return
    setBlackouts(new Set())
    setUserId(null)
    loadUser(name)
  }, [name])

  useEffect(() => {
    if (viewMode === 'group') loadGroupBlackouts()
    if (viewMode === 'list' && userId) loadEventConflicts()
  }, [viewMode, userId])

  useEffect(() => {
    if (viewMode === 'list' && userId) loadEventConflicts()
  }, [blackouts])

  async function loadUser(n: string) {
    const uid = await ensureUser(n)
    setUserId(uid)
    const { data } = await supabase.from('availability').select('date').eq('user_id', uid)
    if (data) setBlackouts(new Set(data.map((r) => r.date)))
  }

  async function loadGroupBlackouts() {
    setGroupLoading(true)
    const [{ data: users }, { data: avail }] = await Promise.all([
      supabase.from('users').select('id, name'),
      supabase.from('availability').select('user_id, date'),
    ])
    const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u.name]))
    const result: GroupBlackouts = {}
    for (const row of avail ?? []) {
      const friendName = userMap[row.user_id]
      if (!friendName) continue
      if (!result[row.date]) result[row.date] = []
      result[row.date].push(friendName)
    }
    setGroupBlackouts(result)
    setGroupLoading(false)
  }

  async function loadEventConflicts() {
    if (!userId) return
    const { data: events } = await supabase.from('events').select('id, title').eq('status', 'planning')
    if (!events || events.length === 0) { setEventConflicts([]); return }
    const { data: options } = await supabase
      .from('date_options').select('event_id, date')
      .in('event_id', events.map((e) => e.id))
    const conflicts: EventConflict[] = []
    for (const ev of events) {
      const evDates = (options ?? []).filter((o) => o.event_id === ev.id).map((o) => o.date)
      const conflicting = evDates.filter((d) => blackouts.has(d) && d >= todayISO)
      if (conflicting.length > 0) conflicts.push({ id: ev.id, title: ev.title, conflictingDates: conflicting.sort() })
    }
    setEventConflicts(conflicts)
  }

  function startDrag(iso: string) {
    if (iso < todayISO) return
    drag.current = { mode: blackouts.has(iso) ? 'remove' : 'add', start: iso }
    setPreviewDays(new Set([iso]))
  }

  function moveDrag(iso: string) {
    if (!drag.current || iso < todayISO) return
    setPreviewDays(new Set(getRange(drag.current.start, iso)))
  }

  async function commitDrag() {
    if (!drag.current || !userId || previewDays.size === 0) {
      drag.current = null; setPreviewDays(new Set()); return
    }
    const { mode } = drag.current
    drag.current = null
    const days = [...previewDays]
    setPreviewDays(new Set())
    const newBlackouts = new Set(blackouts)
    if (mode === 'add') {
      const toAdd = days.filter((d) => !blackouts.has(d))
      if (toAdd.length) {
        await supabase.from('availability').insert(toAdd.map((date) => ({ user_id: userId, date })))
        toAdd.forEach((d) => newBlackouts.add(d))
      }
    } else {
      const toRemove = days.filter((d) => blackouts.has(d))
      if (toRemove.length) {
        await supabase.from('availability').delete().eq('user_id', userId).in('date', toRemove)
        toRemove.forEach((d) => newBlackouts.delete(d))
      }
    }
    setBlackouts(newBlackouts)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function removeRange(range: DateRange) {
    if (!userId) return
    setRemovingRange(range.start)
    await supabase.from('availability').delete().eq('user_id', userId).in('date', range.days)
    const newBlackouts = new Set(blackouts)
    range.days.forEach((d) => newBlackouts.delete(d))
    setBlackouts(newBlackouts)
    setRemovingRange(null)
  }

  async function clearAllFuture() {
    if (!userId) return
    setClearingAll(true)
    const futureDates = [...blackouts].filter((d) => d >= todayISO)
    if (futureDates.length) {
      await supabase.from('availability').delete().eq('user_id', userId).in('date', futureDates)
      const newBlackouts = new Set(blackouts)
      futureDates.forEach((d) => newBlackouts.delete(d))
      setBlackouts(newBlackouts)
    }
    setClearingAll(false)
  }

  function isoFromTouch(touch: React.Touch): string | null {
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    return el?.getAttribute('data-iso') ?? null
  }

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1) } else setMonth((m) => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1) } else setMonth((m) => m + 1)
  }

  const TOTAL_FRIENDS = 12
  function groupCellColor(iso: string) {
    const blocked = groupBlackouts[iso]?.length ?? 0
    if (blocked === 0) return 'bg-gray-50 text-gray-700'
    const ratio = blocked / TOTAL_FRIENDS
    if (ratio < 0.25) return 'bg-yellow-100 text-yellow-800'
    if (ratio < 0.5) return 'bg-yellow-300 text-yellow-900'
    return 'bg-red-400 text-white'
  }

  const selectedDateBlocked = selectedDate ? (groupBlackouts[selectedDate] ?? []) : []
  const futureBlackouts = [...blackouts].filter((d) => d >= todayISO).sort()
  const futureRanges = collapseToRanges(futureBlackouts)

  return (
    <main
      className="min-h-screen bg-gray-50 pb-10 select-none"
      onMouseUp={viewMode === 'mine' ? commitDrag : undefined}
      onMouseLeave={viewMode === 'mine' ? commitDrag : undefined}
    >
      <div className="max-w-md mx-auto px-5">
        <div className="pt-5 pb-1">
          <a href="/" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Back</a>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-1">Availability</h1>
        <p className="text-sm text-gray-500 mb-5">
          {viewMode === 'mine' && <>Block dates you <span className="font-semibold text-red-500">can&apos;t</span> make it. Drag to select a range.</>}
          {viewMode === 'list' && 'Review and manage your blocked dates.'}
          {viewMode === 'group' && 'See when everyone is blocked.'}
        </p>

        {/* 3-tab toggle */}
        <div className="flex bg-gray-200 rounded-xl p-1 mb-5 gap-1">
          {(['mine', 'list', 'group'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => { setViewMode(mode); setSelectedDate(null) }}
              className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                viewMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {mode === 'mine' ? 'Calendar' : mode === 'list' ? 'My Blocks' : 'Group'}
            </button>
          ))}
        </div>

        {/* ── CALENDAR TAB ── */}
        {viewMode === 'mine' && (
          <>
            {!name && <p className="text-sm text-gray-400 text-center py-8">Select your name in the top right to get started.</p>}
            {name && !userId && <p className="text-sm text-gray-400 text-center py-8">Loading...</p>}
            {name && userId && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-600">
                    <span className="font-bold text-red-500">{blackouts.size}</span> date{blackouts.size !== 1 ? 's' : ''} blocked
                  </p>
                  {saved && <span className="text-xs font-semibold text-green-600">Saved ✓</span>}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white">
                    <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-lg transition">‹</button>
                    <span className="font-semibold text-sm">{MONTH_NAMES[month]} {year}</span>
                    <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-lg transition">›</button>
                  </div>
                  <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
                    {DAY_LABELS.map((d) => (
                      <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>
                    ))}
                  </div>
                  <div
                    className="grid grid-cols-7 gap-0.5 p-3"
                    onTouchStart={(e) => { const iso = isoFromTouch(e.touches[0]); if (iso) startDrag(iso) }}
                    onTouchMove={(e) => { e.preventDefault(); const iso = isoFromTouch(e.touches[0]); if (iso) moveDrag(iso) }}
                    onTouchEnd={commitDrag}
                  >
                    {cells.map((iso, i) => {
                      if (!iso) return <div key={`empty-${i}`} className="aspect-square" />
                      const isPast = iso < todayISO
                      const isBlocked = blackouts.has(iso)
                      const isPreview = previewDays.has(iso)
                      const addPreview = isPreview && drag.current?.mode === 'add'
                      const removePreview = isPreview && drag.current?.mode === 'remove'
                      const isToday = iso === todayISO
                      const day = parseInt(iso.split('-')[2])
                      return (
                        <div
                          key={iso}
                          data-iso={iso}
                          onMouseDown={() => startDrag(iso)}
                          onMouseEnter={() => moveDrag(iso)}
                          className={[
                            'aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-colors',
                            isPast ? 'text-gray-200 cursor-default' : 'cursor-pointer',
                            !isPast && isBlocked && !isPreview ? 'bg-red-500 text-white' : '',
                            !isPast && addPreview ? 'bg-red-300 text-white' : '',
                            !isPast && removePreview ? 'bg-gray-200 text-gray-400' : '',
                            !isPast && !isBlocked && !isPreview ? 'text-gray-800 hover:bg-gray-100' : '',
                            isToday && !isBlocked && !isPreview ? 'ring-2 ring-blue-400 ring-offset-1' : '',
                          ].join(' ')}
                        >
                          {day}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <p className="text-xs text-gray-400 text-center mt-3">Tap or drag to block · tap again to unblock</p>
              </div>
            )}
          </>
        )}

        {/* ── MY BLOCKS TAB ── */}
        {viewMode === 'list' && (
          <>
            {!name && <p className="text-sm text-gray-400 text-center py-8">Select your name in the top right to get started.</p>}
            {name && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {futureBlackouts.length} date{futureBlackouts.length !== 1 ? 's' : ''} blocked
                    </p>
                    {futureBlackouts.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">Next: {formatDate(futureBlackouts[0])}</p>
                    )}
                  </div>
                  {futureBlackouts.length > 0 && (
                    <button
                      onClick={clearAllFuture}
                      disabled={clearingAll}
                      className="text-xs font-semibold text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-xl transition-all disabled:opacity-40"
                    >
                      {clearingAll ? 'Clearing...' : 'Clear all'}
                    </button>
                  )}
                </div>

                {eventConflicts.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">⚠️ Event conflicts</p>
                    <div className="flex flex-col gap-2">
                      {eventConflicts.map((ec) => (
                        <div key={ec.id}>
                          <p className="text-sm font-semibold text-amber-900">{ec.title}</p>
                          <p className="text-xs text-amber-700 mt-0.5">
                            You&apos;re blocked on: {ec.conflictingDates.map((d) => formatDate(d, { month: 'short', day: 'numeric' })).join(', ')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {futureRanges.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3">✅</div>
                    <p className="text-gray-500 font-semibold">No dates blocked</p>
                    <p className="text-gray-400 text-sm mt-1">Switch to Calendar to block out dates you can&apos;t make it.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {futureRanges.map((range) => {
                      const isSingleDay = range.start === range.end
                      const label = isSingleDay
                        ? formatDate(range.start)
                        : `${formatDate(range.start, { month: 'short', day: 'numeric' })} – ${formatDate(range.end, { month: 'short', day: 'numeric' })}`
                      const sub = isSingleDay ? null : `${range.days.length} days`
                      return (
                        <div key={range.start} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{label}</p>
                              {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
                            </div>
                          </div>
                          <button
                            onClick={() => removeRange(range)}
                            disabled={removingRange === range.start}
                            className="text-xs font-semibold text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-300 px-3 py-1.5 rounded-xl transition-all disabled:opacity-40 shrink-0"
                          >
                            {removingRange === range.start ? '...' : 'Remove'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── GROUP TAB ── */}
        {viewMode === 'group' && (
          <div>
            {groupLoading && <p className="text-sm text-gray-400 text-center py-8">Loading...</p>}
            {!groupLoading && (
              <>
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  {([
                    ['bg-gray-100 border border-gray-200', 'Free'],
                    ['bg-yellow-100 border border-yellow-200', 'Few blocked'],
                    ['bg-yellow-300', 'Some blocked'],
                    ['bg-red-400', 'Many blocked'],
                  ] as const).map(([cls, label]) => (
                    <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
                      <div className={`w-4 h-4 rounded ${cls}`} />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white">
                    <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-lg transition">‹</button>
                    <span className="font-semibold text-sm">{MONTH_NAMES[month]} {year}</span>
                    <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-lg transition">›</button>
                  </div>
                  <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
                    {DAY_LABELS.map((d) => (
                      <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5 p-3">
                    {cells.map((iso, i) => {
                      if (!iso) return <div key={`empty-${i}`} className="aspect-square" />
                      const isPast = iso < todayISO
                      const blockedCount = groupBlackouts[iso]?.length ?? 0
                      const day = parseInt(iso.split('-')[2])
                      const colorClass = isPast ? 'bg-gray-50 text-gray-200' : groupCellColor(iso)
                      const isSelected = selectedDate === iso
                      return (
                        <div
                          key={iso}
                          onClick={() => { if (!isPast) setSelectedDate(selectedDate === iso ? null : iso) }}
                          className={[
                            'aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-all',
                            isPast ? 'cursor-default' : 'cursor-pointer hover:opacity-80',
                            colorClass,
                            isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : '',
                            iso === todayISO && !isSelected ? 'ring-2 ring-blue-400 ring-offset-1' : '',
                          ].join(' ')}
                        >
                          <span className="font-semibold leading-none">{day}</span>
                          {blockedCount > 0 && !isPast && <span className="text-[9px] leading-none mt-0.5 opacity-80">{blockedCount}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {selectedDate && (
                  <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-semibold text-gray-900 text-sm">
                        {formatDate(selectedDate, { weekday: 'long', month: 'long', day: 'numeric' })}
                      </p>
                      <button onClick={() => setSelectedDate(null)} className="text-gray-300 hover:text-gray-500 text-lg leading-none">×</button>
                    </div>
                    {selectedDateBlocked.length === 0 ? (
                      <p className="text-sm text-green-600 font-medium">Everyone is free!</p>
                    ) : (
                      <>
                        <p className="text-xs text-gray-400 mb-2">{selectedDateBlocked.length} {selectedDateBlocked.length === 1 ? 'person' : 'people'} can&apos;t make it:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedDateBlocked.sort().map((n) => (
                            <span key={n} className="text-xs bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full font-medium">{n}</span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-400 text-center mt-3">Tap a date to see who&apos;s blocked</p>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
