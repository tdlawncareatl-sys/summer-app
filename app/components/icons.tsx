// Inline SVG icon set. Hand-drawn stroke style, matches the earthy baseline.
// Every icon inherits `currentColor` so any parent color class works.

import { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 20, className, ...rest }: IconProps) {
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

export const SunIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="4"/><path d="M12 3v1.8M12 19.2V21M3 12h1.8M19.2 12H21M5.3 5.3l1.3 1.3M17.4 17.4l1.3 1.3M5.3 18.7l1.3-1.3M17.4 6.6l1.3-1.3"/></svg>
)

export const BellIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 8a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6z"/><path d="M10 18a2 2 0 0 0 4 0"/></svg>
)

export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14"/></svg>
)

export const ArrowRightIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6"/></svg>
)

export const ChevronRightIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M9 6l6 6-6 6"/></svg>
)

export const ChevronLeftIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M15 6l-6 6 6 6"/></svg>
)

export const ChevronDownIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 9l6 6 6-6"/></svg>
)

export const HomeIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5z"/></svg>
)

export const CalendarIcon = (p: IconProps) => (
  <svg {...base(p)}><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M8 3.5v3M16 3.5v3M3.5 10h17"/></svg>
)

export const LightbulbIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.8c.5.4.8.9.9 1.5l.1.7h5l.1-.7c.1-.6.4-1.1.9-1.5A6 6 0 0 0 12 3z"/></svg>
)

export const UserIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>
)

export const UsersIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="9" cy="8" r="3.5"/><path d="M2.5 19c0-3 3-5.5 6.5-5.5s6.5 2.5 6.5 5.5"/><circle cx="17" cy="7" r="2.5" opacity=".6"/><path d="M15.5 13.5c3.5.2 6 2.7 6 5.5" opacity=".6"/></svg>
)

export const StarIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="m12 3 2.6 5.6 6.1.8-4.5 4.2 1.2 6.1L12 16.8l-5.4 2.9 1.2-6.1L3.3 9.4l6.1-.8L12 3z"/></svg>
)

export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 12.5 10 17.5 19 7"/></svg>
)

export const XIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18"/></svg>
)

/* ── Category / activity icons ───────────────────────────────────────── */

export const PalmIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 21v-9"/><path d="M12 12c-1-4-4-6-8-5 2 0 4 1 5 3-2-1-4-1-6 1 2-1 4-1 5.5 0"/><path d="M12 12c1-4 4-6 8-5-2 0-4 1-5 3 2-1 4-1 6 1-2-1-4-1-5.5 0"/><path d="M12 12c0-3 1-6 4-7-1 1-1.5 2.5-1 4 1-1.5 2.5-2 4-1.5-1.5.5-3 2-4 4"/></svg>
)

export const ClapperIcon = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="9" width="18" height="11" rx="1.5"/><path d="M3 9l2-4 3 1-2 4M8 6l3 1-2 4M13 7l3 1-2 4M18 8l3 1-2 4"/></svg>
)

export const MountainIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 19 9 9l4 6 2-3 6 7H3z"/><circle cx="15.5" cy="7.5" r="1.2"/></svg>
)

export const BootIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M8 4v8"/><path d="M6 12h5c0 2 1 3 3 3.5 2 .5 4 1 4 3.5v1H5a2 2 0 0 1-2-2v-3c0-1.5 1-3 3-3z"/><path d="M11 13v1.5M13 13v1.5"/></svg>
)

export const PaddleIcon = (p: IconProps) => (
  <svg {...base(p)}><ellipse cx="8.5" cy="8.5" rx="4" ry="5" transform="rotate(-35 8.5 8.5)"/><path d="M11 11l7 7"/><path d="M16 18l2 2"/><circle cx="6.5" cy="10.5" r=".6" fill="currentColor"/><circle cx="9" cy="7" r=".6" fill="currentColor"/><circle cx="7" cy="6.5" r=".6" fill="currentColor"/></svg>
)

export const GameIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M7 7h10a4 4 0 0 1 4 4v2a4 4 0 0 1-7-1l-.5-.5h-3L10 12a4 4 0 0 1-7 1v-2a4 4 0 0 1 4-4z"/><path d="M6 11v-1.5M5.25 10.25h1.5"/><circle cx="16" cy="10" r=".8" fill="currentColor"/><circle cx="17.5" cy="11.5" r=".8" fill="currentColor"/></svg>
)

export const FlagIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 21V4"/><path d="M5 4h10l-2 3 2 3H5"/><ellipse cx="12" cy="21" rx="7" ry="1.5"/></svg>
)

export const PaddleBoatIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 16c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0"/><path d="M5 14l3-7 8 3-3 4H5z"/><path d="M10 14v-5"/></svg>
)

export const PizzaIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3 3 18c3 2 6 3 9 3s6-1 9-3L12 3z"/><circle cx="10" cy="11" r=".8" fill="currentColor"/><circle cx="14" cy="12" r=".8" fill="currentColor"/><circle cx="12" cy="16" r=".8" fill="currentColor"/></svg>
)

export const TentIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 20 12 4l9 16H3z"/><path d="M12 4v16M9 20l3-4 3 4"/></svg>
)

export const DropletIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3c0 0-6 6.5-6 11a6 6 0 0 0 12 0c0-4.5-6-11-6-11z"/></svg>
)

export const PicnicIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="7" r="3"/><path d="M5 21l3-9M19 21l-3-9M7 14h10"/></svg>
)

export const BowlIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M12 5c0 1 .5 1.5 0 2.5M15 4c0 1.5.5 2-.5 3"/></svg>
)

export const ClockIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3 2"/></svg>
)

export const MapPinIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 20s-5.5-6-5.5-10a5.5 5.5 0 1 1 11 0c0 4-5.5 10-5.5 10Z"/><circle cx="12" cy="10" r="1.8"/></svg>
)

export const InfoIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8.5"/><path d="M12 10.2v5.3"/><circle cx="12" cy="7.3" r="0.9"/></svg>
)

export const PencilIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="m5 19 1-4 9-9 3 3-9 9-4 1Z"/><path d="m13.5 7.5 3 3"/></svg>
)

export const MoreIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/></svg>
)

export const ShareIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8 15.8 7.2M8.2 13.2l7.6 3.6"/></svg>
)

export const CopyIcon = (p: IconProps) => (
  <svg {...base(p)}><rect x="9" y="9" width="10" height="12" rx="2"/><path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>
)

export const NoteIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 5h11l3 3v11H5z"/><path d="M9 12h7M9 15.5h5"/></svg>
)
