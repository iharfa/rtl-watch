# BusWatch — RTL Speed Audit

Crowdsourced speed audit of Greater Malé public transport. Riders record trips
on their own phones; recorded speed is compared against per-road speed limits;
aggregates across many trips build the evidence base. Built from
`RTL-Speed-Audit-PRD.md` (Phase 1 PWA + cloud sync).

## Run

```bash
npm install
npm run dev        # http://localhost:3008
npm run build      # static export (never run while `next dev` is running — shared .next)
```

Try it without a bus: tick **Demo mode** on the home screen — it replays a
route with simulated GPS, speeding periodically.

## What it does

- **RTL Bus** — tag one of the 11 RTL Greater Malé routes (Routes 1–5, 8–12, Vilimalé), optional fleet number.
- **Taxi / Other (motorbike, joy ride…)** — no route tag; the trip logs wherever the vehicle goes.
- Logs GNSS at 1 Hz (fixes worse than 20 m accuracy dropped, < 2.5 m/s treated as stationary).
- Every fix is judged against the limit for the road it's on: nearest corridor
  segment within 50 m, else the island zone (Malé 30, Hulhumalé 30, Vilimalé 25).
  Over-limit = speed > limit + 5 km/h margin.
- Offline-first: fixes buffer in IndexedDB; trips upload when online (if sync is configured).
- Privacy: pseudonymous contributor id, first/last 60 s of every trip deleted,
  per-trip delete, write-only cloud key.

## ⚠ Limit dataset is placeholder

Geometry and limits in `lib/route.ts` are approximate. Only the Sinamalé
Bridge 50 km/h is publicly reported; everything else awaits the field survey
(PRD 7.3). Do not publish findings from this dataset.

## Cloud sync setup (Supabase)

1. Create a free project at supabase.com.
2. Paste `db/schema.sql` into the SQL editor and run it.
3. Copy `.env.local.example` to `.env.local`, fill in the project URL and anon key.
4. Rebuild. Trips page shows sync status; finished trips upload automatically.

The anon key can only INSERT (RLS). Trend views for analysts:
`segment_rates` (per-segment speeding rate) and `hourly_rates` (by hour of day),
both excluding demo trips — query them with the service role.

## Roadmap (PRD)

Phase 2: map-matching validation, analyst dashboard. Phase 3: Capacitor wrapper
for background logging. Phase 4: remaining routes, taxi attribution.
