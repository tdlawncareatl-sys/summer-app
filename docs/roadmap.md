# Roadmap

> What's shipped, what's next. One glance = current state. Migrated from Notion 2026-06-20.
>
> **Status:** Shipped / In Progress / Next Up / Someday
> **Area:** Home / Events / Availability / Ideas / Me / Calendar / Design System / Infra / Data
> **Effort:** XS–XL
>
> To add an item: drop a row in the right table below with Item, Area, Effort, why it
> matters, and (optional) GitHub Issue URL. When it ships, move it to Shipped with a date.

## Next Up

| Item | Area | Effort | Why it matters | Issue |
|---|---|---|---|---|
| Archive option for events | Events | S | Reversible "put away" for dead/past plans now that anyone can hard-delete. Design agreed 2026-07-15: one-tap Archive in the options sheet (no confirm — it's reversible), new `archived` status via migration, filtered out in planData, collapsed Archived section + Restore on Events. Manual only for v1. | — |
| Pin turbopack root for clean localhost preview | Infra | XS | Local browser checks are blocked because Next 16 dev resolves summer-app against the parent workspace root. | — |

## In Progress

_(none)_

## Someday

| Item | Area | Effort | Why it matters | Issue |
|---|---|---|---|---|
| Notifications (email or push) | Infra | XL | Group coordination breaks when people don't check the app. Post-auth problem. _(Note: in-app notifications bell shipped; email/push is the open piece.)_ | — |

## Shipped

| Item | Area | Effort | Shipped | Why it matters |
|---|---|---|---|---|
| School schedule import (year-round availability) | Availability | L | 2026-07-15 | One tap blocks a college semester and keeps breaks free — makes the app usable for Friendsgiving/Christmas planning, not just summer. |
| Editable blocks in My Blocks | Availability | S | 2026-07-15 | Tap a block to adjust its dates or label instead of delete-and-redraw. |
| Anyone can delete events, with in-app confirm | Events | XS | 2026-07-15 | Cleanup isn't gated on the creator; a confirm/cancel step in the sheet replaces the browser popup. |
| This Week casual planning + Home voting inbox | Home | L | 2026-06-08 | Lightweight whole-week board with availability overlay; Home leads with This Week + "Needs your vote". |
| Ideas as a database + idea detail + Wheel view | Ideas | L | 2026-05-22 | Grid + Wheel browsing and a real detail page; post-confirmation attendance. |
| App icon full-bleed cleanup | Design System | XS | 2026-05-12 | Home-screen icon uses the supplied artwork without the distracting white side matte. |
| Availability-first Me page redesign | Me | M | 2026-05-12 | Me makes it obvious to mark blackout dates and see what those dates affect. |
| Delete event from the event options menu | Events | S | 2026-05-12 | Hosts can clean up fake/accidental events without direct database work. |
| Calendar export — Add to Calendar from confirmed events | Calendar | S | 2026-05-12 | One tap to get a confirmed event onto a phone's native calendar, from event page and notification bell. |
| Interactive calendar date preview | Calendar | S | 2026-05-11 | Month grid answers what lives on a date without jumping to week/list view. |
| Turn idea → event CTA | Ideas | M | 2026-05-08 | Closes the funnel: liked idea becomes a real plan in one tap. ([#1](https://github.com/tdlawncareatl-sys/summer-app/issues/1)) |
| Surface hosting status on Me page | Me | S | 2026-05-08 | Host cares about "did my event get votes" without two taps. ([#4](https://github.com/tdlawncareatl-sys/summer-app/issues/4)) |
| Real auth (Supabase Auth) | Infra | L | 2026-05-08 | localStorage names are a toy; real auth is table stakes before wider use. ([#2](https://github.com/tdlawncareatl-sys/summer-app/issues/2)) |
| Mobile polish pass on real device | Design System | M | 2026-05-08 | Drag-select edges, bottom sheet, font sizing — only real thumbs find these bugs. ([#3](https://github.com/tdlawncareatl-sys/summer-app/issues/3)) |
| Semantic icon system + icon library | Design System | M | 2026-04-25 | Icons live in a shared registry and library; reusable instead of drifting screen by screen. |
| Brighten UI and sharpen shared surfaces | Design System | M | 2026-04-25 | Aligns shipped app with target visual direction across cards, tabs, buttons, sheets, nav. |
| Event details: logistics + Apple Maps | Events | L | 2026-04-25 | Events carry location, time, notes, one-tap Apple Maps handoff — real plans, not just voting. |
| Bridge Home, Ideas, Calendar toward target mockups | Design System | L | 2026-04-24 | Moves app closer to intended feel/flow without a full backend rewrite. |
| Test suite foundation (Vitest + Playwright) | Infra | M | 2026-04-23 | Real release confidence before wider rollout; a place to grow coverage. |
| In-app notifications bell and panel | Infra | S | 2026-04-23 | Votes, confirmations, idea activity one tap away instead of hidden behind memory. |
| Shared data loader (lib/planData.ts) | Infra | M | 2026-04-23 | Home, Calendar, Me pull from one joined view. One shape, one place to change. |
| Category keyword matcher (title → icon/tint) | Design System | S | 2026-04-23 | Events and ideas get the right visual vibe without asking the user. |
| Best-vote exclusivity (auto-demote prior Best) | Events | M | 2026-04-23 | Forces a real preference signal instead of "best for everything" noise. |
| Me page (dashboard + rename-in-place) | Me | M | 2026-04-23 | Personal corner of the app; also the only settings surface. |
| Ideas funnel (top 3 + everything else) | Ideas | M | 2026-04-23 | Surfaces what's gathering steam without a separate ranking UI. |
| Earthy-baseline redesign across all pages | Design System | XL | 2026-04-23 | Locked the visual language. One coherent app instead of a grab-bag of demo styles. |
| Conflict scoring formula (points − 2×blocked) | Events | S | 2026-04-23 | Rankings account for who actually can't make it, not just who voted. |
| Calendar page (month grid + status dots) | Calendar | L | 2026-04-23 | Visual answer to "what's happening this summer" at a glance. |
| Drag-select calendar with touch support | Availability | L | 2026-04-23 | Blackouts on mobile feel like crossing out days, not tapping 47 times. |
