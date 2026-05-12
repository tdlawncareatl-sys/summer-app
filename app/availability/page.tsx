'use client'

// Availability — personal blackout dates.
//  - Calendar: drag-select to add/remove blackouts; label sheet captures why.
//  - My Blocks: list view of your future blackouts + event conflicts.
//  - Group: heatmap of when the crew is collectively blocked.
//
// Restyled to the earthy baseline. Logic now includes multi-day conflict
// handling and persistence feedback.

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { ensureUser } from '@/lib/ensureUser'
import { eachDay, toLocalISODate } from '@/lib/date'
import { useName } from '@/lib/useName'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Icon from '../components/Icon'
import { conflictingDatesForOptions, densityForDay } from '@/lib/availability'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_LABELS = ['S','M','T','W','T','F','S']

function getRange(a: string, b: string): string[] {
  return eachDay(a, b)
}

function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', opts ?? { weekday: 'short', month: 'short', day: 'numeric' })
}

type DateRange = { start: string; end: string; days: string[]; category?: string | null }
type GroupBlackouts = Record<string, string[]>
type EventConflict = { id: string; title: string; conflictingDates: string[] }
type BlackoutRecord = { date: string; category?: string | null }

// Pull a usable message off any thrown value (Error, PostgrestError, plain
// object). Without this, errors that don't pass `instanceof Error` (which can
// happen for PostgrestError across realm/serialization boundaries) silently
// fall through to a generic notice and we lose the real cause.
function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error !== null) {
    const candidate = (error as { message?: unknown }).message
    if (typeof candidate === 'string' && candidate) return candidate
  }
  if (typeof error === 'string' && error) return error
  return fallback
}

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
  const todayISO = toLocalISODate(today)

  const [name] = useName()
  const [userId, setUserId] = useState<string | null>(null)
  const [blackouts, setBlackouts] = useState<Set<string>>(new Set())
  const [blackoutRecords, setBlackoutRecords] = useState<BlackoutRecord[]>([])
  const [statusNotice, setStatusNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [viewMode, setViewMode] = useState<'mine' | 'list' | 'group'>('mine')

  // Two ways to pick a range:
  //   1) Hit "Block range" → tap anchor day → tap end day. `rangeMode` carries it.
  //   2) Press and drag across days. `dragPreview` shows the live span.
  // A single tap (no drag, no rangeMode) just toggles that one day.
  const [rangeMode, setRangeMode] = useState(false)
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null)
  const [dragPreview, setDragPreview] = useState<Set<string>>(new Set())
  const dragRef = useRef<{ startIso: string; didDrag: boolean } | null>(null)
  const wasDragRef = useRef(false)

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

  const noticeTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!name) return
    setBlackouts(new Set())
    setBlackoutRecords([])
    setUserId(null)
    clearNotice()
    loadUser(name)
  }, [name])

  useEffect(() => {
    return () => {
      if (noticeTimer.current && typeof window !== 'undefined') {
        window.clearTimeout(noticeTimer.current)
      }
    }
  }, [])

  function clearNotice() {
    if (noticeTimer.current && typeof window !== 'undefined') {
      window.clearTimeout(noticeTimer.current)
      noticeTimer.current = null
    }
    setStatusNotice(null)
  }

  function showNotice(text: string, tone: 'success' | 'error') {
    if (noticeTimer.current && typeof window !== 'undefined') {
      window.clearTimeout(noticeTimer.current)
      noticeTimer.current = null
    }

    setStatusNotice({ tone, text })

    if (tone === 'success' && typeof window !== 'undefined') {
      noticeTimer.current = window.setTimeout(() => {
        setStatusNotice((current) => (current?.tone === 'success' ? null : current))
        noticeTimer.current = null
      }, 2200)
    }
  }

  useEffect(() => {
    if (viewMode === 'group') loadGroupBlackouts()
    if (viewMode === 'list' && userId) loadEventConflicts()
  }, [viewMode, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (viewMode === 'list' && userId) loadEventConflicts()
  }, [blackouts]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadUser(n: string) {
    try {
      const uid = await ensureUser(n)
      const { data, error } = await supabase.from('availability').select('date, category').eq('user_id', uid)
      if (error) throw error
      setUserId(uid)
      setBlackoutRecords(data ?? [])
      setBlackouts(new Set((data ?? []).map((r) => r.date)))
    } catch (error) {
      console.error('availability.loadUser', error)
      setUserId(null)
      setBlackoutRecords([])
      setBlackouts(new Set())
      showNotice(extractErrorMessage(error, 'Could not load your blocked dates.'), 'error')
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
    try {
      const { data: events, error: eventsError } = await supabase.from('events').select('id, title').eq('status', 'planning')
      if (eventsError) throw eventsError
      if (!events || events.length === 0) { setEventConflicts([]); return }
      const { data: options, error: optionsError } = await supabase
        .from('date_options').select('event_id, date, end_date')
        .in('event_id', events.map((e) => e.id))
      if (optionsError) throw optionsError
      const conflicts: EventConflict[] = []
      for (const ev of events) {
        const conflicting = conflictingDatesForOptions(
          (options ?? []).filter((o) => o.event_id === ev.id),
          blackouts,
          todayISO,
        )
        if (conflicting.length > 0) conflicts.push({ id: ev.id, title: ev.title, conflictingDates: conflicting.sort() })
      }
      setEventConflicts(conflicts)
    } catch (error) {
      setEventConflicts([])
      console.error('availability.loadEventConflicts', error)
      showNotice(extractErrorMessage(error, 'Could not refresh event conflicts.'), 'error')
    }
  }

  // Tap-tap range selection. Default mode: single tap toggles a day. When
  // `rangeAnchor` is set, the next tap completes a range (add if anchor was
  // unblocked, remove if anchor was already blocked).
  async function commitRangeAdd(days: string[]) {
    if (!userId) return
    const toAdd = days.filter((d) => !blackouts.has(d))
    if (!toAdd.length) return
    clearNotice()
    setPendingDays(toAdd)
    setPendingLabel('')
  }

  async function commitRangeRemove(days: string[]) {
    if (!userId) return
    const toRemove = days.filter((d) => blackouts.has(d))
    if (!toRemove.length) return
    clearNotice()
    const { error } = await supabase.from('availability').delete().eq('user_id', userId).in('date', toRemove)
    if (error) {
      showNotice(error.message || 'Could not remove those blocked dates.', 'error')
      return
    }
    const newBlackouts = new Set(blackouts)
    toRemove.forEach((d) => newBlackouts.delete(d))
    setBlackouts(newBlackouts)
    setBlackoutRecords((prev) => prev.filter((r) => !toRemove.includes(r.date)))
    showNotice(toRemove.length === 1 ? 'Date unblocked.' : `${toRemove.length} blocked dates removed.`, 'success')
  }

  async function handleCalendarTap(iso: string) {
    if (iso < todayISO || !userId) return
    // A drag just committed — swallow the synthetic click that follows pointerup.
    if (wasDragRef.current) return

    if (rangeMode) {
      if (!rangeAnchor) {
        setRangeAnchor(iso)
        return
      }
      const days = getRange(rangeAnchor, iso)
      const mode = blackouts.has(rangeAnchor) ? 'remove' : 'add'
      setRangeAnchor(null)
      setRangeMode(false)
      if (mode === 'add') await commitRangeAdd(days)
      else await commitRangeRemove(days)
      return
    }

    // Default mode — single-day toggle with no second tap required.
    if (blackouts.has(iso)) {
      await commitRangeRemove([iso])
    } else {
      await commitRangeAdd([iso])
    }
  }

  function clearRange() {
    setRangeAnchor(null)
    setRangeMode(false)
  }

  // ─── drag-to-select-range ────────────────────────────────────────────────
  function isoUnderPointer(clientX: number, clientY: number): string | null {
    const el = document.elementFromPoint(clientX, clientY)
    return el?.closest('[data-iso]')?.getAttribute('data-iso') ?? null
  }
  function onGridPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!userId) return
    const iso = isoUnderPointer(e.clientX, e.clientY)
    if (!iso || iso < todayISO) return
    dragRef.current = { startIso: iso, didDrag: false }
    setDragPreview(new Set([iso]))
  }
  function onGridPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return
    const iso = isoUnderPointer(e.clientX, e.clientY)
    if (!iso || iso < todayISO) return
    if (iso !== dragRef.current.startIso) dragRef.current.didDrag = true
    setDragPreview(new Set(getRange(dragRef.current.startIso, iso)))
  }
  async function onGridPointerUp() {
    if (!dragRef.current) return
    const { startIso, didDrag } = dragRef.current
    const days = [...dragPreview].sort()
    dragRef.current = null
    setDragPreview(new Set())
    if (!didDrag) return // single tap — onClick will run handleCalendarTap

    // Drag committed: derive add/remove from the anchor day's current state.
    wasDragRef.current = true
    setTimeout(() => { wasDragRef.current = false }, 0)
    setRangeAnchor(null)
    setRangeMode(false)
    const mode = blackouts.has(startIso) ? 'remove' : 'add'
    if (mode === 'add') await commitRangeAdd(days)
    else await commitRangeRemove(days)
  }
  function onGridPointerCancel() {
    dragRef.current = null
    setDragPreview(new Set())
  }

  async function saveWithCategory(category: string | null) {
    if (!pendingDays || !userId) return
    setSavingCategory(true)
    clearNotice()
    const { error } = await supabase.from('availability').insert(pendingDays.map((date) => ({ user_id: userId, date, category })))
    if (error) {
      setSavingCategory(false)
      showNotice(error.message || 'Could not save your blocked dates.', 'error')
      return
    }
    const newBlackouts = new Set(blackouts)
    pendingDays.forEach((d) => newBlackouts.add(d))
    setBlackouts(newBlackouts)
    setBlackoutRecords((prev) => [
      ...prev.filter((r) => !pendingDays.includes(r.date)),
      ...pendingDays.map((date) => ({ date, category })),
    ])
    setPendingDays(null)
    setSavingCategory(false)
    showNotice(pendingDays.length === 1 ? 'Date blocked.' : `${pendingDays.length} dates blocked.`, 'success')
  }

  async function removeRange(range: DateRange) {
    if (!userId) return
    setRemovingRange(range.start)
    clearNotice()
    const { error } = await supabase.from('availability').delete().eq('user_id', userId).in('date', range.days)
    if (error) {
      setRemovingRange(null)
      showNotice(error.message || 'Could not remove that blocked range.', 'error')
      return
    }
    const newBlackouts = new Set(blackouts)
    range.days.forEach((d) => newBlackouts.delete(d))
    setBlackouts(newBlackouts)
    setBlackoutRecords((prev) => prev.filter((r) => !range.days.includes(r.date)))
    setRemovingRange(null)
    showNotice(range.days.length === 1 ? 'Date unblocked.' : `${range.days.length} blocked dates removed.`, 'success')
  }

  async function clearAllFuture() {
    if (!userId) return
    setClearingAll(true)
    const futureDates = [...blackouts].filter((d) => d >= todayISO)
    if (futureDates.length) {
      clearNotice()
      const { error } = await supabase.from('availability').delete().eq('user_id', userId).in('date', futureDates)
      if (error) {
        setClearingAll(false)
        showNotice(error.message || 'Could not clear your future blocked dates.', 'error')
        return
      }
      const newBlackouts = new Set(blackouts)
      futureDates.forEach((d) => newBlackouts.delete(d))
      setBlackouts(newBlackouts)
      setBlackoutRecords((prev) => prev.filter((r) => r.date < todayISO))
      showNotice('Future blocked dates cleared.', 'success')
    }
    setClearingAll(false)
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
    <main className="max-w-md mx-auto px-5 no-select">
      <PageHeader
        variant="title"
        title="Availability"
        subtitle={
          viewMode === 'mine' ? 'Tap a day to block it. Use Block range for multi-day.'
          : viewMode === 'list' ? 'Review and manage your blocked dates.'
          : 'When the crew is collectively blocked.'
        }
      />

      {/* Label bottom sheet */}
      {pendingDays && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={() => saveWithCategory(null)} />
          <div
            className="relative w-full max-w-md bg-cream rounded-t-[28px] px-6 pt-6 shadow-[var(--shadow-raised)]"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
          >
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
            <button type="button"
              onClick={() => saveWithCategory(pendingLabel.trim() || null)}
              disabled={savingCategory}
              className="w-full bg-olive text-white rounded-xl py-3 text-sm font-bold mb-2 active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {savingCategory ? 'Saving…' : 'Save'}
            </button>
            <button type="button"
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
          <button type="button"
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

      {statusNotice && (
        <div
          className={[
            'mb-4 rounded-[18px] border px-4 py-3 text-sm font-medium',
            statusNotice.tone === 'success'
              ? 'border-olive/15 bg-olive/10 text-olive'
              : 'border-blush/20 bg-blush-soft text-blush',
          ].join(' ')}
        >
          {statusNotice.text}
        </div>
      )}

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
              </div>

              <Card padded={false} className="overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-ink text-cream">
                  <button type="button" onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition" aria-label="Previous month">
                    <Icon name="chevronLeft" size={16} />
                  </button>
                  <span className="font-semibold text-sm">{MONTH_NAMES[month]} {year}</span>
                  <button type="button" onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition" aria-label="Next month">
                    <Icon name="chevronRight" size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-7 bg-sand border-b border-sand-alt">
                  {DAY_LABELS.map((d, i) => (
                    <div key={i} className="text-center text-[10px] font-bold text-ink-mute py-2 uppercase tracking-wider">{d}</div>
                  ))}
                </div>
                <div
                  className="calendar-grid grid grid-cols-7 gap-0.5 p-3"
                  onPointerDown={onGridPointerDown}
                  onPointerMove={onGridPointerMove}
                  onPointerUp={onGridPointerUp}
                  onPointerCancel={onGridPointerCancel}
                  onPointerLeave={onGridPointerCancel}
                >
                  {cells.map((iso, i) => {
                    if (!iso) return <div key={`empty-${i}`} className="aspect-square" />
                    const isPast = iso < todayISO
                    const isBlocked = blackouts.has(iso)
                    const isAnchor = rangeAnchor === iso
                    const isInDrag = dragPreview.has(iso)
                    // Drag preview shape changes color depending on whether the
                    // anchor day is currently blocked (remove) or unblocked (add).
                    const dragMode = dragRef.current
                      ? blackouts.has(dragRef.current.startIso) ? 'remove' : 'add'
                      : null
                    const isToday = iso === todayISO
                    const day = parseInt(iso.split('-')[2])
                    const record = blackoutRecords.find((r) => r.date === iso)

                    return (
                      <button
                        key={iso}
                        type="button"
                        data-iso={iso}
                        disabled={isPast}
                        onClick={() => void handleCalendarTap(iso)}
                        className={[
                          'aspect-square flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-colors',
                          isPast ? 'text-ink-faint cursor-default' : 'cursor-pointer',
                          !isPast && isBlocked && !isInDrag ? 'bg-blush text-white' : '',
                          !isPast && !isBlocked && !isInDrag ? 'text-ink hover:bg-sand' : '',
                          !isPast && isInDrag && dragMode === 'add' ? 'bg-blush-soft text-blush font-semibold' : '',
                          !isPast && isInDrag && dragMode === 'remove' ? 'bg-stone text-ink-soft font-semibold' : '',
                          isAnchor && !isInDrag ? 'ring-2 ring-olive ring-offset-1 ring-offset-cream' : '',
                          isToday && !isBlocked && !isAnchor && !isInDrag ? 'ring-1 ring-olive' : '',
                        ].join(' ')}
                      >
                        <span className="leading-none">{day}</span>
                        {record?.category && isBlocked && !isInDrag && (
                          <span className="text-[8px] leading-none mt-0.5 opacity-70">●</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </Card>

              {/* Range-mode toggle / status row */}
              <div className="mt-3 flex items-center gap-2">
                {rangeMode ? (
                  <>
                    <span className="flex-1 truncate rounded-xl bg-olive-tint px-3 py-2 text-xs font-semibold text-olive">
                      {rangeAnchor
                        ? `Anchor ${formatDate(rangeAnchor, { month: 'short', day: 'numeric' })} — tap a second day to commit`
                        : 'Tap a day to anchor the range'}
                    </span>
                    <button
                      type="button"
                      onClick={clearRange}
                      className="rounded-xl bg-sand px-3 py-2 text-xs font-semibold text-ink-soft active:scale-95"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRangeMode(true)}
                    className="ml-auto rounded-xl bg-olive-tint px-3 py-2 text-xs font-semibold text-olive active:scale-95"
                  >
                    Block range
                  </button>
                )}
              </div>

              <p className="text-xs text-ink-mute text-center mt-3">
                Tap a day to block · tap a blocked day to unblock · drag (or use <span className="font-semibold text-olive">Block range</span>) for multi-day
              </p>
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
                  <button type="button"
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
                        <button type="button"
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
                  <button type="button" onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition" aria-label="Previous month">
                    <Icon name="chevronLeft" size={16} />
                  </button>
                  <span className="font-semibold text-sm">{MONTH_NAMES[month]} {year}</span>
                  <button type="button" onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition" aria-label="Next month">
                    <Icon name="chevronRight" size={16} />
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
                    <button type="button" onClick={() => setSelectedDate(null)} className="text-ink-faint hover:text-ink-soft" aria-label="Close">
                      <Icon name="x" size={16} />
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
