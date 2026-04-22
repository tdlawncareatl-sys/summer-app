-- Users
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  avatar_url text,
  created_at timestamptz default now()
);

-- Availability blackouts
create table if not exists availability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  date date not null,
  created_at timestamptz default now(),
  unique(user_id, date)
);

-- Events
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_by uuid references users(id) on delete set null,
  status text default 'planning' check (status in ('planning', 'confirmed', 'cancelled')),
  created_at timestamptz default now()
);

-- Date options for events
create table if not exists date_options (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade not null,
  date date not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz default now()
);

-- Votes on date options (Best=3pts, Works=1pt, No=0pts)
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  date_option_id uuid references date_options(id) on delete cascade not null,
  user_id uuid references users(id) on delete cascade not null,
  response text not null check (response in ('best', 'works', 'no')),
  points int not null check (points in (0, 1, 3)),
  created_at timestamptz default now(),
  unique(date_option_id, user_id)
);

-- Ideas hub
create table if not exists ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  submitted_by uuid references users(id) on delete set null,
  likes int default 0,
  created_at timestamptz default now()
);
