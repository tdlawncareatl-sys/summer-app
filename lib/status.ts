// Centralized status semantics. Every chip, dot, and border color in the app
// should come through here so they stay consistent.

export type EventStatus = 'confirmed' | 'voting' | 'tentative' | 'hosting'

export type StatusToken = {
  label: string
  // Tailwind-friendly class tuples — text + tint (soft background) + strong (solid)
  text: string
  tint: string
  soft: string
  strong: string
  dot: string
}

export const STATUS: Record<EventStatus, StatusToken> = {
  confirmed: {
    label: 'Confirmed',
    text: 'text-olive',
    tint: 'bg-olive-tint',
    soft: 'bg-olive-soft',
    strong: 'bg-olive text-white',
    dot: 'bg-olive',
  },
  voting: {
    label: 'Voting',
    text: 'text-terracotta',
    tint: 'bg-terracotta-tint',
    soft: 'bg-terracotta-soft',
    strong: 'bg-terracotta text-white',
    dot: 'bg-terracotta',
  },
  tentative: {
    label: 'Tentative',
    text: 'text-lavender',
    tint: 'bg-lavender-tint',
    soft: 'bg-lavender-soft',
    strong: 'bg-lavender text-white',
    dot: 'bg-lavender',
  },
  hosting: {
    label: 'Hosting',
    text: 'text-teal',
    tint: 'bg-teal-tint',
    soft: 'bg-teal-soft',
    strong: 'bg-teal text-white',
    dot: 'bg-teal',
  },
}

// Vote-response tokens (Best / Works / Pass).
export type VoteResponse = 'best' | 'works' | 'pass'

export const VOTE: Record<VoteResponse, StatusToken & { points: number }> = {
  best: {
    label: 'Best',
    text: 'text-olive',
    tint: 'bg-olive-tint',
    soft: 'bg-olive-soft',
    strong: 'bg-olive text-white',
    dot: 'bg-olive',
    points: 3,
  },
  works: {
    label: 'Works',
    text: 'text-amber',
    tint: 'bg-amber-tint',
    soft: 'bg-amber-soft',
    strong: 'bg-amber text-white',
    dot: 'bg-amber',
    points: 1,
  },
  pass: {
    label: 'Pass',
    text: 'text-blush',
    tint: 'bg-blush-tint',
    soft: 'bg-blush-soft',
    strong: 'bg-blush text-white',
    dot: 'bg-blush',
    points: 0,
  },
}

/**
 * Infer an event's display status from DB state.
 * - 'confirmed' if explicitly confirmed
 * - 'voting'    if the event has date options and any votes exist
 * - 'hosting'   (fallback) if current user created it and it's still planning
 * - 'tentative' otherwise
 */
export function inferEventStatus(input: {
  status: string | null | undefined
  hasDateOptions: boolean
  voteCount: number
  createdByCurrentUser: boolean
}): EventStatus {
  if (input.status === 'confirmed') return 'confirmed'
  if (input.hasDateOptions && input.voteCount > 0) return 'voting'
  if (input.createdByCurrentUser) return 'hosting'
  return 'tentative'
}
