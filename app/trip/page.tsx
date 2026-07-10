'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import TripMap from '@/components/TripMap';
import { startTrip, type LiveState, type Tracker } from '@/lib/tracker';
import type { Fix } from '@/lib/db';

export default function TripPage() {
  const router = useRouter();
  const trackerRef = useRef<Tracker | null>(null);
  const [live, setLive] = useState<LiveState | null>(null);
  const [fixes, setFixes] = useState<Fix[]>([]);
  const [ending, setEnding] = useState(false);
  const [native, setNative] = useState(false);
  useEffect(() => setNative(!!(window as any).Capacitor?.isNativePlatform?.()), []);

  useEffect(() => {
    if (trackerRef.current) return;
    const q = new URLSearchParams(window.location.search);
    let cancelled = false;
    const v = q.get('vehicle');
    startTrip({
      vehicle: v === 'taxi' || v === 'other' ? v : 'bus',
      label: q.get('label') ?? '',
      routeId: q.get('route'),
      busId: q.get('bus') ?? '',
      sim: q.get('sim') === '1',
      onUpdate: (s) => {
        setLive(s);
        if (s.fix) setFixes((prev) => [...prev, s.fix!]);
      },
    }).then((t) => {
      if (cancelled) t.stop();
      else trackerRef.current = t;
      (window as any).__tracker = t; // dev handle
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function endTrip() {
    if (!trackerRef.current || ending) return;
    setEnding(true);
    const trip = await trackerRef.current.stop();
    router.push(`/trips/?id=${trip.id}`);
  }

  const fix = live?.fix ?? null;
  const over = !!fix?.over;

  return (
    <main className="shell">
      <div className={`speedo${over ? ' over' : ''}`}>
        <div className="value">{fix ? Math.round(fix.speedKmh) : '—'}</div>
        <div className="dim small" style={{ marginBottom: 8 }}>km/h</div>
        <span className={`limit-chip${over ? ' over' : ''}`}>
          {fix?.limitKmh != null ? `LIMIT ${fix.limitKmh}` : 'OFF ROAD NETWORK'}
        </span>
        <div className="dim small" style={{ marginTop: 8 }}>{live?.segName ?? 'No matched road'}</div>
      </div>

      <TripMap fixes={fixes} follow />

      <div className="statusline">
        <span>{live?.fixCount ?? 0} fixes · {live?.discardedCount ?? 0} dropped</span>
        <span>{live?.overCount ?? 0} over</span>
        <span>{native ? 'BACKGROUND SERVICE' : live?.wakeLock ? 'WAKE LOCK ON' : 'WAKE LOCK OFF'}</span>
      </div>
      {live?.error && (
        <div className="card small" style={{ borderColor: 'var(--color-over)' }}>
          GPS error: {live.error}. Check location permission and try again.
        </div>
      )}

      <button className="btn" onClick={endTrip} disabled={ending}>
        {ending ? 'Saving…' : 'End trip'}
      </button>
    </main>
  );
}
