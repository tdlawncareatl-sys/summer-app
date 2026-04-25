import type { IconColorway } from './base'

const OLIVE = 'var(--color-olive)'
const ORANGE = 'var(--color-amber)'
const BLUE = 'var(--color-teal)'
const SAGE = 'var(--color-sage)'

export const ICON_COLORWAYS = {
  mono: {
    line: 'currentColor',
    accent: 'currentColor',
    accentAlt: 'currentColor',
    accentSoft: 'currentColor',
    highlight: 'currentColor',
    fill: 'none',
  },
  brand: {
    line: OLIVE,
    accent: ORANGE,
    accentAlt: BLUE,
    accentSoft: OLIVE,
    highlight: SAGE,
    fill: 'none',
  },
  lake: {
    line: OLIVE,
    accent: ORANGE,
    accentAlt: BLUE,
    accentSoft: BLUE,
    highlight: SAGE,
    fill: 'none',
  },
  beach: {
    line: OLIVE,
    accent: ORANGE,
    accentAlt: BLUE,
    accentSoft: OLIVE,
    highlight: SAGE,
    fill: 'none',
  },
  trail: {
    line: OLIVE,
    accent: ORANGE,
    accentAlt: OLIVE,
    accentSoft: SAGE,
    highlight: OLIVE,
    fill: 'none',
  },
  camp: {
    line: OLIVE,
    accent: ORANGE,
    accentAlt: OLIVE,
    accentSoft: SAGE,
    highlight: OLIVE,
    fill: 'none',
  },
  food: {
    line: OLIVE,
    accent: ORANGE,
    accentAlt: OLIVE,
    accentSoft: SAGE,
    highlight: OLIVE,
    fill: 'none',
  },
  water: {
    line: OLIVE,
    accent: ORANGE,
    accentAlt: BLUE,
    accentSoft: BLUE,
    highlight: SAGE,
    fill: 'none',
  },
  social: {
    line: OLIVE,
    accent: ORANGE,
    accentAlt: OLIVE,
    accentSoft: SAGE,
    highlight: OLIVE,
    fill: 'none',
  },
  night: {
    line: OLIVE,
    accent: ORANGE,
    accentAlt: OLIVE,
    accentSoft: SAGE,
    highlight: OLIVE,
    fill: 'none',
  },
} as const satisfies Record<string, IconColorway>

export type IconPaletteName = keyof typeof ICON_COLORWAYS
