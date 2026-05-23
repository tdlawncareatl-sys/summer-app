-- Per-user idea interest persistence. Until now, "Interested" was tracked in
-- localStorage; the only DB-side signal was the denormalized `ideas.likes`
-- aggregate. That couldn't answer "who is interested in this idea?" — needed
-- for the detail page (avatars) and the Wheel detail panel.
--
-- The trigger keeps `ideas.likes` in sync as a derived count, so reads stay
-- cheap (no join per row) but writes are honest (one source of truth).
--
-- Idempotent: safe to re-run.

create table if not exists idea_likes (
  idea_id uuid not null references ideas(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

create index if not exists idea_likes_user_id_idx on idea_likes(user_id);

create or replace function refresh_idea_likes_count()
returns trigger
language plpgsql
as $$
declare
  target_id uuid;
begin
  target_id := coalesce(new.idea_id, old.idea_id);
  update ideas
    set likes = (select count(*) from idea_likes where idea_id = target_id)
    where id = target_id;
  return null;
end;
$$;

drop trigger if exists idea_likes_count_trigger on idea_likes;
create trigger idea_likes_count_trigger
  after insert or delete on idea_likes
  for each row execute function refresh_idea_likes_count();

-- Legacy `ideas.likes` counts (from the localStorage era) are left in place.
-- The trigger keeps things consistent from here on — each toggle resets that
-- idea's count to the true row count in `idea_likes`. So counts will drift
-- toward truth as engagement happens, without wiping existing signal today.
