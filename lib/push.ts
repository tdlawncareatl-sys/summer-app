'use client'

import { disablePushSubscription, upsertPushSubscription } from './notifications'

declare global {
  interface Navigator {
    standalone?: boolean
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0))
}

function subscriptionPayload(subscription: PushSubscription) {
  const json = subscription.toJSON()
  return {
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
  }
}

export function supportsPushNotifications() {
  if (typeof window === 'undefined') return false
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function isStandaloneWebApp() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
}

export function getPushPublicKey() {
  return process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? ''
}

export async function getCurrentPushSubscription() {
  if (!supportsPushNotifications()) return null
  const registration = await navigator.serviceWorker.register('/summer-plans-sw.js')
  return registration.pushManager.getSubscription()
}

export async function ensurePushSubscription(userId: string) {
  if (!supportsPushNotifications()) {
    throw new Error('This device does not support web push notifications.')
  }

  const publicKey = getPushPublicKey()
  if (!publicKey) {
    throw new Error('Push notifications are not configured yet.')
  }

  const registration = await navigator.serviceWorker.register('/summer-plans-sw.js')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.')
  }

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }

  const payload = subscriptionPayload(subscription)
  if (!payload.p256dh || !payload.auth) {
    throw new Error('Could not read the browser push keys.')
  }

  await upsertPushSubscription({
    user_id: userId,
    endpoint: payload.endpoint,
    p256dh: payload.p256dh,
    auth: payload.auth,
    user_agent: navigator.userAgent,
  })

  return subscription
}

export async function removePushSubscription() {
  if (!supportsPushNotifications()) return
  const subscription = await getCurrentPushSubscription()
  if (!subscription) return

  await disablePushSubscription(subscription.endpoint)
  await subscription.unsubscribe()
}
