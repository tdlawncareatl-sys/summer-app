-- Voting v2 — replace the weighted 3pt/1pt/0pt model with binary attendance
-- (works | pass) plus an optional preferred flag and an optional time block
-- preference (morning/afternoon/evening/flexible) for short events.
--
-- Also add manual-confirmation metadata so we can tell "auto-locked from
-- recommendation" apart from "someone explicitly chose this date".
--
-- Data migration: existing best votes carry their preference signal through,
-- existing no votes become pass. New rows always use works/pass.
--
-- Idempotent: safe to re-run.

-- ─── votes ──────────────────────────────────────────────────────────────────

alter table votes add column if not exists preferred boolean not null default false;
alter table votes add column if not exists time_preference text;

do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'votes_time_preference_check'
  ) then
    alter table votes add constraint votes_time_preference_check
      check (time_preference is null or time_preference in ('morning','afternoon','evening','flexible'));
  end if;
end $$;

-- Drop the OLD response check before migrating data — the old constraint
-- only permitted ('best','works','no'), so writing 'pass' would fail against
-- it even though it's valid under the new model.
alter table votes drop constraint if exists votes_response_check;

-- Carry the old "best" preference signal forward, then collapse to works/pass.
update votes set preferred = true where response = 'best' and preferred = false;
update votes set response = 'works' where response = 'best';
update votes set response = 'pass'  where response = 'no';

-- Add the new constraint now that all rows are in the new value set.
alter table votes add constraint votes_response_check
  check (response in ('works','pass'));

-- ─── events ─────────────────────────────────────────────────────────────────

alter table events add column if not exists confirmation_method text;
do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'events_confirmation_method_check'
  ) then
    alter table events add constraint events_confirmation_method_check
      check (confirmation_method is null or confirmation_method in ('auto','manual'));
  end if;
end $$;

alter table events add column if not exists confirmed_by text;
