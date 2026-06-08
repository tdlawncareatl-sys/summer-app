-- This Week — lightweight, casual weekly hangout planning.
--
-- Deliberately SEPARATE from the formal events system. Formal events are for
-- trips, reservations, structured scheduling. This is for "what night are we
-- grabbing dinner this week?" — faster, lower friction, opt-in conversion to a
-- real event once a day is locked.
--
-- Three tables:
--   weekly_plans       — one casual plan anchored to a week
--   weekly_plan_votes  — per-user Works/Pass on each candidate day, optional Best
--   weekly_plan_ideas  — simple idea suggestions (dinner, drinks, movie, ...)
--
-- Notes / deviations from the raw outline, and why:
--   • No `group_id`. This app is a single 12-friend group — there is no groups
--     concept anywhere yet. Adding an unused column now would be dead weight;
--     add it later if/when groups actually arrive.
--   • `created_by` is TEXT holding the display name, to match `events.created_by`
--     (the rest of the app checks ownership with `created_by === name`).
--   • `candidate_days` is a jsonb array of ISO date strings (the real calendar
--     dates of the chosen weekdays inside week_start_date's week).
--   • Added `converted_event_id` (not in the outline) so a converted plan can
--     link to the event it produced — lets the UI deep-link and prevents a
--     double conversion. Nullable, harmless.
--
-- RLS stays off (project-wide 12-friend trust model), matching every other table.
-- Idempotent: safe to re-run.

create table if not exists weekly_plans (
  id uuid primary key default gen_random_uuid(),
  created_by text,
  title text not null default 'Hang this week?',
  note text,
  week_start_date date not null,
  candidate_days jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open', 'confirmed', 'archived')),
  confirmed_day date,
  converted_event_id uuid references events(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists weekly_plans_status_week_idx
  on weekly_plans(status, week_start_date desc);

create table if not exists weekly_plan_votes (
  id uuid primary key default gen_random_uuid(),
  weekly_plan_id uuid not null references weekly_plans(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  day date not null,
  availability text not null check (availability in ('works', 'pass')),
  is_best_choice boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (weekly_plan_id, user_id, day)
);

create index if not exists weekly_plan_votes_plan_idx on weekly_plan_votes(weekly_plan_id);
create index if not exists weekly_plan_votes_user_idx on weekly_plan_votes(user_id);

create table if not exists weekly_plan_ideas (
  id uuid primary key default gen_random_uuid(),
  weekly_plan_id uuid not null references weekly_plans(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  idea_text text not null,
  category text,
  created_at timestamptz not null default now()
);

create index if not exists weekly_plan_ideas_plan_idx on weekly_plan_ideas(weekly_plan_id);
