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

/**
 * Stops within `radius` m of a cluster's parking spot (its first stop's road point, see snap.mjs) join it.
 * A cluster's service time includes walking there and back for every extra stop.
 * A stop placed on its street only (house number unknown) sits at the street's middle, like every other such
 * stop on that street: grouping them made "one parking stop" of 7 addresses up to 500 m apart. They park alone.
 */
// ponytail: greedy radius, swap for DBSCAN if clusters look odd
export function cluster(stops, radius = CLUSTER_RADIUS_M) {
  const out = [];
  for (const s of stops) {
    const c = s.exact !== false && out.find(c => c.walkable && meters(c.park, s) <= radius);
    if (c) c.stops.push(s); else out.push({ park: s.road ?? { lat: s.lat, lon: s.lon }, stops: [s], walkable: s.exact !== false });
  }
  for (const c of out) {
    delete c.walkable;
    c.service = c.stops.reduce((t, s, i) => t + serviceSec(s) + (i ? 2 * meters(c.park, s) / WALK_MPS : 0), 0);
  }
  return out;
}
