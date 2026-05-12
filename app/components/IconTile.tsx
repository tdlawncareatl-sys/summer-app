// Rounded-square tinted tile with an icon. Used as the visual anchor
// on home summary cards, event rows, idea cards, etc.

import { TINT_CLASSES } from '@/lib/categories'
import type { CategoryTint } from '@/lib/categories'
import type { IconName } from '@/lib/icons'
import Icon from './Icon'

export default function IconTile({
  name,
  tint = 'olive',
  size = 48,
  iconSize,
  rounded = 'md',
}: {
  name: IconName
  tint?: CategoryTint
  size?: number
  iconSize?: number
  rounded?: 'md' | 'lg' | 'full'
}) {
  const t = TINT_CLASSES[tint]
  const radius =
    rounded === 'full' ? 'rounded-full' :
    rounded === 'lg'   ? 'rounded-[16px]' :
    'rounded-[12px]'
  return (
    <div
      className={`${t.bg} ${t.text} ${radius} flex items-center justify-center shrink-0`}
      style={{ width: size, height: size }}
    >
      <Icon name={name} size={iconSize ?? Math.round(size * 0.54)} />
    </div>
  )
}
