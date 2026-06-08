'use client'

// This Week — casual, low-friction weekly hangout planning. Deliberately
// lighter than the formal events flow: pick candidate nights, friends tap
// Works/Pass (+ one Best star), toss out simple ideas, the creator confirms a
// day, and a confirmed plan can graduate into a real event.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useName } from '@/lib/useName'
import { ensureUser } from '@/lib/ensureUser'
import { todayLocalISO } from '@/lib/date'
import {
  weekStartFor,
  weekDays,
  shiftWeek,
  dayWeekday,
  dayLabel,
  dayLong,
  ideaCategoryMeta,
  worksUserIdsForDay,
  topIdeas,
  IDEA_CATEGORIES,
  type ThisWeekData,
  type EnrichedWeeklyPlan,
  type WeeklyVoteRow,
  type DayAvailability,
  type IdeaCategory,
} from '@/lib/weeklyPlans'
import {
  loadThisWeek,
  createWeeklyPlan,
  castWeeklyVote,
  setWeeklyBest,
  addWeeklyIdea,
  confirmWeeklyPlan,
  reopenWeeklyPlan,
  convertWeeklyPlanToEvent,
} from '@/lib/weeklyPlansData'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Icon from '../components/Icon'
import IconTile from '../components/IconTile'
import { AvatarStack } from '../components/Avatar'

export default function ThisWeekPage() {
  const [name] = useName()
  const router = useRouter()
  const [data, setData] = useState<ThisWeekData | null>(null)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  async function reload() {
    const next = await loadThisWeek()
    setData(next)
    setActiveId((current) => {
      if (current && next.plans.some((p) => p.id === current)) return current
      const featured = next.plans.find((p) => p.status === 'open') ?? next.plans[0]
      return featured?.id ?? null
    })
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (name) {
        try {
          const id = await ensureUser(name)
          if (alive) setMyUserId(id)
        } catch {
          /* not signed in yet — voting stays disabled */
        }
      }
      const next = await loadThisWeek()
      if (!alive) return
      setData(next)
      const featured = next.plans.find((p) => p.status === 'open') ?? next.plans[0]
      setActiveId(featured?.id ?? null)
      // Deep link: /this-week?new=1 jumps straight to the create form.
      if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new')) {
        setShowCreate(true)
      }
    })()
    return () => {
      alive = false
    }
  }, [name])

  const activePlan = useMemo(
    () => data?.plans.find((p) => p.id === activeId) ?? data?.plans[0] ?? null,
    [data, activeId],
  )

  const isCreator = !!name && !!activePlan && activePlan.created_by === name

  function flashThen(message: string) {
    setFlash(message)
    setTimeout(() => setFlash(null), 3500)
  }

  return (
    <main className="mx-auto max-w-md px-5">
      <PageHeader variant="title" title="This Week" subtitle="Casual plans — pick a night, no big production." />

      {flash ? (
        <div className="mb-4 rounded-[var(--radius-lg)] bg-olive-soft px-4 py-3 text-sm font-medium text-olive">{flash}</div>
      ) : null}

      {!data ? (
        <PageSkeleton />
      ) : data.tablesMissing ? (
        <SetupNeededCard />
      ) : showCreate || data.plans.length === 0 ? (
        <CreatePlan
          name={name}
          onCancel={data.plans.length > 0 ? () => setShowCreate(false) : undefined}
          onCreated={async (newId) => {
            setShowCreate(false)
            await reload()
            setActiveId(newId)
            flashThen('Plan started — share it and start voting.')
          }}
        />
      ) : activePlan ? (
        <>
          {data.plans.length > 1 ? (
            <PlanSwitcher plans={data.plans} activeId={activePlan.id} onPick={setActiveId} />
          ) : null}

          {activePlan.status === 'open' ? (
            <OpenPlan
              plan={activePlan}
              myUserId={myUserId}
              userMap={data.userMap}
              isCreator={isCreator}
              onChanged={reload}
            />
          ) : (
            <ConfirmedPlan
              plan={activePlan}
              userMap={data.userMap}
              isCreator={isCreator}
              onChanged={reload}
              onConverted={(eventId) => router.push(`/events/${eventId}`)}
            />
          )}

          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-stone/70 bg-cream py-3 text-sm font-semibold text-ink-soft active:scale-[0.99]"
          >
            <Icon name="plus" size={16} />
            Start another plan
          </button>
        </>
      ) : null}
    </main>
  )
}

/* ── Plan switcher ───────────────────────────────────────────────────────── */

function PlanSwitcher({
  plans,
  activeId,
  onPick,
}: {
  plans: EnrichedWeeklyPlan[]
  activeId: string
  onPick: (id: string) => void
}) {
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto scrollbar-hidden -mx-5 px-5">
      {plans.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onPick(p.id)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            p.id === activeId ? 'bg-olive text-white' : 'bg-cream text-ink-soft border border-stone/70'
          }`}
        >
          {p.title}
        </button>
      ))}
    </div>
  )
}

/* ── Create ──────────────────────────────────────────────────────────────── */

function CreatePlan({
  name,
  onCreated,
  onCancel,
}: {
  name: string
  onCreated: (id: string) => void
  onCancel?: () => void
}) {
  const today = todayLocalISO()
  const thisWeek = weekStartFor(today)
  const [weekOffset, setWeekOffset] = useState(0)
  const weekStart = shiftWeek(thisWeek, weekOffset)
  const days = weekDays(weekStart)

  const [title, setTitle] = useState('Hang this week?')
  const [note, setNote] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [category, setCategory] = useState<IdeaCategory | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleDay(iso: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(iso)) next.delete(iso)
      else next.add(iso)
      return next
    })
  }

  async function submit() {
    if (!name || selected.size === 0 || submitting) return
    setSubmitting(true)
    setError(null)
    const candidateDays = [...selected].sort()
    const { id, error: createError } = await createWeeklyPlan({ name, title, note, weekStart, candidateDays })
    if (createError || !id) {
      setError(createError ?? 'Could not create the plan.')
      setSubmitting(false)
      return
    }
    if (category) {
      const meta = ideaCategoryMeta(category)
      await addWeeklyIdea({ planId: id, userId: null, text: meta?.label ?? 'Idea', category })
    }
    onCreated(id)
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">New quick plan</p>
        {onCancel ? (
          <button type="button" onClick={onCancel} aria-label="Cancel" className="text-ink-faint hover:text-ink-soft">
            <Icon name="x" size={16} />
          </button>
        ) : null}
      </div>

      <div className="flex gap-2">
        {[
          { label: 'This week', offset: 0 },
          { label: 'Next week', offset: 1 },
        ].map((w) => (
          <button
            key={w.offset}
            type="button"
            onClick={() => {
              setWeekOffset(w.offset)
              setSelected(new Set())
            }}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
              weekOffset === w.offset ? 'bg-olive text-white' : 'bg-sand text-ink-soft'
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Hang this week?"
        className="w-full rounded-xl border-0 bg-sand px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive"
      />
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="A note (optional)"
        className="w-full rounded-xl border-0 bg-sand px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive"
      />

      <div>
        <p className="mb-2 text-xs font-semibold text-ink-mute">Which nights are on the table?</p>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((iso) => {
            const isPast = iso < today
            const isOn = selected.has(iso)
            return (
              <button
                key={iso}
                type="button"
                disabled={isPast}
                onClick={() => toggleDay(iso)}
                className={`flex flex-col items-center rounded-xl py-2 text-center transition-colors ${
                  isPast
                    ? 'cursor-default text-ink-faint'
                    : isOn
                      ? 'bg-olive text-white'
                      : 'bg-sand text-ink-soft'
                }`}
              >
                <span className="text-[10px] font-semibold uppercase">{dayWeekday(iso).slice(0, 2)}</span>
                <span className="text-sm font-bold">{Number(iso.slice(8, 10))}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-ink-mute">Vibe (optional)</p>
        <div className="flex flex-wrap gap-1.5">
          {IDEA_CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory((prev) => (prev === c.key ? null : c.key))}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                category === c.key ? 'bg-olive text-white' : 'bg-sand text-ink-soft'
              }`}
            >
              <Icon name={c.iconName} size={13} />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm font-medium text-blush">{error}</p> : null}

      <button
        type="button"
        disabled={!name || selected.size === 0 || submitting}
        onClick={submit}
        className="w-full rounded-xl bg-olive py-2.5 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40"
      >
        {submitting ? 'Starting…' : 'Start the plan'}
      </button>
    </Card>
  )
}

/* ── Open plan: voting + results + ideas ─────────────────────────────────── */

function OpenPlan({
  plan,
  myUserId,
  userMap,
  isCreator,
  onChanged,
}: {
  plan: EnrichedWeeklyPlan
  myUserId: string | null
  userMap: Record<string, string>
  isCreator: boolean
  onChanged: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const myVotes = useMemo(
    () => (myUserId ? plan.votes.filter((v) => v.user_id === myUserId) : []),
    [plan.votes, myUserId],
  )
  const myVoteByDay = useMemo(() => {
    const map: Record<string, WeeklyVoteRow> = {}
    for (const v of myVotes) map[v.day] = v
    return map
  }, [myVotes])

  const chronological = useMemo(() => [...plan.candidate_days].sort(), [plan.candidate_days])
  const leadingDayIso = plan.leadingDay?.day ?? null
  const tallyByDay = useMemo(() => {
    const map: Record<string, { worksCount: number; passCount: number; bestCount: number }> = {}
    for (const t of plan.ranked) map[t.day] = t
    return map
  }, [plan.ranked])

  async function run(fn: () => Promise<{ error: string | null }>) {
    if (busy || !myUserId) return
    setBusy(true)
    setError(null)
    const { error: e } = await fn()
    if (e) setError(e)
    await onChanged()
    setBusy(false)
  }

  async function vote(day: string, availability: DayAvailability) {
    await run(() => castWeeklyVote({ planId: plan.id, userId: myUserId!, day, availability, existing: myVoteByDay[day] }))
  }
  async function star(day: string) {
    await run(() => setWeeklyBest({ planId: plan.id, userId: myUserId!, day, myVotes }))
  }
  async function confirm(day: string) {
    if (!window.confirm(`Lock in ${dayLong(day)} for "${plan.title}"?`)) return
    await run(() => confirmWeeklyPlan({ planId: plan.id, day }))
  }

  return (
    <div className="flex flex-col gap-5">
      <PlanHeader plan={plan} />

      <div>
        <p className="text-sm font-semibold text-ink">
          {plan.leadingDay ? (
            <>
              <span className="text-olive">{dayWeekday(plan.leadingDay.day)}</span> is leading
              <span className="text-ink-mute"> · {plan.leadingDay.worksCount} in</span>
            </>
          ) : (
            'No votes yet — be the first to mark a night.'
          )}
        </p>
        {plan.ranked.some((r) => r.worksCount > 0) ? (
          <div className="mt-2 flex gap-2 overflow-x-auto scrollbar-hidden -mx-5 px-5">
            {plan.ranked
              .filter((r) => r.worksCount > 0)
              .slice(0, 4)
              .map((r, i) => (
                <span
                  key={r.day}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-cream border border-stone/70 px-3 py-1 text-xs font-semibold text-ink-soft"
                >
                  <span className="text-ink-mute">#{i + 1}</span>
                  {dayWeekday(r.day)}
                  <span className="text-olive">{r.worksCount}</span>
                </span>
              ))}
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm font-medium text-blush">{error}</p> : null}

      <div className="flex flex-col gap-2.5">
        {chronological.map((iso) => {
          const tally = tallyByDay[iso] ?? { worksCount: 0, passCount: 0, bestCount: 0 }
          const mine = myVoteByDay[iso]
          const isLeading = iso === leadingDayIso
          return (
            <Card key={iso} className={isLeading ? 'border-olive/60 bg-olive-tint/40' : ''}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-ink">{dayLabel(iso)}</p>
                    {isLeading ? (
                      <span className="rounded-full bg-olive-tint px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-olive">
                        Leading
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-mute">
                    {tally.worksCount} works · {tally.passCount} pass
                    {tally.bestCount > 0 ? ` · ${tally.bestCount} ★` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={busy || !myUserId}
                    onClick={() => vote(iso, 'works')}
                    aria-label="Works for me"
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
                      mine?.availability === 'works' ? 'bg-olive text-white' : 'bg-sand text-ink-soft'
                    }`}
                  >
                    <Icon name="check" size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={busy || !myUserId}
                    onClick={() => vote(iso, 'pass')}
                    aria-label="Pass"
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
                      mine?.availability === 'pass' ? 'bg-blush text-white' : 'bg-sand text-ink-soft'
                    }`}
                  >
                    <Icon name="x" size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={busy || !myUserId}
                    onClick={() => star(iso)}
                    aria-label="Mark as my best night"
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
                      mine?.is_best_choice ? 'bg-amber text-white' : 'bg-sand text-ink-faint'
                    }`}
                  >
                    <Icon name="star" size={16} />
                  </button>
                </div>
              </div>
              {isCreator ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => confirm(iso)}
                  className={`mt-3 w-full rounded-xl py-2 text-xs font-bold transition-colors disabled:opacity-50 ${
                    isLeading ? 'bg-olive text-white' : 'bg-sand text-ink-soft'
                  }`}
                >
                  Confirm this day
                </button>
              ) : null}
            </Card>
          )
        })}
      </div>

      <IdeasBlock plan={plan} myUserId={myUserId} userMap={userMap} onChanged={onChanged} />
    </div>
  )
}

/* ── Confirmed plan + convert ────────────────────────────────────────────── */

function ConfirmedPlan({
  plan,
  userMap,
  isCreator,
  onChanged,
  onConverted,
}: {
  plan: EnrichedWeeklyPlan
  userMap: Record<string, string>
  isCreator: boolean
  onChanged: () => Promise<void>
  onConverted: (eventId: string) => void
}) {
  const [name] = useName()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const goingNames = useMemo(
    () => worksUserIdsForDay(plan.votes, plan.confirmed_day).map((id) => userMap[id]).filter(Boolean),
    [plan.votes, plan.confirmed_day, userMap],
  )
  const ideas = useMemo(() => topIdeas(plan.ideas), [plan.ideas])

  async function convert() {
    if (busy || !name) return
    setBusy(true)
    setError(null)
    const { eventId, error: e } = await convertWeeklyPlanToEvent({ plan, name })
    if (e || !eventId) {
      setError(e ?? 'Could not create the event.')
      setBusy(false)
      return
    }
    onConverted(eventId)
  }

  async function reopen() {
    if (busy) return
    if (!window.confirm('Reopen this plan for voting?')) return
    setBusy(true)
    await reopenWeeklyPlan({ planId: plan.id })
    await onChanged()
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex items-center gap-4 border-olive/50 bg-olive-tint/40">
        <IconTile name="calendar" tint="olive" size={64} rounded="lg" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-olive">Confirmed</p>
          <h2 className="mt-0.5 text-xl font-bold leading-tight text-ink">{plan.title}</h2>
          <p className="mt-0.5 text-sm font-semibold text-ink-soft">
            {plan.confirmed_day ? dayLong(plan.confirmed_day) : 'Day TBD'}
          </p>
        </div>
      </Card>

      {plan.note ? <p className="text-sm leading-6 text-ink-soft">{plan.note}</p> : null}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-mute">Who&apos;s in</p>
        {goingNames.length > 0 ? (
          <div className="flex items-center gap-3">
            <AvatarStack names={goingNames} max={6} size={32} />
            <span className="text-sm text-ink-soft">{goingNames.length} in</span>
          </div>
        ) : (
          <p className="text-sm text-ink-mute">No one marked this day yet.</p>
        )}
      </div>

      {ideas.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-mute">Top ideas</p>
          <div className="flex flex-wrap gap-1.5">
            {ideas.map((idea) => {
              const meta = ideaCategoryMeta(idea.category)
              return (
                <span
                  key={idea.text}
                  className="inline-flex items-center gap-1.5 rounded-full bg-cream border border-stone/70 px-3 py-1.5 text-xs font-semibold text-ink-soft"
                >
                  {meta ? <Icon name={meta.iconName} size={13} /> : null}
                  {idea.text}
                  {idea.count > 1 ? <span className="text-ink-mute">×{idea.count}</span> : null}
                </span>
              )
            })}
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm font-medium text-blush">{error}</p> : null}

      {plan.converted_event_id ? (
        <Link
          href={`/events/${plan.converted_event_id}`}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-olive py-3 text-sm font-bold text-white active:scale-[0.98]"
        >
          View the event
          <Icon name="arrowRight" size={16} />
        </Link>
      ) : isCreator ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={busy || !name}
            onClick={convert}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-olive py-3 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40"
          >
            <Icon name="arrowRight" size={16} />
            {busy ? 'Creating event…' : 'Turn into Event'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={reopen}
            className="w-full rounded-[var(--radius-lg)] border border-stone/70 bg-cream py-2.5 text-sm font-semibold text-ink-soft disabled:opacity-50"
          >
            Reopen voting
          </button>
          <p className="text-center text-xs text-ink-mute">
            Turning it into an event adds it to Events with everyone who&apos;s in.
          </p>
        </div>
      ) : null}
    </div>
  )
}

/* ── Shared bits ─────────────────────────────────────────────────────────── */

function PlanHeader({ plan }: { plan: EnrichedWeeklyPlan }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-[12px] bg-terracotta-tint px-2.5 py-1 text-xs font-semibold text-terracotta">
          <span className="h-1.5 w-1.5 rounded-full bg-terracotta" />
          Voting open
        </span>
        {plan.participantCount > 0 ? (
          <span className="text-xs text-ink-mute">{plan.participantCount} voting</span>
        ) : null}
      </div>
      <h2 className="mt-2 font-serif text-[28px] font-black leading-tight tracking-tight text-ink">{plan.title}</h2>
      {plan.note ? <p className="mt-1 text-sm leading-6 text-ink-soft">{plan.note}</p> : null}
    </div>
  )
}

function IdeasBlock({
  plan,
  myUserId,
  userMap,
  onChanged,
}: {
  plan: EnrichedWeeklyPlan
  myUserId: string | null
  userMap: Record<string, string>
  onChanged: () => Promise<void>
}) {
  const [text, setText] = useState('')
  const [category, setCategory] = useState<IdeaCategory | null>(null)
  const [busy, setBusy] = useState(false)

  async function add(quickCategory?: IdeaCategory) {
    if (busy) return
    const useCategory = quickCategory ?? category
    const meta = ideaCategoryMeta(useCategory)
    const ideaText = text.trim() || meta?.label
    if (!ideaText) return
    setBusy(true)
    await addWeeklyIdea({ planId: plan.id, userId: myUserId, text: ideaText, category: useCategory ?? null })
    setText('')
    setCategory(null)
    await onChanged()
    setBusy(false)
  }

  return (
    <div>
      <p className="mb-2 text-sm font-bold text-ink">Ideas</p>

      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {IDEA_CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            disabled={busy}
            onClick={() => add(c.key)}
            className="inline-flex items-center gap-1.5 rounded-full bg-sand px-3 py-1.5 text-xs font-semibold text-ink-soft active:scale-95 disabled:opacity-50"
          >
            <Icon name="plus" size={11} />
            <Icon name={c.iconName} size={13} />
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add()
          }}
          placeholder="Suggest something…"
          className="flex-1 rounded-xl border-0 bg-sand px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive"
        />
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => add()}
          className="rounded-xl bg-olive px-4 text-sm font-bold text-white disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {plan.ideas.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {plan.ideas.map((idea) => {
            const meta = ideaCategoryMeta(idea.category)
            const who = idea.user_id ? userMap[idea.user_id] : null
            return (
              <li key={idea.id} className="flex items-center gap-2.5">
                <IconTile name={meta?.iconName ?? 'lightbulb'} tint={meta?.tint ?? 'amber'} size={32} rounded="full" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{idea.idea_text}</p>
                  {who ? <p className="text-[11px] text-ink-mute">{who}</p> : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-ink-mute">No ideas yet — tap a chip above to start.</p>
      )}
    </div>
  )
}

function SetupNeededCard() {
  return (
    <Card className="py-6">
      <p className="font-semibold text-ink">This Week needs a quick database step</p>
      <p className="mt-2 text-sm leading-6 text-ink-soft">
        Run the <span className="font-mono text-ink">20260608_add_weekly_plans.sql</span> migration in Supabase, then
        refresh. Everything else in the app keeps working in the meantime.
      </p>
    </Card>
  )
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      <div className="h-24 rounded-[var(--radius-lg)] bg-cream" />
      <div className="h-16 rounded-[var(--radius-lg)] bg-cream" />
      <div className="h-16 rounded-[var(--radius-lg)] bg-cream" />
      <div className="h-16 rounded-[var(--radius-lg)] bg-cream" />
    </div>
  )
}
