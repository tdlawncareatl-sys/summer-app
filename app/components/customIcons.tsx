// Hand-drawn icons that don't belong to Phosphor. They match Phosphor's
// component API (size + weight + className) so they slot into the typed
// registry in lib/icons.ts without a special case.

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number
  // Accepted for Phosphor parity; custom icons render the same regardless.
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'
}

function base({ size = 20, weight: _weight, className, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    ...rest,
  }
}

// Plank Sinatra — the lake's signature raft: picnic table on a wood deck
// with two blue-barrel pontoons. Replaces the generic Phosphor Boat so
// "lake" in the app always means our boat.
export const PlankSinatra = (p: IconProps) => (
  <svg {...base(p)}>
    {/* Picnic table: top + two legs (pi shape) */}
    <path d="M9 8 L15 8" />
    <path d="M10 8 L10 12" />
    <path d="M14 8 L14 12" />
    {/* Deck plank (two parallel strokes give it thickness) */}
    <path d="M2 13 L22 13" />
    <path d="M2 15 L22 15" />
    {/* Two barrel pontoons */}
    <rect x="3" y="16" width="6" height="3" rx="1.5" />
    <rect x="15" y="16" width="6" height="3" rx="1.5" />
  </svg>
)
