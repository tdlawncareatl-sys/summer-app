-- Event length influences best-available date calculation and the calendar UI.
-- couple_hours / day_long → single-day candidates; three_day_trip → 3-day weekend windows.
alter table events
  add column if not exists length_type text
  default 'day_long'
  check (length_type in ('couple_hours', 'day_long', 'three_day_trip'));
