'use client'

// Me — personal dashboard.
//  1. Name + avatar + "member of the crew"
//  2. My availability summary (# blocked days, # free weeks)
//  3. My stuff — events I'm hosting, ideas I've posted
//  4. Settings — change name, clear data

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useName } from '@/lib/useName'
import { loadPlanData, PlanData } from '@/lib/planData'
import { categoryFor } from '@/lib/categories'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Avatar from '../components/Avatar'
import IconTile from '../components/IconTile'
import StatusChip from '../components/StatusChip'
import { ChevronRightIcon, CalendarIcon, LightbulbIcon } from '../components/icons'

export default function MePage() {
  const { authUser, signOut } = useAuth()
  const [name, setName] = useName()
  const [data, setData] = useState<PlanData | null>(null)
  const [editingName, setEditingName] = useState(!name)
  const [draft, setDraft] = useState(name)
  const [savingName, setSavingName] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => { setDraft(name) }, [name])

  useEffect(() => {
    let alive = true
    loadPlanData(name || null).then((d) => { if (alive) setData(d) })
    return () => { alive = false }
  }, [name])

  const myBlackoutDates = data?.availability.filter((a) => data.userMap[a.user_id] === name).length ?? 0
  const myEvents  = data?.events.filter((e) => e.created_by === name) ?? []
  const myIdeas   = data?.ideas.filter((i) => i.submitted_by === name) ?? []

  async function saveName() {
    const trimmed = draft.trim()
    if (!trimmed) return
    setSavingName(true)
    try {
      await setName(trimmed)
      setEditingName(false)
    } finally {
      setSavingName(false)
    }
  }

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <main className="max-w-md mx-auto px-5">
      <PageHeader variant="title" title="Me" subtitle="Your corner of the app" />

      {/* Identity card */}
      <Card className="flex items-center gap-4 mb-5">
        {name ? (
          <Avatar name={name} size={64} />
        ) : (
          <div className="w-16 h-16 rounded-full bg-stone flex items-center justify-center text-ink-soft font-bold text-xl">?</div>
        )}
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void saveName() }}
                placeholder="Your name"
                autoFocus
                className="w-full bg-sand border-0 rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive transition"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveName}
                  disabled={!draft.trim() || savingName}
                  className="flex-1 bg-olive text-white rounded-xl py-2 text-sm font-bold disabled:opacity-40 active:scale-[0.98] transition-transform"
                >
                  {savingName ? 'Saving…' : 'Save'}
                </button>
                {name && (
                  <button
                    onClick={() => { setEditingName(false); setDraft(name) }}
                    className="px-4 bg-sand text-ink-soft rounded-xl py-2 text-sm font-semibold active:scale-[0.98] transition-transform"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <h2 className="font-serif text-2xl font-black text-ink tracking-tight truncate">{name}</h2>
              <p className="text-sm text-ink-soft">Member of the crew</p>
              {authUser?.email && (
                <p className="text-xs text-ink-mute mt-1">{authUser.email}</p>
              )}
              <button
                onClick={() => setEditingName(true)}
                className="mt-1 text-xs font-semibold text-olive"
              >
                Change name
              </button>
            </>
          )}
        </div>
      </Card>

      {/* Summary tiles */}
      {name && (
        <section className="grid grid-cols-2 gap-3 mb-5">
          <StatBlock
            tint="blush"
            value={myBlackoutDates}
            label={myBlackoutDates === 1 ? 'blocked day' : 'blocked days'}
            sub={<Link href="/availability" className="text-olive font-semibold">Edit</Link>}
          />
          <StatBlock
            tint="teal"
            value={myEvents.length}
            label="hosting"
            sub={<Link href="/events" className="text-olive font-semibold">See all</Link>}
          />
          <StatBlock
            tint="amber"
            value={myIdeas.length}
            label={myIdeas.length === 1 ? 'idea' : 'ideas'}
            sub={<Link href="/ideas" className="text-olive font-semibold">See all</Link>}
          />
          <StatBlock
            tint="olive"
            value={data?.totalFriends ?? 12}
            label="in the crew"
            sub={<span className="text-ink-mute">Summer 2026</span>}
          />
        </section>
      )}

      {/* Events I'm hosting */}
      {name && myEvents.length > 0 && (
        <section className="mb-5">
          <h2 className="font-serif text-2xl font-black text-ink tracking-tight mb-3">You&apos;re hosting</h2>
          <div className="flex flex-col gap-2.5">
            {myEvents.map((ev) => {
              const cat = categoryFor(ev.title)
              return (
                <Link key={ev.id} href={`/events/${ev.id}`}>
                  <Card className="flex items-center gap-3">
                    <IconTile Icon={cat.Icon} tint={cat.tint} size={44} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink truncate">{ev.title}</p>
                      <p className="text-xs text-ink-soft mt-0.5">
                        {ev.dateOptions.length} options · {ev.voteCount} votes
                      </p>
                    </div>
                    <StatusChip status={ev.displayStatus} size="xs" />
                    <ChevronRightIcon size={18} className="text-ink-faint" />
                  </Card>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Ideas I've posted */}
      {name && myIdeas.length > 0 && (
        <section className="mb-5">
          <h2 className="font-serif text-2xl font-black text-ink tracking-tight mb-3">Ideas you dropped</h2>
          <div className="flex flex-col gap-2.5">
            {myIdeas.slice(0, 4).map((idea) => {
              const cat = categoryFor(idea.title)
              return (
                <Card key={idea.id} className="flex items-center gap-3">
                  <IconTile Icon={cat.Icon} tint={cat.tint} size={40} />
                  <p className="flex-1 font-semibold text-ink text-sm truncate">{idea.title}</p>
                  <span className="text-xs font-bold text-ink-soft">{idea.likes} ♥</span>
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {/* Quick links */}
      <section className="mb-10">
        <h2 className="font-serif text-2xl font-black text-ink tracking-tight mb-3">Shortcuts</h2>
        <Card padded={false}>
          <NavRow Icon={CalendarIcon} tint="olive" title="Mark availability" sub="Block out your no-go dates" href="/availability" />
          <Divider />
          <NavRow Icon={LightbulbIcon} tint="amber" title="Browse ideas" sub="See what the crew is into" href="/ideas" />
        </Card>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="mt-3 w-full rounded-[var(--radius-lg)] bg-stone px-4 py-3 text-sm font-semibold text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </section>

      {!data && name && (
        <div className="h-24 bg-cream rounded-[var(--radius-lg)] animate-pulse" />
      )}
    </main>
  )
}

/* ─────────────────────────────────────────────────────────────── */

function StatBlock({
  tint, value, label, sub,
}: {
  tint: 'olive' | 'terracotta' | 'teal' | 'amber' | 'blush' | 'sage' | 'lavender'
  value: number | string
  label: string
  sub: React.ReactNode
}) {
  const tintTextCls = {
    olive: 'text-olive',
    terracotta: 'text-terracotta',
    teal: 'text-teal',
    amber: 'text-amber',
    blush: 'text-blush',
    sage: 'text-sage',
    lavender: 'text-lavender',
  }[tint]
  return (
    <div className="bg-cream rounded-[var(--radius-lg)] shadow-[var(--shadow-soft)] p-4 flex flex-col gap-1">
      <p className={`font-serif text-3xl font-black ${tintTextCls} leading-none`}>{value}</p>
      <p className="text-xs font-semibold text-ink">{label}</p>
      <p className="text-[11px] mt-1">{sub}</p>
    </div>
  )
}

function NavRow({
  Icon, tint, title, sub, href,
}: {
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number }>
  tint: 'olive' | 'terracotta' | 'teal' | 'amber' | 'blush' | 'sage' | 'lavender'
  title: string
  sub: string
  href: string
}) {
  return (
    <Link href={href} className="flex items-center gap-3 p-4 active:bg-sand-alt transition-colors">
      <IconTile Icon={Icon} tint={tint} size={40} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-ink">{title}</p>
        <p className="text-xs text-ink-soft">{sub}</p>
      </div>
      <ChevronRightIcon size={18} className="text-ink-faint" />
    </Link>
  )
}

function Divider() {
  return <div className="h-px bg-sand-alt mx-4" />
}
