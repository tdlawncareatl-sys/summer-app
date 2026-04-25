alter table if exists events
  add column if not exists confirmed_date date,
  add column if not exists confirmed_end_date date,
  add column if not exists location_name text,
  add column if not exists location_address text,
  add column if not exists location_notes text,
  add column if not exists event_notes text,
  add column if not exists start_time text,
  add column if not exists end_time text;
