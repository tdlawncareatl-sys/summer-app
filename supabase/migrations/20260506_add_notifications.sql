alter table events
  add column if not exists confirmed_at timestamptz;

create table if not exists notification_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  confirmed_enabled boolean not null default true,
  vote_needed_enabled boolean not null default true,
  reminder_timing text not null default 'smart' check (reminder_timing in ('smart', 'day_before', 'week_before', 'none')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  disabled_at timestamptz
);

create index if not exists push_subscriptions_user_id_idx
  on push_subscriptions(user_id);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  event_id uuid references events(id) on delete cascade,
  type text not null check (type in ('event_confirmed', 'event_reminder', 'vote_needed')),
  tone text not null check (tone in ('olive', 'terracotta', 'amber')),
  title text not null,
  body text not null,
  href text not null,
  dedupe_key text unique not null,
  scheduled_for timestamptz not null default now(),
  created_at timestamptz default now(),
  sent_at timestamptz,
  read_at timestamptz
);

create index if not exists notifications_user_schedule_idx
  on notifications(user_id, scheduled_for desc);

create index if not exists notifications_event_id_idx
  on notifications(event_id);
