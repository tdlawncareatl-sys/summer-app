// Map event/idea titles → category icon + tint. Keeps the visual language
// consistent (palm tree = beach, paddle = pickleball, etc.) without requiring
// a category column in the DB.

import {
  PalmIcon,
  ClapperIcon,
  MountainIcon,
  BootIcon,
  PaddleIcon,
  GameIcon,
  FlagIcon,
  PaddleBoatIcon,
  PizzaIcon,
  TentIcon,
  DropletIcon,
  PicnicIcon,
  BowlIcon,
  CalendarIcon,
  LightbulbIcon,
} from '@/app/components/icons'

export type CategoryTint =
  | 'sage'
  | 'olive'
  | 'terracotta'
  | 'teal'
  | 'lavender'
  | 'amber'
  | 'blush'

export type Category = {
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number }>
  tint: CategoryTint
}

// Each entry: keyword → { icon, tint }. First match wins.
const MATCHERS: { test: RegExp; category: Category }[] = [
  { test: /\bbeach|surf|ocean\b/i,             category: { Icon: PalmIcon,       tint: 'sage' } },
  { test: /\bmovie|film|cinema\b/i,            category: { Icon: ClapperIcon,    tint: 'lavender' } },
  { test: /\bhik|hike|mountain|climb|trail\b/i,category: { Icon: MountainIcon,   tint: 'teal' } },
  { test: /\bcamp|tent\b/i,                    category: { Icon: TentIcon,       tint: 'terracotta' } },
  { test: /\blake|kayak|paddle.?board|swim|river|boat\b/i, category: { Icon: PaddleBoatIcon, tint: 'teal' } },
  { test: /\bpickleball|tennis|padel\b/i,      category: { Icon: PaddleIcon,     tint: 'olive' } },
  { test: /\bgolf\b/i,                         category: { Icon: FlagIcon,       tint: 'sage' } },
  { test: /\bgame|video ?game\b/i,             category: { Icon: GameIcon,       tint: 'olive' } },
  { test: /\bpizza|dinner|sushi|bbq|food|eat\b/i, category: { Icon: PizzaIcon,   tint: 'terracotta' } },
  { test: /\bboots?|walk\b/i,                  category: { Icon: BootIcon,       tint: 'olive' } },
  { test: /\bwater|rain\b/i,                   category: { Icon: DropletIcon,    tint: 'teal' } },
  { test: /\bpicnic\b/i,                       category: { Icon: PicnicIcon,     tint: 'sage' } },
  { test: /\bsushi|bowl|ramen\b/i,             category: { Icon: BowlIcon,       tint: 'amber' } },
  { test: /\bidea|suggest\b/i,                 category: { Icon: LightbulbIcon,  tint: 'amber' } },
]

// Fallback for anything that doesn't match.
const DEFAULT_CATEGORY: Category = { Icon: CalendarIcon, tint: 'olive' }

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
