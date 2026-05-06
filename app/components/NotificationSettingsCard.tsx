'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from './Card'
import {
  loadNotificationPreferences,
  saveNotificationPreferences,
  syncAllNotifications,
  type NotificationPreferenceState,
} from '@/lib/notifications'
import {
  ensurePushSubscription,
  getCurrentPushSubscription,
  getPushPublicKey,
  isStandaloneWebApp,
  removePushSubscription,
  supportsPushNotifications,
} from '@/lib/push'
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/lib/notificationEngine'

const REMINDER_OPTIONS: Array<{
  value: NotificationPreferenceState['reminderTiming']
  label: string
}> = [
  { value: 'smart', label: 'Smart' },
  { value: 'day_before', label: '1 day before' },
  { value: 'week_before', label: '1 week before' },
  { value: 'none', label: 'Off' },
]

export default function NotificationSettingsCard({ userId }: { userId: string }) {
  const [preferences, setPreferences] = useState<NotificationPreferenceState>(DEFAULT_NOTIFICATION_PREFERENCES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [permission, setPermission] = useState<string>('default')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pushSupported = useMemo(() => supportsPushNotifications(), [])
  const standalone = useMemo(() => isStandaloneWebApp(), [])
  const pushConfigured = Boolean(getPushPublicKey())

  useEffect(() => {
    let alive = true

    async function load() {
      try {
        const [nextPreferences, subscription] = await Promise.all([
          loadNotificationPreferences(userId),
          getCurrentPushSubscription(),
        ])

        if (!alive) return
        setPreferences(nextPreferences)
        setPushEnabled(Boolean(subscription))
        setPermission(typeof Notification === 'undefined' ? 'default' : Notification.permission)
      } catch (nextError) {
        if (!alive) return
        setError(nextError instanceof Error ? nextError.message : 'Could not load your notification settings.')
      } finally {
        if (!alive) return
        setLoading(false)
      }
    }

    void load()

    return () => {
      alive = false
    }
  }, [userId])

  async function save(next: NotificationPreferenceState) {
    setPreferences(next)
    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      await saveNotificationPreferences(userId, next)
      await syncAllNotifications()
      setMessage('Notification settings saved.')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not save your notification settings.')
    } finally {
      setSaving(false)
    }
  }

  async function enablePush() {
    setPushBusy(true)
    setError(null)
    setMessage(null)

    try {
      await ensurePushSubscription(userId)
      setPushEnabled(true)
      setPermission(typeof Notification === 'undefined' ? 'default' : Notification.permission)
      setMessage('Push notifications are on for this device.')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not turn on push notifications.')
    } finally {
      setPushBusy(false)
    }
  }

  async function disablePush() {
    setPushBusy(true)
    setError(null)
    setMessage(null)

    try {
      await removePushSubscription()
      setPushEnabled(false)
      setMessage('Push notifications are off for this device.')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not turn off push notifications.')
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <Card className="mb-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-mute">Notifications</p>
          <h2 className="mt-1 font-serif text-[28px] leading-[1.05] font-black tracking-tight text-ink">
            Stay in the loop
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            Confirmed plans, smart reminders, and vote nudges all live here.
          </p>
        </div>
        {saving ? (
          <span className="rounded-full bg-sand px-3 py-1 text-[11px] font-semibold text-ink-soft">Saving…</span>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-4 h-32 animate-pulse rounded-[18px] bg-sand" />
      ) : (
        <>
          <div className="mt-5 grid gap-4">
            <PreferenceRow
              title="Event confirmed"
              description="Send a notification when a date gets locked in."
              enabled={preferences.confirmedEnabled}
              onToggle={(value) => void save({ ...preferences, confirmedEnabled: value })}
            />
            <PreferenceRow
              title="Vote needed"
              description="Nudge people when a plan is waiting on their vote."
              enabled={preferences.voteNeededEnabled}
              onToggle={(value) => void save({ ...preferences, voteNeededEnabled: value })}
            />
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold text-ink">Event reminders</p>
            <p className="mt-1 text-xs leading-5 text-ink-soft">
              Choose how early you want reminders before a plan.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {REMINDER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => void save({ ...preferences, reminderTiming: option.value })}
                  className={[
                    'rounded-[14px] px-3 py-2 text-sm font-semibold transition-colors',
                    preferences.reminderTiming === option.value
                      ? 'bg-olive text-white'
                      : 'bg-sand text-ink-soft hover:bg-sand-alt',
                  ].join(' ')}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-[18px] border border-sand-alt bg-sand-alt px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">Push on this iPhone</p>
                <p className="mt-1 text-xs leading-5 text-ink-soft">
                  Best experience comes from adding Summer Plans to your Home Screen first.
                </p>
              </div>
              <button
                onClick={() => void (pushEnabled ? disablePush() : enablePush())}
                disabled={pushBusy || !pushSupported || !pushConfigured}
                className={[
                  'rounded-[14px] px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40',
                  pushEnabled ? 'bg-stone text-ink-soft' : 'bg-olive text-white',
                ].join(' ')}
              >
                {pushBusy ? 'Working…' : pushEnabled ? 'Turn off' : 'Turn on'}
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-1.5 text-xs text-ink-soft">
              <p>Status: {pushEnabled ? 'Connected on this device' : permission === 'denied' ? 'Permission denied' : 'Not connected yet'}</p>
              {!standalone && (
                <p>On iPhone, web push works best after “Add to Home Screen.”</p>
              )}
              {!pushSupported && (
                <p>This device/browser does not support web push notifications.</p>
              )}
              {pushSupported && !pushConfigured && (
                <p>Push keys are not configured in the app environment yet.</p>
              )}
            </div>
          </div>

          {message ? (
            <p className="mt-4 rounded-[16px] bg-olive-soft px-3 py-2 text-xs font-medium text-olive">
              {message}
            </p>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-[16px] bg-blush-soft px-3 py-2 text-xs font-medium text-blush">
              {error}
            </p>
          ) : null}
        </>
      )}
    </Card>
  )
}

function PreferenceRow({
  title,
  description,
  enabled,
  onToggle,
}: {
  title: string
  description: string
  enabled: boolean
  onToggle: (value: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1 text-xs leading-5 text-ink-soft">{description}</p>
      </div>
      <button
        onClick={() => onToggle(!enabled)}
        className={[
          'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
          enabled ? 'bg-olive text-white' : 'bg-sand text-ink-soft hover:bg-sand-alt',
        ].join(' ')}
      >
        {enabled ? 'On' : 'Off'}
      </button>
    </div>
  )
}
