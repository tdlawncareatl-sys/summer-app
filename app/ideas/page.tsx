'use client'

// Ideas as a database, not a vote. One list, one upvote per person, sort by
// interest or recency. Promoting an idea creates an event but leaves the idea
// in place — nothing ever archives. The "Plan" badge is just a derived view
// of whether a matching event exists.

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useName } from '@/lib/useName'
import { categoryFor } from '@/lib/categories'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import IconTile from '../components/IconTile'
import StatusChip from '../components/StatusChip'
import Icon from '../components/Icon'

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
  status: string
}

type SortMode = 'momentum' | 'recent'

function likedKeyFor(key: string) {
  return `summer-likes-${key}`
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
  const [sortMode, setSortMode] = useState<SortMode>('momentum')
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())

  const formRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    void loadIdeasSurface()
  }, [])

  useEffect(() => {
    const storageKey = authUser?.email ?? name
    if (!storageKey) return
    const liked = localStorage.getItem(likedKeyFor(storageKey))
    setLikedIds(liked ? new Set(JSON.parse(liked)) : new Set())
  }, [authUser?.email, name])

  async function loadIdeasSurface() {
    setLoading(true)
    const [
      { data: ideaRows, error: ideasError },
      { data: eventRows, error: eventsError },
    ] = await Promise.all([
      supabase
        .from('ideas')
        .select('id, title, description, submitted_by, likes, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('events')
        .select('id, title, status'),
    ])

    if (ideasError) console.error('load ideas:', ideasError)
    if (eventsError) console.error('load linked events:', eventsError)

    setIdeas((ideaRows ?? []) as Idea[])
    setEvents((eventRows ?? []) as EventLite[])
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

  async function toggleInterest(idea: Idea) {
    if (!name || likingId === idea.id) return
    setLikingId(idea.id)

    const storageKey = authUser?.email ?? name
    const alreadyLiked = likedIds.has(idea.id)
    const nextLikedIds = new Set(likedIds)
    if (alreadyLiked) nextLikedIds.delete(idea.id)
    else nextLikedIds.add(idea.id)
    const nextLikes = Math.max(0, alreadyLiked ? idea.likes - 1 : idea.likes + 1)

    setLikedIds(nextLikedIds)
    localStorage.setItem(likedKeyFor(storageKey), JSON.stringify([...nextLikedIds]))
    setIdeas((current) => current.map((row) => (
      row.id === idea.id ? { ...row, likes: nextLikes } : row
    )))

    const { error } = await supabase.from('ideas').update({ likes: nextLikes }).eq('id', idea.id)
    if (error) {
      // Rollback on failure so the local count doesn't drift from the DB.
      setLikedIds(likedIds)
      localStorage.setItem(likedKeyFor(storageKey), JSON.stringify([...likedIds]))
      setIdeas((current) => current.map((row) => (
        row.id === idea.id ? { ...row, likes: idea.likes } : row
      )))
    }

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

    setPlanningId(null)
    router.push(`/events/${data.id}`)
  }

  const sortedIdeas = [...ideas].sort((a, b) => {
    if (sortMode === 'momentum') {
      if (b.likes !== a.likes) return b.likes - a.likes
    }
    return (b.created_at ?? '').localeCompare(a.created_at ?? '')
  })

  return (
    <main className="max-w-md mx-auto px-5">
      <PageHeader
        variant="title"
        title="Ideas"
        subtitle="Capture every idea. Tap interested to surface the ones with traction."
        action={name ? (
          <div className="flex justify-end">
            <button type="button"
              onClick={revealForm}
              className="inline-flex items-center gap-2 rounded-[18px] bg-olive px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition-transform active:scale-[0.98]"
            >
              <Icon name="plus" size={16} />
              Add Idea
            </button>
          </div>
        ) : undefined}
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
                <button type="button"
                  onClick={() => {
                    setShowForm(false)
                    setTitle('')
                    setDescription('')
                  }}
                  className="text-ink-faint transition-colors hover:text-ink-soft"
                  aria-label="Close add idea form"
                >
                  <Icon name="x" size={16} />
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
              <button type="button"
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
      ) : sortedIdeas.length === 0 ? (
        <Card className="mt-6 py-8 text-center">
          <p className="font-semibold text-ink">No ideas yet</p>
          <p className="mt-1 text-sm text-ink-soft">Drop the first one and start the list.</p>
        </Card>
      ) : (
        <>
          <div className="mt-6 mb-3 flex items-baseline justify-between gap-3">
            <p className="text-xs font-semibold text-ink-soft">
              {sortedIdeas.length} idea{sortedIdeas.length === 1 ? '' : 's'} in the bank
            </p>
            <label className="flex items-center gap-1 text-sm font-medium text-ink-soft">
              <span>Sort</span>
              <div className="relative">
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as SortMode)}
                  className="appearance-none bg-transparent pr-5 font-semibold text-ink focus:outline-none"
                >
                  <option value="momentum">Most interest</option>
                  <option value="recent">Newest</option>
                </select>
                <Icon name="chevronDown" size={14} className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-ink-mute" />
              </div>
            </label>
          </div>

          <div className="flex flex-col gap-3 pb-4">
            {sortedIdeas.map((idea) => (
              <IdeaRow
                key={idea.id}
                idea={idea}
                liked={likedIds.has(idea.id)}
                liking={likingId === idea.id}
                planning={planningId === idea.id}
                deleting={deletingId === idea.id}
                isOwner={name === idea.submitted_by}
                plannedEvent={findMatchingEvent(idea.title, events) ?? null}
                onToggleInterest={() => void toggleInterest(idea)}
                onPlan={() => void planIdea(idea)}
                onDelete={() => void deleteIdea(idea)}
              />
            ))}
          </div>
        </>
      )}
    </main>
  )
}

function IdeasSkeleton() {
  return (
    <div className="mt-6 animate-pulse">
      <div className="h-32 rounded-[var(--radius-lg)] bg-cream" />
      <div className="mt-3 h-32 rounded-[var(--radius-lg)] bg-cream" />
      <div className="mt-3 h-32 rounded-[var(--radius-lg)] bg-cream" />
    </div>
  )
}

function IdeaRow({
  idea,
  liked,
  liking,
  planning,
  deleting,
  isOwner,
  plannedEvent,
  onToggleInterest,
  onPlan,
  onDelete,
}: {
  idea: Idea
  liked: boolean
  liking: boolean
  planning: boolean
  deleting: boolean
  isOwner: boolean
  plannedEvent: EventLite | null
  onToggleInterest: () => void
  onPlan: () => void
  onDelete: () => void
}) {
  const category = categoryFor(idea.title)

  return (
    <Card className="p-3.5">
      <div className="flex items-start gap-3">
        <IconTile name={category.iconName} tint={category.tint} size={64} rounded="full" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[18px] font-bold leading-tight text-ink">{idea.title}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-soft">
                {idea.submitted_by ? <span>by {idea.submitted_by}</span> : null}
                {plannedEvent ? (
                  <StatusChip status={plannedEvent.status === 'confirmed' ? 'confirmed' : 'voting'} size="xs" />
                ) : null}
              </div>
            </div>
            {isOwner ? (
              <button type="button"
                onClick={onDelete}
                disabled={deleting}
                className="rounded-[12px] p-1 text-ink-faint transition-colors hover:text-blush disabled:opacity-40"
                aria-label="Delete idea"
              >
                <Icon name="x" size={14} />
              </button>
            ) : null}
          </div>

          {idea.description ? (
            <p className="mt-2 text-sm leading-6 text-ink-soft line-clamp-3">{idea.description}</p>
          ) : null}

          <div className="mt-3 flex items-center gap-2">
            <button type="button"
              onClick={onToggleInterest}
              disabled={liking}
              aria-pressed={liked}
              className={[
                'inline-flex items-center gap-1.5 rounded-[14px] px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40',
                liked ? 'bg-olive text-white' : 'bg-sand text-ink-soft hover:bg-sand-alt',
              ].join(' ')}
            >
              <Icon name={liked ? 'check' : 'plus'} size={13} />
              {liked ? 'Interested' : 'Interested?'}
              <span className={liked ? 'text-white/80' : 'text-ink-mute'}>· {idea.likes}</span>
            </button>
            {plannedEvent ? (
              <Link
                href={`/events/${plannedEvent.id}`}
                className="ml-auto inline-flex items-center gap-1.5 rounded-[14px] bg-sage-tint px-3 py-2 text-sm font-semibold text-sage"
              >
                Open event
                <Icon name="chevronRight" size={13} />
              </Link>
            ) : (
              <button type="button"
                onClick={onPlan}
                disabled={planning}
                className="ml-auto inline-flex items-center gap-2 rounded-[14px] bg-olive px-3.5 py-2 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40"
              >
                {planning ? 'Planning…' : 'Plan Event'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
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
