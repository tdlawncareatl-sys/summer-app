import { AppIconProps, IconCanvas, ICON_COLOR } from './base'

function WaveLine({
  y = 18.8,
  tone = ICON_COLOR.accentAlt,
  opacity,
}: {
  y?: number
  tone?: string
  opacity?: number
}) {
  return (
    <path
      d={`M4 ${y}c1.4-.8 2.8-.8 4.2 0s2.8.8 4.2 0 2.8-.8 4.2 0 2.8.8 4.2 0`}
      stroke={tone}
      opacity={opacity}
    />
  )
}

function MiniSun({ cx, cy, r = 1.8 }: { cx: number; cy: number; r?: number }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} stroke={ICON_COLOR.accent} />
      <path
        d={`M${cx} ${cy - (r + 1.4)}v1.2M${cx} ${cy + (r + 0.2)}v1.2M${cx - (r + 1.4)} ${cy}h1.2M${cx + (r + 0.2)} ${cy}h1.2M${cx - (r + 0.95)} ${cy - (r + 0.95)}l.9.9M${cx + (r + 0.05)} ${cy + (r + 0.05)}l.9.9M${cx - (r + 0.95)} ${cy + (r + 0.95)}l.9-.9M${cx + (r + 0.05)} ${cy - (r + 0.05)}l.9-.9`}
        stroke={ICON_COLOR.accent}
      />
    </>
  )
}

function MiniSpark({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x} ${y - 1}v2M${x - 1} ${y}h2M${x - 0.75} ${y - 0.75}l1.5 1.5M${x + 0.75} ${y - 0.75}l-1.5 1.5`}
      stroke={ICON_COLOR.accent}
    />
  )
}

export const BeachDayIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M7.6 18.3c.2-3.3.4-5.9.4-7.9" />
    <path d="M8 10.8c-1.6-2-3.5-2.9-5.8-2.6 1.9-1 3.9-1 5.8-.1" />
    <path d="M8.2 9.7c1.5-1.8 3.4-2.4 5.8-1.8-1.8.2-3.3 1.1-4.6 2.5 1.7-.7 3.3-.5 4.8.5" />
    <path d="M5.2 18.4h7.4" stroke={ICON_COLOR.accentSoft} />
    <MiniSun cx={18.2} cy={6.2} />
    <WaveLine y={19} tone={ICON_COLOR.accentAlt} />
  </IconCanvas>
)

export const LakePlankRaftIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M9.1 8.2h5.8M10.2 6.4h3.6M10.8 6.4v1.8M13.2 6.4v1.8M10.9 8.2v2M13.1 8.2v2" />
    <rect x="4.8" y="10" width="14.4" height="3.4" rx="0.9" />
    <path d="M6.9 11.1h10.2M6.9 12.2h10.2" />
    <rect x="5.6" y="14.5" width="3" height="1.6" rx="0.75" stroke={ICON_COLOR.accentAlt} />
    <rect x="10.5" y="14.5" width="3" height="1.6" rx="0.75" stroke={ICON_COLOR.accentAlt} />
    <rect x="15.4" y="14.5" width="3" height="1.6" rx="0.75" stroke={ICON_COLOR.accentAlt} />
    <path d="M7.1 14.6v1.4M12 14.6v1.4M16.9 14.6v1.4" stroke={ICON_COLOR.accentAlt} />
    <WaveLine y={18.7} tone={ICON_COLOR.accentAlt} />
  </IconCanvas>
)

export const LakeDayIcon = LakePlankRaftIcon

export const PickleballIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <ellipse cx="8.5" cy="9.2" rx="2.6" ry="3.6" transform="rotate(-28 8.5 9.2)" />
    <ellipse cx="15.7" cy="8.8" rx="2.6" ry="3.6" transform="rotate(28 15.7 8.8)" />
    <path d="M9.8 12.3 7 16.4M14.2 12 17 16.2" />
    <circle cx="12" cy="15.9" r="1.7" stroke={ICON_COLOR.accent} />
    <circle cx="11.3" cy="15.4" r=".22" fill={ICON_COLOR.accent} stroke="none" />
    <circle cx="12.7" cy="15.4" r=".22" fill={ICON_COLOR.accent} stroke="none" />
    <circle cx="11.3" cy="16.4" r=".22" fill={ICON_COLOR.accent} stroke="none" />
    <circle cx="12.7" cy="16.4" r=".22" fill={ICON_COLOR.accent} stroke="none" />
  </IconCanvas>
)

export const HikingIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M8 6.2v5.5c0 .9.5 1.8 1.4 2.3l2.4 1.2c1 .5 2.2.8 3.4.8H18v2H7.4A3.4 3.4 0 0 1 4 14.6v-1.2c0-1 .8-1.8 1.8-1.8H8" />
    <path d="M4.8 18.3H19" stroke={ICON_COLOR.accent} />
  </IconCanvas>
)

export const CampingIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M4.8 18.2 12 6.2l7.2 12H4.8Z" />
    <path d="M12 6.2v12M9.5 18.2 12 14.4l2.5 3.8" />
    <MiniSpark x={17.1} y={7.2} />
    <path d="M6.2 18.2h11.6" stroke={ICON_COLOR.accentSoft} />
  </IconCanvas>
)

export const RoadTripIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M5 15.8v-2.2c0-1.2.8-2.2 2-2.4l1.8-.3 1.6-3h5.2l1.6 3 1.8.3c1.2.2 2 1.2 2 2.4v2.2" />
    <path d="M8.8 11.1h6.4" />
    <path d="M10.3 8.1h3.4" stroke={ICON_COLOR.accentSoft} />
    <circle cx="8" cy="16.2" r="1.5" />
    <circle cx="16" cy="16.2" r="1.5" />
  </IconCanvas>
)

export const BbqIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M6.3 10.5h11.4a5.7 5.7 0 0 1-11.4 0Z" />
    <path d="M8.2 14.5 6.8 19M15.8 14.5 17.2 19M9.4 14.5h5.2" />
    <path d="M10.5 5.4c0 .9-.6 1.4-.6 2.2M13.2 4.8c0 .9-.6 1.4-.6 2.2M15.8 5.4c0 .8-.5 1.3-.5 2" stroke={ICON_COLOR.accent} />
  </IconCanvas>
)

export const PicnicIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <rect x="5.5" y="10.2" width="13" height="7.1" rx="1.8" />
    <path d="M8.4 10.2V8.8a3.6 3.6 0 0 1 7.2 0v1.4" />
    <path d="M7.2 13h9.6M9.2 10.8v5.9M12 10.8v5.9M14.8 10.8v5.9" stroke={ICON_COLOR.accentSoft} />
  </IconCanvas>
)

export const BikeRideIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <circle cx="7" cy="16.2" r="3.2" />
    <circle cx="17" cy="16.2" r="3.2" />
    <path d="M7 16.2 10.2 10.1h4l2.8 6.1M10.2 10.1l2.8 6.1M9.4 12.6h4.6M14.2 10.1h2" />
    <path d="m9.2 8.2 1 1.9M15.8 8.8 18.1 7.8" stroke={ICON_COLOR.accent} />
  </IconCanvas>
)

export const KayakingIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="m7 7.6 2.1 2.1-2.1 2.1M17 14.2l-2.1-2.1 2.1-2.1M8.3 10.9 15.7 13" />
    <path d="M8.3 15.4c1.3.7 2.5 1 3.7 1s2.4-.3 3.7-1" stroke={ICON_COLOR.accentSoft} />
    <WaveLine y={18.5} tone={ICON_COLOR.accentAlt} />
  </IconCanvas>
)

export const BoatingIcon = LakePlankRaftIcon

export const PoolDayIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M7.2 5.8v9.3M10.8 5.8v9.3M7.2 8.8h3.6M7.2 12h3.6" />
    <WaveLine y={18.2} tone={ICON_COLOR.accentAlt} />
    <path d="M13.6 8.2h4.6" stroke={ICON_COLOR.accentSoft} />
  </IconCanvas>
)

export const SurfingIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M13.6 5.8c1.4 3.7 1.3 7.4-.3 11.1-1.3.6-2.4.3-3.3-.8 1.2-4 1.5-7.4 1.1-10.3Z" />
    <path d="M15.1 11.3c1-.9 2.1-1.3 3.5-1.2-1.3.7-2.1 1.7-2.4 3" stroke={ICON_COLOR.accentSoft} />
    <WaveLine y={18.6} tone={ICON_COLOR.accentAlt} />
  </IconCanvas>
)

export const FishingIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M5 12c2.4-2 5-2 7.5 0-2.5 2-5 2-7.5 0Z" />
    <path d="M17 7c1.5 0 2.8 1.3 2.8 2.8 0 1.6-1.3 2.8-2.8 2.8h-4.5" />
    <path d="M17 12.6c0 2.1-1.2 3.8-3.5 5" stroke={ICON_COLOR.accent} />
    <circle cx="7.4" cy="11.4" r=".35" fill={ICON_COLOR.accent} stroke="none" />
  </IconCanvas>
)

export const GolfIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M8.2 18.2V6.1" />
    <path d="M8.2 6.1h6.9l-1.8 2.7 1.8 2.7H8.2Z" stroke={ICON_COLOR.accent} />
    <path d="M5.8 18.2h12.4" stroke={ICON_COLOR.accentSoft} />
    <circle cx="14.8" cy="17.2" r=".9" />
  </IconCanvas>
)

export const TennisIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <ellipse cx="10" cy="10" rx="3.5" ry="4.8" transform="rotate(-24 10 10)" />
    <path d="M8.6 6.3c2 .9 3.6 2.4 4.7 4.6M7.5 9.2c2.3.2 4.3 1.2 5.9 3M12.4 13.5l4.7 5" />
    <circle cx="17.2" cy="8.8" r="1" stroke={ICON_COLOR.accent} />
  </IconCanvas>
)

export const VolleyballIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <circle cx="12" cy="12" r="6.4" />
    <path d="M12 5.7c1.7 1.5 2.6 3.5 2.6 5.9s-.9 4.5-2.6 6.3M6.3 8.5c2.1.4 4 .2 5.6-.7 1.6-.8 2.9-2 3.9-3.6M7.4 17.2c1.1-1.8 2.6-3.1 4.5-4 1.9-.8 4-.9 6.2-.2" />
  </IconCanvas>
)

export const GameNightIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M7 8.4h10a4 4 0 0 1 4 4v1a3.7 3.7 0 0 1-6.5 2.4l-.9-1H10.4l-.9 1A3.7 3.7 0 0 1 3 13.4v-1a4 4 0 0 1 4-4Z" />
    <path d="M7 11.3v2.2M5.9 12.4h2.2" />
    <circle cx="15.4" cy="11.3" r=".7" fill={ICON_COLOR.accent} stroke="none" />
    <circle cx="17.6" cy="13.2" r=".7" fill={ICON_COLOR.accent} stroke="none" />
  </IconCanvas>
)

export const MovieNightIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <rect x="4.6" y="9" width="14.8" height="8.4" rx="1.5" />
    <path d="M4.6 9 6.5 5.6l3 1.2-1.8 2.2M9.5 6.8l3.1 1.2L10.8 9M13.7 8l3 1.2L14.9 11" />
  </IconCanvas>
)

export const PizzaAndDrinksIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="m6.2 17.2 7.2-10.8 4.8 9.8c-1.9.7-3.7 1.1-5.5 1.1s-3.7-.4-6.5-1.1Z" />
    <path d="M16.5 9.3h2.4l-.4 5.5h-1.6Z" />
    <circle cx="10.3" cy="13" r=".7" />
    <circle cx="12.5" cy="15" r=".7" />
    <path d="M17.7 7.9v1.4" stroke={ICON_COLOR.accent} />
  </IconCanvas>
)

export const BonfireIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="m8.5 18.2 3.5-2.5 3.5 2.5M9.4 15.6l5.2 3.6" />
    <path d="M12 7c2.1 2 3.2 4 3.2 6a3.2 3.2 0 0 1-6.4 0c0-2 1.1-4 3.2-6Z" stroke={ICON_COLOR.accent} />
    <path d="M12 10.1c.8.8 1.2 1.6 1.2 2.4a1.2 1.2 0 1 1-2.4 0c0-.8.4-1.6 1.2-2.4Z" stroke={ICON_COLOR.accent} />
  </IconCanvas>
)

export const CoffeeDateIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M6 9.6h8.8v4.4a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V9.6Z" />
    <path d="M14.8 10.5h1.6a1.8 1.8 0 1 1 0 3.6h-1.6" />
    <path d="M8.8 6.2c0 .9-.5 1.5-.5 2.3M11.8 6.1c0 .9-.5 1.5-.5 2.3" stroke={ICON_COLOR.accent} />
    <path d="M5.8 18.2h9.4" stroke={ICON_COLOR.accentSoft} />
  </IconCanvas>
)

export const IceCreamIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M9 10.4a3.4 3.4 0 1 1 6 2.3 2.4 2.4 0 0 1-.2 3.1H9.2a2.7 2.7 0 0 1-.2-5.4Z" />
    <path d="m10.2 15.8 1.8 3.8 1.8-3.8" stroke={ICON_COLOR.accent} />
  </IconCanvas>
)

export const FarmersMarketIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <rect x="5.5" y="10.2" width="13" height="6.8" rx="1.7" />
    <path d="M8.1 10.2V8.9c0-1.5 1.2-2.7 2.7-2.7.8 0 1.5.3 2 .9.5-.6 1.2-.9 2-.9 1.5 0 2.7 1.2 2.7 2.7v1.3" />
    <path d="M8.7 8.5h.1M12 7.4h.1M15.3 8.5h.1" stroke={ICON_COLOR.accent} />
    <path d="M7.5 13.1h9" stroke={ICON_COLOR.accentSoft} />
  </IconCanvas>
)

export const SunsetWatchIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M5.6 16.7h12.8" />
    <path d="M7.8 16.7a4.2 4.2 0 0 1 8.4 0" stroke={ICON_COLOR.accent} />
    <WaveLine y={19.1} tone={ICON_COLOR.accentAlt} />
  </IconCanvas>
)

export const StargazingIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M15 5.7a4.5 4.5 0 1 0 4.1 7.2A5.1 5.1 0 0 1 15 5.7Z" />
    <MiniSpark x={8.2} y={9.9} />
    <MiniSpark x={17} y={5.2} />
    <path d="M6.4 18.1c1.8-.8 3.4-1 4.8-.5 1.4.4 3.3.3 5.8-.5" stroke={ICON_COLOR.accentSoft} />
  </IconCanvas>
)

export const ConcertIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M10.2 6.2v8.1a2.2 2.2 0 1 1-1.1-1.9V7.8l6.7-1.6v6.1a2.2 2.2 0 1 1-1.1-1.9V5.1l-4.5 1.1Z" />
  </IconCanvas>
)

export const MuseumsIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="m4.8 9 7.2-3.7L19.2 9M5 18.2h14M6.8 9v9.2M10.1 9v9.2M13.9 9v9.2M17.2 9v9.2" />
    <path d="M5 9h14" stroke={ICON_COLOR.accentSoft} />
  </IconCanvas>
)

export const WaterParkIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M7.2 6.1h3.7v2.4l-2.7 2.9 5 4.7" />
    <path d="M13.8 6.1v3.1" stroke={ICON_COLOR.accent} />
    <WaveLine y={18.4} tone={ICON_COLOR.accentAlt} />
  </IconCanvas>
)

export const BoardGamesIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <rect x="7.4" y="7.2" width="6.8" height="6.8" rx="1.4" transform="rotate(-15 7.4 7.2)" />
    <rect x="11" y="10.1" width="6.8" height="6.8" rx="1.4" transform="rotate(15 11 10.1)" />
    <circle cx="10.4" cy="10.2" r=".5" fill={ICON_COLOR.accent} stroke="none" />
    <circle cx="14.8" cy="13.6" r=".5" fill={ICON_COLOR.accent} stroke="none" />
    <circle cx="12.8" cy="15.6" r=".5" fill={ICON_COLOR.accent} stroke="none" />
  </IconCanvas>
)

export const LakeBoatHangoutIcon = LakePlankRaftIcon

export const PalmIcon = BeachDayIcon
export const ClapperIcon = MovieNightIcon
export const MountainIcon = HikingIcon
export const BootIcon = HikingIcon
export const PaddleIcon = PickleballIcon
export const FlagIcon = GolfIcon
export const PaddleBoatIcon = LakePlankRaftIcon
export const PizzaIcon = PizzaAndDrinksIcon
export const TentIcon = CampingIcon
export const DropletIcon = PoolDayIcon
export const BowlIcon = PizzaAndDrinksIcon
