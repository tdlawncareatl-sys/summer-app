'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth'
import {
  fetchNotifications,
  markNotificationsRead,
  syncAllNotifications,
  type NotificationItem,
  type NotificationTone,
} from '@/lib/notifications'
import { BellIcon, CalendarIcon, CheckIcon, LightbulbIcon, StarIcon, XIcon } from './icons'

const TONE_STYLES: Record<NotificationTone, { badge: string; icon: string }> = {
  olive: {
    badge: 'bg-olive text-white',
    icon: 'bg-olive-tint text-olive',
  },
  terracotta: {
    badge: 'bg-terracotta text-white',
    icon: 'bg-terracotta-tint text-terracotta',
  },
  amber: {
    badge: 'bg-amber text-white',
    icon: 'bg-amber-tint text-amber',
  },
}

const BOOTSTRAP_PREFIX = 'summer-app-notifications-bootstrapped'

function iconFor(item: NotificationItem) {
  if (item.type === 'event_confirmed') return CheckIcon
  if (item.type === 'event_reminder') return CalendarIcon
  if (item.type === 'vote_needed') return StarIcon
  return LightbulbIcon
}

function formatWhen(iso: string) {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const diff = Date.now() - then
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function NotificationsBell() {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const loadItems = useCallback(async (allowBootstrap: boolean) => {
    if (!profile) return

    setLoading(true)
    setError(null)

    try {
      let nextItems = await fetchNotifications(profile.id)

      if (
        allowBootstrap
        && typeof window !== 'undefined'
        && nextItems.length === 0
        && !localStorage.getItem(`${BOOTSTRAP_PREFIX}:${profile.id}`)
      ) {
        await syncAllNotifications()
        localStorage.setItem(`${BOOTSTRAP_PREFIX}:${profile.id}`, '1')
        nextItems = await fetchNotifications(profile.id)
      }

      if (!mounted.current) return
      setItems(nextItems)
    } catch (nextError) {
      if (!mounted.current) return
      setError(nextError instanceof Error ? nextError.message : 'Could not load notifications.')
    } finally {
      if (!mounted.current) return
      setLoading(false)
    }
  }, [profile])

  useEffect(() => {
    if (!profile) return
    void loadItems(true)

    function handleChange() {
      void loadItems(false)
    }

    window.addEventListener('summer-notifications-changed', handleChange)
    return () => {
      window.removeEventListener('summer-notifications-changed', handleChange)
    }
  }, [profile, loadItems])

  useEffect(() => {
    if (!open || !profile) return
    void loadItems(false)
  }, [open, profile, loadItems])

  useEffect(() => {
    if (!open || !profile) return
    const unreadIds = items.filter((item) => !item.read_at).map((item) => item.id)
    if (unreadIds.length === 0) return

    void markNotificationsRead(profile.id, unreadIds).then(() => {
      if (!mounted.current) return
      const readAt = new Date().toISOString()
      setItems((current) => current.map((item) => (
        unreadIds.includes(item.id) ? { ...item, read_at: readAt } : item
      )))
    }).catch((nextError) => {
      if (!mounted.current) return
      setError(nextError instanceof Error ? nextError.message : 'Could not mark notifications read.')
    })
  }, [open, profile, items])

  const unreadCount = items.filter((item) => !item.read_at).length

  return (
    <>
      <button type="button"
        onClick={() => setOpen(true)}
        className="relative text-ink transition-colors hover:text-olive"
        aria-label="Notifications"
      >
        <BellIcon size={22} />
        {unreadCount > 0 && (
          <span className={`absolute -right-1 -top-1 min-w-4 h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${TONE_STYLES.terracotta.badge}`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <button type="button"
            aria-label="Close notifications"
            className="absolute inset-0 bg-ink/18 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
          />

          <section className="absolute right-4 top-4 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-[24px] border border-stone/70 bg-cream shadow-[var(--shadow-raised)]">
            <div className="flex items-center justify-between border-b border-sand-alt px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-mute">Notifications</p>
                <p className="mt-1 text-sm text-ink-soft">
                  {loading ? 'Checking what changed…' : unreadCount > 0 ? `${unreadCount} new` : 'You’re caught up'}
                </p>
              </div>
              <button type="button"
                onClick={() => setOpen(false)}
                className="text-ink-faint transition-colors hover:text-ink-soft"
                aria-label="Close"
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto">
              {error && (
                <div className="px-5 py-4 text-sm text-blush">
                  {error}
                </div>
              )}

              {!error && loading && (
                <div className="flex flex-col gap-3 px-5 py-4 animate-pulse">
                  <div className="h-16 rounded-[16px] bg-sand" />
                  <div className="h-16 rounded-[16px] bg-sand" />
                  <div className="h-16 rounded-[16px] bg-sand" />
                </div>
              )}

              {!error && !loading && items.length === 0 && (
                <div className="px-5 py-10 text-center">
                  <p className="font-semibold text-ink">Nothing new right now</p>
                  <p className="mt-1 text-sm text-ink-soft">Confirmed plans, reminders, and vote nudges will land here.</p>
                </div>
              )}

              {!error && !loading && items.length > 0 && (
                <div className="flex flex-col gap-2 p-3">
                  {items.map((item) => {
                    const unread = !item.read_at
                    const Icon = iconFor(item)
                    const tone = TONE_STYLES[item.tone]
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="flex gap-3 rounded-[16px] p-3 transition-colors hover:bg-sand"
                      >
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${tone.icon}`}>
                          <Icon size={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="text-sm font-semibold leading-5 text-ink">{item.title}</span>
                            {unread && (
                              <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${tone.badge}`} />
                            )}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-ink-soft">{item.body}</span>
                          <span className="mt-1.5 block text-[11px] text-ink-mute">{formatWhen(item.scheduled_for)}</span>
                        </span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
