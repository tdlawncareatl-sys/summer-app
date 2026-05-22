-- Attendance — per-user going/not_going scoped to the EVENT (not a date option).
--
-- Voting on date options is "which dates would work for me." Attendance is
-- "am I actually coming." Once an event is confirmed (or auto-confirmed with
-- no voting at all), this is the surface for committing.
--
-- Seeded silently from votes at confirm time: works → going, pass → not_going.
-- Users can override at any time. Survives date changes (the row is keyed to
-- the event, not the confirmed date), and survives unconfirm → reconfirm.
--
-- Idempotent: safe to re-run.

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  status text not null,
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'attendance_status_check'
  ) then
    alter table attendance add constraint attendance_status_check
      check (status in ('going','not_going'));
  end if;
end $$;

create index if not exists attendance_event_id_idx on attendance(event_id);
create index if not exists attendance_user_id_idx on attendance(user_id);
