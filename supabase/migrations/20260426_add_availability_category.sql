-- The availability table predates the per-blackout `category` field. The
-- canonical schema.sql carries the column, but DBs that were created from the
-- original MVP schema never had it added, so any select/insert that touches
-- `category` crashes with "column availability.category does not exist".
--
-- Idempotent: safe to run on DBs that already have the column.
alter table availability
  add column if not exists category text;
