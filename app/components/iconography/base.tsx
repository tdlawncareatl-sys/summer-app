import { CSSProperties, ReactNode, SVGProps } from 'react'

export type IconColorway = {
  line?: string
  fill?: string
  accent?: string
  accentAlt?: string
  accentSoft?: string
  highlight?: string
}

export type AppIconProps = SVGProps<SVGSVGElement> & {
  size?: number
  colorway?: Partial<IconColorway>
  strokeWidth?: number
}

export const ICON_COLOR = {
  line: 'var(--icon-line)',
  fill: 'var(--icon-fill)',
  accent: 'var(--icon-accent)',
  accentAlt: 'var(--icon-accent-alt)',
  accentSoft: 'var(--icon-accent-soft)',
  highlight: 'var(--icon-highlight)',
} as const

function colorwayStyles(colorway?: Partial<IconColorway>): CSSProperties {
  return {
    '--icon-line': colorway?.line ?? 'currentColor',
    '--icon-fill': colorway?.fill ?? 'none',
    '--icon-accent': colorway?.accent ?? 'currentColor',
    '--icon-accent-alt': colorway?.accentAlt ?? colorway?.accent ?? 'currentColor',
    '--icon-accent-soft': colorway?.accentSoft ?? colorway?.accentAlt ?? colorway?.accent ?? 'currentColor',
    '--icon-highlight': colorway?.highlight ?? colorway?.fill ?? 'none',
  } as CSSProperties
}

export function IconCanvas({
  size = 24,
  colorway,
  strokeWidth = 1.85,
  className,
  style,
  children,
  ...rest
}: AppIconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={ICON_COLOR.line}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ ...colorwayStyles(colorway), ...style }}
      {...rest}
    >
      {children}
    </svg>
  )
}
