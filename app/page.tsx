'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES, type Vehicle } from '@/lib/route';

const CONSENT_KEY = 'buswatch-consent-v1';

export default function Home() {
  const router = useRouter();
  const [consented, setConsented] = useState<boolean | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle>('bus');
  const [label, setLabel] = useState('');
  const [routeId, setRouteId] = useState(ROUTES[0].id);
  const [busId, setBusId] = useState('');
  const [sim, setSim] = useState(false);

  useEffect(() => {
    setConsented(localStorage.getItem(CONSENT_KEY) === 'yes');
  }, []);

  if (consented === null) return null;

  if (!consented) {
    return (
      <main className="shell">
        <h1>BusWatch</h1>
        <p className="dim">A crowdsourced speed audit of Greater Malé public transport, run by riders.</p>
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Before you record</h2>
          <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8 }}>
            <li>While a trip is recording, this app logs your position and speed once per second.</li>
            <li>Trips are stored on your phone under a random ID — no name or phone number.</li>
            <li>The first and last minute of every trip is deleted, so a trace can&apos;t point at your home or workplace.</li>
            <li>Only combined results across many riders are ever published — never your individual trip.</li>
            <li>You can view and delete your trips at any time from this app.</li>
          </ul>
        </div>
        <button className="btn" onClick={() => { localStorage.setItem(CONSENT_KEY, 'yes'); setConsented(true); }}>
          I understand, continue
        </button>
      </main>
    );
  }

  return (
    <main className="shell">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1>BusWatch</h1>
        <a href="/trips/">My trips</a>
      </header>
      <p className="dim">Board, pick what you&apos;re riding, start recording. Keep the screen on — mounted or lap-propped works best.</p>

      <div className="card" style={{ flex: 1 }}>
        <div className="seg-toggle" role="radiogroup" aria-label="Vehicle">
          {(['bus', 'taxi', 'other'] as Vehicle[]).map((v) => (
            <button
              key={v}
              role="radio"
              aria-checked={vehicle === v}
              className={vehicle === v ? 'on' : ''}
              onClick={() => setVehicle(v)}
            >
              {v === 'bus' ? 'RTL Bus' : v === 'taxi' ? 'Taxi' : 'Other'}
            </button>
          ))}
        </div>

        {vehicle === 'bus' && (
          <label className="field">
            <span>Route</span>
            <select value={routeId} onChange={(e) => setRouteId(e.target.value)}>
              {ROUTES.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </label>
        )}
        {vehicle === 'taxi' && (
          <p className="dim small" style={{ marginTop: 0 }}>
            Taxis have no fixed route — the trip logs wherever the car goes, and speed is judged against the
            limit for each road it&apos;s on.
          </p>
        )}
        {vehicle === 'other' && (
          <label className="field">
            <span>What are you riding?</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. motorbike, joy ride, cycle"
            />
          </label>
        )}

        {vehicle !== 'other' && (
          <label className="field">
            <span>{vehicle === 'bus' ? 'Bus plate / fleet number (optional)' : 'Taxi plate (optional)'}</span>
            <input type="text" value={busId} onChange={(e) => setBusId(e.target.value)} placeholder="e.g. C1B 1234" />
          </label>
        )}
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }} className="small dim">
          <input type="checkbox" checked={sim} onChange={(e) => setSim(e.target.checked)} />
          Demo mode — simulated GPS
        </label>
      </div>

      <button
        className="btn"
        onClick={() =>
          router.push(
            `/trip/?vehicle=${vehicle}${vehicle === 'bus' ? `&route=${routeId}` : ''}` +
              `${vehicle === 'other' ? `&label=${encodeURIComponent(label)}` : ''}` +
              `&bus=${encodeURIComponent(busId)}${sim ? '&sim=1' : ''}`
          )
        }
      >
        Start trip
      </button>
    </main>
  );
}
