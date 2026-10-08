// Stop identity and park-and-walk grouping, the same rules as the PC (server/route/stops.mjs, cluster.mjs),
// so a tour planned on the phone and one planned on the PC key and group stops alike.
import type { Cluster, LatLon, Stop } from '../tour/types.ts';

/** "Hohe Straße" and "hohe str." compare equal; NFC first, or a decomposed "ü" slips past. */
export const fold = (s: string) => String(s ?? '').normalize('NFC').toLowerCase()
  .replace(/ß/g, 'ss').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
  .replace(/strasse\b|str\b\.?/g, 'str').replace(/[^a-z0-9]/g, '');

/** OCR drops umlauts ("Lubecker Str." for Lübecker): for comparing only, "ue" and "u" are one letter. Keys keep `fold`. */
export const bare = (s: string) => fold(s).replace(/([aou])e/g, '$1');

const address = (s: Stop) => `${fold(s.street)}|${String(s.number).toLowerCase().replace(/\s/g, '')}`;
const loose = (s: Stop) => `${bare(s.street)}|${String(s.number).toLowerCase().replace(/\s/g, '')}`;
const plz = (s: Stop) => String(s.postcode ?? '').replace(/\D/g, '');
export const stopKey = (s: Stop) => address(s) + (plz(s) ? `|${plz(s)}` : '');

/** OCR and vision models swap umlauts now and then ("Kämpchenshof" for Kümpchenshof): the same name with each umlaut swapped. */
export function umlautVariants(street: string): string[] {
  const out: string[] = [];
  for (const [i, ch] of [...street].entries()) {
    if (!'äöü'.includes(ch.toLowerCase())) continue;
    for (const alt of 'äöü'.replace(ch.toLowerCase(), '')) out.push(street.slice(0, i) + (ch === ch.toUpperCase() ? alt.toUpperCase() : alt) + street.slice(i + 1));
  }
  return out;
}

/** Overlapping photos show a row twice: keep the first, never sum parcels; two postcodes stay two stops. */
export function dedupe(stops: Stop[]): Stop[] {
  const out: Stop[] = [];
  for (const s of stops) {
    const had = out.find(o => loose(o) === loose(s) &&(!plz(o) || !plz(s) || plz(o) === plz(s)));
    if (!had) { out.push({ ...s, key: s.key ?? stopKey(s) }); continue; }
    Object.assign(had, {
      parcels: Math.max(had.parcels || 1, s.parcels || 1), postcode: had.postcode || s.postcode, area: had.area || s.area,
      express: had.express || s.express, name: had.name || s.name,
      parcelIds: [...new Set([...(had.parcelIds ?? []), ...(s.parcelIds ?? [])])],
    });
  }
  return out;
}

export function meters(a: LatLon, b: LatLon) {
  const R = 6371e3, r = (x: number) => x * Math.PI / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const SERVICE_MIN = { private: 2, business: 4, pickup: 5, shop: 10 } as const;
const WALK_MPS = 1.3, RADIUS_M = 80;
/** Seconds at a stop: by type, plus 30 s per extra parcel. */
export const serviceSec = (s: Stop) => (SERVICE_MIN[s.type] ?? 2) * 60 + 30 * Math.max(0, (s.parcels || 1) - 1);

const walkSum = (p: LatLon, stops: LatLon[]) => stops.reduce((t, s) => t + meters(p, s), 0);
const at = (p: LatLon): LatLon => ({ lat: p.lat, lon: p.lon });
/** The parking spot for a group: the most central stop (the PC snaps it onto the street; the phone has no road graph). */
const medoid = (stops: (Stop & LatLon)[]): LatLon => at(stops.reduce((b, p) => (walkSum(p, stops) < walkSum(b, stops) ? p : b)));

/** The walk from the parking spot past every door and back: nearest first, then 2-opt. Doors in walking order + metres. */
export function walkLoop<T extends LatLon>(park: LatLon, doors: T[]): { order: T[]; meters: number } {
  const pts = [park, ...doors], d = pts.map(a => pts.map(b => meters(a, b)));
  const len = (o: number[]) => o.reduce((t, i, k) => t + d[k ? o[k - 1] : 0][i], 0) + (o.length ? d[o[o.length - 1]][0] : 0);
  let order: number[] = [], at = 0;
  const left = new Set(doors.map((_, i) => i + 1));
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
 * Stops within `radius` m (80 by default) of a parking spot share it: each joins the nearest spot in range, else opens
 * one; the spot is the group's most central stop and the stops come back in walking order, that walk in the service time.
 * Street-only stops (house number unknown) park alone: they all sit at the street's middle (see the PC's cluster.mjs).
 */
export function cluster(stops: (Stop & LatLon)[], radius = RADIUS_M): Omit<Cluster, 'eta'>[] {
  const out: { park: LatLon; stops: (Stop & LatLon)[]; walkable: boolean }[] = [];
  for (const s of stops) {
    let best: (typeof out)[number] | null = null, bd = Infinity;
    if (s.exact !== false) for (const c of out) { const dd = c.walkable ? meters(c.park, s) : Infinity; if (dd <= radius && dd < bd) { best = c; bd = dd; } }
    if (best) { best.stops.push(s); best.park = medoid(best.stops); } else out.push({ park: at(s), stops: [s], walkable: s.exact !== false });
  }
  return out.map(({ walkable: _, ...c }) => {
    const walk = walkLoop(c.park, c.stops);
    return { ...c, stops: walk.order, service: c.stops.reduce((t, s) => t + serviceSec(s), 0) + walk.meters / WALK_MPS };
  });
}

/**
 * The scanner's order, as captured (the PC's chain() in cluster.mjs): nothing is moved. A stop within `radius` of
 * the parking spot before it (a next-door neighbour on the list) shares that spot, walked in list order.
 */
export function chain(stops: (Stop & LatLon)[], radius = RADIUS_M): Omit<Cluster, 'eta'>[] {
  const out: { park: LatLon; stops: (Stop & LatLon)[]; walkable: boolean }[] = [];
  for (const s of stops) {
    const last = out[out.length - 1];
    if (last?.walkable && s.exact !== false && meters(last.park, s) <= radius) last.stops.push(s);
    else out.push({ park: at(s), stops: [s], walkable: s.exact !== false });
  }
  return out.map(({ walkable: _, ...c }) => {
    const path = [c.park, ...c.stops, c.park];
    const walked = path.slice(1).reduce((t, p, i) => t + meters(path[i], p), 0);
    return { ...c, service: c.stops.reduce((t, s) => t + serviceSec(s), 0) + walked / WALK_MPS };
  });
}

/** Two parking spots on one street closer than this are one stretch of it: driving it twice is what drivers notice. */
const STRETCH_M = 300;

/**
 * For each parking spot, the others on the same stretch of the same street (the street the van parks on: its
 * stop nearest the spot). The solver charges for leaving a stretch and coming back to it later (solve.ts).
 */
export function streetMates(groups: Pick<Cluster, 'park' | 'stops'>[]): number[][] {
  const parkedAt = (g: Pick<Cluster, 'park' | 'stops'>) => {
    const d = (s: Stop) => (s.lat != null && s.lon != null ? meters({ lat: s.lat, lon: s.lon }, g.park) : Infinity);
    return g.stops.reduce((b, s) => (d(s) < d(b) ? s : b));
  };
  const street = groups.map(g => fold(parkedAt(g).street));
  return groups.map((a, i) => groups.flatMap((b, j) => (i !== j && street[i] && street[i] === street[j] && meters(a.park, b.park) <= STRETCH_M ? [j] : [])));
}
