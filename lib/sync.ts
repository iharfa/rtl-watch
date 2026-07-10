// Cloud sync — uploads finished trips to /api/sync (Vercel function → Neon
// Postgres) so trends can be analysed off-device. The phone never holds a
// database credential.
import { getFixes, getTrips, putTrip, type Trip } from './db';

// Pseudonymous contributor id (PRD 9) — random, stored only on this device.
function contributorId(): string {
  let id = localStorage.getItem('buswatch-contributor');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('buswatch-contributor', id);
  }
  return id;
}

export class SyncOffError extends Error {}

async function uploadTrip(trip: Trip): Promise<void> {
  const fixes = await getFixes(trip.id);
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trip: { ...trip, contributor: contributorId() }, fixes }),
  });
  if (res.status === 503) throw new SyncOffError();
  if (!res.ok) throw new Error(`sync ${res.status}`);
  trip.synced = true;
  await putTrip(trip);
}

// Upload every finished, unsynced trip. Returns how many went up.
export async function syncPending(): Promise<number> {
  if (!navigator.onLine) return 0;
  const pending = (await getTrips()).filter((t) => t.status === 'done' && !t.synced);
  let n = 0;
  for (const t of pending) {
    await uploadTrip(t); // ponytail: sequential, throws on first failure — retried on next page load / online event
    n++;
  }
  return n;
}
