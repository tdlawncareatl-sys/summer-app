import { AppIconProps, IconCanvas, ICON_COLOR } from './base'

export const SummerPlansMarkIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M4 16c2 1.1 4 1.1 6 0s4-1.1 6 0 4 1.1 6 0" stroke={ICON_COLOR.accentAlt} />
    <path d="M5 19c1.7.9 3.3.9 5 0s3.3-.9 5 0 3.3.9 5 0" stroke={ICON_COLOR.accentAlt} opacity="0.75" />
    <circle cx="12" cy="9" r="4.2" stroke={ICON_COLOR.accent} />
    <path d="M12 2.5v2M12 13.5V15.5M4.5 9H6.5M17.5 9H19.5M6.4 4.4 7.8 5.8M16.2 12.2l1.4 1.4M6.4 13.6l1.4-1.4M16.2 5.8l1.4-1.4" stroke={ICON_COLOR.accent} />
  </IconCanvas>
)

export const SunIcon = SummerPlansMarkIcon

export const BellIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M6.5 9a5.5 5.5 0 0 1 11 0c0 3.2 1.3 4.8 1.9 5.5H4.6c.6-.7 1.9-2.3 1.9-5.5Z" />
    <path d="M10 18a2 2 0 0 0 4 0" />
  </IconCanvas>
)

export const PlusIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M12 5v14M5 12h14" />
  </IconCanvas>
)

export const ArrowRightIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M5 12h13" />
    <path d="m14 6 5 6-5 6" />
  </IconCanvas>
)

export const ChevronRightIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="m9 6 6 6-6 6" />
  </IconCanvas>
)

export const ChevronLeftIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="m15 6-6 6 6 6" />
  </IconCanvas>
)

export const ChevronDownIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="m6 9 6 6 6-6" />
  </IconCanvas>
)

export const HomeIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="m4 11 8-6 8 6" />
    <path d="M6 10.5V19h12v-8.5" />
    <path d="M10 19v-5h4v5" />
  </IconCanvas>
)

export const CalendarIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="3" />
    <path d="M8 3.5v3M16 3.5v3M3.5 9.5h17M7.8 13h2.8M13.4 13h2.8M7.8 16.2h2.8" />
  </IconCanvas>
)

export const LightbulbIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3.5a5.8 5.8 0 0 0-3.4 10.5c.6.4 1 .9 1.2 1.5l.2 1h4l.2-1c.2-.6.6-1.1 1.2-1.5A5.8 5.8 0 0 0 12 3.5Z" />
  </IconCanvas>
)

export const UserIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 19c0-3.5 3-6 7-6s7 2.5 7 6" />
  </IconCanvas>
)

export const UsersIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <circle cx="8.5" cy="9" r="3" />
    <circle cx="15.8" cy="8" r="2.5" opacity="0.8" />
    <path d="M3.5 18c0-3 2.4-5.2 5.7-5.2s5.8 2.2 5.8 5.2" />
    <path d="M14 17.8c.4-2.2 2.2-3.8 4.8-3.8 1 0 1.9.2 2.7.7" opacity="0.8" />
  </IconCanvas>
)

export const MessageIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <rect x="3.5" y="6" width="17" height="11" rx="4" />
    <path d="m8.6 17-2 3 4.4-3M8.5 11.5h7" />
  </IconCanvas>
)

export const MenuIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M5 7h14M5 12h14M5 17h14" />
  </IconCanvas>
)

export const StarIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="m12 3.2 2.6 5.2 5.8.8-4.2 4.1 1 5.7L12 16.2 6.8 19l1-5.7-4.2-4.1 5.8-.8L12 3.2Z" />
  </IconCanvas>
)

export const CheckIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="m5 12.5 4.2 4.2L19 7" />
  </IconCanvas>
)

export const XIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </IconCanvas>
)

export const ClockIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5v5l3 2" />
  </IconCanvas>
)

export const RepeatIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M7 7h9l-2.5-2.5M17 17H8l2.5 2.5" />
    <path d="M17 7a5 5 0 0 1 0 10M7 17a5 5 0 0 1 0-10" />
  </IconCanvas>
)

export const TagIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M4 9.5V5.5A1.5 1.5 0 0 1 5.5 4H10l9 9-6 6-9-9Z" />
    <circle cx="7.5" cy="7.5" r="1" />
  </IconCanvas>
)

export const MapPinIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M12 20s-5.5-6-5.5-10a5.5 5.5 0 1 1 11 0c0 4-5.5 10-5.5 10Z" />
    <circle cx="12" cy="10" r="1.8" />
  </IconCanvas>
)

export const ListViewIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M5.2 7h1.8M5.2 12h1.8M5.2 17h1.8M9 7h10M9 12h10M9 17h10" />
  </IconCanvas>
)

export const CalendarViewIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <rect x="4" y="4" width="6" height="6" rx="1.5" />
    <rect x="14" y="4" width="6" height="6" rx="1.5" />
    <rect x="4" y="14" width="6" height="6" rx="1.5" />
    <rect x="14" y="14" width="6" height="6" rx="1.5" />
  </IconCanvas>
)

export const FilterIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M4 5h16l-6.5 7v6l-3-1.7V12Z" />
  </IconCanvas>
)

export const SearchIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <circle cx="10.5" cy="10.5" r="5.5" />
    <path d="m15 15 4 4" />
  </IconCanvas>
)

export const SortIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M5 7h14M5 12h14M5 17h14" />
    <circle cx="9" cy="7" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
    <circle cx="11" cy="17" r="1.5" />
  </IconCanvas>
)

export const MapViewIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M4 6.5 9 4l6 2.5 5-2.5v13L15 19l-6-2.5L4 19Z" />
    <path d="M9 4v12.5M15 6.5V19" />
  </IconCanvas>
)

export const PencilIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="m5 19 1-4 9-9 3 3-9 9-4 1Z" />
    <path d="m13.5 7.5 3 3" />
  </IconCanvas>
)

export const TrashIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M5 7h14M9 7V4.8A.8.8 0 0 1 9.8 4h4.4a.8.8 0 0 1 .8.8V7" />
    <path d="M7 7v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7" />
    <path d="M10 10v6M14 10v6" />
  </IconCanvas>
)

export const ShareIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M12 15V5" />
    <path d="m8.5 8.5 3.5-3.5 3.5 3.5" />
    <path d="M6 12.5V18a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5.5" />
  </IconCanvas>
)

export const InviteIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <circle cx="10" cy="8" r="3" />
    <path d="M4.5 18c0-2.8 2.2-4.8 5.5-4.8" />
    <path d="M16 8v6M13 11h6" />
  </IconCanvas>
)

export const DownloadIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M12 4.5v10" />
    <path d="m8.5 11 3.5 3.5 3.5-3.5" />
    <path d="M5 18.5h14" />
  </IconCanvas>
)

export const HeartIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <path d="M12 19.5 5 12.8A4.1 4.1 0 0 1 10.8 7L12 8.2 13.2 7A4.1 4.1 0 0 1 19 12.8Z" stroke={ICON_COLOR.accent} />
  </IconCanvas>
)

export const InfoIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 10.2v5.3" />
    <circle cx="12" cy="7.3" r="0.9" />
  </IconCanvas>
)

export const AlertIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5v5.2" />
    <circle cx="12" cy="16.3" r="0.9" />
  </IconCanvas>
)

export const BanIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m7.5 7.5 9 9" />
  </IconCanvas>
)

export const ConfirmedStatusIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.2 12.2 2.5 2.5 5-5.3" />
  </IconCanvas>
)

export const TentativeStatusIcon = (p: AppIconProps) => (
  <IconCanvas {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 8v4.5l2.8 1.8" stroke={ICON_COLOR.accent} />
  </IconCanvas>
)
