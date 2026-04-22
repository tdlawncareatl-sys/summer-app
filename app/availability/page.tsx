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

// Group view: map of date -> list of blocked friend names
type GroupBlackouts = Record<string, string[]>

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

  // Group view state
  const [viewMode, setViewMode] = useState<'mine' | 'group'>('mine')
  const [groupBlackouts, setGroupBlackouts] = useState<GroupBlackouts>({})
  const [groupLoading, setGroupLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const drag = useRef<{ mode: 'add' | 'remove'; start: string } | null>(null)

  useEffect(() => {
    if (!name) return
    setBlackouts(new Set())
    setUserId(null)
    loadUser(name)
  }, [name])

  useEffect(() => {
    if (viewMode === 'group') {
      loadGroupBlackouts()
    }
  }, [viewMode])

  async function loadUser(n: string) {
    const uid = await ensureUser(n)
    setUserId(uid)
    const { data } = await supabase.from('availability').select('date').eq('user_id', uid)
    if (data) setBlackouts(new Set(data.map((r) => r.date)))
  }

  async function loadGroupBlackouts() {
    setGroupLoading(true)
    // Get all users
    const { data: users } = await supabase.from('users').select('id, name')
    if (!users) { setGroupLoading(false); return }

    // Get all availability rows
    const { data: avail } = await supabase.from('availability').select('user_id, date')
    if (!avail) { setGroupLoading(false); return }

    const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]))
    const result: GroupBlackouts = {}

    for (const row of avail) {
      const friendName = userMap[row.user_id]
      if (!friendName) continue
      if (!result[row.date]) result[row.date] = []
      result[row.date].push(friendName)
    }

    setGroupBlackouts(result)
    setGroupLoading(false)
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
      drag.current = null
      setPreviewDays(new Set())
      return
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
    if (month === 0) { setMonth(11); setYear((y) => y - 1) }
    else setMonth((m) => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1) }
    else setMonth((m) => m + 1)
  }

  // Group view color logic
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

  return (
    <main
      className="min-h-screen bg-gray-50 p-5 max-w-md mx-auto select-none"
      onMouseUp={viewMode === 'mine' ? commitDrag : undefined}
      onMouseLeave={viewMode === 'mine' ? commitDrag : undefined}
    >
      <a href="/" className="text-sm text-gray-400 mb-5 block hover:text-gray-600 transition-colors">← Back</a>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Availability</h1>
      <p className="text-sm text-gray-500 mb-5">
        {viewMode === 'mine'
          ? <>Block dates you <span className="font-semibold text-red-500">can&apos;t</span> make it. Drag to select a range.</>
          : 'See when everyone is blocked.'}
      </p>

      {/* Toggle */}
      <div className="flex bg-gray-200 rounded-xl p-1 mb-5 gap-1">
        <button
          onClick={() => { setViewMode('mine'); setSelectedDate(null) }}
          className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all ${
            viewMode === 'mine' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >My Schedule</button>
        <button
          onClick={() => { setViewMode('group'); setSelectedDate(null) }}
          className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all ${
            viewMode === 'group' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >Group View</button>
      </div>

      {/* ── MY SCHEDULE ── */}
      {viewMode === 'mine' && (
        <>
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

      {/* ── GROUP VIEW ── */}
      {viewMode === 'group' && (
        <div>
          {groupLoading && <p className="text-sm text-gray-400 text-center py-8">Loading group availability...</p>}

          {!groupLoading && (
            <>
              {/* Legend */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className="w-4 h-4 rounded bg-gray-100 border border-gray-200" />
                  <span>Free</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-200" />
                  <span>Few blocked</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className="w-4 h-4 rounded bg-yellow-300" />
                  <span>Some blocked</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className="w-4 h-4 rounded bg-red-400" />
                  <span>Many blocked</span>
                </div>
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
                    const isToday = iso === todayISO
                    const blockedCount = groupBlackouts[iso]?.length ?? 0
                    const day = parseInt(iso.split('-')[2])
                    const colorClass = isPast ? 'bg-gray-50 text-gray-200' : groupCellColor(iso)
                    const isSelected = selectedDate === iso

                    return (
                      <div
                        key={iso}
                        onClick={() => {
                          if (!isPast) setSelectedDate(selectedDate === iso ? null : iso)
                        }}
                        className={[
                          'aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-all',
                          isPast ? 'cursor-default' : 'cursor-pointer hover:opacity-80',
                          colorClass,
                          isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : '',
                          isToday && !isSelected ? 'ring-2 ring-blue-400 ring-offset-1' : '',
                        ].join(' ')}
                      >
                        <span className="font-semibold leading-none">{day}</span>
                        {blockedCount > 0 && !isPast && (
                          <span className="text-[9px] leading-none mt-0.5 opacity-80">{blockedCount}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Selected date detail panel */}
              {selectedDate && (
                <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 animate-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold text-gray-900 text-sm">
                      {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                    <button onClick={() => setSelectedDate(null)} className="text-gray-300 hover:text-gray-500 text-lg leading-none transition-colors">×</button>
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
    </main>
  )
}
