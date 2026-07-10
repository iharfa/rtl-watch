import { nearestPointOnLine, lineString, point, polygon, booleanPointInPolygon } from '@turf/turf';

// Speed-limit tolerance margin (PRD 7.4). Policy choice, kept visible.
export const TOLERANCE_KMH = 5;
// Fixes worse than this are discarded (PRD 7.1).
export const MAX_ACCURACY_M = 20;
// Below this, treat as stationary — GNSS jitter fabricates phantom movement at stops.
export const SPEED_FLOOR_MPS = 2.5;
// A fix further than this from every corridor falls back to the island zone limit.
export const OFF_CORRIDOR_M = 50;

export type Vehicle = 'bus' | 'taxi' | 'other';

export interface Segment {
  id: string;
  name: string;
  limitKmh: number;
  limitSource: string;
  limitVersion: number;
  coords: [number, number][]; // [lng, lat]
}

// ── Limit layer ──────────────────────────────────────────────────────────────
// Geometry is approximate and most limits are unsurveyed defaults (PRD 7.3:
// the authoritative dataset comes from a field survey — a deliverable in its
// own right). The bridge's 50 km/h is publicly reported; everything else is
// PLACEHOLDER. Replace before any published audit.
const SURVEY = 'placeholder — field survey pending';
const REPORTED = 'public reporting (50 km/h posted) — survey to confirm';

export const SEGMENTS: Segment[] = [
  // Malé ring — Boduthakurufaanu Magu
  { id: 'male-north', name: 'Malé · Boduthakurufaanu Magu (N)', limitKmh: 30, limitSource: SURVEY, limitVersion: 1,
    coords: [[73.504, 4.1758], [73.509, 4.1772], [73.516, 4.1778], [73.522, 4.1768]] },
  { id: 'male-east', name: 'Malé · Boduthakurufaanu Magu (E)', limitKmh: 30, limitSource: SURVEY, limitVersion: 1,
    coords: [[73.522, 4.1768], [73.5258, 4.1758], [73.5262, 4.174]] },
  { id: 'male-south', name: 'Malé · Boduthakurufaanu Magu (S)', limitKmh: 30, limitSource: SURVEY, limitVersion: 1,
    coords: [[73.504, 4.1758], [73.5022, 4.173], [73.503, 4.17], [73.508, 4.1678], [73.516, 4.167], [73.523, 4.169], [73.5258, 4.1715], [73.5262, 4.174]] },
  // Malé inner streets (minibus corridors)
  { id: 'orchid', name: 'Malé · Orchid Magu', limitKmh: 25, limitSource: SURVEY, limitVersion: 1,
    coords: [[73.506, 4.175], [73.513, 4.1755], [73.52, 4.176]] },
  { id: 'ameenee', name: 'Malé · Ameenee Magu', limitKmh: 25, limitSource: SURVEY, limitVersion: 1,
    coords: [[73.5055, 4.1706], [73.513, 4.171], [73.5225, 4.1718]] },
  { id: 'sosun', name: 'Malé · Sosun Magu', limitKmh: 25, limitSource: SURVEY, limitVersion: 1,
    coords: [[73.5192, 4.1768], [73.5194, 4.174], [73.5196, 4.1712]] },
  // Bridge + airport island
  { id: 'sinamale-bridge', name: 'Sinamalé Bridge', limitKmh: 50, limitSource: REPORTED, limitVersion: 1,
    coords: [[73.5262, 4.174], [73.5275, 4.1762], [73.529, 4.1785], [73.5298, 4.1802]] },
  { id: 'hulhule-link-s', name: 'Hulhulé Link Road (S)', limitKmh: 60, limitSource: SURVEY, limitVersion: 1,
    coords: [[73.5298, 4.1802], [73.5308, 4.186], [73.5322, 4.192]] },
  { id: 'hulhule-link-n', name: 'Hulhulé Link Road (N)', limitKmh: 60, limitSource: SURVEY, limitVersion: 1,
    coords: [[73.5322, 4.192], [73.5345, 4.1985], [73.5368, 4.2042]] },
  { id: 'airport-spur', name: 'VIA Terminal Road', limitKmh: 30, limitSource: SURVEY, limitVersion: 1,
    coords: [[73.5322, 4.192], [73.5292, 4.1915]] },
  // Hulhumalé
  { id: 'hmale-highway', name: 'Hulhumalé Highway', limitKmh: 50, limitSource: SURVEY, limitVersion: 1,
    coords: [[73.5368, 4.2042], [73.5388, 4.208], [73.5402, 4.2115], [73.541, 4.215], [73.5415, 4.2185]] },
  { id: 'hmale-p1', name: 'Hulhumalé Ph.1 · Internal', limitKmh: 30, limitSource: SURVEY, limitVersion: 1,
    coords: [[73.5402, 4.2115], [73.544, 4.2125], [73.545, 4.217], [73.543, 4.22], [73.5415, 4.2185]] },
  { id: 'hmale-p2-link', name: 'Hulhumalé Ph.2 Link', limitKmh: 50, limitSource: SURVEY, limitVersion: 1,
    coords: [[73.5415, 4.2185], [73.5405, 4.2225], [73.539, 4.226]] },
  { id: 'hmale-p2', name: 'Hulhumalé Ph.2 · Internal', limitKmh: 30, limitSource: SURVEY, limitVersion: 1,
    coords: [[73.539, 4.226], [73.54, 4.23], [73.538, 4.2335]] },
  // Vilimalé
  { id: 'vilimale', name: 'Vilimalé · Ring', limitKmh: 25, limitSource: SURVEY, limitVersion: 1,
    coords: [[73.4885, 4.1735], [73.4855, 4.172], [73.4865, 4.1695], [73.49, 4.1705], [73.4885, 4.1735]] },
];

// Island fallback zones — a taxi on any street off the mapped corridors still
// gets the island's general limit. Corridors always win over zones.
interface Zone { id: string; name: string; limitKmh: number; ring: [number, number][] }
const ZONES: Zone[] = [
  { id: 'zone-male', name: 'Malé · city streets', limitKmh: 30,
    ring: [[73.498, 4.1665], [73.531, 4.1665], [73.531, 4.1785], [73.498, 4.1785], [73.498, 4.1665]] },
  { id: 'zone-hulhule', name: 'Hulhulé · airport roads', limitKmh: 30,
    ring: [[73.526, 4.18], [73.543, 4.18], [73.543, 4.207], [73.526, 4.207], [73.526, 4.18]] },
  { id: 'zone-hulhumale', name: 'Hulhumalé · streets', limitKmh: 30,
    ring: [[73.532, 4.205], [73.55, 4.205], [73.55, 4.245], [73.532, 4.245], [73.532, 4.205]] },
  { id: 'zone-vilimale', name: 'Vilimalé · streets', limitKmh: 25,
    ring: [[73.483, 4.166], [73.493, 4.166], [73.493, 4.177], [73.483, 4.177], [73.483, 4.166]] },
];

const segLines = SEGMENTS.map((s) => lineString(s.coords));
const zonePolys = ZONES.map((z) => polygon([z.ring]));
const segById = new Map(SEGMENTS.map((s) => [s.id, s]));

export interface LimitMatch { segId: string | null; name: string; limitKmh: number }

// Corridor first (nearest line within 50 m), island zone as fallback, null off-network.
// ponytail: linear scans over ~15 lines + 4 polygons; spatial index when the survey scales this up.
export function limitAt(lng: number, lat: number): LimitMatch | null {
  const p = point([lng, lat]);
  let best: { seg: Segment; d: number } | null = null;
  for (let i = 0; i < SEGMENTS.length; i++) {
    const d = nearestPointOnLine(segLines[i], p, { units: 'meters' }).properties.dist ?? Infinity;
    if (!best || d < best.d) best = { seg: SEGMENTS[i], d };
  }
  if (best && best.d <= OFF_CORRIDOR_M) {
    return { segId: best.seg.id, name: best.seg.name, limitKmh: best.seg.limitKmh };
  }
  for (let i = 0; i < ZONES.length; i++) {
    if (booleanPointInPolygon(p, zonePolys[i])) {
      return { segId: ZONES[i].id, name: ZONES[i].name, limitKmh: ZONES[i].limitKmh };
    }
  }
  return null;
}

export function isOver(speedKmh: number, limitKmh: number | null): boolean {
  return limitKmh !== null && speedKmh > limitKmh + TOLERANCE_KMH;
}

// ── Route registry (RTL Greater Malé network) ───────────────────────────────
export interface Route { id: string; name: string; segIds: string[]; line: [number, number][] }

// Chain segments into one polyline, auto-orienting each hop by nearest endpoint.
function chain(segIds: string[]): [number, number][] {
  const d2 = (a: [number, number], b: [number, number]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  const line: [number, number][] = [];
  segIds.forEach((id, i) => {
    let coords = [...segById.get(id)!.coords];
    if (i === 0 && segIds.length > 1) {
      // orient the first segment so its end meets the second segment
      const next = segById.get(segIds[1])!.coords;
      const gapKeep = Math.min(d2(coords[coords.length - 1], next[0]), d2(coords[coords.length - 1], next[next.length - 1]));
      const gapRev = Math.min(d2(coords[0], next[0]), d2(coords[0], next[next.length - 1]));
      if (gapRev < gapKeep) coords.reverse();
    } else if (line.length) {
      const end = line[line.length - 1];
      if (d2(end, coords[coords.length - 1]) < d2(end, coords[0])) coords.reverse();
    }
    line.push(...coords);
  });
  return line;
}

function route(id: string, name: string, segIds: string[]): Route {
  return { id, name, segIds, line: chain(segIds) };
}

export const ROUTES: Route[] = [
  route('route-01', 'Route 1 · West Park ↔ Hulhumalé Ph.1', ['male-north', 'male-east', 'sinamale-bridge', 'hulhule-link-s', 'hulhule-link-n', 'hmale-highway']),
  route('route-02', 'Route 2 · Carnival ↔ Hulhumalé Ph.1', ['male-east', 'sinamale-bridge', 'hulhule-link-s', 'hulhule-link-n', 'hmale-highway']),
  route('route-03', 'Route 3 · West Park ↔ Airport', ['male-north', 'male-east', 'sinamale-bridge', 'hulhule-link-s', 'airport-spur']),
  route('route-04', 'Route 4 · Hulhumalé Ph.1 ↔ Airport', ['hmale-highway', 'hulhule-link-n', 'airport-spur']),
  route('route-05', 'Route 5 · Hulhumalé Internal', ['hmale-highway', 'hmale-p1']),
  route('route-08', 'Route 8 · Carnival ↔ Hulhumalé Ph.2', ['male-east', 'sinamale-bridge', 'hulhule-link-s', 'hulhule-link-n', 'hmale-highway', 'hmale-p2-link']),
  route('route-09', 'Route 9 · Hulhumalé Ph.2 ↔ Airport', ['hmale-p2-link', 'hmale-highway', 'hulhule-link-n', 'airport-spur']),
  route('route-10', 'Route 10 · Orchid (Malé minibus)', ['orchid']),
  route('route-11', 'Route 11 · Ameenee (Malé minibus)', ['ameenee']),
  route('route-12', 'Route 12 · Sosun (Malé minibus)', ['sosun']),
  route('route-vl', 'Vilimalé Internal', ['vilimale']),
];

export const routeById = (id: string) => ROUTES.find((r) => r.id === id);

// Taxi demo path: the Malé ring loop.
export const TAXI_SIM_LINE: [number, number][] = chain(['male-north', 'male-east', 'male-south']);
