// Park-and-walk: stops close together share one parking spot.

export const SERVICE_MIN = { private: 2, business: 4, pickup: 5, shop: 10 };
const WALK_MPS = 1.3;
export const CLUSTER_RADIUS_M = Number(process.env.CLUSTER_RADIUS_M || 80);

export function meters(a, b) {
  const R = 6371e3, r = x => x * Math.PI / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Seconds spent at a stop: by type, plus 30 s per extra parcel. */
export const serviceSec = s => (SERVICE_MIN[s.type] ?? 2) * 60 + 30 * Math.max(0, (s.parcels || 1) - 1);

const road = s => s.road ?? { lat: s.lat, lon: s.lon }; // where the van stops for s (snap.mjs), else the door

/** The parking spot for a group: the road point of one of them with the least walking to all doors. */
const medoid = stops => stops.map(road).reduce((b, p) => (walkSum(p, stops) < walkSum(b, stops) ? p : b));
const walkSum = (p, stops) => stops.reduce((t, s) => t + meters(p, s), 0);

/**
 * The walk from the parking spot past every door and back: nearest door first, then 2-opt until no
 * uncrossing shortens it (a handful of doors: instant). Returns the doors in walking order and the metres.
 */
export function walkLoop(park, doors) {
  const pts = [park, ...doors], d = pts.map(a => pts.map(b => meters(a, b)));
  const len = o => o.reduce((t, i, k) => t + d[k ? o[k - 1] : 0][i], 0) + (o.length ? d[o.at(-1)][0] : 0);
  let order = [], left = new Set(doors.map((_, i) => i + 1)), at = 0;
  while (left.size) { let best = -1; for (const j of left) if (best < 0 || d[at][j] < d[at][best]) best = j; order.push(best); left.delete(best); at = best; }
  for (let best = len(order), improved = true; improved;) {
    improved = false;
    for (let i = 0; i < order.length - 1; i++) for (let k = i + 1; k < order.length; k++) {
      const cand = [...order.slice(0, i), ...order.slice(i, k + 1).reverse(), ...order.slice(k + 1)];
      const c = len(cand);
      if (c < best - 1e-9) { order = cand; best = c; improved = true; }
    }
  }
  return { order: order.map(i => doors[i - 1]), meters: len(order) };
}

/**
 * Stops within `radius` m of a parking spot share it: each stop joins the nearest spot in range, else opens
 * one; a spot is then the road point of the group's most central stop, and its stops come back in walking
 * order (park -> doors -> park), with that walk in the service time.
 * A stop placed on its street only (house number unknown) sits at the street's middle, like every other such
 * stop on that street: grouping them made "one parking stop" of 7 addresses up to 500 m apart. They park alone.
 */
// ponytail: greedy nearest-spot + medoid; a cost-based merge (parking time vs. extra walk) measured no better on real tours
export function cluster(stops, radius = CLUSTER_RADIUS_M) {
  const out = [];
  for (const s of stops) {
    let best = null, bd = Infinity;
    if (s.exact !== false) for (const c of out) { const dd = c.walkable ? meters(c.park, s) : Infinity; if (dd <= radius && dd < bd) { best = c; bd = dd; } }
    if (best) { best.stops.push(s); best.park = medoid(best.stops); } else out.push({ park: road(s), stops: [s], walkable: s.exact !== false });
  }
  return out.map(({ walkable: _, ...c }) => {
    const walk = walkLoop(c.park, c.stops);
    return { ...c, stops: walk.order, service: c.stops.reduce((t, s) => t + serviceSec(s), 0) + walk.meters / WALK_MPS };
  });
}
