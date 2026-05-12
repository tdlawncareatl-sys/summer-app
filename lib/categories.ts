// Map event/idea titles → category icon + tint. Keeps the visual language
// consistent (palm tree = beach, paddle = pickleball, etc.) without requiring
// a category column in the DB.

import type { IconName } from '@/lib/icons'

export type CategoryTint =
  | 'sage'
  | 'olive'
  | 'terracotta'
  | 'teal'
  | 'lavender'
  | 'amber'
  | 'blush'

export type Category = {
  iconName: IconName
  tint: CategoryTint
}

// Each entry: keyword → { iconName, tint }. First match wins.
const MATCHERS: { test: RegExp; category: Category }[] = [
  { test: /\bbeach|surf|ocean\b/i,             category: { iconName: 'palm',    tint: 'sage' } },
  { test: /\bmovie|film|cinema\b/i,            category: { iconName: 'clapper', tint: 'lavender' } },
  { test: /\bhik|hike|mountain|climb|trail\b/i,category: { iconName: 'mountain',tint: 'teal' } },
  { test: /\bcamp|tent\b/i,                    category: { iconName: 'tent',    tint: 'terracotta' } },
  { test: /\blake|kayak|paddle.?board|swim|river|boat\b/i, category: { iconName: 'boat', tint: 'teal' } },
  { test: /\bpickleball|tennis|padel\b/i,      category: { iconName: 'paddle',  tint: 'olive' } },
  { test: /\bgolf\b/i,                         category: { iconName: 'flag',    tint: 'sage' } },
  { test: /\bgame|video ?game\b/i,             category: { iconName: 'game',    tint: 'olive' } },
  { test: /\bpizza|dinner|sushi|bbq|food|eat\b/i, category: { iconName: 'pizza',tint: 'terracotta' } },
  { test: /\bboots?|walk\b/i,                  category: { iconName: 'boot',    tint: 'olive' } },
  { test: /\bwater|rain\b/i,                   category: { iconName: 'droplet', tint: 'teal' } },
  { test: /\bpicnic\b/i,                       category: { iconName: 'picnic',  tint: 'sage' } },
  { test: /\bsushi|bowl|ramen\b/i,             category: { iconName: 'bowl',    tint: 'amber' } },
  { test: /\bidea|suggest\b/i,                 category: { iconName: 'lightbulb', tint: 'amber' } },
]

// Fallback for anything that doesn't match.
const DEFAULT_CATEGORY: Category = { iconName: 'calendar', tint: 'olive' }

export function categoryFor(title: string | null | undefined): Category {
  if (!title) return DEFAULT_CATEGORY
  for (const m of MATCHERS) if (m.test.test(title)) return m.category
  return DEFAULT_CATEGORY
}

// Map tint → Tailwind bg/text class pairs. Keeps tint styling centralized.
export const TINT_CLASSES: Record<CategoryTint, { bg: string; text: string }> = {
  sage:       { bg: 'bg-sage-tint',       text: 'text-sage' },
  olive:      { bg: 'bg-olive-tint',      text: 'text-olive' },
  terracotta: { bg: 'bg-terracotta-tint', text: 'text-terracotta' },
  teal:       { bg: 'bg-teal-tint',       text: 'text-teal' },
  lavender:   { bg: 'bg-lavender-tint',   text: 'text-lavender' },
  amber:      { bg: 'bg-amber-tint',      text: 'text-amber' },
  blush:      { bg: 'bg-blush-tint',      text: 'text-blush' },
}
