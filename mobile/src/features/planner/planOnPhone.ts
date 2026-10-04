// "Plan my tour" without the PC: the same result shape as POST /optimize, computed on the phone.
import type { LatLon, Place, Plan, PlanRequest, Stop } from '../tour/types.ts';
import type { Matrix, MatrixOptions } from './matrix.ts';
import { label, type Located } from './locate.ts';
import { solveOrder } from './solve.ts';
import { untruncate } from './parseText.ts';
import { chain, cluster, dedupe, fold, meters, streetMates, umlautVariants } from './stops.ts';

export interface PhoneDeps {
  /** Address -> position, null when not found. exact:false when only the street (not the house number) was placed. */
  geocode(q: string): Promise<(LatLon & { exact?: boolean }) | null>;
  matrix(points: LatLon[], opts?: MatrixOptions): Promise<Matrix>;
  /** Messages shown to the driver: a translation key in, text out. */
  t(key: 'plan.startNotFound' | 'plan.noStopsPlaced'): string;
  /** Street names from earlier tours (the geocode history): completes names the scanner shortened with "…". */
  knownStreets?(): Promise<string[]>;
  /** The second geocoder (OpenStreetMap), for a stop the first could not place; `q` is its label (the cache key). */
  locate?(s: Stop, q: string): Promise<Located | null>;
  /** The detailed log: why each stop was or wasn't placed, and how the order came about. */
  log?(msg: string, data?: Record<string, unknown>): void;
}

/** What a long plan is doing: placing stop `done` of `total`, fetching road times, ordering. */
export type PlanProgress = (stage: 'places' | 'roadTimes' | 'ordering', done?: number, total?: number) => void;

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

export async function planOnPhone(req: PlanRequest, deps: PhoneDeps, progress: PlanProgress = () => {}): Promise<Plan & { stops: Stop[] }> {
  const note = deps.log ?? (() => {});
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
  for (const [i, s] of todo.entries()) {
    progress('places', i, todo.length);
    const inArea = async (g: (LatLon & { exact?: boolean }) | null, by: string) => {
      const c = g && await centre(s);
      const km = g && c ? Math.round(meters(g, c) / 100) / 10 : null;
      if (g && km != null && km > 3) note('placed too far from its postcode, ignored', { stop: label(s), by, km });
      return g && (km == null || km <= 3) ? g : null;
    };
    const kept = s.lat != null && s.lon != null ? { lat: s.lat, lon: s.lon } : null;
    let g = s.pinned ? kept : await inArea(await deps.geocode(label(s)).catch(() => null), 'phone');
    // a street read with the wrong umlaut is retried with the others; the stop takes the spelling that exists
    if (!g && !s.pinned) for (const street of umlautVariants(s.street)) {
      g = await inArea(await deps.geocode(label({ ...s, street })).catch(() => null), 'phone, umlaut swapped');
      if (g) { note('placed with an umlaut swapped', { stop: label(s), street }); s.street = street; break; }
    }
    // the phone's geocoder takes a street named after a town ("Neusser Str.") for the town, or lacks the house:
    // OpenStreetMap's, by the PC's rules (locate.ts); the stop takes the spelling it found if that differs
    if (!g && !s.pinned && deps.locate) for (const street of [s.street, ...umlautVariants(s.street)]) {
      const h = await deps.locate({ ...s, street }, label({ ...s, street })).catch(e => { note('second geocoder failed', { stop: label(s), error: (e as Error).message }); return null; });
      g = await inArea(h && { lat: h.lat, lon: h.lon, exact: h.exact }, 'openstreetmap');
      if (g) { if (fold(h!.street) !== fold(s.street)) s.street = h!.street; break; }
    }
    note(g ? 'stop placed' : 'stop not placed', { stop: label(s), ...(g && { lat: +g.lat.toFixed(6), lon: +g.lon.toFixed(6), exact: (g as { exact?: boolean }).exact ?? true }), pinned: !!s.pinned });
    if (!g) s.lat = s.lon = undefined;
    if (g) { Object.assign(s, g); placed.push(s as Stop & LatLon); } else ungeocoded.push(s);
  }
  if (!placed.length) throw new Error(deps.t('plan.noStopsPlaced'));

  // as scanned: the list's order stands, only next-door neighbours share a parking spot; nothing is solved
  const scanned = req.order === 'scanned';
  const groups = scanned ? chain(placed, req.walkM) : cluster(placed, req.walkM);
  const points = [start, ...groups.map(g => g.park), ...(end ? [end] : [])];
  progress('roadTimes');
  const m = await deps.matrix(points, { hasEnd: !!end, heading: req.heading, curb: req.bothSides === false });
  note('road times', { by: m.by, why: m.why, points: points.length, parkingStops: groups.length });
  const endIdx = end ? points.length - 1 : undefined;
  const margin = Math.max(0, req.expressMarginMin ?? 0) * 60;
  const due = req.expressOnTime === false ? [] : [null, ...groups.map(g => {
    // Express deadlines (aimed `margin` early) and a Paketshop's closing time; ponytail: opening time not modelled on the phone (the PC waits for it)
    const d = g.stops.flatMap(s => [early(dueSec(s.express, departAt), margin), dueSec(s.opens?.split('-')[1], departAt)]).filter((x): x is number => x != null);
    return d.length ? Math.min(...d) : null;
  })];
  const rank = req.expressFirst ? [0, ...groups.map(g => (g.stops.some(s => s.express) ? 0 : 1)), 0] : [];
  progress('ordering');
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
  note('order', { scanned, km: +km.toFixed(1), min: Math.round((t + served) / 60), late, parkingStops: clusters.map(c => `${c.eta}m ${c.stops.map(x => `#${x.no} ${x.street} ${x.number}`).join(' + ')}`) });
  return {
    clusters, km, late, min: Math.round((t + served) / 60),
    baseline: scanned ? null : { km: base.km, min: (base.s + served) / 60 },
    ungeocoded, start, end, startedAt: departAt, stops: all, lastNo: next, by: m.by === 'road' ? 'phone-road' : 'phone-estimate', ...(m.why && { note: m.why }),
    ...(scanned && { order: 'scanned' as const }),
  };
}
