'use client'

// Bottom sheet for importing a college semester schedule as blackout dates.
//
// Three steps:
//   1. school  — pick which college you're at
//   2. mode    — living away at school, or local/commuting?
//   3. review  — the away/home timeline as a toggleable range list; confirm
//
// The sheet is pure selection UI. Persistence stays on the Availability page
// (the page owns the Supabase writes and the blackout state), passed in via
// `onApply` / `onClear`.

import { useMemo, useState } from 'react'
import Icon from './Icon'
import {
  SCHOOLS,
  School,
  ScheduleSegment,
  expandBlockedDays,
  localFinalsSchedule,
  schoolYearSchedule,
} from '@/lib/schoolCalendars'

type Mode = 'away' | 'local'
type Step = 'school' | 'mode' | 'review'

type Props = {
  todayISO: string
  // Days that will still be blocked after old school rows are replaced —
  // i.e. manually-entered blackouts. Used to avoid duplicate inserts.
  nonSchoolBlocked: Set<string>
  hasSchoolBlocks: boolean
  onApply: (school: School, days: string[]) => Promise<void>
  onClear: () => Promise<void>
  onClose: () => void
}

function formatShort(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function segmentDayCount(segment: ScheduleSegment): number {
  const ms = new Date(segment.end + 'T12:00:00').getTime() - new Date(segment.start + 'T12:00:00').getTime()
  return Math.round(ms / 86400000) + 1
}

export default function SchoolScheduleSheet({
  todayISO,
  nonSchoolBlocked,
  hasSchoolBlocks,
  onApply,
  onClear,
  onClose,
}: Props) {
  const [step, setStep] = useState<Step>('school')
  const [school, setSchool] = useState<School | null>(null)
  const [mode, setMode] = useState<Mode>('away')
  const [disabledSegments, setDisabledSegments] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)

  const schedule = useMemo(() => {
    if (!school) return null
    return mode === 'away' ? schoolYearSchedule(school) : localFinalsSchedule(school)
  }, [school, mode])

  const enabledIndexes = useMemo(() => {
    if (!schedule) return new Set<number>()
    return new Set(schedule.segments.map((_, i) => i).filter((i) => !disabledSegments.has(i)))
  }, [schedule, disabledSegments])

  const daysToBlock = useMemo(() => {
    if (!schedule) return []
    return expandBlockedDays(schedule.segments, enabledIndexes, todayISO, nonSchoolBlocked)
  }, [schedule, enabledIndexes, todayISO, nonSchoolBlocked])

  function pickSchool(s: School) {
    setSchool(s)
    setDisabledSegments(new Set())
    setStep('mode')
  }

  function pickMode(m: Mode) {
    setMode(m)
    setDisabledSegments(new Set())
    setStep('review')
  }

  function toggleSegment(i: number) {
    setDisabledSegments((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  async function save() {
    if (!school || busy) return
    setBusy(true)
    try {
      await onApply(school, daysToBlock)
    } finally {
      setBusy(false)
    }
  }

  async function clearSchool() {
    if (busy) return
    setBusy(true)
    try {
      await onClear()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md bg-cream rounded-t-[28px] px-6 pt-6 shadow-[var(--shadow-raised)] max-h-[85vh] overflow-y-auto"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
      >
        <div className="w-10 h-1 bg-stone rounded-full mx-auto mb-5" />

        {/* ── STEP 1 — pick school ── */}
        {step === 'school' && (
          <>
            <p className="font-serif text-xl font-black text-ink">School schedule</p>
            <p className="text-sm text-ink-soft mt-0.5 mb-4">
              Pick your college and we&apos;ll block the semester for you — breaks and holidays stay free.
            </p>
            <div className="flex flex-col gap-2 mb-4">
              {SCHOOLS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickSchool(s)}
                  className="flex items-center justify-between bg-sand rounded-xl px-4 py-3 text-left hover:bg-sand-alt active:scale-[0.99] transition"
                >
                  <span>
                    <span className="block text-sm font-semibold text-ink">{s.name}</span>
                    <span className="block text-xs text-ink-mute mt-0.5">{s.city}</span>
                  </span>
                  <Icon name="chevronRight" size={16} />
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-mute mb-2">
              School not listed? Block your semester by hand with <span className="font-semibold">Block range</span> —
              or ask Tad to add it.
            </p>
            {hasSchoolBlocks && (
              <button
                type="button"
                onClick={clearSchool}
                disabled={busy}
                className="w-full text-sm font-semibold text-blush py-2 transition-colors disabled:opacity-40"
              >
                {busy ? 'Removing…' : 'Remove my current school blocks'}
              </button>
            )}
          </>
        )}

        {/* ── STEP 2 — away or local ── */}
        {step === 'mode' && school && (
          <>
            <button type="button" onClick={() => setStep('school')} className="flex items-center gap-1 text-xs font-semibold text-ink-soft mb-3">
              <Icon name="chevronLeft" size={14} /> {school.short}
            </button>
            <p className="font-serif text-xl font-black text-ink">Where do you live during the semester?</p>
            <p className="text-sm text-ink-soft mt-0.5 mb-4">This decides how much of the semester gets blocked.</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => pickMode('away')}
                className="bg-sand rounded-xl px-4 py-3 text-left hover:bg-sand-alt active:scale-[0.99] transition"
              >
                <span className="block text-sm font-semibold text-ink">Away at school</span>
                <span className="block text-xs text-ink-mute mt-0.5">
                  Blocks the whole semester. Breaks, holidays, and summer stay free.
                </span>
              </button>
              <button
                type="button"
                onClick={() => pickMode('local')}
                className="bg-sand rounded-xl px-4 py-3 text-left hover:bg-sand-alt active:scale-[0.99] transition"
              >
                <span className="block text-sm font-semibold text-ink">Local / commuting</span>
                <span className="block text-xs text-ink-mute mt-0.5">
                  You&apos;re around all semester — only finals weeks are offered as blocks.
                </span>
              </button>
            </div>
          </>
        )}

        {/* ── STEP 3 — review ── */}
        {step === 'review' && school && schedule && (
          <>
            <button type="button" onClick={() => setStep('mode')} className="flex items-center gap-1 text-xs font-semibold text-ink-soft mb-3">
              <Icon name="chevronLeft" size={14} /> {school.short} · {mode === 'away' ? 'Away at school' : 'Local'}
            </button>
            <p className="font-serif text-xl font-black text-ink">Does this look right?</p>
            <p className="text-sm text-ink-soft mt-0.5 mb-4">
              Tap a blocked stretch to skip it. You can fine-tune single days on the calendar afterwards.
            </p>

            <div className="flex flex-col gap-2 mb-4">
              {schedule.segments.map((segment, i) => {
                const away = segment.kind === 'away'
                const enabled = away && !disabledSegments.has(i)
                const rangeLabel =
                  segment.start === segment.end
                    ? formatShort(segment.start)
                    : `${formatShort(segment.start)} – ${formatShort(segment.end)}`
                return (
                  <button
                    key={`${segment.start}-${i}`}
                    type="button"
                    disabled={!away}
                    onClick={() => toggleSegment(i)}
                    className={[
                      'flex items-center justify-between rounded-xl px-4 py-3 text-left transition',
                      away
                        ? enabled
                          ? 'bg-blush-tint hover:bg-blush-soft active:scale-[0.99]'
                          : 'bg-sand opacity-60 hover:opacity-80 active:scale-[0.99]'
                        : 'bg-olive-tint cursor-default',
                    ].join(' ')}
                  >
                    <span className="min-w-0">
                      <span className={`block text-sm font-semibold ${away ? (enabled ? 'text-blush' : 'text-ink-soft') : 'text-olive'}`}>
                        {segment.label}
                      </span>
                      <span className="block text-xs text-ink-mute mt-0.5">
                        {rangeLabel} · {segmentDayCount(segment)} days · {segment.termName}
                      </span>
                    </span>
                    <span className={`text-xs font-bold shrink-0 ml-3 ${away ? (enabled ? 'text-blush' : 'text-ink-faint') : 'text-olive'}`}>
                      {away ? (enabled ? 'Blocked' : 'Skipped') : 'Home · free'}
                    </span>
                  </button>
                )
              })}
              <div className="flex items-center justify-between rounded-xl px-4 py-3 bg-olive-tint">
                <span className="text-sm font-semibold text-olive">Home for summer</span>
                <span className="text-xs font-bold text-olive">from {formatShort(schedule.summerFrom)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={save}
              disabled={busy || daysToBlock.length === 0}
              className="w-full bg-olive text-white rounded-xl py-3 text-sm font-bold mb-2 active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {busy ? 'Saving…' : `Block ${daysToBlock.length} days`}
            </button>
            <p className="text-xs text-ink-mute text-center mb-1">
              {daysToBlock.length === 0
                ? 'Nothing new to block — every stretch is skipped, past, or already blocked.'
                : 'Replaces any earlier school-schedule blocks. Manual blocks are untouched.'}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
