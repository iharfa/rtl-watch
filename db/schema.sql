-- BusWatch cloud schema (Supabase / Postgres)
-- Run this once in the Supabase SQL editor of a fresh project.
--
-- Privacy model (PRD 9): the app's anon key is WRITE-ONLY. Contributors are
-- pseudonymous UUIDs. Individual traces are never readable by the public —
-- analysts query with the service role, and only aggregates get published.

create table trips (
  id uuid primary key,
  contributor uuid not null,
  vehicle text not null default 'bus',      -- bus | taxi | other
  label text,                               -- free text for 'other' (motorbike, joy ride…)
  route_id text,
  bus_id text,
  started_at timestamptz not null,
  ended_at timestamptz,
  sim boolean not null default false,       -- demo-mode trips; exclude from every analysis
  platform text,
  fix_count int not null default 0,
  over_count int not null default 0,
  discarded_count int not null default 0,
  created_at timestamptz not null default now()
);

create table fixes (
  trip_id uuid not null references trips (id),
  t int not null,                           -- ms since trip start, monotonic
  lat double precision not null,
  lng double precision not null,
  speed_kmh real not null,
  heading real,
  accuracy real not null,
  seg_id text,
  limit_kmh int,
  over boolean not null,
  stationary boolean not null,
  primary key (trip_id, t)
);

-- Write-only for the app: anon may insert, never select/update/delete.
alter table trips enable row level security;
alter table fixes enable row level security;
create policy trips_insert on trips for insert to anon with check (true);
create policy fixes_insert on fixes for insert to anon with check (true);

-- Trend queries (service role / dashboard side) --------------------------------

-- Per-segment speeding rate across all real (non-demo) trips.
create view segment_rates as
select
  f.seg_id,
  count(*) filter (where f.over)                          as over_fixes,
  count(*)                                                as valid_fixes,
  round(100.0 * count(*) filter (where f.over) / count(*), 1) as over_pct,
  count(distinct f.trip_id)                               as trip_count
from fixes f
join trips tr on tr.id = f.trip_id and not tr.sim
where not f.stationary and f.seg_id is not null
group by f.seg_id
order by over_pct desc;

-- Speeding rate by hour of day (spot rush-hour patterns).
create view hourly_rates as
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
