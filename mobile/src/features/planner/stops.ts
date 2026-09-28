// Stop identity and park-and-walk grouping, the same rules as the PC (server/route/stops.mjs, cluster.mjs),
// so a tour planned on the phone and one planned on the PC key and group stops alike.
import type { Cluster, LatLon, Stop } from '../tour/types.ts';

/** "Hohe Straße" and "hohe str." compare equal; NFC first, or a decomposed "ü" slips past. */
export const fold = (s: string) => String(s ?? '').normalize('NFC').toLowerCase()
  .replace(/ß/g, 'ss').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
  .replace(/strasse\b|str\b\.?/g, 'str').replace(/[^a-z0-9]/g, '');

const address = (s: Stop) => `${fold(s.street)}|${String(s.number).toLowerCase().replace(/\s/g, '')}`;
const plz = (s: Stop) => String(s.postcode ?? '').replace(/\D/g, '');
export const stopKey = (s: Stop) => address(s) + (plz(s) ? `|${plz(s)}` : '');

/** Overlapping photos show a row twice: keep the first, never sum parcels; two postcodes stay two stops. */
export function dedupe(stops: Stop[]): Stop[] {
  const out: Stop[] = [];
  for (const s of stops) {
    const had = out.find(o => address(o) === address(s) && (!plz(o) || !plz(s) || plz(o) === plz(s)));
    if (!had) { out.push({ ...s, key: s.key ?? stopKey(s) }); continue; }
    Object.assign(had, {
      parcels: Math.max(had.parcels || 1, s.parcels || 1), postcode: had.postcode || s.postcode,
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

/**
 * Stops within `radius` m (80 by default) of a parking spot (its first stop) are walked to; service includes the walk there and back.
 * Street-only stops (house number unknown) park alone: they all sit at the street's middle (see the PC's cluster.mjs).
 */
export function cluster(stops: (Stop & LatLon)[], radius = RADIUS_M): Omit<Cluster, 'eta'>[] {
  const out: { park: LatLon; stops: (Stop & LatLon)[]; walkable: boolean }[] = [];
  for (const s of stops) {
    const c = s.exact !== false && out.find(c => c.walkable && meters(c.park, s) <= radius);
    if (c) c.stops.push(s); else out.push({ park: { lat: s.lat, lon: s.lon }, stops: [s], walkable: s.exact !== false });
  }
  return out.map(({ walkable: _, ...c }) => ({ ...c, service: c.stops.reduce((t, s, i) => t + serviceSec(s) + (i ? 2 * meters(c.park, s) / WALK_MPS : 0), 0) }));
}
