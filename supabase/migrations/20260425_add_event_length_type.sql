-- Event length influences best-available date calculation and the calendar UI.
-- Stored as an integer day count so any number of days is supported:
--   0 = couple-hour event (treated as single-day for scheduling)
--   1 = day-long event
--   N = N-day trip (Bald Head Island = 8)
--
-- Earlier in the redesign we used a `length_type` text enum with three fixed
-- values; that turned out too rigid. Drop it if it exists and switch to an int.

alter table events drop column if exists length_type;

alter table events
  add column if not exists length_days int
  default 1
  check (length_days >= 0 and length_days <= 30);
