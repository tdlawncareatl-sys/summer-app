# 📱 Summer Plans — Mission Control

> The one file to rule them all. Start every session here. End every session here.
> (Migrated out of Notion on 2026-06-20 — this repo is now the single source of truth.)

## What this is

A lightweight web app for ~12 friends to coordinate summer plans — availability
blackouts, event date voting, shared idea hub. Mobile-first. Simple and working beats
big and broken. No external deadline — ship increments the friend group can actually use.

## Live links

- **App (prod):** https://summer-app.vercel.app
- **Repo:** https://github.com/tdlawncareatl-sys/summer-app
- **Issues (what's next):** https://github.com/tdlawncareatl-sys/summer-app/issues
- **Supabase:** the dashboard Tad has bookmarked
- **Vercel deploys:** auto-deploy on push to `main`

## Stack (one-liner each)

- **Next.js 16** (App Router, Turbopack) — pages & routing
- **Supabase** (Postgres, RLS off for now) — the shared database
- **Tailwind v4** with `@theme inline` — earthy token system, no cosmetic colors
- **Vercel** — auto-deploys every push to `main`

## Top 3 next up

_Live list. Keep it at 3. Anything beyond 3 goes in [roadmap.md](./roadmap.md) or
[parking-lot.md](./parking-lot.md)._

1. **Real-device pass on the School schedule flow** — run the import on iPhone as a
   real user (away school + local KSU), confirm the review sheet feels right, then
   have the away-at-college friends fill theirs in before fall semester starts (late
   August). _(Only Tad can do this — needs a physical phone + the group.)_
2. **Real-device pass on the redesigned Me page + updated app icon** — verify the
   availability-first hierarchy lands on iPhone and the icon refreshes cleanly after
   reinstall. _(Only Tad can do this.)_
3. **Backfill the 05-22 and 06-08 session learnings** — those entries below were
   reconstructed from git and have empty Learned/Decided bullets.

## Session log

_Newest first. Shipped / Learned / Decided — 3 bullets max each._

### 2026-07-15 — School schedules: year-round availability

**Shipped:**
- "School schedule" import on Availability: pick your college (KSU, Wheaton,
  ASU, Hillsdale, Samford) → away-at-school or local → review the away/home
  timeline → one tap blocks the semester, leaving breaks/holidays/summer free
- `lib/schoolCalendars.ts` — registrar-verified 2026–27 term data + pure
  expansion logic; rows are tagged `School · <name>` so re-import/clear is one
  action and manual blocks are never touched (no schema change needed)
- 30 new tests (data sanity + segment logic + sheet component flow);
  `findBestRanges` horizon 90 → 180 days for winter-party planning

**Learned:**
- Academic calendars differ enough to matter (UGA takes the whole Thanksgiving
  week, Georgia Tech only Wed–Fri) — a generic "college template" would put
  people home on the wrong days
- Registrars don't publish machine-readable feeds (Georgia Tech's page is a JS
  app), so a curated in-repo data file + a human confirm step beats scraping
- The existing blackout model absorbed the whole feature: away-at-school days
  are just ordinary availability rows, so scoring/heatmap/voting all worked
  untouched

**Decided:**
- Semester scheduling is for leave/return/break windows (Friendsgiving,
  Christmas party dates), NOT week-to-week class times — no time-of-day model
- Away vs local fork in the flow: commuter students (most KSU users) get only
  optional finals-week blocks, not a fake four-month blackout
- `lib/schoolCalendars.ts` needs a ~10-minute date refresh each year when
  registrars publish the next cycle (guarded by data-sanity tests)

### 2026-06-20 — Retire Notion, drop the fake deadline, infra + repo cleanup

**Shipped:**
- Migrated the entire PM system out of Notion into `docs/` (mission-control, roadmap,
  parking-lot, decisions); pointed `CLAUDE.md` at the new files
- Pinned `turbopack.root` in `next.config.ts` so Next 16 stops resolving against the
  parent PersonalAI folder
- Moved the design mockups (8 PNGs + `ideas-mockup.html`) into `docs/mockups/`, off the
  repo root and out of the public web path

**Learned:**
- Notion drifted ~6 weeks stale because it lived outside the commit flow — in-repo docs
  update in the same motion as code
- `ideas-mockup.html` was sitting in `public/`, meaning it was being served publicly on
  the live site — internal mockups don't belong there
- The brief framed Bald Head Island as the app's "anchor event"; it's actually Tad's
  personal trip, unrelated to the app

**Decided:**
- Repo is the single source of truth; Notion is retired (logged in decisions.md)
- No external deadline — ship increments the friend group can use, don't pin work to BHI
- Keep design mockups in-repo under `docs/mockups/` as reference, not in `public/`

### 2026-06-08 — This Week + Home voting inbox _(reconstructed from git, 2026-06-20)_

**Shipped:**
- This Week casual planning: whole-week (Mon–Sun) board with availability overlay and
  time-of-day, plus voting
- Home rebuilt to lead with This Week + a "Needs your vote" inbox surfacing the full
  voting list
- "Coming up later" strip for confirmed events beyond this week

**Learned / Decided:**
- (Not logged at the time — fill in if you remember the reasoning. See
  `lib/weeklyPlans.ts` / `lib/weeklyPlansData.ts` and CLAUDE.md "This Week" section.)

### 2026-05-22 — Ideas as a database + Wheel _(reconstructed from git, 2026-06-20)_

**Shipped:**
- Ideas page redesigned as a database: Grid view, idea detail page, Wheel view
  (infinite loop, no walls, shake killed)
- Post-confirmation attendance on events

**Learned / Decided:**
- (Not logged at the time — fill in if you remember the reasoning.)

### 2026-05-12 — Availability-first Me page + app icon

**Shipped:**
- Rebuilt the Me page around personal availability: strong `Mark availability` CTA up
  top, upcoming blocked ranges in the middle, planning-event conflicts before
  hosting/settings
- Removed the low-value Me stat grid and the Ideas shortcut so the page stays focused
  on blackout dates and what those dates affect
- Updated the app icon to a clean full-bleed crop with no white side matte; wired the
  icon/app-manifest routes to the square asset

**Learned:**
- The old Me layout acted like a generic profile dashboard, but the real high-value job
  is personal scheduling, not showing counts
- The supplied icon art still had a baked-in white matte, so cropping alone wasn't enough
- Next 16 dev can infer the wrong workspace root in this parent-folder setup, which
  breaks localhost preview even when `build` and `test` are both clean

**Decided:**
- Me should be availability-first: schedule action first, consequences second,
  hosting/settings after that
- Remove the Ideas shortcut from Me instead of making the page be both a planning
  dashboard and a browsing hub
- Treat the app icon as a full-bleed branded asset, not a padded screenshot export

## Migrations

Live in Supabase as of 2026-05-12: `20260425_add_event_details.sql`,
`20260425_add_event_length_type.sql`, `20260506_add_notifications.sql`,
`20260426_add_availability_category.sql`.

**Run next (both idempotent):** `20260508_add_lookup_indexes.sql` and
`20260508_voting_v2.sql`. The voting one migrates existing best votes → works+preferred
and existing no → pass. ⚠️ Verify current state — the June 8 This Week work may already
depend on voting v2.

## Session ritual

### At the start of every session
1. Open this file. Read **Top 3 Next Up** and the latest **Session log** entry.
2. Glance at [roadmap.md](./roadmap.md) for what's In Progress / Next Up.
3. Skim [decisions.md](./decisions.md) if you're about to touch anything architectural.
4. Confirm with Tad what we're doing this session before writing code.

### At the end of every session
1. Add a new **Session log** entry above (Shipped / Learned / Decided — 3 bullets max each).
2. Update statuses in [roadmap.md](./roadmap.md) for anything that moved.
3. If you made an architectural choice, add an entry to [decisions.md](./decisions.md).
4. Update **Top 3 Next Up** if priorities shifted.
5. Commit & push so `main` reflects reality.
