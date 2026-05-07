import { NextRequest } from 'next/server'
import webpush from 'web-push'
import { getServerSupabase } from '@/lib/serverSupabase'

export const runtime = 'nodejs'

type DispatchableNotification = {
  id: string
  user_id: string
  title: string
  body: string
  href: string
  dedupe_key: string
  tone: 'olive' | 'terracotta' | 'amber'
}

type PushSubscriptionRow = {
  endpoint: string
  user_id: string
  p256dh: string
  auth: string
}

function configureWebPush() {
  const subject = process.env.WEB_PUSH_SUBJECT
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY

  if (!subject || !publicKey || !privateKey) {
    return false
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  return true
}

async function sendDueNotifications(eventId?: string) {
  const serverSupabase = getServerSupabase()
  const now = new Date().toISOString()

  let query = serverSupabase
    .from('notifications')
    .select('id, user_id, title, body, href, dedupe_key, tone')
    .is('sent_at', null)
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(100)

  if (eventId) {
    query = query.eq('event_id', eventId)
  }

  const { data: notifications, error: notificationsError } = await query
  if (notificationsError) {
    throw new Error(notificationsError.message)
  }

  const dueNotifications = (notifications ?? []) as DispatchableNotification[]
  if (dueNotifications.length === 0) {
    return { sent: 0, disabledSubscriptions: 0 }
  }

  const userIds = [...new Set(dueNotifications.map((item) => item.user_id))]
  const { data: subscriptions, error: subscriptionsError } = await serverSupabase
    .from('push_subscriptions')
    .select('endpoint, user_id, p256dh, auth')
    .in('user_id', userIds)
    .is('disabled_at', null)

  if (subscriptionsError) {
    throw new Error(subscriptionsError.message)
  }

  const subscriptionsByUserId: Record<string, PushSubscriptionRow[]> = {}
  for (const row of (subscriptions ?? []) as PushSubscriptionRow[]) {
    ;(subscriptionsByUserId[row.user_id] ??= []).push(row)
  }

  const disabledEndpoints = new Set<string>()
  const deliveredNotificationIds = new Set<string>()
  let attemptedDeliveries = 0

  for (const notification of dueNotifications) {
    const userSubscriptions = subscriptionsByUserId[notification.user_id] ?? []
    for (const subscription of userSubscriptions) {
      attemptedDeliveries += 1
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          JSON.stringify({
            title: notification.title,
            body: notification.body,
            url: notification.href,
            tag: notification.dedupe_key,
            icon: '/icon',
            badge: '/icon',
            data: {
              href: notification.href,
              tone: notification.tone,
            },
          }),
        )
        deliveredNotificationIds.add(notification.id)
      } catch (error) {
        const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
          ? Number((error as { statusCode?: number }).statusCode)
          : null

        if (statusCode === 404 || statusCode === 410) {
          disabledEndpoints.add(subscription.endpoint)
          continue
        }

        console.error('Push send failed', error)
      }
    }
  }

  if (disabledEndpoints.size > 0) {
    const { error } = await serverSupabase
      .from('push_subscriptions')
      .update({
        disabled_at: now,
        updated_at: now,
      })
      .in('endpoint', [...disabledEndpoints])

    if (error) {
      throw new Error(error.message)
    }
  }

  if (deliveredNotificationIds.size > 0) {
    const { error: markSentError } = await serverSupabase
      .from('notifications')
      .update({ sent_at: now })
      .in('id', [...deliveredNotificationIds])

    if (markSentError) {
      throw new Error(markSentError.message)
    }
  }

  return {
    sent: deliveredNotificationIds.size,
    attemptedDeliveries,
    queuedWithoutDelivery: dueNotifications.length - deliveredNotificationIds.size,
    disabledSubscriptions: disabledEndpoints.size,
  }
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')

  if (cronSecret && authorization !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!configureWebPush()) {
    return Response.json({ ok: true, sent: 0, disabled: true })
  }

  try {
    const result = await sendDueNotifications(request.nextUrl.searchParams.get('eventId') ?? undefined)
    return Response.json({ ok: true, ...result })
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Dispatch failed.', { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!configureWebPush()) {
    return Response.json({ ok: true, sent: 0, disabled: true })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const eventId = typeof body?.eventId === 'string' ? body.eventId : undefined
    const result = await sendDueNotifications(eventId)
    return Response.json({ ok: true, ...result })
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Dispatch failed.', { status: 500 })
  }
}
