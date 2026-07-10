-- BusWatch — Neon Postgres.
--
-- The `trips` and `fixes` tables are created automatically by the app
-- (app/api/sync/route.ts ensures them on first upload). This file documents
-- the schema and holds the analyst-side trend views — run the views below
-- once in the Neon SQL editor.
--
-- Privacy model (PRD 9): the phone talks only to /api/sync; the database
-- credential lives in Vercel env. Contributors are pseudonymous UUIDs.
-- Publish aggregates only, never individual traces.

-- Reference (auto-created):
--   trips (id uuid pk, contributor uuid, vehicle text, label text, route_id text,
--          bus_id text, started_at timestamptz, ended_at timestamptz, sim bool,
--          platform text, fix_count int, over_count int, discarded_count int,
--          created_at timestamptz)
--   fixes (trip_id uuid fk, t int, lat float8, lng float8, speed_kmh real,
--          heading real, accuracy real, seg_id text, limit_kmh int,
--          over bool, stationary bool, pk (trip_id, t))

-- Trend views ------------------------------------------------------------------

-- Per-segment speeding rate across all real (non-demo) trips.
create or replace view segment_rates as
select
  f.seg_id,
  count(*) filter (where f.over)                              as over_fixes,
  count(*)                                                    as valid_fixes,
  round(100.0 * count(*) filter (where f.over) / count(*), 1) as over_pct,
  count(distinct f.trip_id)                                   as trip_count
from fixes f
join trips tr on tr.id = f.trip_id and not tr.sim
where not f.stationary and f.seg_id is not null
group by f.seg_id
order by over_pct desc;

-- Speeding rate by hour of day and vehicle (spot rush-hour patterns).
create or replace view hourly_rates as
select
  extract(hour from tr.started_at at time zone 'Indian/Maldives') as hour,
  tr.vehicle,
  count(*) filter (where f.over) as over_fixes,
  count(*) as valid_fixes,
  round(100.0 * count(*) filter (where f.over) / count(*), 1) as over_pct
from fixes f
join trips tr on tr.id = f.trip_id and not tr.sim
where not f.stationary
group by 1, 2
order by 1, 2;
