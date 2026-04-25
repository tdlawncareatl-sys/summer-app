'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useName } from '@/lib/useName'
import { categoryFor, type CategoryTint } from '@/lib/categories'
import { formatDateRangeShort, todayISO } from '@/lib/planData'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import IconTile from '../components/IconTile'
import StatusChip from '../components/StatusChip'
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, LightbulbIcon, PlusIcon, StarIcon, UsersIcon, XIcon } from '../components/icons'

type Idea = {
  id: string
  title: string
  description: string | null
  submitted_by: string | null
  likes: number
  created_at?: string
}

type EventLite = {
  id: string
  title: string
  description: string | null
  status: string
  created_at: string
  confirmed_date?: string | null
  confirmed_end_date?: string | null
  participantCount: number
}

type SortMode = 'recent' | 'momentum'
type IdeaChoice = 'best' | 'works' | 'pass'

function likedKeyFor(key: string) {
  return `summer-likes-${key}`
}

function choicesKeyFor(key: string) {
  return `summer-idea-choices-${key}`
}

export default function IdeasPage() {
  const router = useRouter()
  const { authUser } = useAuth()
  const [name] = useName()
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [events, setEvents] = useState<EventLite[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [likingId, setLikingId] = useState<string | null>(null)
  const [planningId, setPlanningId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [showAllActive, setShowAllActive] = useState(false)
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [choices, setChoices] = useState<Record<string, IdeaChoice>>({})

  const formRef = useRef<HTMLDivElement | null>(null)
  const activeRef = useRef<HTMLElement | null>(null)
  const backlogRef = useRef<HTMLElement | null>(null)
  const plansRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    void loadIdeasSurface()
  }, [])

  useEffect(() => {
    const storageKey = authUser?.email ?? name
    if (!storageKey) return

    const liked = localStorage.getItem(likedKeyFor(storageKey))
    const storedChoices = localStorage.getItem(choicesKeyFor(storageKey))
    setLikedIds(liked ? new Set(JSON.parse(liked)) : new Set())
    setChoices(storedChoices ? JSON.parse(storedChoices) : {})
  }, [authUser?.email, name])

  async function loadIdeasSurface() {
    setLoading(true)

    const [
      { data: ideaRows, error: ideasError },
      { data: eventRows, error: eventsError },
      { data: optionRows },
      { data: voteRows },
    ] = await Promise.all([
      supabase
        .from('ideas')
        .select('id, title, description, submitted_by, likes, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('events')
        .select('id, title, description, status, created_at, confirmed_date, confirmed_end_date')
        .order('created_at', { ascending: false }),
      supabase.from('date_options').select('id, event_id'),
      supabase.from('votes').select('id, date_option_id'),
    ])

    if (ideasError) console.error('load ideas:', ideasError)
    if (eventsError) console.error('load linked events:', eventsError)

    const voteCountsByEvent: Record<string, number> = {}
    const eventByOption: Record<string, string> = {}

    for (const option of optionRows ?? []) {
      eventByOption[option.id] = option.event_id
    }
    for (const vote of voteRows ?? []) {
      const eventId = eventByOption[vote.date_option_id]
      if (!eventId) continue
      voteCountsByEvent[eventId] = (voteCountsByEvent[eventId] ?? 0) + 1
    }

    setIdeas((ideaRows ?? []) as Idea[])
    setEvents(
      ((eventRows ?? []) as Omit<EventLite, 'participantCount'>[]).map((event) => ({
        ...event,
        participantCount: voteCountsByEvent[event.id] ?? 0,
      })),
    )
    setLoading(false)
  }

  function revealForm() {
    setShowForm(true)
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  async function submitIdea() {
    if (!title.trim() || !name || submitting) return
    setSubmitting(true)
    await supabase.from('ideas').insert({
      title: title.trim(),
      description: description.trim() || null,
      submitted_by: name,
      likes: 0,
    })
    setTitle('')
    setDescription('')
    setShowForm(false)
    setSortMode('recent')
    await loadIdeasSurface()
    setSubmitting(false)
  }

  async function reactToIdea(idea: Idea, choice: IdeaChoice) {
    if (!name || likingId === idea.id) return
    setLikingId(idea.id)

    const likeStorageKey = authUser?.email ?? name
    const nextChoices = { ...choices, [idea.id]: choice }
    const nextLikedIds = new Set(likedIds)
    const currentlyLiked = likedIds.has(idea.id)
    const shouldLike = choice !== 'pass'

    let nextLikes = idea.likes
    if (shouldLike && !currentlyLiked) {
      nextLikedIds.add(idea.id)
      nextLikes += 1
    }
    if (!shouldLike && currentlyLiked) {
      nextLikedIds.delete(idea.id)
      nextLikes = Math.max(0, nextLikes - 1)
    }

    setChoices(nextChoices)
    setLikedIds(nextLikedIds)
    localStorage.setItem(choicesKeyFor(likeStorageKey), JSON.stringify(nextChoices))
    localStorage.setItem(likedKeyFor(likeStorageKey), JSON.stringify([...nextLikedIds]))
    setIdeas((current) => current.map((row) => (
      row.id === idea.id ? { ...row, likes: nextLikes } : row
    )))

    if (nextLikes !== idea.likes) {
      await supabase.from('ideas').update({ likes: nextLikes }).eq('id', idea.id)
    }

    await loadIdeasSurface()
    setLikingId(null)
  }

  async function deleteIdea(idea: Idea) {
    if (deletingId) return
    setDeletingId(idea.id)
    await supabase.from('ideas').delete().eq('id', idea.id)
    setIdeas((current) => current.filter((row) => row.id !== idea.id))
    setDeletingId(null)
  }

  async function planIdea(idea: Idea) {
    if (!name || planningId) return
    setPlanningId(idea.id)

    const existing = findMatchingEvent(idea.title, events)
    if (existing) {
      router.push(`/events/${existing.id}`)
      setPlanningId(null)
      return
    }

    const { data, error } = await supabase
      .from('events')
      .insert({
        title: idea.title.trim(),
        description: idea.description?.trim() || null,
        created_by: name,
      })
      .select('id')
      .single()

    if (error) {
      console.error('plan idea:', error)
      setPlanningId(null)
      return
    }

    await loadIdeasSurface()
    setPlanningId(null)
    router.push(`/events/${data.id}`)
  }

  const sortedUnplannedIdeas = [...ideas]
    .filter((idea) => !findMatchingEvent(idea.title, events))
    .sort((a, b) => {
      if (sortMode === 'momentum') {
        if (b.likes !== a.likes) return b.likes - a.likes
      }
      return (b.created_at ?? '').localeCompare(a.created_at ?? '')
    })

  const activeIdeas = showAllActive ? sortedUnplannedIdeas.slice(0, 6) : sortedUnplannedIdeas.slice(0, 3)
  const backlogIdeas = sortedUnplannedIdeas.slice(showAllActive ? 6 : 3)
  const turnedIntoPlans = [...events]
    .filter((event) => ideas.some((idea) => titlesMatch(idea.title, event.title)))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <main className="max-w-md mx-auto px-5">
      <PageHeader
        variant="title"
        title="Ideas"
        subtitle="Capture and plan what to do next."
        action={name ? (
          <div className="flex justify-end">
            <button
              onClick={revealForm}
              className="inline-flex items-center gap-2 rounded-[18px] bg-olive px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition-transform active:scale-[0.98]"
            >
              <PlusIcon size={16} />
              Add Idea
            </button>
          </div>
        ) : undefined}
      />

      <ActionRail
        onAddIdea={revealForm}
        onVoteTogether={() => scrollToRef(activeRef)}
        onPlanAndSchedule={() => scrollToRef(plansRef)}
        onLearnMore={() => scrollToRef(backlogRef)}
      />

      {name && (
        <div ref={formRef} className="mt-4">
          {showForm ? (
            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-mute">Add an idea</p>
                  <p className="mt-1 text-sm text-ink-soft">Anything you want to do this summer.</p>
                </div>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setTitle('')
                    setDescription('')
                  }}
                  className="text-ink-faint transition-colors hover:text-ink-soft"
                  aria-label="Close add idea form"
                >
                  <XIcon size={16} />
                </button>
              </div>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void submitIdea()
                  }
                }}
                placeholder="Pickleball Saturday"
                autoFocus
                className="mt-4 w-full rounded-[16px] border-0 bg-sand px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive"
              />
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                placeholder="Any details to help the group picture it?"
                className="mt-3 w-full resize-none rounded-[16px] border-0 bg-sand px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive"
              />
              <button
                onClick={() => void submitIdea()}
                disabled={!title.trim() || submitting}
                className="mt-3 w-full rounded-[16px] bg-olive py-3 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40"
              >
                {submitting ? 'Saving idea…' : 'Add idea'}
              </button>
            </Card>
          ) : null}
        </div>
      )}

      {loading ? (
        <IdeasSkeleton />
      ) : (
        <>
          <section ref={activeRef} className="mt-6">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="font-sans text-[18px] font-bold tracking-tight text-ink">Active Ideas</h2>
                <p className="mt-1 text-sm text-ink-soft">Vote on ideas to help decide what to plan next.</p>
              </div>
              <label className="flex items-center gap-1 text-sm font-medium text-ink-soft">
                <span>Sort</span>
                <div className="relative">
                  <select
                    value={sortMode}
                    onChange={(event) => setSortMode(event.target.value as SortMode)}
                    className="appearance-none bg-transparent pr-5 font-semibold text-ink focus:outline-none"
                  >
                    <option value="recent">Recent</option>
                    <option value="momentum">Momentum</option>
                  </select>
                  <ChevronDownIcon size={14} className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-ink-mute" />
                </div>
              </label>
            </div>

            {activeIdeas.length === 0 ? (
              <Card className="py-8 text-center">
                <p className="font-semibold text-ink">No active ideas yet</p>
                <p className="mt-1 text-sm text-ink-soft">Start one and give the group something to vote around.</p>
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                {activeIdeas.map((idea) => (
                  <IdeaRow
                    key={idea.id}
                    idea={idea}
                    choice={choices[idea.id]}
                    liking={likingId === idea.id}
                    planning={planningId === idea.id}
                    deleting={deletingId === idea.id}
                    isOwner={name === idea.submitted_by}
                    onChoose={(choice) => void reactToIdea(idea, choice)}
                    onPlan={() => void planIdea(idea)}
                    onDelete={() => void deleteIdea(idea)}
                  />
                ))}
              </div>
            )}

            {sortedUnplannedIdeas.length > (showAllActive ? 6 : 3) && (
              <button
                onClick={() => setShowAllActive((current) => !current)}
                className="mx-auto mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-olive"
              >
                {showAllActive ? 'Show fewer active ideas' : 'See all active ideas'}
                <ChevronDownIcon size={14} className={showAllActive ? 'rotate-180' : ''} />
              </button>
            )}
          </section>

          {backlogIdeas.length > 0 && (
            <section ref={backlogRef} className="mt-7">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 className="font-sans text-[18px] font-bold tracking-tight text-ink">Saved Ideas (backlog)</h2>
                  <p className="mt-1 text-sm text-ink-soft">Ideas to keep around for later.</p>
                </div>
                <LinkishButton label="See all" onClick={() => setShowAllActive(true)} />
              </div>
              <div className="flex gap-3 overflow-x-auto scrollbar-hidden -mx-5 px-5 pb-1">
                {backlogIdeas.map((idea) => (
                  <BacklogCard key={idea.id} idea={idea} />
                ))}
              </div>
            </section>
          )}

          {turnedIntoPlans.length > 0 && (
            <section ref={plansRef} className="mt-7 mb-4">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 className="font-sans text-[18px] font-bold tracking-tight text-ink">Recently Turned Into Plans</h2>
                  <p className="mt-1 text-sm text-ink-soft">Ideas that already made it onto the calendar.</p>
                </div>
                <LinkishButton label="See all" href="/events" />
              </div>
              <div className="grid grid-cols-1 gap-3">
                {turnedIntoPlans.slice(0, 3).map((event) => (
                  <TurnedPlanCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}

function IdeasSkeleton() {
  return (
    <div className="mt-4 animate-pulse">
      <div className="h-24 rounded-[var(--radius-lg)] bg-cream" />
      <div className="mt-6 h-40 rounded-[var(--radius-lg)] bg-cream" />
      <div className="mt-3 h-40 rounded-[var(--radius-lg)] bg-cream" />
      <div className="mt-3 h-40 rounded-[var(--radius-lg)] bg-cream" />
    </div>
  )
}

function ActionRail({
  onAddIdea,
  onVoteTogether,
  onPlanAndSchedule,
  onLearnMore,
}: {
  onAddIdea: () => void
  onVoteTogether: () => void
  onPlanAndSchedule: () => void
  onLearnMore: () => void
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="grid grid-cols-4 divide-x divide-stone/60">
        <ActionRailItem
          tint="sage"
          title="Add an idea"
          description="Anything you want to do."
          Icon={LightbulbIcon}
          onClick={onAddIdea}
        />
        <ActionRailItem
          tint="terracotta"
          title="Vote together"
          description="Help the best ideas rise."
          Icon={UsersIcon}
          onClick={onVoteTogether}
        />
        <ActionRailItem
          tint="teal"
          title="Plan & schedule"
          description="Turn ideas into real plans."
          Icon={PlusIcon}
          onClick={onPlanAndSchedule}
        />
        <ActionRailItem
          tint="olive"
          title="Learn more"
          description="See what is waiting in the wings."
          Icon={ChevronRightIcon}
          onClick={onLearnMore}
        />
      </div>
    </Card>
  )
}

function ActionRailItem({
  Icon,
  tint,
  title,
  description,
  onClick,
}: {
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number }>
  tint: CategoryTint
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-2 px-3 py-3 text-left transition-colors hover:bg-sand-alt"
    >
      <IconTile Icon={Icon} tint={tint} size={38} rounded="full" iconSize={18} />
      <div className="min-w-0">
        <p className="text-[12px] font-semibold leading-tight text-ink">{title}</p>
        <p className="mt-1 text-[11px] leading-4 text-ink-soft">{description}</p>
      </div>
    </button>
  )
}

function IdeaRow({
  idea,
  choice,
  liking,
  planning,
  deleting,
  isOwner,
  onChoose,
  onPlan,
  onDelete,
}: {
  idea: Idea
  choice?: IdeaChoice
  liking: boolean
  planning: boolean
  deleting: boolean
  isOwner: boolean
  onChoose: (choice: IdeaChoice) => void
  onPlan: () => void
  onDelete: () => void
}) {
  const category = categoryFor(idea.title)

  return (
    <Card className="p-3.5">
      <div className="flex items-start gap-3">
        <IconTile Icon={category.Icon} tint={category.tint} size={68} rounded="full" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[20px] font-bold leading-tight text-ink">{idea.title}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                <span className="inline-flex items-center gap-1">
                  <UsersIcon size={12} />
                  {idea.likes} interested
                </span>
                <span className="inline-flex items-center gap-1">
                  <StarIcon size={12} />
                  {choice === 'best' ? 'You said best' : choice === 'works' ? 'You said works' : choice === 'pass' ? 'You passed' : 'Waiting on your take'}
                </span>
              </div>
            </div>
            {isOwner ? (
              <button
                onClick={onDelete}
                disabled={deleting}
                className="rounded-[12px] p-1 text-ink-faint transition-colors hover:text-blush disabled:opacity-40"
                aria-label="Delete idea"
              >
                <XIcon size={14} />
              </button>
            ) : null}
          </div>

          {idea.description ? (
            <p className="mt-2 text-sm leading-6 text-ink-soft line-clamp-2">{idea.description}</p>
          ) : null}

          <div className="mt-3 flex items-center gap-1.5">
            {Array.from({ length: 6 }).map((_, index) => (
              <span
                key={index}
                className={`h-2.5 w-2.5 rounded-full ${index < filledDots(idea.likes) ? tintDot(category.tint) : 'bg-stone'}`}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <PreferenceButton
              active={choice === 'best'}
              tint="olive"
              label="Best"
              Icon={StarIcon}
              disabled={liking}
              onClick={() => onChoose('best')}
            />
            <PreferenceButton
              active={choice === 'works'}
              tint="amber"
              label="Works"
              Icon={CheckIcon}
              disabled={liking}
              onClick={() => onChoose('works')}
            />
            <PreferenceButton
              active={choice === 'pass'}
              tint="blush"
              label="Pass"
              Icon={XIcon}
              disabled={liking}
              onClick={() => onChoose('pass')}
            />
            <button
              onClick={onPlan}
              disabled={planning}
              className="ml-auto inline-flex items-center gap-2 rounded-[16px] bg-olive px-4 py-2 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40"
            >
              {planning ? 'Planning…' : 'Plan Event'}
            </button>
          </div>
        </div>
      </div>
    </Card>
  )
}

function PreferenceButton({
  Icon,
  label,
  tint,
  active,
  disabled,
  onClick,
}: {
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number }>
  label: string
  tint: 'olive' | 'amber' | 'blush'
  active: boolean
  disabled: boolean
  onClick: () => void
}) {
  const activeClass =
    tint === 'olive' ? 'bg-olive-soft text-olive' :
    tint === 'amber' ? 'bg-amber-soft text-amber' :
    'bg-blush-soft text-blush'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center gap-2 rounded-[14px] px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40',
        active ? activeClass : 'bg-sand text-ink-soft hover:bg-stone',
      ].join(' ')}
    >
      <Icon size={13} />
      {label}
    </button>
  )
}

function BacklogCard({ idea }: { idea: Idea }) {
  const category = categoryFor(idea.title)
  return (
    <Card className="min-w-[152px] p-3">
      <div className="flex items-center gap-2.5">
        <IconTile Icon={category.Icon} tint={category.tint} size={36} rounded="full" iconSize={18} />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight text-ink line-clamp-2">{idea.title}</p>
          <p className="mt-1 text-[11px] text-ink-mute">{idea.likes} interested</p>
        </div>
      </div>
    </Card>
  )
}

function TurnedPlanCard({ event }: { event: EventLite }) {
  const category = categoryFor(event.title)
  const status = event.status === 'confirmed' ? 'confirmed' : event.participantCount > 0 ? 'voting' : 'tentative'

  return (
    <LinkCard href={`/events/${event.id}`}>
      <div className="flex items-center gap-3">
        <IconTile Icon={category.Icon} tint={category.tint} size={48} rounded="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-ink">{event.title}</p>
          <p className="mt-1 text-xs text-ink-soft">
            {event.confirmed_date
              ? formatDateRangeShort(event.confirmed_date, event.confirmed_end_date)
              : relativePlanLabel(event.created_at)}
          </p>
          <div className="mt-1.5">
            <StatusChip status={status} size="xs" />
          </div>
        </div>
        <ChevronRightIcon size={16} className="text-ink-faint" />
      </div>
    </LinkCard>
  )
}

function LinkCard({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <Link href={href} className="block">
      <Card className="p-3.5 transition-transform active:scale-[0.99]">
        {children}
      </Card>
    </Link>
  )
}

function LinkishButton({
  label,
  href,
  onClick,
}: {
  label: string
  href?: string
  onClick?: () => void
}) {
  if (href) {
    return (
      <LinkCardText href={href} label={label} />
    )
  }

  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 text-sm font-semibold text-olive">
      {label}
      <ChevronRightIcon size={14} />
    </button>
  )
}

function LinkCardText({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-olive">
      {label}
      <ChevronRightIcon size={14} />
    </Link>
  )
}

function filledDots(likes: number) {
  if (likes <= 0) return 1
  return Math.min(6, likes)
}

function tintDot(tint: CategoryTint) {
  switch (tint) {
    case 'sage':
      return 'bg-sage'
    case 'olive':
      return 'bg-olive'
    case 'terracotta':
      return 'bg-terracotta'
    case 'teal':
      return 'bg-teal'
    case 'lavender':
      return 'bg-lavender'
    case 'amber':
      return 'bg-amber'
    case 'blush':
      return 'bg-blush'
  }
}

function normalizeTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function titlesMatch(a: string, b: string) {
  return normalizeTitle(a) === normalizeTitle(b)
}

function findMatchingEvent(title: string, events: EventLite[]) {
  return events.find((event) => titlesMatch(title, event.title))
}

function relativePlanLabel(createdAt: string) {
  const created = createdAt.slice(0, 10)
  const today = todayISO()
  if (created === today) return 'Turned into a plan today'
  return `Planned ${created}`
}

function scrollToRef(ref: RefObject<HTMLElement | null>) {
  ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
