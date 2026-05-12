// Typed icon registry. One source of truth for every icon name the app uses.
// Maps to Phosphor Regular by default. Add a new icon? Add it here first, then
// reference it everywhere as `<Icon name="..." />`.
//
// To see every icon at a glance, open /icon-library.

import {
  // system
  Sun, Bell, Plus, ArrowRight,
  CaretRight, CaretLeft, CaretDown,
  House, Calendar, Lightbulb,
  User, Users, Star, Check, X,
  Clock, MapPin, Info, PencilSimple, DotsThree,
  ShareNetwork, Copy, Note,
  // outdoor activities
  TreePalm, FilmSlate, Mountains, Footprints,
  PingPong, GameController, Flag,
  Pizza, Tent, Drop, PicnicTable, BowlFood,
  // food & drink
  Coffee, BeerStein, Wine, Martini, Cake,
  // entertainment
  MusicNotes, MicrophoneStage,
  // outdoor + indoor games
  Campfire, BowlingBall, Fish, Bicycle, SwimmingPool, Cards,
  // travel
  Airplane, Car,
} from '@phosphor-icons/react'
import { PlankSinatra } from '@/app/components/customIcons'

export const icons = {
  // system / ui
  sun: Sun,
  bell: Bell,
  plus: Plus,
  arrowRight: ArrowRight,
  chevronRight: CaretRight,
  chevronLeft: CaretLeft,
  chevronDown: CaretDown,
  home: House,
  calendar: Calendar,
  lightbulb: Lightbulb,
  user: User,
  users: Users,
  star: Star,
  check: Check,
  x: X,
  clock: Clock,
  mapPin: MapPin,
  info: Info,
  pencil: PencilSimple,
  more: DotsThree,
  share: ShareNetwork,
  copy: Copy,
  note: Note,
  // activities (used by lib/categories.ts keyword matcher)
  palm: TreePalm,
  clapper: FilmSlate,
  mountain: Mountains,
  boot: Footprints,
  paddle: PingPong,
  game: GameController,
  flag: Flag,
  // Plank Sinatra — the lake means our boat, not a generic sailboat.
  boat: PlankSinatra,
  pizza: Pizza,
  tent: Tent,
  droplet: Drop,
  picnic: PicnicTable,
  bowl: BowlFood,
  // food & drink
  coffee: Coffee,
  beer: BeerStein,
  wine: Wine,
  cocktail: Martini,
  cake: Cake,
  // entertainment
  music: MusicNotes,
  mic: MicrophoneStage,
  // outdoor + games
  fire: Campfire,
  bowling: BowlingBall,
  fish: Fish,
  bike: Bicycle,
  swim: SwimmingPool,
  cards: Cards,
  // travel
  plane: Airplane,
  car: Car,
} as const

export type IconName = keyof typeof icons
