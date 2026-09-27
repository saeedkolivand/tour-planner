// The "plan my tour" use case: stops in, ordered parking stops out, plus savings vs the scanner's order.
import { log } from '../log.mjs';
import { geocode, geocodeText } from './geocode.mjs';
import { routeOf, solve } from './solve.mjs';
import { readTour } from '../tour.mjs';
import { dedupe } from './stops.mjs';

const L = log('plan');

/** A start/end given as {lat, lon} or {q: address}. */
async function resolvePlace(p) {
  if (p?.lat != null) return p;
  if (!p?.q) return null;
  // a bare street means Cologne; an address with its own postcode or town (the depot is in Erftstadt) stands as is
  const g = await geocodeText(/\b\d{5}\b|,/.test(p.q) ? p.q : `${p.q}, Köln`);
  if (!g) L.warn('place not found', { q: p.q });
  return g;
}

const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
const isPlace = p => p == null || (Number.isFinite(p.lat) && Number.isFinite(p.lon)) || typeof p.q === 'string';
const str = v => (v == null ? '' : String(v)).slice(0, 200);

/** Trust boundary: whatever the phone or a photo produced, the solver only sees sane stops. */
export function clean(stops) {
  if (!Array.isArray(stops)) throw bad('stops must be a list');
  if (stops.length > 1000) throw bad('at most 1000 stops per tour');
  return stops.filter(x => x && typeof x === 'object').map(x => ({
    ...x, street: str(x.street), number: str(x.number), postcode: str(x.postcode), city: str(x.city),
    parcels: Math.min(99, Math.max(1, Math.round(Number(x.parcels)) || 1)),
  }));
}

export async function planTour({ start, end, stops, departAt, expressOnTime = true } = {}) {
  if (!start || !isPlace(start) || !isPlace(end)) throw bad('start (and end) must be {lat, lon} or {q}');
  const all = dedupe(clean(stops));
  const [s, e] = [await resolvePlace(start), await resolvePlace(end)];
  if (!s) throw bad('start location not found', 422);
  // a stop without street + number (e.g. added by hand, never filled in) would geocode to "Köln" itself
  const complete = x => !!(x.street?.trim() && String(x.number ?? '').trim());
  const incomplete = all.filter(x => !x.done && !complete(x));
  const todo = all.filter(x => !x.done && complete(x));
  const ungeocoded = [...incomplete, ...await geocode(todo)];
  if (incomplete.length) L.warn('incomplete stops skipped', { count: incomplete.length });
  const placed = todo.filter(x => x.lat != null);
  if (!placed.length) throw bad('no stops could be placed on the map', 422);

  // ETAs and Express deadlines count from departure: now, or later when planned at the depot before leaving
  const depart = Number.isFinite(departAt) && departAt > Date.now() ? departAt : Date.now();
  const { unreachable, ...plan } = await solve(placed, s, e, { departAt: depart, expressOnTime: expressOnTime !== false });
  ungeocoded.push(...unreachable.map(x => ({ ...x, unreachable: true })));
  // stop time is the same in any order, so the scanner's order pays it too (else "saved" compares drive vs drive+stops)
  const serviceMin = plan.clusters.reduce((t, c) => t + c.service, 0) / 60;
  const baseline = await routeOf([s, ...placed.filter(x => !unreachable.includes(x)), ...(e ? [e] : [])])
    .then(b => ({ km: b.km, min: b.min + serviceMin }))
    .catch(err => { L.warn('baseline failed', { error: err }); return null; });

  // Loading numbers are handed out once and never change on re-plan (they're written on parcels).
  // ...and never reused: a deleted stop's number may already be on a parcel
  let next = Math.max(0, readTour().lastNo ?? 0, ...all.map(x => x.no || 0));
  for (const c of plan.clusters) for (const x of c.stops) x.no ??= ++next;

  L.info('planned', {
    stops: all.length, todo: todo.length, ungeocoded: ungeocoded.length, km: +plan.km.toFixed(1), min: plan.min,
    baselineMin: baseline && Math.round(baseline.min), fromGps: start?.lat != null, endAtDepot: !!e,
  });
  return { ...plan, stops: all, baseline, ungeocoded, start: s, end: e, startedAt: depart };
}
