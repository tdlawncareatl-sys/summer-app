-- Performance indexes for the hot lookup paths the app already runs on every
-- page load. Postgres hashes uuid equality fast enough that 12-user scale
-- rarely sees the cost, but keeping them in place removes one foot-gun if the
-- crew ever grows or someone bulk-imports historical blackouts.
--
-- All idempotent — safe to re-run.

create index if not exists availability_user_id_idx     on availability(user_id);
create index if not exists availability_date_idx        on availability(date);
create index if not exists date_options_event_id_idx    on date_options(event_id);
create index if not exists date_options_date_idx        on date_options(date);
create index if not exists votes_date_option_id_idx     on votes(date_option_id);
create index if not exists votes_user_id_idx            on votes(user_id);
