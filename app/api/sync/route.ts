import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

// Trip upload endpoint — the phone never talks to the database directly.
// Schema is ensured lazily once per cold start (idempotent CREATEs).

const MAX_FIXES = 100_000;

let ready: Promise<void> | null = null;
function db() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) return null;
  const sql = neon(url);
  ready ??= (async () => {
    await sql`create table if not exists trips (
      id uuid primary key,
      contributor uuid not null,
      vehicle text not null default 'bus',
      label text,
      route_id text,
      bus_id text,
      started_at timestamptz not null,
      ended_at timestamptz,
      sim boolean not null default false,
      platform text,
      fix_count int not null default 0,
      over_count int not null default 0,
      discarded_count int not null default 0,
      created_at timestamptz not null default now()
    )`;
    await sql`create table if not exists fixes (
      trip_id uuid not null references trips (id),
      t int not null,
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
    )`;
  })();
  return { sql, ready };
}

const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : null);
const str = (v: unknown, max = 100) => (typeof v === 'string' ? v.slice(0, max) : null);

export async function GET() {
  return NextResponse.json({ configured: !!(process.env.DATABASE_URL ?? process.env.POSTGRES_URL) });
}

export async function POST(req: Request) {
  const conn = db();
  if (!conn) return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  await conn.ready;
  const { sql } = conn;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }
  const trip = body?.trip;
  const fixes: any[] = Array.isArray(body?.fixes) ? body.fixes : [];
  // Trust boundary: validate everything coming off a phone.
  if (
    !trip ||
    typeof trip.id !== 'string' ||
    typeof trip.contributor !== 'string' ||
    num(trip.startedAt) === null ||
    fixes.length > MAX_FIXES ||
    fixes.some((f) => num(f?.t) === null || num(f?.lat) === null || num(f?.lng) === null)
  ) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  try {
    await sql`insert into trips (id, contributor, vehicle, label, route_id, bus_id, started_at, ended_at, sim, platform, fix_count, over_count, discarded_count)
      values (${trip.id}, ${trip.contributor}, ${str(trip.vehicle) ?? 'bus'}, ${str(trip.label)},
        ${str(trip.routeId)}, ${str(trip.busId)}, ${new Date(trip.startedAt).toISOString()},
        ${num(trip.endedAt) ? new Date(trip.endedAt).toISOString() : null}, ${trip.sim === true},
        ${str(trip.platform)}, ${num(trip.fixCount) ?? 0}, ${num(trip.overCount) ?? 0}, ${num(trip.discardedCount) ?? 0})
      on conflict (id) do nothing`;
    if (fixes.length) {
      // one round-trip: unnest parallel arrays
      await sql`insert into fixes (trip_id, t, lat, lng, speed_kmh, heading, accuracy, seg_id, limit_kmh, over, stationary)
        select ${trip.id}::uuid, * from unnest(
          ${fixes.map((f) => Math.round(f.t))}::int[],
          ${fixes.map((f) => f.lat)}::float8[],
          ${fixes.map((f) => f.lng)}::float8[],
          ${fixes.map((f) => num(f.speedKmh) ?? 0)}::real[],
          ${fixes.map((f) => num(f.heading))}::real[],
          ${fixes.map((f) => num(f.accuracy) ?? 0)}::real[],
          ${fixes.map((f) => str(f.segId))}::text[],
          ${fixes.map((f) => num(f.limitKmh))}::int[],
          ${fixes.map((f) => f.over === true)}::bool[],
          ${fixes.map((f) => f.stationary === true)}::bool[]
        ) on conflict (trip_id, t) do nothing`;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'insert failed' }, { status: 500 });
  }
}
