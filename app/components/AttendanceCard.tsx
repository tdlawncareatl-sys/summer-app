'use client'

// Post-confirmation attendance. Voting on date options answers "which dates
// work for me." This card answers "am I actually coming." Scoped to the
// event, not the date — survives date changes and unconfirm/reconfirm.

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ensureUser } from '@/lib/ensureUser'
import type { Participant } from '@/lib/availability'
import Card from './Card'
import Avatar from './Avatar'
import Icon from './Icon'

export type AttendanceStatus = 'going' | 'not_going'

type AttendanceRow = {
  event_id: string
  user_id: string
  status: AttendanceStatus
}

export default function AttendanceCard({
  eventId,
  participants,
  currentUserName,
}: {
  eventId: string
  participants: Participant[]
  currentUserName: string | null
}) {
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    void loadAttendance()
  }, [eventId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!currentUserName) {
      setCurrentUserId(null)
      return
    }
    const match = participants.find((p) => p.name === currentUserName)
    if (match) setCurrentUserId(match.id)
  }, [currentUserName, participants])

  async function loadAttendance() {
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from('attendance')
      .select('event_id, user_id, status')
      .eq('event_id', eventId)
    if (loadError) {
      setError(loadError.message)
    } else {
      setRows((data ?? []) as AttendanceRow[])
      setError(null)
    }
    setLoading(false)
  }

  async function setStatus(next: AttendanceStatus) {
    if (!currentUserName || saving) return
    setSaving(true)
    setError(null)

    let userId = currentUserId
    if (!userId) {
      try {
        userId = await ensureUser(currentUserName)
        setCurrentUserId(userId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not identify you.')
        setSaving(false)
        return
      }
    }

    const previous = rows
    setRows((current) => {
      const next_rows = current.filter((r) => r.user_id !== userId)
      next_rows.push({ event_id: eventId, user_id: userId!, status: next })
      return next_rows
    })

    const { error: upsertError } = await supabase
      .from('attendance')
      .upsert(
        { event_id: eventId, user_id: userId, status: next, updated_at: new Date().toISOString() },
        { onConflict: 'event_id,user_id' },
      )

    if (upsertError) {
      setRows(previous)
      setError(upsertError.message)
    }
    setSaving(false)
  }

  const byUserId = new Map(rows.map((row) => [row.user_id, row.status]))
  const going: Participant[] = []
  const notGoing: Participant[] = []
  const waiting: Participant[] = []
  for (const p of participants) {
    const status = byUserId.get(p.id)
    if (status === 'going') going.push(p)
    else if (status === 'not_going') notGoing.push(p)
    else waiting.push(p)
  }

  const myStatus = currentUserId ? byUserId.get(currentUserId) ?? null : null

  return (
    <Card className="mb-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-mute">Attendance</p>
        {!loading && participants.length > 0 ? (
          <p className="text-xs font-semibold text-ink-soft">
            {going.length} going{waiting.length > 0 ? ` · ${waiting.length} waiting` : ''}
          </p>
        ) : null}
      </div>

      {currentUserName ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void setStatus('going')}
            disabled={saving}
            aria-pressed={myStatus === 'going'}
            className={[
              'rounded-[16px] px-3 py-3 text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50',
              myStatus === 'going'
                ? 'bg-sage text-white shadow-[var(--shadow-soft)]'
                : 'bg-sage-tint text-sage hover:bg-sage-soft',
            ].join(' ')}
          >
            <span className="inline-flex items-center gap-2">
              <Icon name="check" size={14} />
              I&apos;m going
            </span>
          </button>
          <button
            type="button"
            onClick={() => void setStatus('not_going')}
            disabled={saving}
            aria-pressed={myStatus === 'not_going'}
            className={[
              'rounded-[16px] px-3 py-3 text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50',
              myStatus === 'not_going'
                ? 'bg-blush text-white shadow-[var(--shadow-soft)]'
                : 'bg-blush-tint text-blush hover:bg-blush-soft',
            ].join(' ')}
          >
            <span className="inline-flex items-center gap-2">
              <Icon name="x" size={14} />
              Can&apos;t make it
            </span>
          </button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-soft">Sign in to mark whether you&apos;re going.</p>
      )}

      {error ? (
        <p className="mt-2 text-xs font-semibold text-blush">{error}</p>
      ) : null}

      {!loading && participants.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3">
          {going.length > 0 ? (
            <RosterRow label="Going" tone="sage" people={going} />
          ) : null}
          {notGoing.length > 0 ? (
            <RosterRow label="Not going" tone="blush" people={notGoing} />
          ) : null}
          {waiting.length > 0 ? (
            <RosterRow label="Waiting on" tone="muted" people={waiting} />
          ) : null}
        </div>
      ) : null}
    </Card>
  )
}

function RosterRow({
  label,
  tone,
  people,
}: {
  label: string
  tone: 'sage' | 'blush' | 'muted'
  people: Participant[]
}) {
  const labelClass =
    tone === 'sage' ? 'text-sage' : tone === 'blush' ? 'text-blush' : 'text-ink-mute'
  return (
    <div>
      <p className={`text-[11px] font-bold uppercase tracking-[0.14em] ${labelClass}`}>
        {label} · {people.length}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {people.map((p) => (
          <div key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-sand py-1 pl-1 pr-2.5">
            <Avatar name={p.name} size={22} />
            <span className="text-xs font-semibold text-ink-soft">{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
