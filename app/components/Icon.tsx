// The one icon component. Pulls from the typed registry in lib/icons.ts.
// Use `tint` for semantic color, `size` for px size. Stroke weight matches
// the previous hand-drawn set (1.8) so the swap doesn't change page rhythm.

import { icons, type IconName } from '@/lib/icons'
import { type CategoryTint, TINT_CLASSES } from '@/lib/categories'

type Props = {
  name: IconName
  size?: number
  tint?: CategoryTint
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'
  className?: string
}

export default function Icon({ name, size = 20, tint, weight = 'regular', className }: Props) {
  const Comp = icons[name]
  const tintClass = tint ? TINT_CLASSES[tint].text : ''
  return <Comp size={size} weight={weight} className={`${tintClass} ${className ?? ''}`.trim()} />
}
