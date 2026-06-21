# 🧭 Journey & Decisions

> The _why_ behind the _what_. The story of how Summer Plans got built — the choices,
> the trade-offs, the lessons. Read this when you (or Claude) need context a code comment
> can't give. Migrated from Notion 2026-06-20.

## Who's building this

Tad is not a professional coder. He's a KSU student (Spring 2026) who runs TD Lawns, has
a girlfriend named Grace, and hosts the Bald Head Island trip every August. He's learning
to ship real software by building something his friends will actually use. Claude is the pair.

This matters because:
- **Decisions skew toward "simple and legible"** over "clever and generic." If future-Tad
  opens a file at 11pm on a Tuesday, it has to make sense.
- **Learning is a first-class output.** Every session should teach something that sticks.
- **Done > perfect.** Ship working increments the friend group can actually use rather
  than polishing forever. (No external deadline — BHI is Tad's personal trip, not an app
  milestone.)
- **The stack choices are beginner-friendly on purpose.** Next.js App Router + Supabase +
  Vercel + Tailwind is the happy path for someone learning — lots of docs, lots of
  examples, one-click deploys, no ops.

## How to add an entry

Every time we make a non-obvious choice, log it. Template:

```
## YYYY-MM-DD — [Short title]

**Choice:** what we decided
**Alternatives considered:** the ones we looked at
**Why:** the reasoning, including what tipped the decision
**Trade-offs:** what this costs us
**Revisit if:** conditions that would make us change our mind
```

Keep entries short. If it takes more than 10 lines, you're overthinking it.

---

## 2026-05-12 — Me should be an availability surface, not a generic profile dashboard

**Choice:** Reorganize Me around marking blackout dates, seeing upcoming blocked ranges,
and spotting planning-event conflicts; remove the Ideas shortcut from that page.
**Alternatives considered:** Keep the profile + stat-grid layout; add more summary tiles;
keep Ideas as a peer shortcut in the Me shortcuts list.
**Why:** The real reason someone opens Me is to manage their own schedule. Putting the
availability action and its consequences first reduces friction and makes the page useful
immediately instead of decorative.
**Trade-offs:** Me becomes less of a catch-all personal dashboard, and hosting/settings
move lower in the scroll. Browsing ideas is one more tap away, but it has its own tab.
**Revisit if:** hosts start using Me primarily as an admin cockpit, or personal
preferences/settings grow large enough to deserve a separate structure.

---

## 2026-05-12 — Delete event lives in the existing options sheet

**Choice:** Add a creator-only `Delete event` action to the event detail options sheet,
confirm before removal, and hard-delete the event so related dates and votes disappear with it.
**Alternatives considered:** Leave cleanup as a direct-Supabase task; add a separate admin
screen; add list-level swipe-to-delete on Events first.
**Why:** The app already had one obvious "more options" place on the detail page. That keeps
event management discoverable without adding another surface, and it fixes the real pain we
hit cleaning fake events out of live data.
**Trade-offs:** Hard delete is irreversible for now, so the confirm step matters. It also
doesn't solve "this should go back to idea status" yet; that's a separate follow-on.
**Revisit if:** hosts start needing undo, archive/history, or a softer recovery path.

---

## 2026-05-12 — Calendar export covers Apple/.ics, Google, and Outlook via one popover

**Choice:** The "Add to calendar" pill opens a small bottom sheet with three options: Apple
Calendar / .ics download (server-rendered at `/api/events/[id]/ics`), Google Calendar (deep
link), and Outlook (deep link). All three are no-auth, no-API-key, and produce events with
identical date semantics.
**Alternatives considered:** One button only (.ics) — simplest, but extra taps for
Google-first users. Two buttons side-by-side — explicit but noisy on the tight green banner.
Platform-sniffing — unreliable on web (people use Google Calendar on iPhones).
**Why:** One pill keeps the default state clean; three options inside the sheet are honest
about real-world calendar choice without guessing the user's platform. The Google and
Outlook deep links cost nothing — same data shape, plain URL building, no server route.
**Trade-offs:** Two more URL builders to keep in sync with the ICS builder if event-detail
fields change. The notification-bell path lazy-fetches event data on popover open (one extra
round-trip vs the event-detail page, which passes data directly).
**Revisit if:** the friend group wants the popover to auto-pick a provider per user, or if
one provider's URL format breaks.

---

## 2026-05-12 — Calendar export ships as a per-event .ics download, not OAuth or a feed

**Choice:** Ship calendar integration as a server-rendered `.ics` file at
`/api/events/[id]/ics`, surfaced by an "Add to calendar" pill on the confirmed banner and on
`event_confirmed` notifications. No OAuth, no subscribable feed, no client-side library.
**Alternatives considered:** Subscribable per-user `.ics` feed (auto-add when an event
confirms); Google Calendar / Apple EventKit OAuth for true two-way sync; client-side ICS
generation with a library like `ics`.
**Why:** Push-style downloads cover ~80% of the "get this on my calendar" intent with ~5% of
the complexity. iOS Safari handles `text/calendar` natively and opens the native
Add-to-Calendar sheet on tap. No keys, no refresh tokens, no per-user state. Feeds and OAuth
can be layered later if the friend group actually uses the push version.
**Trade-offs:** Users tap once per event instead of subscribing once. Reschedules don't
auto-propagate — they'd re-tap the pill on the updated event. Couple-hour events write
floating local time (no TZID), so exporting from a different timezone won't shift the wall
clock — mirrors how the app already stores times.
**Revisit if:** the group wants confirmed events to appear automatically, or hosts reschedule
enough that manual re-adds become friction. Then build a per-user subscribable feed before
ever reaching for OAuth.

---

## 2026-05-11 — Calendar previews should follow the actual date someone touched

**Choice:** Make the main Calendar preview key off the exact hovered / tapped day, and treat
tentative or voting events as present on every proposed option date instead of only the
current leader.
**Alternatives considered:** Keep the month grid as display-only; preview only the event
`topDate`; send users to week/list view for detail.
**Why:** The question on Calendar is date-first: "what's on this day?" A preview that ignores
non-leading options or only changes a subtle cell state feels broken even when the code fires.
**Trade-offs:** Slightly more client-side calendar shaping and one more preview UI state.
**Revisit if:** the month view gets crowded enough that we need a richer overlay or a
dedicated day sheet instead of the lightweight inline preview.

---

## 2026-04-26 — Notifications should track exact seen items, not just a last-open time

**Choice:** Keep a small local store of seen notification signatures (`id + timestamp`)
alongside the last-open timestamp.
**Alternatives considered:** Rely only on `lastSeenAt`; add a full backend notifications table.
**Why:** Some notifications, especially confirmed events, can have timestamps that don't
behave like a normal inbox if we only compare against a single last-seen time. Tracking exact
versions keeps the unread badge honest without backend complexity.
**Trade-offs:** Slightly more local-state bookkeeping and one more helper module.
**Revisit if:** notifications become shared, server-authored objects that need true read
receipts across devices.

---

## 2026-04-26 — `length_days` replaces `length_type`

**Choice:** Treat event length as a numeric day-count field (`length_days`) instead of the
older three-value `length_type` enum.
**Alternatives considered:** Keep the fixed enum forever; support both models indefinitely.
**Why:** The enum was too rigid once we wanted anything beyond a single day or a 3-day
weekend. Numeric day counts keep the picker flexible and match the newer migration and
scoring logic.
**Trade-offs:** We need a small compatibility layer while older code and notes catch up.
**Revisit if:** hosts start asking for more nuanced timing than a simple day count can express.

---

## 2026-04-25 — "Unknown" is a real availability bucket, not a synonym for "free"

**Choice:** Treat any participant who has never submitted an availability row as `unknown`,
not `free`. "X/Y free" only displays when blocked and unknown are both zero.
**Alternatives considered:** (A) keep the model where missing == free, since most invited
friends are likely available; (B) build a real `availability_submissions` table tracking who
has actively submitted and when.
**Why:** The old model meant the event page would proudly show "12/12 free" even when nobody
had opened the app. That's misinformation, not just imprecision. Splitting unknown out makes
the displayed score honest at the cost of a busier label ("8/12 free · 4 unknown"). Option B
is cleaner long-term but too much scaffolding for a 12-friend app right now.
**Trade-offs:** "Submitted" is inferred from "has any row in the availability table," so a
user who has only ever blocked one day counts as submitted forever. False positives bias
toward *more* certainty, not less. Edge case: a user who submits then deletes all rows flips
back to unknown.
**Revisit if:** the group complains the app is too pedantic about who's submitted, or we want
to nag non-responders.

---

## 2026-04-25 — Event length is a first-class field, not a note

**Choice:** Add `events.length_type` enum (`couple_hours` / `day_long` / `three_day_trip`)
and use it to drive Best Available candidate generation. 3-day trips produce Friday-anchored
weekend ranges; everything else produces single-day candidates.
**Alternatives considered:** (A) infer length from how the host drags the calendar; (B) keep
length informal in the description; (C) support arbitrary range lengths (`N`-day trip).
**Why:** The host knows ahead of time whether they're planning a long weekend or a Tuesday
dinner; making them communicate that twice was friction. As a structured field, Best
Available can suggest the right shape of date. Couple-hour stays single-day for now, since we
don't have time-of-day availability yet.
**Trade-offs:** Three discrete options is rigid; a 4-day trip or a Wednesday-anchored weekend
doesn't fit. New schema column means another migration.
**Revisit if:** hosts repeatedly want range lengths that aren't 1 or 3, or we add time-of-day
availability and couple-hour events should stop suggesting whole days.
_(Superseded 2026-04-26 by `length_days`; kept for history.)_

---

## 2026-04-25 — Revert the registry-based icon system, keep event details

**Choice:** Roll the icon system back to the flat `icons.tsx` from `5fe35ca` (named SVGs +
`<IconTile Icon={...} />`). Keep every event-detail feature shipped in `16f60b5`.
**Alternatives considered:** (A) revert just the latest in-flight edits and live with the
scaffolded-but-wrong drawings; (B) keep the registry architecture and re-redraw the SVGs a
fourth time.
**Why:** The new architecture (registry + palettes + library page) was directionally right,
but multiple SVG passes kept missing the mark. Without source SVGs across the full inventory,
every redraw was guesswork. The flat set was visibly "decent enough" — better to ship from a
known-good baseline than keep iterating on something that wasn't landing.
**Trade-offs:** Lose the typed registry, the `/icon-library` reference page, and the
lake-plank-raft scene; future icon work rebuilds some of that scaffolding. The revert touched
21 files but only 2 needed surgical edits.
**Revisit if:** a complete source-SVG package exists for the full inventory and the brand is
stable enough to justify rebuilding the registry layer.

---

## 2026-04-25 — Event pages should carry real logistics, not just votes

**Choice:** Expand event pages to store and show location, street address, time range, group
notes, parking / meetup notes, and Apple Maps handoff.
**Alternatives considered:** Keep event detail as a voting-only surface; stuff logistics into
the description field.
**Why:** Once plans become real, hosts need one page that answers where, when, and what people
need to know. Voting picks a date, but it doesn't get people to the right place.
**Trade-offs:** More schema fields, a bigger detail page, and a stronger need to keep the
create flow disciplined.
**Revisit if:** events start needing RSVP, comments, or attachments and the detail page needs
another structural pass.

---

## 2026-04-25 — Manual address entry over paid autofill for now

**Choice:** Keep location entry manual and rely on one-tap Apple Maps links instead of
shipping Mapbox autofill right now.
**Alternatives considered:** Add Mapbox address autocomplete immediately.
**Why:** For a 12-friend app, the cost and vendor complexity isn't worth it yet. Manual entry
is good enough if maps handoff is fast.
**Trade-offs:** Hosts type the address themselves; we lose convenience suggestions for now.
**Revisit if:** hosts start creating lots of events or address accuracy becomes real friction.

---

## 2026-04-25 — Icons need architecture, not one-off SVGs

**Choice:** Build a typed semantic icon registry and a living icon library page, then route
categories and surfaces through that system.
**Alternatives considered:** Keep swapping individual SVGs inline whenever a screen needs a
visual tweak.
**Why:** Icons are a core part of Summer Plans' feel. A semantic system makes them reusable,
documentable, and easier to extend without drift.
**Trade-offs:** More upfront structure and more files to keep coherent.
**Revisit if:** the icon set stabilizes so completely that the registry feels heavier than
the product needs.
_(Note: reverted same day — see "Revert the registry-based icon system" above.)_

---

## 2026-04-25 — Brighter background + sharper geometry as the visual baseline

**Choice:** Move Summer Plans toward a brighter off-white background, lighter cards, and
tighter rounded corners across the shared UI system.
**Alternatives considered:** Keep the warmer cream-heavy look; keep adding page-specific
tweaks without changing the shared surface language.
**Why:** The mockup gap was mostly feel, not product structure. The previous version was
directionally right but too soft and creamy. Tightening geometry and brightening surfaces got
much closer to the intended product without a full redesign.
**Trade-offs:** The app loses a little of the super-soft handmade feel; future screens must
respect the crisper geometry so the system stays coherent.
**Revisit if:** real device testing shows the brighter treatment feels too sterile or
readability drops outside ideal lighting.

---

## 2026-04-24 — Bridge mockups with the current data model first

**Choice:** Push Home, Ideas, and Calendar much closer to the target mobile mockups using the
existing Supabase tables and client-side logic before designing new schema.
**Alternatives considered:** Stop and redesign ideas voting + event metadata first; ship only
cosmetic tweaks.
**Why:** It closed the product-feel gap fast and let us learn which parts of the mockups
really needed backend support. Most of the lift was layout, hierarchy, and flow, not storage.
**Trade-offs:** Some behaviors are still approximations. Idea Best/Works/Pass was local UI
layered on likes, and events still lacked true time/location fields for the calendar.
**Revisit if:** the group needs shared idea preference counts or the calendar needs richer
event metadata.

---

## 2026-04-23 — Supabase magic-link auth replaces localStorage identity

**Choice:** Summer Plans uses Supabase Auth magic links instead of name-only localStorage
identity. Signed-in users get a real persisted profile and can still rename themselves in-app.
**Alternatives considered:** Keep trust-based localStorage names forever; add passwords.
**Why:** Keeps the app low-friction, but identity is now real enough to survive refreshes,
sessions, and wider use without people accidentally or intentionally pretending to be someone
else.
**Trade-offs:** Signing out, switching devices, or clearing browser data means using a fresh
magic link. Supabase auth setup is a little more involved than a text field.
**Revisit if:** the crew hates email links or we need invite-only onboarding.

---

## 2026-04-24 — Test-suite foundation before friend-group rollout

**Choice:** Start a real three-layer test strategy: Vitest for logic, Testing Library for
component behavior, Playwright for end-to-end flows.
**Alternatives considered:** Keep relying on manual testing; add only e2e later.
**Why:** Once the friend group starts using this for real plans, we need confidence before
shipping. Fast logic tests catch regressions early, and Playwright proves important flows
still work.
**Trade-offs:** More setup and maintenance, plus test data eventually needs clean seeding.
**Revisit if:** the app stays tiny enough that the tests cost more than they save.

---

## 2026-04-23 — GitHub Issues + CLAUDE.md as the PM system (Notion retired 2026-06-20)

**Choice:** _Originally:_ a Notion Mission Control page was the living brief, GitHub Issues
the to-do list, `CLAUDE.md` the onboarding doc. **Updated 2026-06-20:** the Notion layer is
retired. The living project surface now lives in-repo under `docs/`
(`mission-control.md`, `roadmap.md`, `parking-lot.md`, `decisions.md`). GitHub Issues stays
the to-do list; `CLAUDE.md` stays the brief.
**Alternatives considered:** Linear, Jira, Notion-only, Asana, "just remember."
**Why:** Notion drifted ~6 weeks out of date because it lived outside the commit flow. Keeping
the project state in the repo means it updates in the same motion as the code and travels with
a clone — one source of truth, no second tool to keep in sync.
**Trade-offs:** Lose Notion's database views/kanban and visual layer; markdown tables are
plainer. Still requires session-end discipline, but now it's a commit, not a context switch.
**Revisit if:** we grow beyond solo + Claude, or we miss the visual/kanban surface enough to
justify a tool outside the repo.

---

## 2026-04-23 — Earthy palette, no cosmetic colors

**Choice:** Every color comes from the semantic token system (`olive`, `terracotta`, `sand`,
`ink`, etc.). No raw Tailwind colors like `bg-red-500` or `text-blue-600`. No gradients.
**Alternatives considered:** Keep the default Tailwind palette; use shadcn defaults.
**Why:** The app needs to feel like one coherent thing, not a grab-bag of demo components.
Earthy tokens give every screen the same "voice." When Claude generates new code, it can't
accidentally reach for a mismatched color — the tokens are the only vocabulary.
**Trade-offs:** Slight friction adding new colors (must name them first). Easier to add a
token than to police cosmetic drift.
**Revisit if:** we ever need a second theme (dark mode, holiday skin).

---

## 2026-04-23 — localStorage for identity (not real auth)

**Choice:** Users "log in" by typing their name, stored in `localStorage` via `useName()`.
Every write to Supabase tags the row with that name.
**Alternatives considered:** Supabase Auth with magic links or passwords.
**Why:** 12 friends, one group chat, zero strangers. Auth friction would kill adoption for
the non-technical friends. The app is trust-based by design.
**Trade-offs:** Anyone can pretend to be anyone. No password recovery. No multi-device
without retyping.
**Revisit if:** we ever want this to work for more than one friend group, or if someone
starts griefing.
_(Superseded 2026-04-23 by Supabase magic-link auth above; kept for history.)_

---

## 2026-04-23 — Best-vote exclusivity

**Choice:** You can mark only *one* date option as "Best." Picking Best on a new option
auto-demotes your previous Best to "Works."
**Alternatives considered:** Allow multiple Bests; allow no Bests.
**Why:** Forces a real preference signal. If everyone can pick every date as Best, the ranking
is noise. One Best = one vote of real intent.
**Trade-offs:** Users who genuinely love two dates have to pick. That's the point.
**Revisit if:** we see users gaming the system or host feedback says ranking is too rigid.

---

## 2026-04-23 — Conflict scoring formula

**Choice:** A date option's score = `totalPoints - (blockedCount × 2)`. Best=3, Works=1,
No=0. Blockouts are doubly weighted.
**Alternatives considered:** Ignore blackouts in scoring; weight them 1x; weight them 3x.
**Why:** A date half the group can't attend is worse than a date nobody's excited about.
Double weight is a crude but legible penalty — you can explain it out loud to a friend.
**Trade-offs:** Arbitrary magic number (2x). Someone will eventually ask why.
**Revisit if:** host feedback suggests the "winner" feels wrong vs. the vibe in the group chat.
_(Note: superseded by voting v2 — see CLAUDE.md "voting v2"; the Best=3/Works=1/No=0 points
model is gone. Kept for history.)_

---

## 2026-04-23 — Free-text labels > category picker

**Choice:** Category for an event or idea is inferred from its title via keyword matching
(`lib/categories.ts`), not set by the user.
**Alternatives considered:** Dropdown with preset categories; tag input.
**Why:** One less field. Users think in "Lake weekend," not "Category: Travel > Weekend Trip."
Keyword matching gets the right icon ~90% of the time and it's invisible when it works.
**Trade-offs:** Weird titles get a default icon. That's fine.
**Revisit if:** we add event detail complexity that requires explicit categorization.

---

## 2026-04-23 — Shared data loader (`lib/planData.ts`)

**Choice:** Home, Calendar, and Me all pull from one async loader that fetches + joins the
full state. Each page picks what it needs.
**Alternatives considered:** Each page queries Supabase independently; React Query; SWR.
**Why:** Three pages need the same joined view. Centralizing it means one place to change the
shape, one place to optimize. Avoids six nearly-identical query blocks that drift apart.
**Trade-offs:** Over-fetches if a page only needs part of the data. Not a problem at 12 users.
**Revisit if:** load times get noticeable, or we outgrow the one-shape-fits-all approach.

---

## 2026-04-23 — Kill the dev server when you step away

**Choice:** End-of-session ritual includes killing `next dev`. No "leave it running overnight."
**Alternatives considered:** Keep it running for fast restart.
**Why:** One source of truth (prod = what Vercel shows, not a stale localhost). Port hygiene.
Battery. Forces the "restart to rule out server state" reflex that catches real bugs.
**Trade-offs:** ~5 seconds to restart next time. Worth it.
**Revisit if:** never.
