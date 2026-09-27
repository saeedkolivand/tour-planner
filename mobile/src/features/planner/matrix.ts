// Travel times between points when the PC isn't there. Two sources, best first:
//  - OpenRouteService (free key, real road network incl. one-ways; needs internet),
//  - straight line, fitted to OSRM (x1.3 city factor) over Cologne (always works, offline).
import type { LatLon } from '../tour/types.ts';
import { meters } from './stops.ts';

export interface Matrix { seconds: number[][]; meters: number[][]; by: 'road' | 'estimate'; /** why road times weren't used */ why?: string }

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
