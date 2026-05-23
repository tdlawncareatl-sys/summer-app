'use client'

// Detail page for a single idea. Lives in its own route so links from
// notifications, share sheets, and the Wheel detail panel all land somewhere
// real — and so the avatars of interested users have room to breathe.

import Link from 'next/link'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useName } from '@/lib/useName'
import { ensureUser } from '@/lib/ensureUser'
import { categoryFor } from '@/lib/categories'
import PageHeader from '../../components/PageHeader'
import Card from '../../components/Card'
import IconTile from '../../components/IconTile'
import StatusChip from '../../components/StatusChip'
import Avatar, { AvatarStack } from '../../components/Avatar'
import Icon from '../../components/Icon'

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

export default function IdeaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { authUser } = useAuth()
  const [name] = useName()
  const [idea, setIdea] = useState<Idea | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [interestedNames, setInterestedNames] = useState<string[]>([])
  const [plannedEvent, setPlannedEvent] = useState<EventLite | null>(null)
  const [liked, setLiked] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [busy, setBusy] = useState<'like' | 'plan' | 'delete' | null>(null)

  useEffect(() => {
    void loadDetail()
  }, [id])

  useEffect(() => {
    let alive = true
    async function resolveMe() {
      if (!name && !authUser?.email) return
      try {
        const userId = await ensureUser(name ?? authUser?.email ?? '')
        if (!alive) return
        setCurrentUserId(userId)
        const { data } = await supabase
          .from('idea_likes')
          .select('idea_id')
          .eq('user_id', userId)
          .eq('idea_id', id)
          .maybeSingle()
        if (!alive) return
        setLiked(!!data)
      } catch {
        // not authed — leave liked = false
      }
    }
    void resolveMe()
    return () => {
      alive = false
    }
  }, [authUser?.email, name, id])

  async function loadDetail() {
    setLoading(true)
    const [
      { data: ideaRow, error: ideaErr },
      { data: likeRows },
      { data: eventRows },
    ] = await Promise.all([
      supabase
        .from('ideas')
        .select('id, title, description, submitted_by, likes, created_at')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('idea_likes')
        .select('user_id')
        .eq('idea_id', id),
      supabase
        .from('events')
        .select('id, title, status'),
    ])

    if (ideaErr) console.error('load idea detail:', ideaErr)
    if (!ideaRow) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setIdea(ideaRow as Idea)

    const userIds = (likeRows ?? []).map((r) => r.user_id as string)
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, name')
        .in('id', userIds)
      setInterestedNames((users ?? []).map((u) => u.name as string).filter(Boolean))
    } else {
      setInterestedNames([])
    }

    const match = (eventRows ?? []).find((e) => titlesMatch(e.title, ideaRow.title)) as EventLite | undefined
    setPlannedEvent(match ?? null)
    setLoading(false)
  }

  async function toggleInterest() {
    if (!idea || !name || busy) return
    setBusy('like')

    let userId = currentUserId
    if (!userId) {
      try {
        userId = await ensureUser(name)
        setCurrentUserId(userId)
      } catch (err) {
        console.error('ensureUser:', err)
        setBusy(null)
        return
      }
    }

    const op = liked
      ? supabase.from('idea_likes').delete().eq('idea_id', idea.id).eq('user_id', userId)
      : supabase.from('idea_likes').insert({ idea_id: idea.id, user_id: userId })

    const { error } = await op
    if (error) {
      console.error('toggle interest:', error)
    } else {
      setLiked(!liked)
      // Refresh count + roster from source of truth (cheap reads).
      await loadDetail()
    }
    setBusy(null)
  }

  async function planEvent() {
    if (!idea || !name || busy) return
    setBusy('plan')

    if (plannedEvent) {
      router.push(`/events/${plannedEvent.id}`)
      setBusy(null)
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

    setBusy(null)
    if (error) {
      console.error('plan idea:', error)
      return
    }
    router.push(`/events/${data.id}`)
  }

  async function deleteIdea() {
    if (!idea || busy) return
    if (typeof window !== 'undefined' && !window.confirm('Delete this idea? This can\'t be undone.')) return
    setBusy('delete')
    const { error } = await supabase.from('ideas').delete().eq('id', idea.id)
    if (error) {
      console.error('delete idea:', error)
      setBusy(null)
      return
    }
    router.push('/ideas')
  }

  if (loading) {
    return (
      <main className="max-w-md mx-auto px-5">
        <BackToIdeasLink />
        <PageHeader variant="title" title="Idea" />
        <div className="mt-6 animate-pulse">
          <div className="h-40 rounded-[var(--radius-lg)] bg-cream" />
        </div>
      </main>
    )
  }

  if (notFound || !idea) {
    return (
      <main className="max-w-md mx-auto px-5">
        <BackToIdeasLink />
        <PageHeader variant="title" title="Idea not found" />
        <Card className="mt-6 py-8 text-center">
          <p className="text-sm text-ink-soft">This idea may have been deleted.</p>
          <Link
            href="/ideas"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-olive"
          >
            Back to Ideas
            <Icon name="chevronRight" size={14} />
          </Link>
        </Card>
      </main>
    )
  }

  const category = categoryFor(idea.title)
  const isOwner = !!name && name === idea.submitted_by

  return (
    <main className="max-w-md mx-auto px-5 pb-8">
      <BackToIdeasLink />
      <PageHeader variant="title" title="Idea" />

      <Card className="mt-4 p-4">
        <div className="flex items-start gap-3">
          <IconTile name={category.iconName} tint={category.tint} size={72} rounded="full" />
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-[24px] font-black leading-tight text-ink">{idea.title}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-soft">
              {idea.submitted_by ? <span>by {idea.submitted_by}</span> : null}
              {plannedEvent ? (
                <StatusChip status={plannedEvent.status === 'confirmed' ? 'confirmed' : 'voting'} size="xs" />
              ) : null}
            </div>
          </div>
          {isOwner ? (
            <button
              type="button"
              onClick={() => void deleteIdea()}
              disabled={busy === 'delete'}
              className="rounded-[12px] p-2 text-ink-faint transition-colors hover:text-blush disabled:opacity-40"
              aria-label="Delete idea"
            >
              <Icon name="x" size={16} />
            </button>
          ) : null}
        </div>

        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-mute">Description</p>
          {idea.description ? (
            <p className="mt-1 text-sm leading-6 text-ink-soft">{idea.description}</p>
          ) : (
            <p className="mt-1 text-sm italic text-ink-mute">No description yet.</p>
          )}
        </div>
      </Card>

      <Card className="mt-3 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-mute">Interest</p>
          <p className="text-xs font-semibold text-ink-soft">{idea.likes} interested</p>
        </div>
        {interestedNames.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <AvatarStack names={interestedNames} max={6} size={30} />
            <span className="text-xs text-ink-soft">
              {interestedNames.slice(0, 3).join(', ')}
              {interestedNames.length > 3 ? ` + ${interestedNames.length - 3} more` : ''}
            </span>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-mute">No one has tapped interested yet. Be first.</p>
        )}
        {name ? (
          <button
            type="button"
            onClick={() => void toggleInterest()}
            disabled={busy === 'like'}
            aria-pressed={liked}
            className={[
              'mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[16px] px-4 py-3 text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-40',
              liked ? 'bg-olive text-white shadow-[var(--shadow-soft)]' : 'bg-sand text-ink-soft hover:bg-sand-alt',
            ].join(' ')}
          >
            <Icon name={liked ? 'check' : 'plus'} size={14} />
            {liked ? "You're interested" : "I'm interested"}
          </button>
        ) : null}
      </Card>

      <div className="mt-4">
        {plannedEvent ? (
          <Link
            href={`/events/${plannedEvent.id}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-[16px] bg-sage-tint px-4 py-3.5 text-sm font-bold text-sage"
          >
            Open event
            <Icon name="chevronRight" size={14} />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => void planEvent()}
            disabled={!name || busy === 'plan'}
            className="inline-flex w-full items-center justify-center gap-2 rounded-[16px] bg-olive px-4 py-3.5 text-sm font-bold text-white shadow-[var(--shadow-soft)] transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            {busy === 'plan' ? 'Planning…' : 'Plan Event from this idea'}
          </button>
        )}
      </div>
    </main>
  )
}

function BackToIdeasLink() {
  return (
    <Link
      href="/ideas"
      className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-olive"
    >
      <Icon name="chevronRight" size={14} className="rotate-180" />
      Ideas
    </Link>
  )
}

function normalizeTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function titlesMatch(a: string, b: string) {
  return normalizeTitle(a) === normalizeTitle(b)
}
