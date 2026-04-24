'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { fetchNotifications, type NotificationItem, type NotificationTone } from '@/lib/notifications'
import { BellIcon, CheckIcon, LightbulbIcon, StarIcon, CalendarIcon, XIcon } from './icons'

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

const LAST_SEEN_PREFIX = 'summer-app-notifications-seen'

function iconFor(item: NotificationItem) {
  if (item.type === 'confirmed') return CheckIcon
  if (item.type === 'idea') return LightbulbIcon
  if (item.type === 'vote-needed') return CalendarIcon
  return StarIcon
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
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!profile) return

    const storageKey = `${LAST_SEEN_PREFIX}:${profile.id}`
    const storedLastSeen = localStorage.getItem(storageKey)
    setLastSeenAt(storedLastSeen)

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchNotifications({ userId: profile.id, name: profile.name })
      .then((nextItems) => {
        if (cancelled || !mounted.current) return
        setItems(nextItems)
      })
      .catch((nextError) => {
        if (cancelled || !mounted.current) return
        setError(nextError instanceof Error ? nextError.message : 'Could not load notifications.')
      })
      .finally(() => {
        if (cancelled || !mounted.current) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [profile])

  useEffect(() => {
    if (!open || !profile) return
    const now = new Date().toISOString()
    const storageKey = `${LAST_SEEN_PREFIX}:${profile.id}`
    localStorage.setItem(storageKey, now)
    setLastSeenAt(now)
  }, [open, profile])

  const unreadCount = items.filter((item) => !lastSeenAt || item.timestamp > lastSeenAt).length

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative text-ink hover:text-olive transition-colors"
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
          <button
            aria-label="Close notifications"
            className="absolute inset-0 bg-ink/18 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
          />

          <section className="absolute right-4 top-4 w-[min(24rem,calc(100vw-2rem))] rounded-[28px] bg-cream shadow-[var(--shadow-raised)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-sand-alt">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-mute">Notifications</p>
                <p className="text-sm text-ink-soft mt-1">
                  {loading ? 'Checking what changed…' : unreadCount > 0 ? `${unreadCount} new` : 'You’re caught up'}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-ink-faint hover:text-ink-soft transition-colors"
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
                <div className="px-5 py-4 flex flex-col gap-3 animate-pulse">
                  <div className="h-16 rounded-2xl bg-sand" />
                  <div className="h-16 rounded-2xl bg-sand" />
                  <div className="h-16 rounded-2xl bg-sand" />
                </div>
              )}

              {!error && !loading && items.length === 0 && (
                <div className="px-5 py-10 text-center">
                  <p className="font-semibold text-ink">Nothing new right now</p>
                  <p className="text-sm text-ink-soft mt-1">Votes, confirmed plans, and ideas with momentum will show up here.</p>
                </div>
              )}

              {!error && !loading && items.length > 0 && (
                <div className="p-3 flex flex-col gap-2">
                  {items.map((item) => {
                    const unread = !lastSeenAt || item.timestamp > lastSeenAt
                    const Icon = iconFor(item)
                    const tone = TONE_STYLES[item.tone]
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="rounded-2xl p-3 flex gap-3 hover:bg-sand transition-colors"
                      >
                        <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${tone.icon}`}>
                          <Icon size={18} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-sm text-ink leading-5">{item.title}</span>
                            {unread && (
                              <span className={`mt-0.5 shrink-0 w-2.5 h-2.5 rounded-full ${tone.badge}`} />
                            )}
                          </span>
                          <span className="block text-xs text-ink-soft mt-1 leading-5">{item.body}</span>
                          <span className="block text-[11px] text-ink-mute mt-1.5">{formatWhen(item.timestamp)}</span>
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
