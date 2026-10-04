// "Plan my tour" without the PC: the same result shape as POST /optimize, computed on the phone.
import type { LatLon, Place, Plan, PlanRequest, Stop } from '../tour/types.ts';
import type { Matrix, MatrixOptions } from './matrix.ts';
import { solveOrder } from './solve.ts';
import { untruncate } from './parseText.ts';
import { chain, cluster, dedupe, meters, streetMates, umlautVariants } from './stops.ts';

export interface PhoneDeps {
  /** Address -> position, null when not found. exact:false when only the street (not the house number) was placed. */
  geocode(q: string): Promise<(LatLon & { exact?: boolean }) | null>;
  matrix(points: LatLon[], opts?: MatrixOptions): Promise<Matrix>;
  /** Messages shown to the driver: a translation key in, text out. */
  t(key: 'plan.startNotFound' | 'plan.noStopsPlaced'): string;
  /** Street names from earlier tours (the geocode history): completes names the scanner shortened with "…". */
  knownStreets?(): Promise<string[]>;
}

const label = (s: Stop) => `${s.street} ${s.number}, ${s.postcode ?? ''} ${s.city || 'Köln'}`.replace(/\s+/g, ' ').trim();
const complete = (s: Stop) => !!(s.street?.trim() && String(s.number ?? '').trim());

/** "12:00" -> seconds after departure, null when none or already past. Same rule as the PC (server/route/solve.mjs). */
export function dueSec(express: string | undefined, departAt: number) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(express ?? '');
  if (!m) return null;
  const due = new Date(departAt);
  due.setHours(Number(m[1]), Number(m[2]), 0, 0);
  const s = Math.round((due.getTime() - departAt) / 1000);
  return s > 0 ? s : null;
}

/** A deadline `marginSec` earlier, but never in the past while the deadline itself is still ahead (then: as soon as possible). */
const early = (due: number | null, marginSec: number) => (due == null ? null : Math.max(1, due - marginSec));

export async function planOnPhone(req: PlanRequest, deps: PhoneDeps): Promise<Plan & { stops: Stop[] }> {
  const departAt = req.departAt && req.departAt > Date.now() ? req.departAt : Date.now();
  const place = async (p: Place | null) => (!p ? null : 'lat' in p ? p : deps.geocode(/\b\d{5}\b|,/.test(p.q) ? p.q : `${p.q}, Köln`));
  const start = await place(req.start);
  if (!start) throw new Error(deps.t('plan.startNotFound'));
  const end = await place(req.end);

  const all = untruncate(dedupe(req.stops), (await deps.knownStreets?.().catch(() => [])) ?? []);
  const todo = all.filter(s => !s.done && complete(s));
  const ungeocoded: Stop[] = all.filter(s => !s.done && !complete(s));
  const placed: (Stop & LatLon)[] = [];
  // Geocoders answer an address that doesn't exist in this postcode with the same street elsewhere (the PC found
  // an Agnesstraße 69 20 km away): a position must be within 3 km of its postcode's area to count, unless the
  // driver pinned it. A dragged pin is kept; everything else is looked up again (cached on the phone, so cheap)
  // because a stored position may be a wrong hit from before a geocoder fix.
  const centres = new Map<string, LatLon | null>();
  const centre = async (s: Stop) => {
    const pc = String(s.postcode ?? '').replace(/\D/g, '');
    if (!/^\d{5}$/.test(pc)) return null;
    if (!centres.has(pc)) centres.set(pc, await deps.geocode(`${pc} ${s.city || 'Köln'}`).catch(() => null));
    return centres.get(pc) ?? null;
  };
  for (const s of todo) {
    const inArea = async (g: LatLon | null) => { const c = g && await centre(s); return g && (!c || meters(g, c) <= 3000) ? g : null; };
    const kept = s.lat != null && s.lon != null ? { lat: s.lat, lon: s.lon } : null;
    let g = s.pinned ? kept : await inArea(await deps.geocode(label(s)).catch(() => null));
    // a street read with the wrong umlaut is retried with the others; the stop takes the spelling that exists
    if (!g && !s.pinned) for (const street of umlautVariants(s.street)) {
      g = await inArea(await deps.geocode(label({ ...s, street })).catch(() => null));
      if (g) { s.street = street; break; }
    }
    if (!g) s.lat = s.lon = undefined;
    if (g) { Object.assign(s, g); placed.push(s as Stop & LatLon); } else ungeocoded.push(s);
  }
  if (!placed.length) throw new Error(deps.t('plan.noStopsPlaced'));

  // as scanned: the list's order stands, only next-door neighbours share a parking spot; nothing is solved
  const scanned = req.order === 'scanned';
  const groups = scanned ? chain(placed, req.walkM) : cluster(placed, req.walkM);
  const points = [start, ...groups.map(g => g.park), ...(end ? [end] : [])];
  const m = await deps.matrix(points, { hasEnd: !!end, heading: req.heading, curb: req.bothSides === false });
  const endIdx = end ? points.length - 1 : undefined;
  const margin = Math.max(0, req.expressMarginMin ?? 0) * 60;
  const due = req.expressOnTime === false ? [] : [null, ...groups.map(g => {
    // Express deadlines (aimed `margin` early) and a Paketshop's closing time; ponytail: opening time not modelled on the phone (the PC waits for it)
    const d = g.stops.flatMap(s => [early(dueSec(s.express, departAt), margin), dueSec(s.opens?.split('-')[1], departAt)]).filter((x): x is number => x != null);
    return d.length ? Math.min(...d) : null;
  })];
  const rank = req.expressFirst ? [0, ...groups.map(g => (g.stops.some(s => s.express) ? 0 : 1)), 0] : [];
  const order = scanned ? groups.map((_, i) => i + 1)
    : solveOrder(m.seconds, endIdx, { service: [0, ...groups.map(g => g.service)], due, rank, mates: [[], ...streetMates(groups).map(ms => ms.map(j => j + 1)), []] });

  let t = 0, km = 0, at = 0, served = 0;
  const clusters = order.map(i => {
    const g = groups[i - 1];
    t += m.seconds[at][i]; km += m.meters[at][i] / 1000; at = i;
    const eta = Math.round((t + served) / 60);
    served += g.service;
    return { ...g, eta };
  });
  if (endIdx != null) { t += m.seconds[at][endIdx]; km += m.meters[at][endIdx] / 1000; }

  // the scanner's order (as captured), same matrix and same stop time: what "you save" compares against
  // (nothing to compare when the plan is that order)
  const firstSeen = [...new Set(placed.map(s => groups.findIndex(g => g.stops.includes(s)) + 1))];
  const path = [0, ...firstSeen, ...(endIdx != null ? [endIdx] : [])];
  const base = path.slice(1).reduce((a, p, i) => ({ s: a.s + m.seconds[path[i]][p], km: a.km + m.meters[path[i]][p] / 1000 }), { s: 0, km: 0 });

  // loading numbers: handed out once, never reused (they're written on the parcels)
  let next = Math.max(0, req.lastNo ?? 0, ...all.map(s => s.no ?? 0));
  for (const c of clusters) for (const s of c.stops) s.no ??= ++next;

  const late = req.expressOnTime === false ? [] : clusters.filter(c => c.stops.some(s => {
    return [dueSec(s.express, departAt), dueSec(s.opens?.split('-')[1], departAt)].some(d => d != null && c.eta * 60 > d);
  })).flatMap(c => c.stops.map(s => s.key!));
  return {
    clusters, km, late, min: Math.round((t + served) / 60),
    baseline: scanned ? null : { km: base.km, min: (base.s + served) / 60 },
    ungeocoded, start, end, startedAt: departAt, stops: all, lastNo: next, by: m.by === 'road' ? 'phone-road' : 'phone-estimate', ...(m.why && { note: m.why }),
    ...(scanned && { order: 'scanned' as const }),
  };
}
