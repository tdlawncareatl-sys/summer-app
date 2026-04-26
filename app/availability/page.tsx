'use client'

// Availability — personal blackout dates.
//  - Calendar: drag-select to add/remove blackouts; label sheet captures why.
//  - My Blocks: list view of your future blackouts + event conflicts.
//  - Group: heatmap of when the crew is collectively blocked.
//
// Restyled to the earthy baseline. Logic unchanged.

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { ensureUser } from '@/lib/ensureUser'
import { useName } from '@/lib/useName'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from '../components/icons'
import { densityForDay } from '@/lib/availability'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_LABELS = ['S','M','T','W','T','F','S']

function getRange(a: string, b: string): string[] {
  const start = new Date(a + 'T12:00:00')
  const end = new Date(b + 'T12:00:00')
  const [s, e] = start <= end ? [start, end] : [end, start]
  const days: string[] = []
  const cur = new Date(s)
  while (cur <= e) { days.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 1) }
  return days
}

function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', opts ?? { weekday: 'short', month: 'short', day: 'numeric' })
}

type DateRange = { start: string; end: string; days: string[]; category?: string | null }
type GroupBlackouts = Record<string, string[]>
type EventConflict = { id: string; title: string; conflictingDates: string[] }
type BlackoutRecord = { date: string; category?: string | null }

function collapseToRanges(records: BlackoutRecord[]): DateRange[] {
  if (records.length === 0) return []
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
  const ranges: DateRange[] = []
  let rangeStart = sorted[0].date
  let rangeDays = [sorted[0].date]
  let rangeCategory = sorted[0].category
  let prev = sorted[0].date
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]
    const diff = (new Date(cur.date + 'T12:00:00').getTime() - new Date(prev + 'T12:00:00').getTime()) / 86400000
    const sameCategory = cur.category === rangeCategory
    if (diff === 1 && sameCategory) {
      rangeDays.push(cur.date)
    } else {
      ranges.push({ start: rangeStart, end: prev, days: rangeDays, category: rangeCategory })
      rangeStart = cur.date
      rangeDays = [cur.date]
      rangeCategory = cur.category
    }
    prev = cur.date
  }
  ranges.push({ start: rangeStart, end: prev, days: rangeDays, category: rangeCategory })
  return ranges
}

export default function AvailabilityPage() {
  const today = new Date()
  const todayISO = today.toISOString().split('T')[0]

  const [name] = useName()
  const [userId, setUserId] = useState<string | null>(null)
  const [blackouts, setBlackouts] = useState<Set<string>>(new Set())
  const [blackoutRecords, setBlackoutRecords] = useState<BlackoutRecord[]>([])
  const [saved, setSaved] = useState(false)
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [previewDays, setPreviewDays] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'mine' | 'list' | 'group'>('mine')

  const [pendingDays, setPendingDays] = useState<string[] | null>(null)
  const [pendingLabel, setPendingLabel] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)

  const [groupBlackouts, setGroupBlackouts] = useState<GroupBlackouts>({})
  const [totalUsers, setTotalUsers] = useState(0)
  const [groupLoading, setGroupLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const [eventConflicts, setEventConflicts] = useState<EventConflict[]>([])
  const [removingRange, setRemovingRange] = useState<string | null>(null)
  const [clearingAll, setClearingAll] = useState(false)

  const drag = useRef<{ mode: 'add' | 'remove'; start: string } | null>(null)

  useEffect(() => {
    if (!name) return
    setBlackouts(new Set())
    setBlackoutRecords([])
    setUserId(null)
    loadUser(name)
  }, [name])

  useEffect(() => {
    if (viewMode === 'group') loadGroupBlackouts()
    if (viewMode === 'list' && userId) loadEventConflicts()
  }, [viewMode, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (viewMode === 'list' && userId) loadEventConflicts()
  }, [blackouts]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadUser(n: string) {
    const uid = await ensureUser(n)
    setUserId(uid)
    const { data } = await supabase.from('availability').select('date, category').eq('user_id', uid)
    if (data) {
      setBlackoutRecords(data)
      setBlackouts(new Set(data.map((r) => r.date)))
    }
  }

  async function loadGroupBlackouts() {
    setGroupLoading(true)
    const [{ data: users }, { data: avail }] = await Promise.all([
      supabase.from('users').select('id, name'),
      supabase.from('availability').select('user_id, date'),
    ])
    const userList = users ?? []
    const userMap = Object.fromEntries(userList.map((u) => [u.id, u.name]))
    const result: GroupBlackouts = {}
    for (const row of avail ?? []) {
      const friendName = userMap[row.user_id]
      if (!friendName) continue
      ;(result[row.date] ??= []).push(friendName)
    }
    setGroupBlackouts(result)
    setTotalUsers(userList.length)
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

    if (mode === 'remove') {
      const toRemove = days.filter((d) => blackouts.has(d))
      if (toRemove.length) {
        await supabase.from('availability').delete().eq('user_id', userId).in('date', toRemove)
        const newBlackouts = new Set(blackouts)
        toRemove.forEach((d) => newBlackouts.delete(d))
        setBlackouts(newBlackouts)
        setBlackoutRecords((prev) => prev.filter((r) => !toRemove.includes(r.date)))
      }
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } else {
      const toAdd = days.filter((d) => !blackouts.has(d))
      if (toAdd.length) { setPendingDays(toAdd); setPendingLabel('') }
    }
  }

  async function saveWithCategory(category: string | null) {
    if (!pendingDays || !userId) return
    setSavingCategory(true)
    await supabase.from('availability').insert(pendingDays.map((date) => ({ user_id: userId, date, category })))
    const newBlackouts = new Set(blackouts)
    pendingDays.forEach((d) => newBlackouts.add(d))
    setBlackouts(newBlackouts)
    setBlackoutRecords((prev) => [
      ...prev.filter((r) => !pendingDays.includes(r.date)),
      ...pendingDays.map((date) => ({ date, category })),
    ])
    setPendingDays(null)
    setSavingCategory(false)
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  async function removeRange(range: DateRange) {
    if (!userId) return
    setRemovingRange(range.start)
    await supabase.from('availability').delete().eq('user_id', userId).in('date', range.days)
    const newBlackouts = new Set(blackouts)
    range.days.forEach((d) => newBlackouts.delete(d))
    setBlackouts(newBlackouts)
    setBlackoutRecords((prev) => prev.filter((r) => !range.days.includes(r.date)))
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
      setBlackoutRecords((prev) => prev.filter((r) => r.date < todayISO))
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

  function prevMonth() { if (month === 0) { setMonth(11); setYear((y) => y - 1) } else setMonth((m) => m - 1) }
  function nextMonth() { if (month === 11) { setMonth(0); setYear((y) => y + 1) } else setMonth((m) => m + 1) }

  function groupCellTint(iso: string) {
    const blocked = groupBlackouts[iso]?.length ?? 0
    switch (densityForDay(blocked, totalUsers)) {
      case 'few':  return 'bg-amber-tint text-amber'
      case 'some': return 'bg-amber-soft text-amber'
      case 'many': return 'bg-blush-soft text-blush'
      default:     return 'bg-sand text-ink'
    }
  }

  const selectedDateBlocked = selectedDate ? (groupBlackouts[selectedDate] ?? []) : []
  const futureRecords = blackoutRecords.filter((r) => r.date >= todayISO)
  const futureRanges = collapseToRanges(futureRecords)

  const pendingDateLabel = pendingDays
    ? pendingDays.length === 1
      ? formatDate(pendingDays[0])
      : `${formatDate(pendingDays[0], { month: 'short', day: 'numeric' })} – ${formatDate(pendingDays[pendingDays.length - 1], { month: 'short', day: 'numeric' })} · ${pendingDays.length} days`
    : ''

  return (
    <main
      className="max-w-md mx-auto px-5 no-select"
      onMouseUp={viewMode === 'mine' ? commitDrag : undefined}
      onMouseLeave={viewMode === 'mine' ? commitDrag : undefined}
    >
      <PageHeader
        variant="title"
        title="Availability"
        subtitle={
          viewMode === 'mine' ? 'Block dates you can\u2019t make it. Drag for a range.'
          : viewMode === 'list' ? 'Review and manage your blocked dates.'
          : 'When the crew is collectively blocked.'
        }
      />

      {/* Label bottom sheet */}
      {pendingDays && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={() => saveWithCategory(null)} />
          <div className="relative w-full max-w-md bg-cream rounded-t-[28px] p-6 shadow-[var(--shadow-raised)]">
            <div className="w-10 h-1 bg-stone rounded-full mx-auto mb-5" />
            <p className="font-serif text-xl font-black text-ink">What&apos;s this for?</p>
            <p className="text-sm text-ink-soft mt-0.5 mb-4">{pendingDateLabel}</p>
            <input
              type="text"
              autoFocus
              placeholder="e.g. Beach trip, Work travel, Family"
              value={pendingLabel}
              onChange={(e) => setPendingLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveWithCategory(pendingLabel.trim() || null) }}
              className="w-full bg-sand border-0 rounded-xl px-4 py-3 text-sm text-ink mb-3 focus:outline-none focus:ring-2 focus:ring-olive transition"
            />
            <button
              onClick={() => saveWithCategory(pendingLabel.trim() || null)}
              disabled={savingCategory}
              className="w-full bg-olive text-white rounded-xl py-3 text-sm font-bold mb-2 active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {savingCategory ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => saveWithCategory(null)}
              disabled={savingCategory}
              className="w-full text-sm text-ink-soft hover:text-ink py-2 transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* View toggle */}
      <div className="flex bg-stone rounded-xl p-1 mb-5 gap-1">
        {(['mine', 'list', 'group'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => { setViewMode(mode); setSelectedDate(null) }}
            className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              viewMode === mode ? 'bg-cream text-ink shadow-[var(--shadow-soft)]' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {mode === 'mine' ? 'Calendar' : mode === 'list' ? 'My blocks' : 'Group'}
          </button>
        ))}
      </div>

      {/* ── CALENDAR ── */}
      {viewMode === 'mine' && (
        <>
          {!name && <p className="text-sm text-ink-soft text-center py-8">Set your name to get started.</p>}
          {name && !userId && <div className="h-64 bg-cream rounded-[var(--radius-lg)] animate-pulse" />}
          {name && userId && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-ink-soft">
                  <span className="font-bold text-blush">{blackouts.size}</span> date{blackouts.size !== 1 ? 's' : ''} blocked
                </p>
                {saved && <span className="text-xs font-semibold text-olive">Saved ✓</span>}
              </div>

              <Card padded={false} className="overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-ink text-cream">
                  <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition" aria-label="Previous month">
                    <ChevronLeftIcon size={16} />
                  </button>
                  <span className="font-semibold text-sm">{MONTH_NAMES[month]} {year}</span>
                  <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition" aria-label="Next month">
                    <ChevronRightIcon size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-7 bg-sand border-b border-sand-alt">
                  {DAY_LABELS.map((d, i) => (
                    <div key={i} className="text-center text-[10px] font-bold text-ink-mute py-2 uppercase tracking-wider">{d}</div>
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
                    const record = blackoutRecords.find((r) => r.date === iso)

                    return (
                      <div
                        key={iso}
                        data-iso={iso}
                        onMouseDown={() => startDrag(iso)}
                        onMouseEnter={() => moveDrag(iso)}
                        className={[
                          'aspect-square flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-colors',
                          isPast ? 'text-ink-faint cursor-default' : 'cursor-pointer',
                          !isPast && isBlocked && !isPreview ? 'bg-blush text-white' : '',
                          !isPast && addPreview ? 'bg-blush-soft text-blush' : '',
                          !isPast && removePreview ? 'bg-stone text-ink-soft' : '',
                          !isPast && !isBlocked && !isPreview ? 'text-ink hover:bg-sand' : '',
                          isToday && !isBlocked && !isPreview ? 'ring-1 ring-olive' : '',
                        ].join(' ')}
                      >
                        <span className="leading-none">{day}</span>
                        {record?.category && isBlocked && !isPreview && (
                          <span className="text-[8px] leading-none mt-0.5 opacity-70">●</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </Card>

              <p className="text-xs text-ink-mute text-center mt-3">Tap or drag to block · tap again to unblock</p>
            </div>
          )}
        </>
      )}

      {/* ── MY BLOCKS ── */}
      {viewMode === 'list' && (
        <>
          {!name && <p className="text-sm text-ink-soft text-center py-8">Set your name to get started.</p>}
          {name && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {futureRecords.length} date{futureRecords.length !== 1 ? 's' : ''} blocked
                  </p>
                  {futureRecords.length > 0 && (
                    <p className="text-xs text-ink-mute mt-0.5">
                      Next: {formatDate(futureRecords.sort((a, b) => a.date.localeCompare(b.date))[0].date)}
                    </p>
                  )}
                </div>
                {futureRecords.length > 0 && (
                  <button
                    onClick={clearAllFuture}
                    disabled={clearingAll}
                    className="text-xs font-semibold text-blush hover:text-blush/80 border border-blush-soft px-3 py-1.5 rounded-xl transition-all disabled:opacity-40"
                  >
                    {clearingAll ? 'Clearing…' : 'Clear all'}
                  </button>
                )}
              </div>

              {eventConflicts.length > 0 && (
                <Card className="bg-amber-tint border border-amber-soft mb-4">
                  <p className="text-xs font-bold text-amber uppercase tracking-wider mb-2">Event conflicts</p>
                  <div className="flex flex-col gap-2">
                    {eventConflicts.map((ec) => (
                      <div key={ec.id}>
                        <p className="text-sm font-semibold text-ink">{ec.title}</p>
                        <p className="text-xs text-ink-soft mt-0.5">
                          You&apos;re blocked on {ec.conflictingDates.map((d) => formatDate(d, { month: 'short', day: 'numeric' })).join(', ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {futureRanges.length === 0 ? (
                <Card className="text-center py-10">
                  <p className="font-semibold text-ink">No dates blocked</p>
                  <p className="text-sm text-ink-soft mt-1">Switch to Calendar to block out dates.</p>
                </Card>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {futureRanges.map((range) => {
                    const isSingleDay = range.start === range.end
                    const label = isSingleDay
                      ? formatDate(range.start)
                      : `${formatDate(range.start, { month: 'short', day: 'numeric' })} – ${formatDate(range.end, { month: 'short', day: 'numeric' })}`
                    const sub = isSingleDay ? null : `${range.days.length} days`
                    return (
                      <Card key={range.start} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full bg-blush shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink truncate">{label}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {sub && <p className="text-xs text-ink-mute">{sub}</p>}
                              {range.category && (
                                <span className="text-xs text-ink-soft font-medium">{range.category}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => removeRange(range)}
                          disabled={removingRange === range.start}
                          className="text-xs font-semibold text-ink-soft hover:text-blush px-3 py-1.5 rounded-xl transition-all disabled:opacity-40 shrink-0 bg-sand hover:bg-sand-alt"
                        >
                          {removingRange === range.start ? '…' : 'Remove'}
                        </button>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── GROUP ── */}
      {viewMode === 'group' && (
        <div>
          {groupLoading && <div className="h-64 bg-cream rounded-[var(--radius-lg)] animate-pulse" />}
          {!groupLoading && (
            <>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                {([
                  ['bg-sand', 'Free'],
                  ['bg-amber-tint', 'Few blocked'],
                  ['bg-amber-soft', 'Some'],
                  ['bg-blush-soft', 'Many'],
                ] as const).map(([cls, label]) => (
                  <div key={label} className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                    <span className={`w-4 h-4 rounded ${cls}`} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>

              <Card padded={false} className="overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-ink text-cream">
                  <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition" aria-label="Previous month">
                    <ChevronLeftIcon size={16} />
                  </button>
                  <span className="font-semibold text-sm">{MONTH_NAMES[month]} {year}</span>
                  <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition" aria-label="Next month">
                    <ChevronRightIcon size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-7 bg-sand border-b border-sand-alt">
                  {DAY_LABELS.map((d, i) => (
                    <div key={i} className="text-center text-[10px] font-bold text-ink-mute py-2 uppercase tracking-wider">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5 p-3">
                  {cells.map((iso, i) => {
                    if (!iso) return <div key={`empty-${i}`} className="aspect-square" />
                    const isPast = iso < todayISO
                    const blockedCount = groupBlackouts[iso]?.length ?? 0
                    const day = parseInt(iso.split('-')[2])
                    const tintClass = isPast ? 'bg-sand-alt text-ink-faint' : groupCellTint(iso)
                    const isSelected = selectedDate === iso
                    return (
                      <div
                        key={iso}
                        onClick={() => { if (!isPast) setSelectedDate(selectedDate === iso ? null : iso) }}
                        className={[
                          'aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-all',
                          isPast ? 'cursor-default' : 'cursor-pointer hover:opacity-80',
                          tintClass,
                          isSelected ? 'ring-2 ring-olive' : '',
                          iso === todayISO && !isSelected ? 'ring-1 ring-olive' : '',
                        ].join(' ')}
                      >
                        <span className="font-semibold leading-none">{day}</span>
                        {blockedCount > 0 && !isPast && <span className="text-[9px] leading-none mt-0.5 opacity-80">{blockedCount}</span>}
                      </div>
                    )
                  })}
                </div>
              </Card>

              {selectedDate && (
                <Card className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold text-ink">
                      {formatDate(selectedDate, { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                    <button onClick={() => setSelectedDate(null)} className="text-ink-faint hover:text-ink-soft" aria-label="Close">
                      <XIcon size={16} />
                    </button>
                  </div>
                  {selectedDateBlocked.length === 0 ? (
                    <p className="text-sm text-olive font-medium">Everyone is free.</p>
                  ) : (
                    <>
                      <p className="text-xs text-ink-mute mb-2">
                        {selectedDateBlocked.length} {selectedDateBlocked.length === 1 ? 'person' : 'people'} can&apos;t make it:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedDateBlocked.sort().map((n) => (
                          <span key={n} className="text-xs bg-blush-tint text-blush px-2 py-0.5 rounded-full font-medium">{n}</span>
                        ))}
                      </div>
                    </>
                  )}
                </Card>
              )}
              <p className="text-xs text-ink-mute text-center mt-3">Tap a date to see who&apos;s blocked</p>
            </>
          )}
        </div>
      )}
    </main>
  )
}
