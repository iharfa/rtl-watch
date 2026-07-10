import { along, length, lineString, distance, point, bearing } from '@turf/turf';
import { addFix, putTrip, trimFixes, type Fix, type Trip } from './db';
import { isOver, limitAt, routeById, MAX_ACCURACY_M, SPEED_FLOOR_MPS, TAXI_SIM_LINE, type Vehicle } from './route';

export interface LiveState {
  fix: Fix | null;
  segName: string | null;
  fixCount: number;
  overCount: number;
  discardedCount: number;
  wakeLock: boolean;
  error: string | null;
}

export interface Tracker {
  trip: Trip;
  stop: () => Promise<Trip>;
}

// Privacy: clip the first/last minute so endpoints can't reveal home or workplace.
// ponytail: time-based 60 s clip, only on trips > 3 min; distance-based 100 m buffer if PDPA review asks.
const TRIM_MS = 60_000;
const TRIM_MIN_TRIP_MS = 180_000;

export async function startTrip(opts: {
  vehicle: Vehicle;
  label: string;
  routeId: string | null;
  busId: string;
  sim: boolean;
  onUpdate: (s: LiveState) => void;
}): Promise<Tracker> {
  const trip: Trip = {
    id: crypto.randomUUID(),
    vehicle: opts.vehicle,
    label: opts.vehicle === 'other' ? opts.label : '',
    routeId: opts.vehicle === 'bus' ? opts.routeId : null,
    busId: opts.busId,
    platform: navigator.platform || 'unknown',
    startedAt: Date.now(),
    endedAt: null,
    status: 'recording',
    sim: opts.sim,
    fixCount: 0,
    overCount: 0,
    discardedCount: 0,
    synced: false,
  };
  await putTrip(trip);

  const t0 = performance.now(); // one monotonic clock for all fixes
  const state: LiveState = { fix: null, segName: null, fixCount: 0, overCount: 0, discardedCount: 0, wakeLock: false, error: null };
  let lastKept: Fix | null = null;
  let wakeLock: WakeLockSentinel | null = null;
  let stopped = false;

  const emit = () => opts.onUpdate({ ...state });

  async function acquireWakeLock() {
    try {
      wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
      state.wakeLock = !!wakeLock;
    } catch {
      state.wakeLock = false;
    }
    emit();
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible' && !stopped) acquireWakeLock();
  };
  document.addEventListener('visibilitychange', onVisible);
  acquireWakeLock();

  function handlePosition(lat: number, lng: number, speedMps: number | null, heading: number | null, accuracy: number) {
    if (stopped) return;
    if (accuracy > MAX_ACCURACY_M) {
      state.discardedCount++;
      trip.discardedCount++;
      emit();
      return;
    }
    const t = Math.round(performance.now() - t0);
    // Fallback only: derive speed by position differencing when the GNSS layer gives none (PRD 7.1).
    let mps = speedMps;
    if (mps === null && lastKept) {
      const dt = (t - lastKept.t) / 1000;
      if (dt > 0) mps = (distance(point([lastKept.lng, lastKept.lat]), point([lng, lat]), { units: 'meters' }) / dt);
    }
    if (mps === null) mps = 0;
    const stationary = mps < SPEED_FLOOR_MPS;
    const speedKmh = stationary ? 0 : mps * 3.6;
    const match = limitAt(lng, lat);
    const limitKmh = match?.limitKmh ?? null;
    const over = !stationary && isOver(speedKmh, limitKmh);

    const fix: Fix = {
      tripId: trip.id,
      t,
      lat,
      lng,
      speedKmh: Math.round(speedKmh * 10) / 10,
      heading,
      accuracy,
      segId: match?.segId ?? null,
      limitKmh,
      over,
      stationary,
    };
    addFix(fix).catch(() => {});
    lastKept = fix;
    state.fix = fix;
    state.segName = match?.name ?? null;
    state.fixCount = ++trip.fixCount;
    if (over) state.overCount = ++trip.overCount;
    emit();
  }

  let watchId: number | null = null;
  let simTimer: ReturnType<typeof setInterval> | null = null;
  let bgWatcherId: string | null = null;
  // In the Capacitor APK, the injected bridge exposes the background-geolocation
  // plugin: an Android foreground service that keeps fixes coming with the
  // screen off or the app backgrounded — the pocket-logging upgrade (PRD Phase 3).
  const cap = (window as any).Capacitor;
  const bg = cap?.isNativePlatform?.() ? cap.registerPlugin('BackgroundGeolocation') : null;

  if (opts.sim) {
    const line = (opts.routeId && routeById(opts.routeId)?.line) || TAXI_SIM_LINE;
    simTimer = simulate(line, handlePosition);
  } else if (bg) {
    bg.addWatcher(
      {
        backgroundTitle: 'BusWatch — recording trip',
        backgroundMessage: 'Logging position. End the trip in the app.',
        requestPermissions: true,
        stale: false,
        distanceFilter: 0,
      },
      (loc: any, err: any) => {
        if (err) {
          state.error = err.message ?? String(err);
          emit();
          return;
        }
        if (loc) handlePosition(loc.latitude, loc.longitude, loc.speed ?? null, loc.bearing ?? null, loc.accuracy ?? 9999);
      }
    ).then((id: string) => {
      bgWatcherId = id;
      if (stopped) bg.removeWatcher({ id });
    });
  } else {
    watchId = navigator.geolocation.watchPosition(
      (p) =>
        handlePosition(p.coords.latitude, p.coords.longitude, p.coords.speed, p.coords.heading, p.coords.accuracy),
      (err) => {
        state.error = err.message;
        emit();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  }

  return {
    trip,
    stop: async () => {
      stopped = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (simTimer !== null) clearInterval(simTimer);
      if (bg && bgWatcherId) await bg.removeWatcher({ id: bgWatcherId }).catch(() => {});
      document.removeEventListener('visibilitychange', onVisible);
      wakeLock?.release().catch(() => {});
      const durMs = lastKept?.t ?? 0;
      if (durMs > TRIM_MIN_TRIP_MS) {
        await trimFixes(trip.id, TRIM_MS, durMs - TRIM_MS);
      }
      trip.endedAt = Date.now();
      trip.status = 'done';
      await putTrip(trip);
      return trip;
    },
  };
}

// Demo mode: replays the given line at 1 Hz. Periodically exceeds the local
// limit by ~10 km/h, and dwells at a stop every ~45 s.
function simulate(
  path: [number, number][],
  handle: (lat: number, lng: number, mps: number | null, heading: number | null, acc: number) => void
) {
  const line = lineString(path);
  const totalKm = length(line);
  let km = 0;
  let tick = 0;
  return setInterval(() => {
    tick++;
    const pos = along(line, Math.min(km, totalKm));
    const [lng, lat] = pos.geometry.coordinates;
    const limit = limitAt(lng, lat)?.limitKmh ?? 30;
    let kmh = tick % 60 < 20 ? limit + 10 : limit - 3; // speeding window every minute
    if (tick % 45 < 6) kmh = 0; // dwell at a stop every ~45 s
    const ahead = along(line, Math.min(km + 0.05, totalKm));
    const hdg = bearing(pos, ahead);
    handle(lat, lng, kmh / 3.6, hdg, 8);
    km += kmh / 3600; // km travelled in 1 s
    if (km >= totalKm) km = 0; // loop
  }, 1000);
}
