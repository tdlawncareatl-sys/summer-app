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

// Plank Sinatra — the lake's signature raft, slight 3/4 view so both rows of
// barrels show. Picnic table (bench-table-bench) on a thick wood deck with
// three barrel pontoons on each side. No motor, no people, just the raft.
export const PlankSinatra = (p: IconProps) => (
  <svg {...base(p)}>
    {/* Picnic table — three stacked planks with center supports */}
    <path d="M9 3.5 L15 3.5" />
    <path d="M8 5.5 L16 5.5" />
    <path d="M9 8 L15 8" />
    <path d="M10.5 3.5 L10.5 8" />
    <path d="M13.5 3.5 L13.5 8" />

    {/* Back row of 3 barrels — humps peeking above the deck */}
    <path d="M4 11 Q5 9.5 6 11" />
    <path d="M11 11 Q12 9.5 13 11" />
    <path d="M18 11 Q19 9.5 20 11" />

    {/* Deck — rectangle with visible thickness */}
    <path d="M2 11 L22 11" />
    <path d="M2 14 L22 14" />
    <path d="M2 11 L2 14" />
    <path d="M22 11 L22 14" />

    {/* Front row of 3 barrels — full rounded cylinders */}
    <rect x="2.5" y="15" width="5" height="3" rx="1.5" />
    <rect x="9.5" y="15" width="5" height="3" rx="1.5" />
    <rect x="16.5" y="15" width="5" height="3" rx="1.5" />
  </svg>
)
