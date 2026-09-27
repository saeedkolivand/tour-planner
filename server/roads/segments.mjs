// Which road segments (pairs of OSM nodes) lie at a point. Used to turn closures/roadworks into speed updates.
// Not /nearest: in OSRM 26 its `nodes` is often [X, X] (one node twice) whenever the closest point is a
// segment's end node, so main roads near junctions never came back as real segments. Routes are reliable:
// a route's annotation.nodes are real consecutive OSM nodes, 1:1 with its geometry points. So we route
// across the point along four axes, both ways, and keep the traversed segments that pass close to it.

// The plain graph (wsl/osrm.sh: map-plain on :5051), never re-weighted: on the routing graph, routes avoid
// slowed streets and can't cross closed ones, so re-snapping an existing closure would lose it.
const OSRM = process.env.OSRM_PLAIN_URL || 'http://localhost:5051';
const M_PER_DEG = 111_320;

/** Metres from p to the segment a–b (equirectangular: exact enough at street scale). */
export function distToSegment(p, a, b) {
  const kx = M_PER_DEG * Math.cos(p.lat * Math.PI / 180), ky = M_PER_DEG;
  const [ax, ay, bx, by] = [(a.lon - p.lon) * kx, (a.lat - p.lat) * ky, (b.lon - p.lon) * kx, (b.lat - p.lat) * ky];
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** Start/end pairs `reach` metres either side of p, along N–S, E–W and both diagonals. */
function crossings(p, reach) {
  const kx = M_PER_DEG * Math.cos(p.lat * Math.PI / 180);
  return [0, 45, 90, 135].flatMap(deg => {
    const t = deg * Math.PI / 180, dLat = reach * Math.cos(t) / M_PER_DEG, dLon = reach * Math.sin(t) / kx;
    const a = { lat: p.lat + dLat, lon: p.lon + dLon }, b = { lat: p.lat - dLat, lon: p.lon - dLon };
    return [[a, b], [b, a]]; // both ways: one-way streets and dual carriageways
  });
}

async function route(a, b) {
  const url = `${OSRM}/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson&annotations=nodes`;
  const r = await (await fetch(url)).json();
  if (r.code !== 'Ok') return null;
  return { nodes: r.routes[0].legs[0].annotation.nodes, coords: r.routes[0].geometry.coordinates };
}

/** Compass bearing (0 = north, clockwise) from a to b, both [lon, lat]. */
export function bearing([x1, y1], [x2, y2]) {
  const kx = Math.cos(y1 * Math.PI / 180);
  return (Math.atan2((x2 - x1) * kx, y2 - y1) * 180 / Math.PI + 360) % 360;
}
const angleDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

/**
 * "from,to" node pairs of every road segment within radiusM of p: both directions, or with `p.heading`
 * (a one-way report: "no entry this way") only the direction within 60° of that heading.
 */
export async function segmentsAt(p, radiusM, routeFn = route) {
  const pairs = new Set();
  const oneWay = Number.isFinite(p.heading);
  for (const [a, b] of crossings(p, Math.max(60, radiusM * 3))) {
    const r = await routeFn(a, b);
    if (!r || r.nodes.length !== r.coords.length) continue; // pairing needs them 1:1
    for (let i = 0; i < r.nodes.length - 1; i++) {
      const [x1, y1] = r.coords[i], [x2, y2] = r.coords[i + 1];
      if (distToSegment(p, { lon: x1, lat: y1 }, { lon: x2, lat: y2 }) > radiusM) continue;
      const along = bearing(r.coords[i], r.coords[i + 1]);
      if (!oneWay || angleDiff(along, p.heading) <= 60) pairs.add(`${r.nodes[i]},${r.nodes[i + 1]}`);
      if (!oneWay || angleDiff(along + 180, p.heading) <= 60) pairs.add(`${r.nodes[i + 1]},${r.nodes[i]}`);
    }
  }
  return [...pairs];
}
