// Semantic event / idea icon matching. Titles stay free-text, and the app
// resolves them to a consistent icon + tint pair through the shared icon registry.

import type { AppIconName } from '@/app/components/icons'

export type CategoryTint =
  | 'sage'
  | 'olive'
  | 'terracotta'
  | 'teal'
  | 'lavender'
  | 'amber'
  | 'blush'

export type Category = {
  icon: AppIconName
  tint: CategoryTint
}

const MATCHERS: { test: RegExp; category: Category }[] = [
  { test: /\bbeach|surf|ocean|shore\b/i, category: { icon: 'beachDay', tint: 'sage' } },
  { test: /\blake|boat|dock|marina|float|pontoon\b/i, category: { icon: 'lakePlankRaft', tint: 'teal' } },
  { test: /\bkayak|kayaking|canoe|river|paddle.?board\b/i, category: { icon: 'kayaking', tint: 'teal' } },
  { test: /\bpool|swim|water ?park\b/i, category: { icon: 'poolDay', tint: 'teal' } },
  { test: /\bhik|trail|mountain|climb|boot\b/i, category: { icon: 'hiking', tint: 'olive' } },
  { test: /\bcamp|tent|bonfire\b/i, category: { icon: 'camping', tint: 'terracotta' } },
  { test: /\broad ?trip|drive\b/i, category: { icon: 'roadTrip', tint: 'sage' } },
  { test: /\bmovie|film|cinema|drive in\b/i, category: { icon: 'movieNight', tint: 'lavender' } },
  { test: /\bgame|video ?game|board ?game\b/i, category: { icon: 'gameNight', tint: 'olive' } },
  { test: /\bgolf\b/i, category: { icon: 'golf', tint: 'sage' } },
  { test: /\bpickleball|padel\b/i, category: { icon: 'pickleball', tint: 'olive' } },
  { test: /\btennis\b/i, category: { icon: 'tennis', tint: 'olive' } },
  { test: /\bvolleyball\b/i, category: { icon: 'volleyball', tint: 'teal' } },
  { test: /\bbike|cycling\b/i, category: { icon: 'bikeRide', tint: 'sage' } },
  { test: /\bfish|fishing\b/i, category: { icon: 'fishing', tint: 'teal' } },
  { test: /\bsurf|surfing\b/i, category: { icon: 'surfing', tint: 'teal' } },
  { test: /\bbbq|barbecue|cookout|grill\b/i, category: { icon: 'bbq', tint: 'terracotta' } },
  { test: /\bpizza|dinner|drinks|sushi|food|eat|ramen|bowl\b/i, category: { icon: 'pizzaAndDrinks', tint: 'terracotta' } },
  { test: /\bpicnic\b/i, category: { icon: 'picnic', tint: 'amber' } },
  { test: /\bcoffee\b/i, category: { icon: 'coffeeDate', tint: 'amber' } },
  { test: /\bice ?cream\b/i, category: { icon: 'iceCream', tint: 'amber' } },
  { test: /\bfarmers? market|market\b/i, category: { icon: 'farmersMarket', tint: 'sage' } },
  { test: /\bsunset\b/i, category: { icon: 'sunsetWatch', tint: 'amber' } },
  { test: /\bstar|stargaz|moon\b/i, category: { icon: 'stargazing', tint: 'lavender' } },
  { test: /\bconcert|music\b/i, category: { icon: 'concert', tint: 'lavender' } },
  { test: /\bmuseum|gallery\b/i, category: { icon: 'museums', tint: 'olive' } },
  { test: /\bidea|suggest\b/i, category: { icon: 'lightbulb', tint: 'amber' } },
]

const DEFAULT_CATEGORY: Category = { icon: 'calendar', tint: 'olive' }

export function categoryFor(title: string | null | undefined): Category {
  if (!title) return DEFAULT_CATEGORY
  for (const matcher of MATCHERS) {
    if (matcher.test.test(title)) return matcher.category
  }
  return DEFAULT_CATEGORY
}

export const TINT_CLASSES: Record<CategoryTint, { bg: string; text: string }> = {
  sage: { bg: 'bg-sage-tint', text: 'text-sage' },
  olive: { bg: 'bg-olive-tint', text: 'text-olive' },
  terracotta: { bg: 'bg-terracotta-tint', text: 'text-terracotta' },
  teal: { bg: 'bg-teal-tint', text: 'text-teal' },
  lavender: { bg: 'bg-lavender-tint', text: 'text-lavender' },
  amber: { bg: 'bg-amber-tint', text: 'text-amber' },
  blush: { bg: 'bg-blush-tint', text: 'text-blush' },
}
