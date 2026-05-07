'use client'

import { disablePushSubscription, upsertPushSubscription } from './notifications'

declare global {
  interface Navigator {
    standalone?: boolean
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const normalized = base64String
    .trim()
    .replace(/^Public Key:\s*/i, '')
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, '')

  const padding = '='.repeat((4 - (normalized.length % 4)) % 4)
  const base64 = (normalized + padding).replace(/-/g, '+').replace(/_/g, '/')
  let rawData = ''
  try {
    rawData = window.atob(base64)
  } catch {
    throw new Error('The public push key is malformed. Re-copy the VAPID public key into NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY.')
  }

  return Uint8Array.from(rawData, (char) => char.charCodeAt(0))
}

function uint8ArrayToBase64Url(bytes: Uint8Array) {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function subscriptionMatchesPublicKey(subscription: PushSubscription, publicKey: string) {
  const serverKey = subscription.options.applicationServerKey
  if (!serverKey) return false
  const bytes = serverKey instanceof ArrayBuffer ? new Uint8Array(serverKey) : new Uint8Array(serverKey)
  return uint8ArrayToBase64Url(bytes) === publicKey.replace(/=+$/g, '')
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
  return (process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? '').trim()
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
  if (subscription && !subscriptionMatchesPublicKey(subscription, publicKey)) {
    try {
      await disablePushSubscription(subscription.endpoint)
    } catch {
      // If the old endpoint cannot be marked disabled remotely, still refresh locally.
    }
    await subscription.unsubscribe().catch(() => undefined)
    subscription = null
  }

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
