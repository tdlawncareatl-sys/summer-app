'use client'

// Calendar / Plans — month view + upcoming events + this-week strip.
//  1. Serif "Calendar" header (with month nav)
//  2. Month grid; each day renders colored dots for events/blackouts
//  3. Legend
//  4. Upcoming events list (confirmed + voting, chronological)
//  5. This week availability strip

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useName } from '@/lib/useName'
import { loadPlanData, PlanData, formatDateRangeShort, todayISO } from '@/lib/planData'
import { categoryFor } from '@/lib/categories'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import StatusChip from '../components/StatusChip'
import IconTile from '../components/IconTile'
import { AvatarStack } from '../components/Avatar'
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons'

type DayMeta = {
  confirmed: string[]   // event ids
  voting: string[]      // event ids
  blockedCount: number
}

export default function CalendarPage() {
  const [name] = useName()
  const [data, setData] = useState<PlanData | null>(null)
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() } // 0-indexed
  })

  useEffect(() => {
    let alive = true
    loadPlanData(name || null).then((d) => { if (alive) setData(d) })
    return () => { alive = false }
  }, [name])

  // Build per-day metadata for any date we might render
  const dayMap = useMemo<Record<string, DayMeta>>(() => {
    if (!data) return {}
    const map: Record<string, DayMeta> = {}
    const touch = (iso: string): DayMeta => (map[iso] ??= { confirmed: [], voting: [], blockedCount: 0 })

    for (const ev of data.events) {
      if (!ev.topDate) continue
      const days = daysBetween(ev.topDate, ev.topEndDate)
      for (const d of days) {
        const m = touch(d)
        if (ev.displayStatus === 'confirmed') m.confirmed.push(ev.id)
        else if (ev.displayStatus === 'voting') m.voting.push(ev.id)
      }
    }
    for (const [d, names] of Object.entries(data.blackoutsByDate)) {
      touch(d).blockedCount = names.length
    }
    return map
  }, [data])

  const monthName = new Date(cursor.year, cursor.month, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })

  const upcoming = (data?.events ?? [])
    .filter((e) => e.topDate && e.topDate >= todayISO())
    .sort((a, b) => (a.topDate ?? '').localeCompare(b.topDate ?? ''))
    .slice(0, 5)

  return (
    <main className="max-w-md mx-auto px-5">
      <PageHeader variant="title" title="Calendar" subtitle="See the whole summer at a glance" />

      {/* Month nav */}
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCursor(shiftMonth(cursor, -1))}
            className="w-9 h-9 rounded-full bg-sand hover:bg-stone transition-colors flex items-center justify-center text-ink-soft"
            aria-label="Previous month"
          >
            <ChevronLeftIcon size={18} />
          </button>
          <h2 className="font-serif text-xl font-black text-ink">{monthName}</h2>
          <button
            onClick={() => setCursor(shiftMonth(cursor, 1))}
            className="w-9 h-9 rounded-full bg-sand hover:bg-stone transition-colors flex items-center justify-center text-ink-soft"
            aria-label="Next month"
          >
            <ChevronRightIcon size={18} />
          </button>
        </div>

        {/* Week header */}
        <div className="grid grid-cols-7 gap-1 text-[10px] font-bold text-ink-mute uppercase tracking-wider text-center">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>

        {/* Day grid */}
        <MonthGrid year={cursor.year} month={cursor.month} dayMap={dayMap} />

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-ink-soft pt-1">
          <LegendDot color="bg-olive" label="Confirmed" />
          <LegendDot color="bg-terracotta" label="Voting" />
          <LegendDot color="bg-blush" label="Blocked" />
          <LegendDot color="bg-stone" label="Today" outline />
        </div>
      </Card>

      {/* Upcoming events */}
      <section className="mt-6">
        <h2 className="font-serif text-2xl font-black text-ink tracking-tight mb-3">Upcoming</h2>
        {upcoming.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-soft">Nothing on the books yet. Head to <Link href="/events" className="text-olive font-semibold">Events</Link> to propose one.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2.5">
            {upcoming.map((ev) => {
              const cat = categoryFor(ev.title)
              return (
                <Link key={ev.id} href={`/events/${ev.id}`}>
                  <Card className="flex items-center gap-3">
                    <IconTile Icon={cat.Icon} tint={cat.tint} size={48} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <StatusChip status={ev.displayStatus} size="xs" />
                      </div>
                      <p className="font-semibold text-ink truncate">{ev.title}</p>
                      <p className="text-xs text-ink-soft mt-0.5 truncate">
                        {ev.topDate ? formatDateRangeShort(ev.topDate, ev.topEndDate) : 'TBD'}
                      </p>
                    </div>
                    <AvatarStack names={ev.participantNames} max={3} size={22} />
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {!data && (
        <div className="mt-6 h-32 bg-cream rounded-[var(--radius-lg)] animate-pulse" />
      )}
    </main>
  )
}

/* ─────────────────────────────────────────────────────────────── */

function MonthGrid({
  year, month, dayMap,
}: { year: number; month: number; dayMap: Record<string, DayMeta> }) {
  const first = new Date(year, month, 1)
  const startWeekday = first.getDay() // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Pad leading blanks
  const cells: (string | null)[] = Array.from({ length: startWeekday }, () => null)
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push(iso)
  }
  // Pad trailing to complete the last row
  while (cells.length % 7 !== 0) cells.push(null)

  const today = todayISO()

  return (
    <div className="grid grid-cols-7 gap-1">
      {cells.map((iso, i) => {
        if (!iso) return <div key={i} className="aspect-square" />
        const meta = dayMap[iso]
        const isToday = iso === today
        const isPast = iso < today
        const day = Number(iso.slice(8, 10))
        return (
          <div
            key={iso}
            className={[
              'aspect-square rounded-xl flex flex-col items-center justify-center relative',
              isToday ? 'bg-olive-tint ring-1 ring-olive' : 'bg-sand-alt',
              isPast ? 'opacity-45' : '',
            ].join(' ')}
          >
            <span className={`text-sm font-semibold ${isToday ? 'text-olive' : 'text-ink'}`}>{day}</span>
            {meta && (meta.confirmed.length + meta.voting.length + (meta.blockedCount > 0 ? 1 : 0) > 0) && (
              <div className="flex gap-0.5 absolute bottom-1.5">
                {meta.confirmed.length > 0 && <span className="w-1 h-1 rounded-full bg-olive" />}
                {meta.voting.length > 0 && <span className="w-1 h-1 rounded-full bg-terracotta" />}
                {meta.blockedCount > 0 && <span className="w-1 h-1 rounded-full bg-blush" />}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function LegendDot({ color, label, outline }: { color: string; label: string; outline?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${color} ${outline ? 'ring-1 ring-olive bg-olive-tint' : ''}`} />
      {label}
    </span>
  )
}

function shiftMonth(c: { year: number; month: number }, delta: number) {
  const d = new Date(c.year, c.month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

function daysBetween(start: string, end: string | null | undefined): string[] {
  if (!end || end === start) return [start]
  const out: string[] = []
  const cur = new Date(start + 'T12:00:00')
  const stop = new Date(end + 'T12:00:00')
  while (cur <= stop) {
    out.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }
  return out
}
