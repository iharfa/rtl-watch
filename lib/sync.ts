// Cloud sync — uploads finished trips to Supabase so trends can be analysed
// off-device. Write-only from the app: the anon key can INSERT but never read
// anyone's traces back (see db/schema.sql RLS policies).
import { getFixes, getTrips, putTrip, type Trip } from './db';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const syncEnabled = !!(URL && KEY);

// Pseudonymous contributor id (PRD 9) — random, stored only on this device.
function contributorId(): string {
  let id = localStorage.getItem('buswatch-contributor');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('buswatch-contributor', id);
  }
  return id;
}

async function insert(table: string, rows: unknown): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: KEY!,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal,resolution=ignore-duplicates',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
}

async function uploadTrip(trip: Trip): Promise<void> {
  const fixes = await getFixes(trip.id);
  await insert('trips', {
    id: trip.id,
    contributor: contributorId(),
    vehicle: trip.vehicle ?? 'bus',
    label: trip.label || null,
    route_id: trip.routeId,
    bus_id: trip.busId || null,
    started_at: new Date(trip.startedAt).toISOString(),
    ended_at: trip.endedAt ? new Date(trip.endedAt).toISOString() : null,
    sim: trip.sim,
    platform: trip.platform ?? 'unknown',
    fix_count: trip.fixCount,
    over_count: trip.overCount,
    discarded_count: trip.discardedCount,
  });
  if (fixes.length) {
    await insert(
      'fixes',
      fixes.map((f) => ({
        trip_id: f.tripId,
        t: f.t,
        lat: f.lat,
        lng: f.lng,
        speed_kmh: f.speedKmh,
        heading: f.heading,
        accuracy: f.accuracy,
        seg_id: f.segId,
        limit_kmh: f.limitKmh,
        over: f.over,
        stationary: f.stationary,
      }))
    );
  }
  trip.synced = true;
  await putTrip(trip);
}

// Upload every finished, unsynced trip. Returns how many went up.
export async function syncPending(): Promise<number> {
  if (!syncEnabled || !navigator.onLine) return 0;
  const pending = (await getTrips()).filter((t) => t.status === 'done' && !t.synced);
  let n = 0;
  for (const t of pending) {
    await uploadTrip(t); // ponytail: sequential, throws on first failure — retried on next page load / online event
    n++;
  }
  return n;
}
