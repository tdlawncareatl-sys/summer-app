'use client'

// Spin-and-browse Wheel. A vertical scroll container with CSS scroll-snap
// gives us native momentum + snap-to-center on iOS without writing physics.
// We layer per-card 3D transforms on top: cards above/below the active slot
// tilt away and fade, so the strip reads as the edge of a rotating wheel.
//
// "Spin" picks a random idea and smooth-scrolls there. No casino — just a
// momentary surprise pick, then the user lands on it and decides.

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { categoryFor } from '@/lib/categories'
import Card from '../components/Card'
import IconTile from '../components/IconTile'
import StatusChip from '../components/StatusChip'
import Icon from '../components/Icon'
import type { Idea, EventLite } from './page'
import { findMatchingEvent } from './page'

const SLOT_HEIGHT = 120 // px — also the gap between snap points
const WHEEL_HEIGHT = 360 // px — viewport height of the wheel strip

export default function IdeaWheel({
  ideas,
  likedIds,
  events,
  likingId,
  planningId,
  onToggleInterest,
  onPlan,
}: {
  ideas: Idea[]
  likedIds: Set<string>
  events: EventLite[]
  likingId: string | null
  planningId: string | null
  onToggleInterest: (idea: Idea) => void
  onPlan: (idea: Idea) => void
}) {
  const wheelRef = useRef<HTMLDivElement | null>(null)
  const slotRefs = useRef<Array<HTMLDivElement | null>>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const rafRef = useRef<number | null>(null)

  // Recompute transforms for every visible slot based on its distance from
  // the active center. Runs on scroll (rAF-throttled) and drives the wheel
  // illusion. Transforms are applied directly to DOM (no React) and slots
  // have NO CSS transition on transform — scroll position is the source of
  // truth, easing would just fight it and create the shake.
  const updateSlots = useCallback(() => {
    rafRef.current = null
    const wheel = wheelRef.current
    if (!wheel) return

    const wheelCenter = wheel.scrollTop + wheel.clientHeight / 2
    let nearest = 0
    let nearestDist = Infinity

    slotRefs.current.forEach((slot, index) => {
      if (!slot) return
      const slotCenter = slot.offsetTop + slot.clientHeight / 2
      const delta = (slotCenter - wheelCenter) / SLOT_HEIGHT
      const absDelta = Math.abs(delta)

      // Cap distortion at +/- 3 slots. Gentler tilt (was 18deg) so snap
      // settling doesn't read as a visible "kick".
      const clamped = Math.max(-3, Math.min(3, delta))
      const scale = Math.max(0.66, 1 - Math.abs(clamped) * 0.11)
      const opacity = Math.max(0.22, 1 - Math.abs(clamped) * 0.28)
      const rotateX = clamped * 12
      const translateZ = -Math.abs(clamped) * 22

      // translate3d puts each slot on its own GPU layer; the trailing
      // rotateX/scale compose on top without re-layout per frame.
      slot.style.transform = `translate3d(0, 0, 0) rotateX(${rotateX}deg) translateZ(${translateZ}px) scale(${scale})`
      slot.style.opacity = String(opacity)
      slot.style.zIndex = String(100 - Math.round(absDelta * 10))

      if (absDelta < nearestDist) {
        nearestDist = absDelta
        nearest = index
      }
    })

    // Hysteresis: only flip active when the new card is meaningfully close
    // to center. Stops border/state from oscillating during snap settle.
    if (nearestDist < 0.4) {
      setActiveIndex((prev) => (prev === nearest ? prev : nearest))
    }
  }, [])

  function handleScroll() {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(updateSlots)
  }

  // Re-run on mount + whenever the list changes so transforms apply to the
  // fresh DOM. Also when window resizes (font-size/layout shifts).
  useEffect(() => {
    updateSlots()
    function onResize() {
      updateSlots()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [ideas.length, updateSlots])

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  function scrollToIndex(index: number, behavior: ScrollBehavior = 'smooth') {
    const slot = slotRefs.current[index]
    const wheel = wheelRef.current
    if (!slot || !wheel) return
    const target = slot.offsetTop + slot.clientHeight / 2 - wheel.clientHeight / 2
    wheel.scrollTo({ top: target, behavior })
  }

  function spin() {
    if (ideas.length <= 1) return
    let next = activeIndex
    // Don't land on the same idea twice in a row — keeps Spin honest.
    while (next === activeIndex) {
      next = Math.floor(Math.random() * ideas.length)
    }
    scrollToIndex(next)
  }

  // Center the first card on mount so the initial layout is clean.
  useEffect(() => {
    if (ideas.length > 0) {
      requestAnimationFrame(() => scrollToIndex(0, 'auto'))
    }
  }, [ideas.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const active = ideas[activeIndex]
  const plannedEvent = active ? findMatchingEvent(active.title, events) ?? null : null
  const activeLiked = active ? likedIds.has(active.id) : false

  return (
    <div className="pb-4">
      <div
        className="relative mx-auto mt-2 w-full"
        style={{ perspective: '900px' }}
      >
        {/* Soft top/bottom fades to sell the wheel-edge illusion */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-cream to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-cream to-transparent"
        />
        {/* Center indicator — barely-there hairlines that frame the active card */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-2 z-0 rounded-[18px] border border-olive/15"
          style={{
            top: `calc(50% - ${SLOT_HEIGHT / 2}px)`,
            height: `${SLOT_HEIGHT}px`,
          }}
        />
        <div
          ref={wheelRef}
          onScroll={handleScroll}
          className="relative scrollbar-hidden overflow-y-scroll snap-y snap-mandatory"
          style={{
            height: `${WHEEL_HEIGHT}px`,
            transformStyle: 'preserve-3d',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Top spacer so the first card can center */}
          <div
            aria-hidden
            style={{ height: `${(WHEEL_HEIGHT - SLOT_HEIGHT) / 2}px` }}
          />

          {ideas.map((idea, index) => (
            <div
              key={idea.id}
              ref={(el) => {
                slotRefs.current[index] = el
              }}
              className="snap-center will-change-transform"
              style={{
                height: `${SLOT_HEIGHT}px`,
                transformOrigin: 'center center',
                backfaceVisibility: 'hidden',
              }}
            >
              <WheelCard idea={idea} active={index === activeIndex} />
            </div>
          ))}

          {/* Bottom spacer */}
          <div
            aria-hidden
            style={{ height: `${(WHEEL_HEIGHT - SLOT_HEIGHT) / 2}px` }}
          />
        </div>

        {/* Up/down chevrons aligned with the active row */}
        <button
          type="button"
          onClick={() => scrollToIndex(Math.max(0, activeIndex - 1))}
          disabled={activeIndex === 0}
          aria-label="Previous idea"
          className="absolute left-1 top-1/2 z-20 -translate-y-1/2 rounded-full bg-cream p-1.5 text-ink-mute shadow-[var(--shadow-soft)] transition-opacity disabled:opacity-30"
        >
          <Icon name="chevronDown" size={16} className="rotate-180" />
        </button>
        <button
          type="button"
          onClick={() => scrollToIndex(Math.min(ideas.length - 1, activeIndex + 1))}
          disabled={activeIndex === ideas.length - 1}
          aria-label="Next idea"
          className="absolute right-1 top-1/2 z-20 -translate-y-1/2 rounded-full bg-cream p-1.5 text-ink-mute shadow-[var(--shadow-soft)] transition-opacity disabled:opacity-30"
        >
          <Icon name="chevronDown" size={16} />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
          {ideas.length > 0 ? `${activeIndex + 1} / ${ideas.length}` : '—'}
        </p>
        <button
          type="button"
          onClick={spin}
          disabled={ideas.length <= 1}
          className="inline-flex items-center gap-2 rounded-[14px] bg-olive px-4 py-2 text-sm font-bold text-white shadow-[var(--shadow-soft)] transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          <Icon name="star" size={13} />
          Spin
        </button>
      </div>

      {active ? (
        <Card className="mt-4 p-4">
          <div className="flex items-start gap-3">
            <IconTile name={categoryFor(active.title).iconName} tint={categoryFor(active.title).tint} size={52} rounded="full" />
            <div className="min-w-0 flex-1">
              <h3 className="text-[18px] font-bold leading-tight text-ink">{active.title}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-soft">
                {active.submitted_by ? <span>by {active.submitted_by}</span> : null}
                {plannedEvent ? (
                  <StatusChip status={plannedEvent.status === 'confirmed' ? 'confirmed' : 'voting'} size="xs" />
                ) : null}
              </div>
            </div>
          </div>
          {active.description ? (
            <p className="mt-3 text-sm leading-6 text-ink-soft line-clamp-3">{active.description}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleInterest(active)}
              disabled={likingId === active.id}
              aria-pressed={activeLiked}
              className={[
                'inline-flex items-center gap-1.5 rounded-[14px] px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40',
                activeLiked ? 'bg-olive text-white' : 'bg-sand text-ink-soft hover:bg-sand-alt',
              ].join(' ')}
            >
              <Icon name={activeLiked ? 'check' : 'plus'} size={13} />
              {activeLiked ? 'Interested' : 'Interested?'}
              <span className={activeLiked ? 'text-white/80' : 'text-ink-mute'}>· {active.likes}</span>
            </button>
            <Link
              href={`/ideas/${active.id}`}
              className="inline-flex items-center gap-1.5 rounded-[14px] bg-sand px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-sand-alt"
            >
              Open
              <Icon name="chevronRight" size={13} />
            </Link>
            {plannedEvent ? (
              <Link
                href={`/events/${plannedEvent.id}`}
                className="ml-auto inline-flex items-center gap-1.5 rounded-[14px] bg-sage-tint px-3 py-2 text-sm font-semibold text-sage"
              >
                Open event
                <Icon name="chevronRight" size={13} />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => onPlan(active)}
                disabled={planningId === active.id}
                className="ml-auto inline-flex items-center gap-2 rounded-[14px] bg-olive px-3.5 py-2 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40"
              >
                {planningId === active.id ? 'Planning…' : 'Plan Event'}
              </button>
            )}
          </div>
        </Card>
      ) : null}
    </div>
  )
}

function WheelCard({
  idea,
  active,
}: {
  idea: Idea
  active: boolean
}) {
  const category = categoryFor(idea.title)
  return (
    <div
      className={[
        'mx-2 flex h-full items-center gap-3 rounded-[18px] border bg-cream px-4 shadow-[var(--shadow-soft)]',
        // Only transition the border color — never the box itself, because
        // its position is being driven by the parent slot's transform.
        'transition-colors duration-150',
        active ? 'border-olive/40' : 'border-stone/60',
      ].join(' ')}
    >
      <IconTile name={category.iconName} tint={category.tint} size={52} rounded="full" />
      <div className="min-w-0 flex-1">
        <h4 className="text-[16px] font-bold leading-tight text-ink line-clamp-2">{idea.title}</h4>
        <p className="mt-0.5 text-[11px] text-ink-mute">
          {idea.submitted_by ? `by ${idea.submitted_by} · ` : ''}{idea.likes} interested
        </p>
      </div>
    </div>
  )
}
