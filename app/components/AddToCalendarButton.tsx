'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  buildGoogleCalendarUrl,
  buildOutlookCalendarUrl,
  type CalendarLinkEvent,
} from '@/lib/calendarLinks'
import Icon from './Icon'

type Variant = 'onOlive' | 'inline'

const VARIANT_CLASSES: Record<Variant, string> = {
  onOlive: 'inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white hover:bg-white/25 active:scale-[0.98] transition-all',
  inline: 'inline-flex items-center gap-1.5 rounded-full bg-olive-tint px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-olive hover:bg-olive hover:text-white active:scale-[0.98] transition-all',
}

type Props = {
  eventId: string
  variant?: Variant
  event?: CalendarLinkEvent | null
  label?: string
}

export default function AddToCalendarButton({
  eventId,
  variant = 'inline',
  event: providedEvent,
  label = 'Add to calendar',
}: Props) {
  const [open, setOpen] = useState(false)
  const [event, setEvent] = useState<CalendarLinkEvent | null>(providedEvent ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (providedEvent) setEvent(providedEvent)
  }, [providedEvent])

  useEffect(() => {
    if (!open || event || loading) return
    let cancelled = false
    setLoading(true)
    setError(null)
    supabase
      .from('events')
      .select('id, title, description, confirmed_date, confirmed_end_date, location_name, location_address, location_notes, event_notes, start_time, end_time, length_days')
      .eq('id', eventId)
      .maybeSingle()
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        if (fetchError) {
          setError('Could not load event details.')
        } else if (data) {
          setEvent(data as CalendarLinkEvent)
        } else {
          setError('Event not found.')
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, event, loading, eventId])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={VARIANT_CLASSES[variant]}
        aria-label={label}
      >
        <Icon name="calendar" size={14} />
        {label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]"
          />
          <section
            className="relative w-full max-w-sm rounded-t-[28px] bg-cream p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-raised)] sm:rounded-[24px] sm:pb-5"
            role="dialog"
            aria-label="Add to calendar"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-mute">
                Add to calendar
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-ink-faint transition-colors hover:text-ink-soft"
                aria-label="Close"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            {loading ? (
              <p className="px-1 py-4 text-sm text-ink-soft">Loading event…</p>
            ) : error ? (
              <p className="px-1 py-4 text-sm text-blush">{error}</p>
            ) : !event ? null : (
              <div className="flex flex-col gap-2">
                <CalendarOption
                  href={`/api/events/${eventId}/ics`}
                  label="Apple Calendar / Download .ics"
                  hint="Works on iPhone, Mac, and most calendar apps"
                  onSelect={() => setOpen(false)}
                />
                <CalendarOption
                  href={buildGoogleCalendarUrl(event)}
                  label="Google Calendar"
                  hint="Opens a pre-filled event in your browser"
                  external
                  onSelect={() => setOpen(false)}
                />
                <CalendarOption
                  href={buildOutlookCalendarUrl(event)}
                  label="Outlook"
                  hint="Opens outlook.com pre-filled"
                  external
                  onSelect={() => setOpen(false)}
                />
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  )
}

function CalendarOption({
  href,
  label,
  hint,
  external,
  onSelect,
}: {
  href: string
  label: string
  hint: string
  external?: boolean
  onSelect: () => void
}) {
  return (
    <a
      href={href}
      onClick={onSelect}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="flex items-center gap-3 rounded-[16px] bg-sand px-3 py-3 transition-colors hover:bg-olive-tint active:scale-[0.99]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-olive-tint text-olive">
        <Icon name="calendar" size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-4 text-ink-soft">{hint}</span>
      </span>
      <Icon name="chevronRight" size={14} className="text-ink-faint" />
    </a>
  )
}
