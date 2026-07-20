// Per-friend connector keys for the MCP endpoint. Pure functions — no Supabase.
//
// One secret (MCP_SECRET env var) → one derived key per friend, computed as
// HMAC-SHA256(secret, user id). Nothing is stored: to check a presented key we
// re-derive every friend's key and compare. 12 friends × one HMAC each is
// nothing, and it means no schema change and no key table to manage.
// Rotating MCP_SECRET invalidates every link at once.

import { createHmac, timingSafeEqual } from 'crypto'

/** Hex length of a connector key. 24 hex chars = 96 bits — plenty for a
 *  never-guessable URL, short enough to not look scary in a text message. */
const KEY_LENGTH = 24

export function deriveFriendKey(secret: string, userId: string): string {
  return createHmac('sha256', secret).update(userId).digest('hex').slice(0, KEY_LENGTH)
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/** Find which friend a presented key belongs to, or null if it matches nobody. */
export function findFriendForKey<T extends { id: string }>(
  friends: T[],
  secret: string,
  presentedKey: string,
): T | null {
  for (const friend of friends) {
    if (safeEqual(deriveFriendKey(secret, friend.id), presentedKey)) return friend
  }
  return null
}

/** The URL a friend pastes into their AI tool as a custom connector. */
export function connectorUrl(origin: string, key: string): string {
  return `${origin}/api/mcp?key=${key}`
}

/** Timing-safe check for the admin secret itself (the mcp-keys listing page). */
export function secretMatches(expected: string, presented: string): boolean {
  return safeEqual(expected, presented)
}
