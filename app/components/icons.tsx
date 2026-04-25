import { ICON_COLORWAYS, type IconPaletteName } from './iconography/palettes'
import { type AppIconProps } from './iconography/base'
import { getIconDefinition, ICON_LIBRARY_SECTIONS, ICON_REGISTRY, type AppIconName } from './iconography/registry'

export * from './iconography/system-icons'
export * from './iconography/activity-icons'

export type { AppIconProps, AppIconName, IconPaletteName }
export { ICON_COLORWAYS, ICON_LIBRARY_SECTIONS, ICON_REGISTRY, getIconDefinition }

export function AppIcon({
  name,
  palette,
  colorway,
  ...props
}: {
  name: AppIconName
  palette?: IconPaletteName
} & AppIconProps) {
  const definition = getIconDefinition(name)
  const Icon = definition.component
  const resolvedPalette = palette ?? definition.defaultPalette
  return (
    <Icon
      {...props}
      colorway={{
        ...ICON_COLORWAYS[resolvedPalette],
        ...colorway,
      }}
    />
  )
}
