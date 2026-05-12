// One of the 4-up stat tiles on the Home page.
// Tile == big rounded surface, icon top-left, number + label.

import Link from 'next/link'
import IconTile from './IconTile'
import Icon from './Icon'
import { CategoryTint } from '@/lib/categories'
import type { IconName } from '@/lib/icons'

export default function SummaryTile({
  iconName,
  tint,
  title,
  description,
  href,
}: {
  iconName: IconName
  tint: CategoryTint
  title: string
  description: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-3 p-4 bg-cream rounded-[var(--radius-lg)] shadow-[var(--shadow-soft)] active:scale-[0.98] transition-transform"
    >
      <IconTile name={iconName} tint={tint} size={52} rounded="md" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-ink leading-tight">{title}</p>
          <p className="text-xs text-ink-soft mt-1 leading-snug">{description}</p>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-end">
        <span className={`w-7 h-7 rounded-full ${tintCircle(tint)} flex items-center justify-center`}>
          <Icon name="arrowRight" size={14} />
        </span>
      </div>
    </Link>
  )
}

function tintCircle(tint: CategoryTint) {
  switch (tint) {
    case 'olive':      return 'bg-olive text-white'
    case 'terracotta': return 'bg-terracotta text-white'
    case 'teal':       return 'bg-teal text-white'
    case 'lavender':   return 'bg-lavender text-white'
    case 'amber':      return 'bg-amber text-white'
    case 'sage':       return 'bg-sage text-white'
    case 'blush':      return 'bg-blush text-white'
  }
}
