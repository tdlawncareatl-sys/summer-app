# Parking Lot

> Ideas we like but aren't doing now. Revisit at session start, not mid-build.
> Migrated from Notion 2026-06-20.
>
> **Tag:** Feature / Polish / Refactor / Moonshot / Maybe never

| Idea | Tag | Why parked | Captured |
|---|---|---|---|
| Per-user notification preferences | Feature | No notifications exist yet. Premature. _(Note: an in-app bell has since shipped — revisit.)_ | 2026-04-23 |
| Refactor supabase client calls into typed data-access layer | Refactor | Current direct calls are legible. Refactor when we feel the pain, not before. | 2026-04-23 |
| RLS (Row-Level Security) policies | Refactor | Off because of the 12-friend trust model. Needs to be on before any wider release. Bundle with real auth. | 2026-04-23 |
| RSVP + headcount separate from voting | Feature | Voting implicitly signals interest. Don't add another step until we see real confusion. | 2026-04-23 |
| Shared budget / cost-splitting per event | Maybe never | Splitwise already exists. Don't rebuild what friends already use. | 2026-04-23 |
| Per-event group chat / comments | Feature | Adds a real-time surface. Worth it only if the group wants it — right now iMessage is the group chat. | 2026-04-23 |
| Import availability from iCal / Google Calendar | Feature | Cool but heavy lift. Manual drag-select is 30 seconds for a summer. | 2026-04-23 |
| Multi-group support (one app, many friend groups) | Moonshot | Current design assumes one crew. Multi-tenant would rewrite auth + data model. Revisit if other groups ask. | 2026-04-23 |
| Dark mode | Polish | Earthy palette has no dark theme yet. Would require a second token layer. Not a pain point. | 2026-04-23 |
| Photo wall / memory grid per event | Moonshot | After-the-fact feature. Only matters if the app survives the first trip. | 2026-04-23 |
