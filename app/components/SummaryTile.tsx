// One of the 4-up stat tiles on the Home page.
// Tile == big rounded surface, icon top-left, number + label.

import Link from 'next/link'
import type { ComponentType } from 'react'
import IconTile from './IconTile'
import { CategoryTint } from '@/lib/categories'
import { type AppIconProps, ArrowRightIcon } from './icons'

type IconComp = ComponentType<AppIconProps>

export default function SummaryTile({
  Icon,
  tint,
  title,
  description,
  href,
}: {
  Icon: IconComp
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
      <IconTile Icon={Icon} tint={tint} size={52} rounded="md" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-ink leading-tight">{title}</p>
          <p className="text-xs text-ink-soft mt-1 leading-snug">{description}</p>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-end">
        <span className={`w-7 h-7 rounded-full ${tintCircle(tint)} flex items-center justify-center`}>
          <ArrowRightIcon size={14} />
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
