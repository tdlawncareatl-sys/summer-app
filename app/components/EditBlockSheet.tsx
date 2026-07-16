'use client'

// Bottom sheet for editing one blocked range from the My Blocks list —
// move/shrink/expand its dates, rename its label, or remove it.
//
// Pure selection UI, same contract as SchoolScheduleSheet: the Availability
// page owns the Supabase writes and passes them in as onSave / onRemove.

import { useState } from 'react'
import { eachDay } from '@/lib/date'

export type EditableBlock = {
  start: string
  end: string
  days: string[]
  category?: string | null
}

export type BlockUpdate = {
  start: string
  end: string
  category: string | null
}

type Props = {
  block: EditableBlock
  todayISO: string
  onSave: (update: BlockUpdate) => Promise<void>
  onRemove: () => Promise<void>
  onClose: () => void
}

function formatLong(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function EditBlockSheet({ block, todayISO, onSave, onRemove, onClose }: Props) {
  const [start, setStart] = useState(block.start)
  const [end, setEnd] = useState(block.end)
  const [label, setLabel] = useState(block.category ?? '')
  const [busy, setBusy] = useState(false)

  const reversed = end < start
  const futureDays = reversed ? [] : eachDay(start, end).filter((d) => d >= todayISO)
  const unchanged = start === block.start && end === block.end && (label.trim() || null) === (block.category ?? null)
  const canSave = !reversed && futureDays.length > 0 && !unchanged

  async function save() {
    if (!canSave || busy) return
    setBusy(true)
    try {
      await onSave({ start, end, category: label.trim() || null })
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (busy) return
    setBusy(true)
    try {
      await onRemove()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md bg-cream rounded-t-[28px] px-6 pt-6 shadow-[var(--shadow-raised)]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
      >
        <div className="w-10 h-1 bg-stone rounded-full mx-auto mb-5" />
        <p className="font-serif text-xl font-black text-ink">Edit block</p>
        <p className="text-sm text-ink-soft mt-0.5 mb-4">
          {formatLong(block.start)}
          {block.start !== block.end ? ` – ${formatLong(block.end)}` : ''}
        </p>

        <label className="block text-xs font-bold text-ink-mute uppercase tracking-wider mb-1.5">Label</label>
        <input
          type="text"
          placeholder="e.g. Beach trip, Work travel, Family"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full bg-sand border-0 rounded-xl px-4 py-3 text-sm text-ink mb-4 focus:outline-none focus:ring-2 focus:ring-olive transition"
        />

        <div className="flex gap-3 mb-2">
          <div className="flex-1">
            <label htmlFor="edit-block-start" className="block text-xs font-bold text-ink-mute uppercase tracking-wider mb-1.5">
              First day
            </label>
            <input
              id="edit-block-start"
              type="date"
              value={start}
              min={todayISO}
              onChange={(e) => setStart(e.target.value)}
              className="w-full bg-sand border-0 rounded-xl px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive transition"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="edit-block-end" className="block text-xs font-bold text-ink-mute uppercase tracking-wider mb-1.5">
              Last day
            </label>
            <input
              id="edit-block-end"
              type="date"
              value={end}
              min={start > todayISO ? start : todayISO}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full bg-sand border-0 rounded-xl px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive transition"
            />
          </div>
        </div>

        <p className="text-xs text-ink-mute mb-4">
          {reversed
            ? 'The last day is before the first day.'
            : futureDays.length === 0
              ? 'Those dates are all in the past.'
              : `Blocks ${futureDays.length} day${futureDays.length !== 1 ? 's' : ''}`}
        </p>

        <button
          type="button"
          onClick={save}
          disabled={busy || !canSave}
          className="w-full bg-olive text-white rounded-xl py-3 text-sm font-bold mb-2 active:scale-[0.98] transition-all disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="w-full text-sm font-semibold text-blush py-2 transition-colors disabled:opacity-40"
        >
          Remove block
        </button>
      </div>
    </div>
  )
}
