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

// Each entry: keyword → { iconName, tint }. First match wins, so order
// specific phrases before broad ones (e.g. "bowling" before "bowl").
const MATCHERS: { test: RegExp; category: Category }[] = [
  // outdoors & nature
  { test: /\bbeach|surf|ocean\b/i,                    category: { iconName: 'palm',     tint: 'sage' } },
  { test: /\bhik|hike|mountain|climb|trail\b/i,       category: { iconName: 'mountain', tint: 'teal' } },
  { test: /\bcamp|tent\b/i,                           category: { iconName: 'tent',     tint: 'terracotta' } },
  { test: /\bbonfire|campfire|fire\b/i,               category: { iconName: 'fire',     tint: 'terracotta' } },
  { test: /\bfish/i,                                  category: { iconName: 'fish',     tint: 'teal' } },
  { test: /\bpicnic\b/i,                              category: { iconName: 'picnic',   tint: 'sage' } },
  { test: /\bboots?|walk\b/i,                         category: { iconName: 'boot',     tint: 'olive' } },
  // water
  { test: /\bpool|swim\b/i,                           category: { iconName: 'swim',     tint: 'teal' } },
  { test: /\blake|kayak|paddle.?board|river|boat\b/i, category: { iconName: 'boat',     tint: 'teal' } },
  { test: /\bwater|rain\b/i,                          category: { iconName: 'droplet',  tint: 'teal' } },
  // sports & games (bowling before bowl-the-food)
  { test: /\bbowling\b/i,                             category: { iconName: 'bowling',  tint: 'teal' } },
  { test: /\bpickleball|tennis|padel\b/i,             category: { iconName: 'paddle',   tint: 'olive' } },
  { test: /\bgolf\b/i,                                category: { iconName: 'flag',     tint: 'sage' } },
  { test: /\bbike|cycling|bicycle\b/i,                category: { iconName: 'bike',     tint: 'olive' } },
  { test: /\bcards|board ?game|poker|euchre|spades\b/i, category: { iconName: 'cards',  tint: 'amber' } },
  { test: /\bgame|video ?game\b/i,                    category: { iconName: 'game',     tint: 'olive' } },
  // entertainment
  { test: /\bmovie|film|cinema\b/i,                   category: { iconName: 'clapper',  tint: 'lavender' } },
  { test: /\bkaraoke|sing\b/i,                        category: { iconName: 'mic',      tint: 'terracotta' } },
  { test: /\bconcert|music|festival|band|show\b/i,    category: { iconName: 'music',    tint: 'lavender' } },
  // food & drink (coffee/brunch before generic food; sushi/ramen before pizza/dinner/food)
  { test: /\bcoffee|cafe|brunch\b/i,                  category: { iconName: 'coffee',   tint: 'amber' } },
  { test: /\bbrewery|brew|beer\b/i,                   category: { iconName: 'beer',     tint: 'terracotta' } },
  { test: /\bwine|vineyard|tasting\b/i,               category: { iconName: 'wine',     tint: 'blush' } },
  { test: /\bcocktail|drinks?|bar\b/i,                category: { iconName: 'cocktail', tint: 'lavender' } },
  { test: /\bsushi|ramen|poke\b/i,                    category: { iconName: 'bowl',     tint: 'amber' } },
  { test: /\bpizza|dinner|bbq|food|eat\b/i,           category: { iconName: 'pizza',    tint: 'terracotta' } },
  { test: /\bbirthday|party|celebrate\b/i,            category: { iconName: 'cake',     tint: 'blush' } },
  // travel
  { test: /\bplane|flight|airport|fly|travel\b/i,     category: { iconName: 'plane',    tint: 'teal' } },
  { test: /\broad ?trip|drive|car\b/i,                category: { iconName: 'car',      tint: 'sage' } },
  // ideas
  { test: /\bidea|suggest\b/i,                        category: { iconName: 'lightbulb',tint: 'amber' } },
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
