# Summer Plans — Claude's Project Brief

> You're Claude. Tad is a KSU student who's learning to build real software by shipping this app.
> He's not a pro coder. Keep code legible, decisions explicit, and lessons durable.

## What the app is

A lightweight web app for ~12 friends to coordinate summer plans — availability blackouts,
event date voting, shared idea hub. Mobile-first. The anchor event is **Bald Head Island,
Aug 1–8 2026**. Everything before that is a dress rehearsal for that week actually happening.

## Core rule

Every decision should reduce friction, not add process. Simple and working beats big and broken.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **Supabase** (Postgres; RLS off for now — 12-friend trust model)
- **Tailwind v4** with `@theme inline` earthy token system
- **Vercel** auto-deploys on push to `main`

## Database tables

`users`, `availability`, `events`, `date_options`, `votes`, `ideas`

## Voting logic

| Response | Points |
|----------|--------|
| Best     | 3 pts  |
| Works    | 1 pt   |
| No       | 0 pts  |

Best is **exclusive** — picking Best on a new option auto-demotes your previous Best to Works.
Conflict score per date option: `totalPoints − (blockedCount × 2)`.

## Design system rules (non-negotiable)

- **Only semantic tokens.** `olive`, `terracotta`, `sand`, `cream`, `ink`, `teal`, `amber`,
  `blush`, `sage`, `lavender`, `stone`. No cosmetic classes like `bg-red-500`, `text-blue-600`.
  No gradients. If you need a new color, add a token first.
- **Shared components over one-offs.** `Card`, `PageHeader`, `StatusChip`, `IconTile`,
  `Avatar`, `icons`. Reach for these before writing new markup.
- **Status through `lib/status.ts`.** Don't hard-code status strings or colors.
- **Categories through `lib/categories.ts`.** Icon + tint comes from keyword match on title.
- **Shared data loader: `lib/planData.ts`.** Home, Calendar, Me all pull from here.

## The PM system (read this before wandering)

Three surfaces, each doing one job:

1. **Notion Mission Control** — live project state, next-3 priorities, session log, roadmap,
   parking lot, decisions. The one page that tells you where we are.
2. **GitHub Issues** — the to-do list. Each Issue has enough context to ship from cold.
3. **This file (`CLAUDE.md`)** — the brief you're reading. How the app works, what rules apply.

## Session ritual

### When a session starts

1. Read this file (you already are).
2. Open the Notion Mission Control page — read **Top 3 Next Up** and **Latest Session**.
3. If we're about to touch architecture, skim **Journey & Decisions** first.
4. Confirm with Tad what we're doing this session before writing code.

### When a session ends

1. Update **Latest Session** on Mission Control (Shipped / Learned / Decided — 3 bullets each).
2. Move any Roadmap cards whose status changed.
3. If we made an architectural choice, add an entry to **Journey & Decisions** using the
   template in that page (Choice / Alternatives / Why / Trade-offs / Revisit if).
4. Update **Top 3 Next Up** if priorities shifted.
5. Commit & push — `main` must reflect reality.

## How to add a Roadmap item

Fields: Item, Status (Shipped / In Progress / Next Up / Someday), Area (Home / Events /
Availability / Ideas / Me / Calendar / Design System / Infra / Data), Effort (XS–XL),
Why it matters (one line), GitHub Issue URL, Shipped On.

## How to add a Parking Lot item

Fields: Idea, Why parked, Tag (Feature / Polish / Refactor / Moonshot / Maybe never),
Captured (date).

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

_Latest session summary lives on the Notion Mission Control page — keep it there, not here.
This file stays stable; Mission Control is the living surface._
