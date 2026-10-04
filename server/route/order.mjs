// What makes an order good besides the clock (ADR 0006), as extra seconds on top of driving + lateness:
// - coming back to a stretch of street the route already left: drivers notice driving it twice;
// - with "Express first", an ordinary parking stop before an Express one.
// The phone's solver applies the same two terms (mobile/src/features/planner/solve.ts).
import { meters } from './cluster.mjs';
import { normStreet } from './stops.mjs';

/** A re-visit has to save more driving than this to be planned. */
export const REVISIT_SEC = Number(process.env.REVISIT_SEC || 90);
/** "Express first" broken: never worth it. */
export const FIRST_PENALTY = 1e7;
/** Two parking spots on one street closer than this are one stretch of it. */
const STRETCH_M = 300;

/** The stop a parking spot is for (its door nearest the spot): the street the van parks on. */
const parkedAt = c => c.stops.reduce((b, s) => (meters(s, c.park) < meters(b, c.park) ? s : b));

/** For each parking stop, the indices of the others on the same stretch of the same street. */
export function streetMates(clusters) {
  const street = clusters.map(c => normStreet(parkedAt(c).street));
  return clusters.map((a, i) => clusters.flatMap((b, j) => (i !== j && street[i] && street[i] === street[j] && meters(a.park, b.park) <= STRETCH_M ? [j] : [])));
}

/** How often `route` comes back to a stretch it left: a mate seen before, the previous point not a mate. */
export function revisits(route, mates) {
  let n = 0;
  const seen = new Set();
  route.forEach((p, k) => {
    const ms = mates[p];
    if (k > 0 && ms?.length && !ms.includes(route[k - 1]) && ms.some(x => seen.has(x))) n++;
    seen.add(p);
  });
  return n;
}

/** How often a point follows one of a higher rank (0 = all rank-0 points before all rank-1 points). */
export function descents(route, rank) {
  let n = 0;
  for (let k = 1; k < route.length; k++) if ((rank[route[k]] ?? 0) < (rank[route[k - 1]] ?? 0)) n++;
  return n;
}
