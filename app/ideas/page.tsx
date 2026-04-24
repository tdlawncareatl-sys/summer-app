'use client'

// Ideas — the backlog of "things we could do." Funnel shape:
//  - Top (most liked) — the ones gathering momentum
//  - Everything else — recent chronological
//  - Each idea has: tint+icon, like, "Turn into plan" CTA (→ create event)
//  - Inline "add idea" card at the top.

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useName } from '@/lib/useName'
import { categoryFor } from '@/lib/categories'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import IconTile from '../components/IconTile'
import Avatar from '../components/Avatar'
import { PlusIcon, StarIcon, XIcon } from '../components/icons'

type Idea = {
  id: string
  title: string
  description: string | null
  submitted_by: string | null
  likes: number
  created_at?: string
}

function getLikedKey(key: string) { return `summer-likes-${key}` }

export default function IdeasPage() {
  const { authUser } = useAuth()
  const [name] = useName()
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [likingId, setLikingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadIdeas() }, [])

  useEffect(() => {
    const likeKey = authUser?.email ?? name
    if (!likeKey) return
    const stored = localStorage.getItem(getLikedKey(likeKey))
    setLikedIds(stored ? new Set(JSON.parse(stored)) : new Set())
  }, [authUser?.email, name])

  async function loadIdeas() {
    setLoading(true)
    const { data, error } = await supabase
      .from('ideas')
      .select('id, title, description, submitted_by, likes, created_at')
      .order('likes', { ascending: false })
    if (error) console.error('loadIdeas:', error)
    if (data) setIdeas(data as Idea[])
    setLoading(false)
  }

  async function submitIdea() {
    if (!title.trim() || !name) return
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
    await loadIdeas()
    setSubmitting(false)
  }

  async function toggleLike(idea: Idea) {
    if (!name || likingId === idea.id) return
    setLikingId(idea.id)

    const alreadyLiked = likedIds.has(idea.id)
    const newLiked = new Set(likedIds)
    if (alreadyLiked) newLiked.delete(idea.id); else newLiked.add(idea.id)
    setLikedIds(newLiked)
    localStorage.setItem(getLikedKey(authUser?.email ?? name), JSON.stringify([...newLiked]))

    const newLikes = alreadyLiked ? idea.likes - 1 : idea.likes + 1
    setIdeas((prev) => prev.map((i) => i.id === idea.id ? { ...i, likes: newLikes } : i))

    await supabase.from('ideas').update({ likes: newLikes }).eq('id', idea.id)
    await loadIdeas()
    setLikingId(null)
  }

  async function deleteIdea(idea: Idea) {
    if (deletingId) return
    setDeletingId(idea.id)
    await supabase.from('ideas').delete().eq('id', idea.id)
    setIdeas((prev) => prev.filter((i) => i.id !== idea.id))
    setDeletingId(null)
  }

  const top = ideas.slice(0, 3).filter((i) => i.likes > 0)
  const topIds = new Set(top.map((i) => i.id))
  const rest = ideas.filter((i) => !topIds.has(i.id))

  return (
    <main className="max-w-md mx-auto px-5">
      <PageHeader
        variant="title"
        title="Ideas"
        subtitle="Throw things out. The group tells you what they're into."
      />

      {/* Add idea */}
      {name && (
        <Card className="mb-5">
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center gap-3 text-left"
            >
              <span className="w-10 h-10 rounded-xl bg-amber-tint text-amber flex items-center justify-center shrink-0">
                <PlusIcon size={18} />
              </span>
              <span className="flex-1">
                <span className="block font-semibold text-ink">Drop an idea</span>
                <span className="block text-xs text-ink-soft mt-0.5">No commitment — just a seed</span>
              </span>
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <p className="text-xs font-bold text-ink-mute uppercase tracking-wider">New idea</p>
                <button
                  onClick={() => { setShowForm(false); setTitle(''); setDescription('') }}
                  className="text-ink-faint hover:text-ink-soft transition-colors"
                  aria-label="Cancel"
                >
                  <XIcon size={16} />
                </button>
              </div>
              <input
                type="text"
                placeholder="What's the idea?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && submitIdea()}
                autoFocus
                className="w-full bg-sand border-0 rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive transition"
              />
              <textarea
                placeholder="Any details? (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-sand border-0 rounded-xl px-3 py-2.5 text-sm text-ink resize-none focus:outline-none focus:ring-2 focus:ring-olive transition"
              />
              <button
                onClick={submitIdea}
                disabled={!title.trim() || submitting}
                className="w-full bg-olive text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                {submitting ? 'Posting…' : 'Post idea'}
              </button>
            </div>
          )}
        </Card>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="flex flex-col gap-3 animate-pulse">
          <div className="h-24 bg-cream rounded-[var(--radius-lg)]" />
          <div className="h-24 bg-cream rounded-[var(--radius-lg)]" />
          <div className="h-24 bg-cream rounded-[var(--radius-lg)]" />
        </div>
      )}

      {/* Empty */}
      {!loading && ideas.length === 0 && (
        <Card className="text-center py-10">
          <p className="font-semibold text-ink">No ideas yet</p>
          <p className="text-sm text-ink-soft mt-1">Be the one who starts it off.</p>
        </Card>
      )}

      {/* Top */}
      {top.length > 0 && (
        <section className="mb-6">
          <h2 className="font-serif text-2xl font-black text-ink tracking-tight mb-3">Gathering steam</h2>
          <div className="flex flex-col gap-2.5">
            {top.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                liked={likedIds.has(idea.id)}
                likingId={likingId}
                deletingId={deletingId}
                isOwner={name === idea.submitted_by}
                onLike={() => toggleLike(idea)}
                onDelete={() => deleteIdea(idea)}
                featured
              />
            ))}
          </div>
        </section>
      )}

      {/* Rest */}
      {rest.length > 0 && (
        <section className="mb-4">
          <h2 className="font-serif text-2xl font-black text-ink tracking-tight mb-3">
            {top.length > 0 ? 'Everything else' : 'All ideas'}
          </h2>
          <div className="flex flex-col gap-2.5">
            {rest.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                liked={likedIds.has(idea.id)}
                likingId={likingId}
                deletingId={deletingId}
                isOwner={name === idea.submitted_by}
                onLike={() => toggleLike(idea)}
                onDelete={() => deleteIdea(idea)}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

/* ─────────────────────────────────────────────────────────────── */

function IdeaCard({
  idea, liked, likingId, deletingId, isOwner, onLike, onDelete, featured = false,
}: {
  idea: Idea
  liked: boolean
  likingId: string | null
  deletingId: string | null
  isOwner: boolean
  onLike: () => void
  onDelete: () => void
  /** Larger icon tile for "top" / featured ideas */
  featured?: boolean
}) {
  const cat = categoryFor(idea.title)
  return (
    <Card className="flex gap-3">
      <IconTile Icon={cat.Icon} tint={cat.tint} size={featured ? 52 : 44} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-ink leading-snug">{idea.title}</p>
        {idea.description && (
          <p className="text-xs text-ink-soft mt-1 leading-snug line-clamp-2">{idea.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          {idea.submitted_by && (
            <div className="flex items-center gap-1.5">
              <Avatar name={idea.submitted_by} size={18} />
              <span className="text-[11px] text-ink-mute">{idea.submitted_by}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-2">
        <button
          onClick={onLike}
          disabled={likingId === idea.id}
          className={[
            'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all active:scale-90 disabled:opacity-50',
            liked ? 'bg-olive text-white' : 'bg-sand text-ink-soft hover:bg-olive-tint hover:text-olive',
          ].join(' ')}
          aria-pressed={liked}
        >
          <StarIcon size={12} />
          {idea.likes}
        </button>
        {isOwner && (
          <button
            onClick={onDelete}
            disabled={deletingId === idea.id}
            className="text-ink-faint hover:text-blush transition-colors disabled:opacity-40"
            aria-label="Delete idea"
          >
            <XIcon size={14} />
          </button>
        )}
      </div>

    </Card>
  )
}
