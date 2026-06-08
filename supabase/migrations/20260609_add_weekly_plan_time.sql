-- This Week — add an optional time-of-day preference to weekly plan votes.
--
-- One block per (plan, user, day): morning | afternoon | evening | flexible.
-- Mirrors the formal-event vote time preference (votes.time_preference). Used
-- to surface the leading time-of-day per day on the week board. Purely a
-- preference signal — it does not change day ranking.
--
-- Idempotent: safe to re-run.

alter table weekly_plan_votes add column if not exists time_preference text;

do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'weekly_plan_votes_time_preference_check'
  ) then
    alter table weekly_plan_votes add constraint weekly_plan_votes_time_preference_check
      check (time_preference is null or time_preference in ('morning', 'afternoon', 'evening', 'flexible'));
  end if;
end $$;
