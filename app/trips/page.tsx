'use client';
import { useEffect, useState } from 'react';
import TripMap from '@/components/TripMap';
import { deleteTrip, getFixes, getTrips, type Fix, type Trip } from '@/lib/db';
import { routeById } from '@/lib/route';
import { SyncOffError, syncPending } from '@/lib/sync';

function fmtDur(ms: number) {
  const m = Math.floor(ms / 60000);
  return m < 1 ? '<1 min' : `${m} min`;
}

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selected, setSelected] = useState<Trip | null>(null);
  const [fixes, setFixes] = useState<Fix[]>([]);
  const [syncMsg, setSyncMsg] = useState('Cloud sync: idle');
  const [syncOff, setSyncOff] = useState(false);

  async function load(selectId?: string | null) {
    const all = (await getTrips()).sort((a, b) => b.startedAt - a.startedAt);
    setTrips(all);
    const pick = selectId ? all.find((t) => t.id === selectId) ?? all[0] ?? null : all[0] ?? null;
    setSelected(pick);
  }

  async function runSync() {
    setSyncMsg('Cloud sync: uploading…');
    try {
      const n = await syncPending();
      setSyncMsg(n > 0 ? `Cloud sync: ${n} trip${n === 1 ? '' : 's'} uploaded` : 'Cloud sync: up to date');
      if (n > 0) load();
    } catch (e) {
      if (e instanceof SyncOffError) {
        setSyncOff(true);
        setSyncMsg('Cloud sync: off (no database configured)');
      } else {
        setSyncMsg('Cloud sync: failed — will retry when online');
      }
    }
  }

  useEffect(() => {
    load(new URLSearchParams(window.location.search).get('id'));
    runSync();
    window.addEventListener('online', runSync);
    return () => window.removeEventListener('online', runSync);
  }, []);

  useEffect(() => {
    if (!selected) return setFixes([]);
    getFixes(selected.id).then((f) => setFixes(f.sort((a, b) => a.t - b.t)));
  }, [selected]);

  async function remove(t: Trip) {
    if (!confirm('Delete this trip and all its recorded fixes? This cannot be undone.')) return;
    await deleteTrip(t.id);
    load();
  }

  const overPct = selected && selected.fixCount > 0 ? Math.round((selected.overCount / selected.fixCount) * 100) : 0;

  return (
    <main className="shell">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1>My trips</h1>
        <a href="/">Record</a>
      </header>

      <p className="dim small mono" style={{ margin: 0 }}>{syncMsg}</p>
      {trips.length === 0 && <p className="dim">No trips yet. Record one from the home screen.</p>}

      {selected && (
        <>
          <TripMap fixes={fixes} />
          <div className="statusline">
            <span>{fixes.length} fixes kept</span>
            <span className="mono" style={{ color: overPct > 0 ? 'var(--color-over)' : 'var(--color-ok)' }}>
              {overPct}% over limit
            </span>
            <span>{selected.discardedCount} dropped</span>
          </div>
          <p className="dim small" style={{ margin: 0 }}>
            Speeds compared against a placeholder limit dataset (limit +5 km/h margin). Not audit-grade until the
            field survey replaces it. Endpoints trimmed for privacy on trips over 3 minutes.
          </p>
        </>
      )}

      <div style={{ display: 'grid', gap: 8 }}>
        {trips.map((t) => (
          <button key={t.id} className="trip-row" aria-current={selected?.id === t.id} onClick={() => setSelected(t)}>
            <span>
              <span style={{ display: 'block', fontWeight: 500 }}>
                {t.vehicle === 'taxi'
                  ? 'Taxi — free route'
                  : t.vehicle === 'other'
                    ? `${t.label || 'Custom ride'} — free route`
                    : routeById(t.routeId ?? '')?.name ?? t.routeId ?? 'Bus'}
              </span>
              <span className="dim small">
                {new Date(t.startedAt).toLocaleString()} · {t.endedAt ? fmtDur(t.endedAt - t.startedAt) : 'recording'}
                {t.busId ? ` · bus ${t.busId}` : ''}
              </span>
            </span>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {t.sim && <span className="badge">DEMO</span>}
              <span className="badge">
                {t.vehicle === 'taxi' ? 'TAXI' : t.vehicle === 'other' ? 'OTHER' : 'BUS'}
              </span>
              <span className="badge">{t.overCount} over</span>
              {!syncOff && t.status === 'done' && (
                <span className="badge">{t.synced ? 'SYNCED' : 'QUEUED'}</span>
              )}
            </span>
          </button>
        ))}
      </div>

      {selected && (
        <button className="btn btn-danger" onClick={() => remove(selected)}>
          Delete selected trip
        </button>
      )}
    </main>
  );
}
