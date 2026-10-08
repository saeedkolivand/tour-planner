// A second opinion on the stop order: OpenRouteService's hosted VROOM (the solver the PC runs), with the driver's own
// free key. Its road network, not ours, so the phone judges its answer with its own matrix and rules (routeCost) and
// keeps whichever order is cheaper. The hosted endpoint takes at most 50 locations: start, end and 48 parking stops.
import type { LatLon } from '../tour/types.ts';

export const VROOM_MAX_JOBS = 48;
// ORS moved to api.heigit.org in April 2026; the old host is the fallback (same as its matrix, matrix.ts)
const URLS = ['https://api.heigit.org/openrouteservice/optimization', 'https://api.openrouteservice.org/optimization'];
// the phone's road times are OSRM's x1.3 for town traffic (matrix.ts): the same slowdown for VROOM's deadlines
const CITY_FACTOR = 1.3;

export interface VroomInput {
  start: LatLon; end: LatLon | null;
  /** Parking stops, in matrix order (point i + 1): seconds spent there, latest arrival in seconds after the start. */
  stops: (LatLon & { service: number; due: number | null })[];
}

/** VROOM's order as point indices (1 = the first parking stop); null when it can't serve every stop in time. Throws on network or key errors. */
export async function vroomOrder({ start, end, stops }: VroomInput, key: string, fetchFn: typeof fetch = fetch): Promise<number[] | null> {
  if (stops.length > VROOM_MAX_JOBS) throw new Error(`more than ${VROOM_MAX_JOBS} parking stops`);
  const at = (p: LatLon) => [p.lon, p.lat];
  const body = JSON.stringify({
    jobs: stops.map((s, i) => ({ id: i + 1, location: at(s), service: Math.round(s.service), ...(s.due != null && { time_windows: [[0, Math.round(s.due)]] }) })),
    vehicles: [{ id: 1, profile: 'driving-car', start: at(start), ...(end && { end: at(end) }), speed_factor: 1 / CITY_FACTOR }],
  });
  let r: Response | null = null;
  for (const url of URLS) {
    r = await fetchFn(url, { method: 'POST', headers: { authorization: key, 'content-type': 'application/json' }, body, signal: AbortSignal.timeout?.(30_000) });
    if (r.ok || (r.status !== 403 && r.status !== 404)) break;
  }
  if (!r!.ok) throw new Error(r!.status === 403 ? 'OpenRouteService rejected the key (403)' : r!.status === 429 ? 'OpenRouteService daily limit reached' : `OpenRouteService optimization ${r!.status}`);
  const j = await r!.json() as { unassigned?: unknown[]; routes?: { steps: { type: string; id?: number; job?: number }[] }[] };
  // a stop it left out (a deadline it can't make) isn't an order for all of them: ours stands
  if (j.unassigned?.length || !j.routes?.[0]) return null;
  return j.routes[0].steps.filter(s => s.type === 'job').map(s => s.job ?? s.id!);
}
