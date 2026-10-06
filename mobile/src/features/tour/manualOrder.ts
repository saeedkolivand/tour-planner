// The driver's own order, like the DPD scanner's: a parking stop moved by hand, and a re-plan that keeps that order
// (new parking stops fitted in where they cost least). Works on any plan, the PC's or the phone's: a leg whose two
// ends stay neighbours keeps the planner's time; a new leg is the straight-line estimate, scaled by how this plan's
// real legs compare with their estimates. Each stop remembers its place as `seq`.
import { estimateMatrix } from '../planner/matrix.ts';
import { lateKeys } from './selectors.ts';
import type { Cluster, LatLon, Plan, Stop } from './types.ts';

const est = (a: LatLon, b: LatLon) => { const m = estimateMatrix([a, b]); return { min: m.seconds[0][1] / 60, m: m.meters[0][1] }; };
const from = (plan: Plan, cs: Cluster[], k: number) => (k ? cs[k - 1].park : plan.start);
const sum = (cs: Cluster[], f: (c: Cluster, k: number) => number) => cs.reduce((t, c, k) => t + f(c, k), 0);

/** The plan with its parking stops in `order`: ETAs, km, minutes and late stops worked out again. */
export function retime(plan: Plan, order: Cluster[]): Plan {
  const old = plan.clusters;
  const real = new Map(old.map((c, k) => [c, { prev: k ? old[k - 1] : null, min: c.eta - (k ? old[k - 1].eta + old[k - 1].service / 60 : 0) }]));
  const estMin = sum(old, (c, k) => est(from(plan, old, k), c.park).min);
  const scale = estMin ? Math.min(3, Math.max(0.5, sum(old, c => real.get(c)!.min) / estMin)) : 1;
  let eta = 0;
  const clusters = order.map((c, k) => {
    const prev = k ? order[k - 1] : null, r = real.get(c);
    eta = (prev ? eta + prev.service / 60 : 0) + (r && r.prev === prev ? r.min : est(from(plan, order, k), c.park).min * scale);
    return { ...c, eta: Math.round(eta) };
  });
  const last = clusters.at(-1), oldLast = old.at(-1);
  const toEnd = !plan.end || !last || !oldLast ? 0 : last.stops[0].key === oldLast.stops[0].key ? plan.min - (oldLast.eta + oldLast.service / 60)
    : est(last.park, plan.end).min * scale;
  const estKm = (cs: Cluster[]) => sum(cs, (c, k) => est(from(plan, cs, k), c.park).m);
  const kmOld = estKm(old);
  return {
    ...plan, clusters, km: kmOld ? plan.km * estKm(clusters) / kmOld : plan.km,
    min: last ? Math.round(last.eta + last.service / 60 + toEnd) : 0,
    late: lateKeys(clusters, plan.startedAt, plan.expressOnTime !== false),
  };
}

/** Each stop's place in the driver's order: the index of its parking stop. */
export const seqOf = (plan: Plan) => new Map(plan.clusters.flatMap((c, k) => c.stops.flatMap(s => (s.key ? [[s.key, k] as const] : []))));

/** The tour's stops with their places in this plan written on them. */
export const withSeq = (stops: Stop[], plan: Plan) => {
  const seq = seqOf(plan);
  return stops.map(s => (s.key && seq.has(s.key) ? { ...s, seq: seq.get(s.key) } : s));
};

/** A parking stop moved by hand, from one place in the plan to another. */
export function moveCluster(plan: Plan, from: number, to: number): Plan {
  const order = [...plan.clusters];
  order.splice(to, 0, ...order.splice(from, 1));
  return retime(plan, order);
}

/**
 * After a re-plan: the parking stops holding a stop the driver had placed go back into the driver's order (by
 * their earliest stop); the others go where they add the least driving. null when nothing was placed by hand.
 */
export function keepOrder(plan: Plan, seq: Map<string, number>): Plan | null {
  const rank = (c: Cluster) => Math.min(...c.stops.map(s => seq.get(s.key ?? '') ?? Infinity));
  const order = plan.clusters.filter(c => rank(c) < Infinity).sort((a, b) => rank(a) - rank(b));
  if (!order.length) return null;
  for (const c of plan.clusters.filter(x => rank(x) === Infinity)) {
    const cost = (k: number) => {
      const a = k ? order[k - 1].park : plan.start, b = order[k]?.park;
      return est(a, c.park).min + (b ? est(c.park, b).min - est(a, b).min : 0);
    };
    const best = [...Array(order.length + 1).keys()].reduce((x, k) => (cost(k) < cost(x) ? k : x), 0);
    order.splice(best, 0, c);
  }
  return retime(plan, order);
}
