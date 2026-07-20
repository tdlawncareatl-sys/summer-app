# Summer Plans — Claude's Project Brief

> You're Claude. Tad is a KSU student who's learning to build real software by shipping this app.
> He's not a pro coder. Keep code legible, decisions explicit, and lessons durable.

## What the app is

A lightweight web app for ~12 friends to coordinate summer plans — availability blackouts,
event date voting, shared idea hub. Mobile-first. No external deadline — ship working
increments the friend group can actually use.

## Core rule

Every decision should reduce friction, not add process. Simple and working beats big and broken.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **Supabase** (Postgres; RLS off for now — 12-friend trust model)
- **Tailwind v4** with `@theme inline` earthy token system
- **Vercel** auto-deploys on push to `main`

## Database tables

Formal events: `users`, `availability`, `events`, `date_options`, `votes`, `ideas`,
`attendance`, plus notification tables (`notification_preferences`, `push_subscriptions`,
`notifications`).

This Week (casual): `weekly_plans`, `weekly_plan_votes`, `weekly_plan_ideas`.

## Voting logic — formal events (voting v2)

Each person marks each proposed date **Works** or **Pass**. On a Works vote they may also
**star** it as their Best (one star per event — starring a new date moves the star). Short
events can add an optional time-of-day preference.

Ranking a date option: **most Works wins**, ties broken by **most Best stars**, then earlier
date. "Blocked" (from the availability calendar) is shown as info only — it does **not** change
the ranking. (The old Best=3/Works=1/No=0 points model is gone; see the `20260508_voting_v2`
migration.)

An event reads as **Voting** as soon as it has date options (even with zero votes), so the
events that need a *first* vote are surfaced, not hidden. Logic lives in `lib/status.ts`
(`inferEventStatus`) and per-user `needsMyVote` is derived in `lib/planData.ts`.

## School schedules — year-round availability

The availability model is blackout-by-exception, which breaks when friends leave for
college. The **School schedule** import on the Availability page fixes that: pick your
college → review the away/home timeline → confirm. Importing means "blocked while
school is in session" (there is deliberately no away-vs-commuter question — skip
stretches in the review step if that's not you). Away stretches become ordinary
`availability` rows tagged `School · <name>`
(`SCHOOL_CATEGORY_PREFIX`); breaks, holidays, and summer stay free. Re-importing or
clearing replaces only school-tagged rows — manual blocks are never touched.

Term/break data lives in `lib/schoolCalendars.ts` (pure logic, no Supabase) with
registrar-verified 2026–27 dates for KSU, Wheaton, ASU, Hillsdale, and Samford.
**Update the dates once a year** when registrars publish the next cycle — data-sanity
tests in `test/lib/schoolCalendars.test.ts` guard the shape. This is deliberately NOT
week-to-week class scheduling: no time-of-day, no recurring blocks. It answers "when do
people leave and when are they home" for things like Friendsgiving and Christmas-party
date hunting.

## AI connector (MCP)

`/api/mcp?key=<per-friend key>` is an MCP server (mcp-handler + zod, `lib/mcp/`) that
lets Claude or any MCP-speaking AI read and write the app as a specific friend. Keys
derive from the `MCP_SECRET` env var (HMAC per user id — see `lib/mcp/keys.ts`);
`/api/mcp-keys?secret=<MCP_SECRET>` lists everyone's personal link. Rules that matter:

- **Identity comes from the key.** Tools call `currentFriend()` (`lib/mcp/context.ts`);
  never accept "acting as X" from tool arguments.
- **Writes mirror the app's write paths** (voting upserts with the `points` compat
  column, star demotion, attendance upsert, availability insert-ignore). If a write
  path changes in the app, change it in `lib/mcp/tools.ts` too.
- **Set semantics, not toggle semantics.** The app's tap-to-toggle would make an AI
  re-sending the same vote clear it; connector tools never do that.

## This Week — casual weekly plans

Lightweight, intentionally separate from the formal event system. Pure logic in
`lib/weeklyPlans.ts`, Supabase loaders/mutations in `lib/weeklyPlansData.ts`, UI at `/this-week`.

The **whole week (Mon–Sun) is the canvas** — the creator does not propose a subset of days
(`candidate_days` is auto-filled with all 7). Everyone marks each day **Works/Pass**, optionally
picks one time block (morning/afternoon/evening), and stars one **Best** day, plus simple ideas
(dinner, drinks, movie, game night, outside, other). The **availability calendar overlays each
day** (who's in town vs out of town) via `scoreRange` — informational only, it does **not** change
ranking. Day ranking: **Works desc → Best desc → Pass asc** → earliest. The creator confirms a
day; a confirmed plan can be **converted into a formal event** (seeds attendance "going" from the
Works voters). Do not fold a weekly plan into the events table until the user taps "Turn into Event."

## Design system rules (non-negotiable)

- **Only semantic tokens.** `olive`, `terracotta`, `sand`, `cream`, `ink`, `teal`, `amber`,
  `blush`, `sage`, `lavender`, `stone`. No cosmetic classes like `bg-red-500`, `text-blue-600`.
  No gradients. If you need a new color, add a token first.
- **Shared components over one-offs.** `Card`, `PageHeader`, `StatusChip`, `IconTile`,
  `Avatar`, `icons`. Reach for these before writing new markup.
- **Status through `lib/status.ts`.** Don't hard-code status strings or colors.
- **Categories through `lib/categories.ts`.** Icon + tint comes from keyword match on title.
- **Shared data loader: `lib/planData.ts`.** Home, Calendar, Me, Events all pull from here.
  This Week has its own loader in `lib/weeklyPlans.ts` (separate data model).

## The PM system (read this before wandering)

Everything lives in the repo — no external tools. Three surfaces, each doing one job:

1. **`docs/` folder** — live project state. `mission-control.md` (Top 3 Next Up + session
   log + migrations), `roadmap.md` (shipped / next up / someday), `parking-lot.md` (ideas
   we like but aren't doing), `decisions.md` (the *why* behind architectural choices).
2. **GitHub Issues** — the to-do list. Each Issue has enough context to ship from cold.
3. **This file (`CLAUDE.md`)** — the brief you're reading. How the app works, what rules apply.

> Notion was retired 2026-06-20 — it drifted ~6 weeks stale because it lived outside the
> commit flow. The repo is now the single source of truth. (See the 2026-04-23 PM-system
> entry in `docs/decisions.md` for the why.)

## Session ritual

### When a session starts

1. Read this file (you already are).
2. Open `docs/mission-control.md` — read **Top 3 Next Up** and the latest **Session log** entry.
3. If we're about to touch architecture, skim `docs/decisions.md` first.
4. Confirm with Tad what we're doing this session before writing code.

### When a session ends

1. Add a new **Session log** entry in `docs/mission-control.md` (Shipped / Learned / Decided
   — 3 bullets each).
2. Update statuses in `docs/roadmap.md` for anything that moved.
3. If we made an architectural choice, add an entry to `docs/decisions.md` using the template
   at the top of that file (Choice / Alternatives / Why / Trade-offs / Revisit if).
4. Update **Top 3 Next Up** if priorities shifted.
5. Commit & push — `main` must reflect reality.

## How to add a Roadmap item

In `docs/roadmap.md`, add a row under the right status table: Item, Area (Home / Events /
Availability / Ideas / Me / Calendar / Design System / Infra / Data), Effort (XS–XL), Why it
matters (one line), and optional GitHub Issue link. When it ships, move it to **Shipped** with
a date.

## How to add a Parking Lot item

In `docs/parking-lot.md`, add a row: Idea, Tag (Feature / Polish / Refactor / Moonshot /
Maybe never), Why parked, Captured (date).

Revisit the parking lot at session start, not mid-build.

## Tad's context (so decisions make sense)

- Not a professional coder. Code has to be legible to him at 11pm on a Tuesday.
- KSU student through May 9 2026. Spring term is heavy.
- Runs TD Lawns. Has limited time per session — default to shippable increments.
- Builds for his actual friend group. Real users = Grace + the BHI crew.
- **Learning is a first-class output.** Explain trade-offs, not just instructions.

## Anti-patterns (don't do these)

- Adding a dependency to solve a 10-line problem.
- Cosmetic Tailwind classes anywhere in `/app`.
- Dropping types. TypeScript is on for a reason.
- Leaving `next dev` running when you walk away. Kill it — one source of truth.
- Amending commits. Create a new commit.
- Skipping the session-end Notion update. That's where context lives for next time.

## Current status

_Latest session summary lives in `docs/mission-control.md` — keep it there, not here.
This file stays stable; `docs/mission-control.md` is the living surface._
