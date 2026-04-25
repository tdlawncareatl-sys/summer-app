// Rounded-square tinted tile with an icon. Used as the visual anchor
// on home summary cards, event rows, idea cards, etc.

import { CategoryTint, TINT_CLASSES } from '@/lib/categories'

export default function IconTile({
  Icon,
  tint = 'olive',
  size = 48,
  iconSize,
  rounded = 'md',
}: {
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number }>
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
      <Icon size={iconSize ?? Math.round(size * 0.54)} />
    </div>
  )
}
