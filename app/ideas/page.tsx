'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useName } from '@/lib/useName'

type Idea = {
  id: string
  title: string
  description: string | null
  submitted_by: string | null
  likes: number
}

function getLikedKey(n: string) { return `summer-likes-${n}` }

export default function IdeasPage() {
  const [name] = useName()
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [likingId, setLikingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadIdeas() }, [])

  // Load persisted likes when name is set
  useEffect(() => {
    if (!name) return
    const stored = localStorage.getItem(getLikedKey(name))
    setLikedIds(stored ? new Set(JSON.parse(stored)) : new Set())
  }, [name])

  async function loadIdeas() {
    setLoading(true)
    const { data, error } = await supabase
      .from('ideas')
      .select('id, title, description, submitted_by, likes')
      .order('likes', { ascending: false })
    if (error) console.error('loadIdeas:', error)
    if (data) setIdeas(data)
    setLoading(false)
  }

  async function submitIdea() {
    if (!title.trim() || !name) return
    setSubmitting(true)
    const { error } = await supabase.from('ideas').insert({
      title: title.trim(),
      description: description.trim() || null,
      submitted_by: name,
      likes: 0,
    })
    if (error) console.error('submitIdea:', error)
    setTitle('')
    setDescription('')
    await loadIdeas()
    setSubmitting(false)
  }

  async function toggleLike(idea: Idea) {
    if (!name || likingId === idea.id) return
    setLikingId(idea.id)

    const alreadyLiked = likedIds.has(idea.id)

    // Update liked state + persist to localStorage
    const newLiked = new Set(likedIds)
    alreadyLiked ? newLiked.delete(idea.id) : newLiked.add(idea.id)
    setLikedIds(newLiked)
    localStorage.setItem(getLikedKey(name), JSON.stringify([...newLiked]))

    // Optimistic UI update
    const newLikes = alreadyLiked ? idea.likes - 1 : idea.likes + 1
    setIdeas((prev) => prev.map((i) => i.id === idea.id ? { ...i, likes: newLikes } : i))

    // Write to DB then reload for accurate count
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

  return (
    <main className="min-h-screen bg-gray-50 pb-10">
      <div className="max-w-md mx-auto px-5">
        <div className="pt-5 pb-1">
          <a href="/" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Back</a>
        </div>

        <div className="mt-4 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">Ideas Hub</h1>
        </div>
        <p className="text-sm text-gray-500 mb-5">Throw out ideas. Like the ones you&apos;re into.</p>

        {/* Submit form */}
        {name && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Add an idea</p>
            <input
              type="text"
              placeholder="What's the idea?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && submitIdea()}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-green-400 transition"
            />
            <textarea
              placeholder="Any details? (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none transition"
            />
            <button
              onClick={submitIdea}
              disabled={!title.trim() || submitting}
              className="w-full bg-green-600 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-40 hover:bg-green-700 active:scale-[0.98] transition-all"
            >
              {submitting ? 'Posting...' : 'Post Idea'}
            </button>
          </div>
        )}

        {/* Ideas list */}
        {loading && (
          <div className="text-center py-12 text-gray-300 text-sm">Loading...</div>
        )}

        {!loading && ideas.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">💡</div>
            <p className="text-gray-500 font-semibold">No one has posted yet</p>
            <p className="text-gray-400 text-sm mt-1">Be the one who starts it off!</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {ideas.map((idea) => {
            const isOwner = name === idea.submitted_by
            return (
              <div
                key={idea.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start gap-3"
              >
                {/* Like button */}
                <button
                  onClick={() => toggleLike(idea)}
                  disabled={!name || likingId === idea.id}
                  className={`flex flex-col items-center min-w-[44px] rounded-xl py-2 px-2 transition-all active:scale-90 disabled:opacity-50 ${
                    likedIds.has(idea.id)
                      ? 'bg-green-100 text-green-600'
                      : 'bg-gray-50 text-gray-400 hover:bg-green-50 hover:text-green-500'
                  }`}
                >
                  <span className="text-xl leading-none">👍</span>
                  <span className="text-xs font-bold mt-0.5">{idea.likes}</span>
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm leading-snug">{idea.title}</p>
                  {idea.description && (
                    <p className="text-xs text-gray-500 mt-1 leading-snug">{idea.description}</p>
                  )}
                  <p className="text-xs text-gray-300 mt-1.5">— {idea.submitted_by}</p>
                </div>

                {/* Delete button (owner only) */}
                {isOwner && (
                  <button
                    onClick={() => deleteIdea(idea)}
                    disabled={deletingId === idea.id}
                    className="text-gray-200 hover:text-red-400 transition-colors text-lg leading-none shrink-0 disabled:opacity-40 active:scale-90"
                    title="Delete idea"
                  >
                    {deletingId === idea.id ? '...' : '×'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
