// IndexedDB buffer — offline-first, a dropped connection never loses a trip.
export interface Trip {
  id: string;
  vehicle: 'bus' | 'taxi' | 'other';
  label: string; // free text for 'other' rides (motorbike, joy ride…), empty otherwise
  routeId: string | null; // null for taxi/other — no fixed route to tag
  busId: string;
  platform: string;
  startedAt: number; // wall clock, ms
  endedAt: number | null;
  status: 'recording' | 'done';
  sim: boolean;
  fixCount: number;
  overCount: number;
  discardedCount: number; // fixes rejected for accuracy > 20 m
  synced: boolean; // upload queue flag — backend is Phase 2
}

export interface Fix {
  tripId: string;
  t: number; // ms since trip start, monotonic (performance.now based)
  lat: number;
  lng: number;
  speedKmh: number;
  heading: number | null;
  accuracy: number;
  segId: string | null;
  limitKmh: number | null;
  over: boolean;
  stationary: boolean;
}

// ponytail: raw IndexedDB, ~40 lines; swap for `idb` if this grows transactions
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('buswatch', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('trips', { keyPath: 'id' });
      const fixes = db.createObjectStore('fixes', { autoIncrement: true });
      fixes.createIndex('tripId', 'tripId');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(store, mode).objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export const putTrip = (t: Trip) => tx('trips', 'readwrite', (s) => s.put(t));
export const getTrip = (id: string) => tx<Trip | undefined>('trips', 'readonly', (s) => s.get(id));
export const getTrips = () => tx<Trip[]>('trips', 'readonly', (s) => s.getAll());
export const addFix = (f: Fix) => tx('fixes', 'readwrite', (s) => s.add(f));
export const getFixes = (tripId: string): Promise<Fix[]> =>
  tx<Fix[]>('fixes', 'readonly', (s) => s.index('tripId').getAll(tripId));

export async function deleteTrip(id: string): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(['trips', 'fixes'], 'readwrite');
    t.objectStore('trips').delete(id);
    const idx = t.objectStore('fixes').index('tripId');
    idx.openKeyCursor(IDBKeyRange.only(id)).onsuccess = function () {
      const c = this.result;
      if (c) {
        t.objectStore('fixes').delete(c.primaryKey);
        c.continue();
      }
    };
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

// Privacy: trim trip endpoints so a trace can't reveal home/workplace.
export async function trimFixes(tripId: string, keepFrom: number, keepTo: number): Promise<number> {
  const db = await open();
  return new Promise((resolve, reject) => {
    let removed = 0;
    const t = db.transaction('fixes', 'readwrite');
    const store = t.objectStore('fixes');
    store.index('tripId').openCursor(IDBKeyRange.only(tripId)).onsuccess = function () {
      const c = this.result;
      if (c) {
        const f = c.value as Fix;
        if (f.t < keepFrom || f.t > keepTo) {
          c.delete();
          removed++;
        }
        c.continue();
      }
    };
    t.oncomplete = () => resolve(removed);
    t.onerror = () => reject(t.error);
  });
}
