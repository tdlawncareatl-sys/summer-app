// Semantic icon tile. System icons stay tint-driven, while activity icons use
// the same thin-line SVG system inside a framed UI tile.

import type { ComponentType } from 'react'
import { CategoryTint, TINT_CLASSES } from '@/lib/categories'
import { AppIcon, getIconDefinition, ICON_COLORWAYS, type AppIconName, type AppIconProps, type IconPaletteName } from './icons'

export default function IconTile({
  icon,
  Icon,
  tint = 'olive',
  size = 48,
  iconSize,
  rounded = 'md',
  palette,
  treatment = 'auto',
}: {
  icon?: AppIconName
  Icon?: ComponentType<AppIconProps>
  tint?: CategoryTint
  size?: number
  iconSize?: number
  rounded?: 'md' | 'lg' | 'full'
  palette?: IconPaletteName
  treatment?: 'auto' | 'system' | 'scene'
}) {
  const tintClasses = TINT_CLASSES[tint]
  const radius =
    rounded === 'full' ? 'rounded-full' :
    rounded === 'lg' ? 'rounded-[16px]' :
    'rounded-[12px]'

  const definition = icon ? getIconDefinition(icon) : null
  const isScene = treatment === 'scene' || (treatment === 'auto' && definition?.kind === 'scene')
  const resolvedPalette = palette ?? definition?.defaultPalette
  const resolvedSize = iconSize ?? Math.round(size * (isScene ? 0.84 : 0.54))

  const tileClass = isScene
    ? `${radius} border border-stone/70 bg-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.85),var(--shadow-soft)]`
    : `${radius} ${tintClasses.bg} ${tintClasses.text}`

  return (
    <div
      className={`${tileClass} flex items-center justify-center shrink-0`}
      style={{ width: size, height: size }}
    >
      {icon ? (
        <AppIcon name={icon} size={resolvedSize} palette={resolvedPalette} />
      ) : Icon ? (
        <Icon
          size={resolvedSize}
          colorway={resolvedPalette ? ICON_COLORWAYS[resolvedPalette] : undefined}
        />
      ) : null}
    </div>
  )
}
