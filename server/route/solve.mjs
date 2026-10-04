// Stop order: VROOM over a travel-time table from the self-hosted OSRM road graph.
// Objective = the driver's total time; the only constraint is Express: on time when asked to (ADR 0005).
import { log } from '../log.mjs';
import { CLUSTER_RADIUS_M, chain, cluster } from './cluster.mjs';
import { improve } from './improve.mjs';
import { insertLate, timeline } from './lateness.mjs';
import { FIRST_PENALTY, REVISIT_SEC, descents, revisits, streetMates } from './order.mjs';

const OSRM = process.env.OSRM_URL || 'http://localhost:5050';
const VROOM = process.env.VROOM_URL || 'http://localhost:3001';
export const SPEED_FACTOR = Number(process.env.SPEED_FACTOR || 1.3); // ponytail: free-flow OSRM times x factor, no traffic model
const BEARING_RANGE = 90; // degrees either side of the van's course that still count as the way it is going
const IMPROVE_MS = Number(process.env.IMPROVE_MS || 1500); // local search after VROOM; it converges well before this on 60 stops
const L = log('solve');

const ll = p => [p.lon, p.lat];

/** "12:00" -> seconds after departure (null when no deadline, or it's already past: can't be kept). */
export function dueSec(express, departAt) {
  const s = secondsAfter(express, departAt);
  return s != null && s > 0 ? s : null;
}
function secondsAfter(hhmm, departAt) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  if (!m) return null;
  const t = new Date(departAt);
  t.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return Math.round((t - departAt) / 1000);
}

/**
 * When a parking stop may be reached, as [earliest, latest] seconds after departure, or null (any time):
 * a Paketshop's opening hours ("09:00-20:00") narrowed by any Express deadline, aimed `marginSec` early (but
 * never before departure while the deadline itself is still ahead). A shop that has already closed for the day,
 * or hours that can't overlap the deadline, give no window (planned anyway, flagged).
 */
export function arrivalWindow(stops, departAt, expressOnTime = true, marginSec = 0) {
  let lo = 0, hi = Infinity;
  for (const s of stops) {
    const [open, close] = String(s.opens ?? '').split('-').map(t => secondsAfter(t, departAt));
    if (open != null && close != null && close > 0) { lo = Math.max(lo, open); hi = Math.min(hi, close); }
    const d = expressOnTime ? dueSec(s.express, departAt) : null;
    if (d != null) hi = Math.min(hi, Math.max(1, d - marginSec));
  }
  return Number.isFinite(hi) && hi > lo ? [lo, hi] : null;
}

/**
 * The VROOM problem on our own matrix (so VROOM's times are the ETAs the app shows, city factor included).
 * Point 0 = start, 1..n = parking stops, n+1 = end (optional). `win[i]` = [earliest, latest] arrival, or null.
 */
export function vroomJob(clusters, matrix, hasEnd, win = []) {
  // VROOM wants whole numbers everywhere; no road between two points = "very far" (they're never consecutive)
  const whole = rows => rows?.map(row => row.map(v => (v == null ? 1e7 : Math.round(v))));
  matrix = { durations: whole(matrix.durations), distances: whole(matrix.distances) };
  return {
    vehicles: [{ id: 1, profile: 'car', start_index: 0, ...(hasEnd && { end_index: clusters.length + 1 }) }],
    jobs: clusters.map((c, i) => ({ id: i, location_index: i + 1, service: Math.round(c.service), ...(win[i] && { time_windows: [win[i]] }) })),
    matrices: { car: matrix },
  };
}

// OSRM restarts for ~2 s whenever road data is applied: one retry covers a plan that lands in that gap
const retryOnce = async fn => { try { return await fn(); } catch (e) { L.warn('retrying after 3 s', { error: e }); await new Promise(r => setTimeout(r, 3000)); return fn(); } };

async function postJson(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${url} ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

/**
 * Road-direction options for a list of points (start, parking stops, optional end):
 * with `curb`, every parking stop is reached at the right-hand kerb (the van's side in Germany), so no stop is
 * planned across the road, at the price of driving a street twice when it has stops on both sides; without it
 * the van stops on its own side and the driver crosses on foot (ADR 0006). `heading` (the van's course when
 * re-planning on the move) makes the first leg start the way it is already going instead of "turn around first".
 */
export function osrmOptions(n, { hasEnd = false, heading, curb = true } = {}) {
  const approaches = Array.from({ length: n }, (_, i) => (!curb || i === 0 || (hasEnd && i === n - 1) ? 'unrestricted' : 'curb'));
  const bearings = Number.isFinite(heading) ? `&bearings=${Math.round(heading)},${BEARING_RANGE}${';'.repeat(n - 1)}` : '';
  return `&approaches=${approaches.join(';')}${bearings}`;
}

async function osrm(service, points, opts = {}) {
  const url = o => `${OSRM}/${service}/v1/driving/${points.map(p => ll(p).join(',')).join(';')}?${service === 'table' ? 'annotations=duration,distance' : 'overview=false'}${osrmOptions(points.length, o)}`;
  let r = await retryOnce(async () => (await fetch(url(opts))).json());
  // a course no road nearby runs in (GPS noise, a car park): plan as if standing still rather than fail
  if (r.code !== 'Ok' && opts.heading != null) {
    L.warn('course unusable, ignoring it', { code: r.code, heading: opts.heading });
    r = await (await fetch(url({ ...opts, heading: undefined }))).json();
  }
  if (r.code !== 'Ok') throw new Error(`osrm ${service}: ${r.code}`);
  return r;
}

/** Travel seconds (city factor applied) and metres between all points; null where no road connects them. */
async function table(points, opts) {
  const r = await osrm('table', points, opts);
  return { durations: r.durations.map(row => row.map(d => (d == null ? null : Math.round(d * SPEED_FACTOR)))), distances: r.distances };
}

/** Driving distance/time of a fixed order (the scanner's), for the "you save" line. */
export async function routeOf(points, opts) {
  if (points.length < 2) return { km: 0, min: 0 };
  const r = await osrm('route', points, opts);
  return { km: r.routes[0].distance / 1000, min: r.routes[0].duration * SPEED_FACTOR / 60 };
}

/**
 * Geocoded stops -> clusters in driving order, each with an ETA in minutes after departure.
 * `expressOnTime`: Express stops must be reached by their deadline; those no order can make are planned the
 * fastest way and reported in `late`. `keepOrder`: the stops' own (the scanner's) order, nothing solved.
 */
export async function solve(stops, start, end, { walkM, ...opts } = {}) {
  const radius = walkM ?? CLUSTER_RADIUS_M;
  return solveClusters(opts.keepOrder ? chain(stops, radius) : cluster(stops, radius), start, end, opts);
}

/**
 * As `solve`, for parking stops already formed (the benchmark compares clusterings this way).
 * `bothSides`: the van may stop on either side (no kerb-side approach); `expressMarginMin`: Express deadlines
 * aimed that much early (lateness is still reported against the deadline); `expressFirst`: Express parking stops
 * before all others.
 */
export async function solveClusters(clusters, start, end, { departAt = Date.now(), expressOnTime = true, heading, bothSides = true, expressMarginMin = 0, expressFirst = false, keepOrder = false } = {}) {
  let m = await table([start, ...clusters.map(c => c.park), ...(end ? [end] : [])], { hasEnd: !!end, heading, curb: !bothSides });

  // A closure can cut a pocket of streets off completely: no road in or out. Those parking stops are left
  // out (the driver sees them under "not planned") instead of failing the whole tour.
  const cut = clusters.map((_, i) => m.durations[0][i + 1] == null || m.durations[i + 1][0] == null);
  const unreachable = clusters.filter((_, i) => cut[i]).flatMap(c => c.stops);
  if (unreachable.length) {
    L.warn('no road to parking stops today (closure?), left out', { stops: unreachable.map(s => s.key) });
    const keep = [0, ...cut.map((c, i) => (c ? -1 : i + 1)).filter(i => i > 0), ...(end ? [cut.length + 1] : [])];
    clusters = clusters.filter((_, i) => !cut[i]);
    m = { durations: keep.map(a => keep.map(b => m.durations[a][b])), distances: keep.map(a => keep.map(b => m.distances[a][b])) };
  }
  if (!clusters.length) throw Object.assign(new Error('no stop can be reached by road'), { status: 422 });

  const margin = Math.max(0, expressMarginMin) * 60;
  const win = clusters.map(c => arrivalWindow(c.stops, departAt, expressOnTime, margin));
  // Matrix indices: 0 = start, 1..n = parking stops, n+1 = end.
  const dur = m.durations.map(row => row.map(d => d ?? 1e7));
  const endIdx = end ? clusters.length + 1 : undefined;
  const service = [0, ...clusters.map(c => Math.round(c.service))], windows = [null, ...win];
  let order = clusters.map((_, i) => i + 1), missing = [], solverMs;
  if (!keepOrder) {
    const sol = await retryOnce(() => postJson(VROOM, vroomJob(clusters, m, !!end, win)));
    if (sol.code !== 0) throw new Error('vroom: ' + sol.error);
    solverMs = sol.summary?.computing_times?.solving;
    // VROOM's order keeps every deadline it can; the stops it couldn't fit go back in where they cost least
    // (lateness.mjs), instead of anywhere at all.
    order = sol.routes[0].steps.filter(st => st.type === 'job').map(st => st.id + 1);
    missing = (sol.unassigned ?? []).map(u => u.id + 1);
    if (missing.length) {
      L.warn('express deadlines that cannot be kept', { stops: missing.map(i => clusters[i - 1].stops.map(s => s.key)) });
      order = insertLate(order, missing, dur, service, windows, endIdx);
    }
    // VROOM symmetrises the matrix for one vehicle; kerb sides and one-ways make ours anything but (improve.mjs).
    // The local search also weighs the driver's preferences (order.mjs): a street driven once, Express first.
    const mates = [[], ...streetMates(clusters).map(ms => ms.map(j => j + 1)), []];
    const rank = expressFirst ? [0, ...clusters.map(c => (c.stops.some(s => s.express) ? 0 : 1)), 0] : null;
    if (rank) order = [...order.filter(i => rank[i] === 0), ...order.filter(i => rank[i] !== 0)];
    const cost = r => timeline(r, dur, service, windows, endIdx).cost + REVISIT_SEC * revisits(r, mates) + (rank ? FIRST_PENALTY * descents(r, rank) : 0);
    const before = cost(order);
    order = improve(order, cost, { budgetMs: IMPROVE_MS });
    const saved = before - cost(order);
    if (saved > 1) L.info('order improved after VROOM', { savedMin: +(saved / 60).toFixed(1), revisits: revisits(order, mates) });
  }
  const t = timeline(order, dur, service, windows, endIdx);
  const ordered = order.map((i, k) => ({ ...clusters[i - 1], eta: Math.round(t.arrive[k] / 60) }));
  // late = after the deadline itself, not after the margin
  const due = margin ? [null, ...clusters.map(c => arrivalWindow(c.stops, departAt, expressOnTime))] : windows;
  const late = order.filter((i, k) => due[i] && t.arrive[k] > due[i][1]);
  const path = [0, ...order, ...(endIdx != null ? [endIdx] : [])];
  const km = path.slice(1).reduce((sum, i, k) => sum + (m.distances[path[k]][i] ?? 0), 0) / 1000;
  const lastI = order.at(-1);
  const plan = {
    clusters: ordered, unreachable, late: late.flatMap(i => clusters[i - 1].stops.map(s => s.key)),
    km, min: Math.round((t.arrive.at(-1) + service[lastI] + (endIdx != null ? dur[lastI][endIdx] : 0)) / 60),
  };
  L.info('solved', { stops: clusters.reduce((n, c) => n + c.stops.length, 0), clusters: clusters.length, km: +plan.km.toFixed(1), min: plan.min, windows: win.filter(Boolean).length, missed: missing.length, late: late.length, solverMs, keepOrder, bothSides, expressFirst, expressMarginMin });
  return plan;
}
