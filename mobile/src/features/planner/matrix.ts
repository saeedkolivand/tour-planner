// Travel times between points when the PC isn't there. Three sources, best first:
//  - a public OSRM (OpenStreetMap's own router, no key): one-ways, kerb-side arrival and the van's course, like the PC,
//  - OpenRouteService (free key, real road network; needs internet),
//  - straight line, fitted to OSRM (x1.3 city factor) over Cologne (always works, offline).
import type { LatLon } from '../tour/types.ts';
import { meters } from './stops.ts';

export interface Matrix { seconds: number[][]; meters: number[][]; by: 'road' | 'estimate'; /** why road times weren't used */ why?: string }
export interface MatrixOptions {
  /** the last point is a fixed end (the depot): reached from any side */ hasEnd?: boolean;
  /** the van's course in degrees while moving */ heading?: number;
  /** arrive with each stop on the right-hand kerb (default); false = from either direction, crossing on foot */ curb?: boolean;
}

// Fitted on OSRM x 1.3 (2026-09): roads run ~1.5x the straight line; every leg costs ~2.5 min (start, lights,
// parking), then ~22 km/h in town and ~40 km/h beyond 4 km (arterials, Autobahn to/from the depot).
// ponytail: one curve for all of Cologne; ORS road times replace it when a key works.
const DETOUR = 1.5;
export const estimateSec = (straight: number) =>
  straight < 1 ? 0 : 150 + 0.25 * Math.min(straight, 4000) + 0.09 * Math.max(0, straight - 4000);

export function estimateMatrix(points: LatLon[]): Matrix {
  const d = points.map(a => points.map(b => meters(a, b)));
  return { meters: d.map(row => row.map(m => m * DETOUR)), seconds: d.map(row => row.map(estimateSec)), by: 'estimate' };
}

// Public OSRM instances: FOSSGIS's (behind openstreetmap.org's directions) first, the OSRM demo second. Both cap a
// table at 100 points, plenty for one van's parking stops. Free-flow times, so the PC's x1.3 city factor applies.
const OSRM = ['https://routing.openstreetmap.de/routed-car', 'https://router.project-osrm.org'];
export const OSRM_MAX_POINTS = 100;
const CITY_FACTOR = 1.3, BEARING_RANGE = 90;

/** Same road-direction options as the PC (server/route/solve.mjs): kerb side at every stop (unless off), the course at the start. */
export function osrmOptions(n: number, { hasEnd = false, heading, curb = true }: MatrixOptions = {}) {
  const approaches = Array.from({ length: n }, (_, i) => (!curb || i === 0 || (hasEnd && i === n - 1) ? 'unrestricted' : 'curb'));
  const bearings = Number.isFinite(heading) ? `&bearings=${Math.round(heading!)},${BEARING_RANGE}${';'.repeat(n - 1)}` : '';
  return `&approaches=${approaches.join(';')}${bearings}`;
}

/** Road travel times from a public OSRM. Throws when none answers (caller falls back). */
export async function osrmMatrix(points: LatLon[], opts: MatrixOptions = {}, fetchFn: typeof fetch = fetch): Promise<Matrix> {
  if (points.length > OSRM_MAX_POINTS) throw new Error(`more than ${OSRM_MAX_POINTS} points`);
  const coords = points.map(p => `${p.lon},${p.lat}`).join(';');
  const ask = async (host: string, o: MatrixOptions) => {
    const r = await fetchFn(`${host}/table/v1/driving/${coords}?annotations=duration,distance${osrmOptions(points.length, o)}`, { signal: AbortSignal.timeout?.(20_000) });
    if (!r.ok) throw new Error(`OSRM ${r.status}`);
    return (await r.json()) as { code: string; durations?: (number | null)[][]; distances?: (number | null)[][] };
  };
  let last: Error | null = null;
  for (const host of OSRM) {
    try {
      let j = await ask(host, opts);
      // a course no nearby road runs in (GPS noise, a car park): plan as if standing still rather than fail
      if (j.code !== 'Ok' && opts.heading != null) j = await ask(host, { ...opts, heading: undefined });
      if (j.code !== 'Ok' || !j.durations || !j.distances) throw new Error('OSRM ' + j.code);
      // null = no road between two points (a pin in a pedestrian zone): the estimate fills that cell
      const seconds = j.durations.map((row, a) => row.map((d, b) => (d == null ? estimateSec(meters(points[a], points[b])) : Math.round(d * CITY_FACTOR))));
      const dist = j.distances.map((row, a) => row.map((d, b) => d ?? meters(points[a], points[b]) * DETOUR));
      return { seconds, meters: dist, by: 'road' };
    } catch (e) { last = e as Error; }
  }
  throw last ?? new Error('OSRM unavailable');
}

// ORS moved to api.heigit.org in April 2026 (new keys get 403 on the old host); the old one is the fallback
const ORS = ['https://api.heigit.org/openrouteservice/v2/matrix/driving-car', 'https://api.openrouteservice.org/v2/matrix/driving-car'];
const BLOCK = 59; // ORS free plan: at most 3,500 cells (59 x 59) per request

/** Road travel times from OpenRouteService, fetched in 59 x 59 blocks. Throws on any failure (caller falls back). */
export async function orsMatrix(points: LatLon[], key: string, fetchFn: typeof fetch = fetch): Promise<Matrix> {
  const n = points.length;
  const seconds = points.map(() => Array<number>(n).fill(0)), dist = points.map(() => Array<number>(n).fill(0));
  const locations = points.map(p => [p.lon, p.lat]);
  for (let si = 0; si < n; si += BLOCK) {
    for (let di = 0; di < n; di += BLOCK) {
      const sources = [...Array(Math.min(BLOCK, n - si)).keys()].map(i => i + si);
      const destinations = [...Array(Math.min(BLOCK, n - di)).keys()].map(i => i + di);
      const ids = [...new Set([...sources, ...destinations])];
      const body = JSON.stringify({ locations: ids.map(i => locations[i]), sources: sources.map(i => ids.indexOf(i)), destinations: destinations.map(i => ids.indexOf(i)), metrics: ['duration', 'distance'] });
      let r: Response | null = null;
      for (const url of ORS) {
        r = await fetchFn(url, { method: 'POST', headers: { authorization: key, 'content-type': 'application/json' }, body, signal: AbortSignal.timeout?.(20_000) });
        if (r.ok || (r.status !== 403 && r.status !== 404)) break;
      }
      if (!r!.ok) throw new Error(r!.status === 403 ? 'OpenRouteService rejected the key (403)' : r!.status === 429 ? 'OpenRouteService daily limit reached' : `OpenRouteService ${r!.status}`);
      const j = await r!.json() as { durations: (number | null)[][]; distances: (number | null)[][] };
      sources.forEach((s, a) => destinations.forEach((d, b) => {
        // null = unreachable on the road graph (e.g. a pin in a pedestrian zone): fall back to the estimate
        const straight = meters(points[s], points[d]);
        seconds[s][d] = j.durations[a][b] ?? estimateSec(straight);
        dist[s][d] = j.distances[a][b] ?? straight * DETOUR;
      }));
    }
  }
  return { seconds, meters: dist, by: 'road' };
}
