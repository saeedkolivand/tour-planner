// The fixed route (CONTEXT.md): remembered customers with a place in the delivery order (`rank`) and the pin where the
// van stops. Each night's scanner rows are matched to them and delivered in that order; nothing is solved. A row on no
// route is new tonight: it's offered the slot that costs the least detour, and the driver decides.
import { editDistance } from '../planner/locate.ts';
import { bare, meters, samePlz } from '../planner/stops.ts';
import type { LatLon, Stop } from '../tour/types.ts';
import { type Customer, isVisitTo } from './match.ts';

export type Ranked = Customer & LatLon & { rank: number };
/** What the planner asks of the route (customers.ts keeps it on the phone). */
export interface RouteDeps {
  match(s: Stop): (LatLon & { id: string; rank: number }) | null;
  slot(p: LatLon): number;
  /** A matched stop teaches its customer the scanner's address, so later nights match by address. */
  learn(id: string, s: Stop): void;
}

// "Bergische Apo im Kaufland", "Fillmann 15 Optik", "Optik schulz nach Deutzer Apotheke": the words that name the place.
// PHOENIX cuts a long name off and runs its street into it ("Optik Lan Neuer Markt 3"): the row's street words go too.
const FILLER = /\b(apo(theke[n]?)?|appthek|opti[ck]?|optk|ag|gmbh|ohg|co|kg|ek|und|die|der|am|an|im|in|bei|neben|nach|tief|ge?rage|rechts|links|fahren|str)\b/g;
const split = (n?: string) => String(n ?? '').split(/[^\p{L}\d]+/u).map(bare).join(' ').replace(/\b\d+[a-z]?\b/g, ' ').replace(FILLER, ' ').replace(/\d+/g, ' ').split(/\s+/).filter(Boolean); // "1A": a house number
const words = (n?: string, street?: string) => { const st = new Set(split(street)); return split(String(n ?? '').split(' · ')[0]).filter(w => !st.has(w)); };
const close = (u: string, v: string) => editDistance(u, v) <= (Math.min(u.length, v.length) >= 7 ? 2 : 1);
// one is the other cut off ("Holterbos" / "Holterbosch", "Deutzerhof" / "Deutzer"), the shorter at least `min` letters
const cut = (u: string, v: string, min: number) => { const [a, b] = u.length < v.length ? [u, v] : [v, u]; return a.length >= min && a !== b && b.startsWith(a); };

/**
 * "Fielmann AG & Co. OHG" ~ "Fillmann 15 Optik", "Avie Apo am Blumentopf" ~ "Avia Apotheke", "Mc pill" ~ "McPill",
 * cut off: "Holterbos" ~ "Holterbosch Optik". `strong`: the same words, or one cut off after 6 letters or more.
 * `street`: the scanner row's.
 */
export function sameName(route?: string, scanned?: string, street?: string, strong = false) {
  const x = words(route), y = words(scanned, street), X = x.join(''), Y = y.join('');
  if (!X || !Y) return false;
  if (strong) return X === Y || cut(X, Y, 6);
  if (close(X, Y)) return true;
  return x.some(u => y.some(v => (u.length >= 4 && v.length >= 4 && close(u, v)) || cut(u, v, 3)));
}

// Real night (2026-10-31 scan vs the supervisor's pins): most within 25-85 m; one 250 m; a geocoder's wrong Bahnstraße
// (Haan has two) 3.9 km off a pin that was right; a second Montanus-Apotheke 9.8 km from the route's
const NAMED_M = 1000; // a geocoded scanner address vs a pin whose name matches
const STRONG_M = 5000; // ... whose name matches without guessing (a geocoder's wrong hit, the pin is right)
const SAME_M = 40; // that close it's the same door, whatever OCR made of the name

/** The route customer this stop is a visit to: by address once learned, else by name near its pin, else by its pin. */
export function routeMatch(all: Record<string, Customer>, s: Stop): [string, Ranked] | undefined {
  const plz = (p?: string) => String(p ?? '').replace(/\D/g, '');
  // a route stop whose postcode is known is never a row from another postcode (Montanus in Burscheid isn't Leichlingen's)
  const ranked = Object.entries(all).filter((e): e is [string, Ranked] => e[1].rank != null && e[1].lat != null && e[1].lon != null
    && samePlz(plz(e[1].postcode), plz(s.postcode)));
  const known = ranked.find(([, c]) => !!c.street && isVisitTo(c, s));
  if (known) return known;
  const named = ranked.filter(([, c]) => sameName(c.name, s.name, s.street));
  const strong = named.filter(([, c]) => sameName(c.name, s.name, s.street, true));
  // not placed: a sure name nobody else has, else a near one nobody else has ("Reusrather Apo" ~ "Rosrather Apotheke")
  if (s.lat == null || s.lon == null) return strong.length === 1 ? strong[0] : !strong.length && named.length === 1 ? named[0] : undefined;
  const at = { lat: s.lat, lon: s.lon }, d = ([, c]: [string, Ranked]) => meters(c, at);
  const nearest = (es: [string, Ranked][], m: number) => es.filter(e => d(e) <= m).sort((a, b) => d(a) - d(b))[0];
  return nearest(named, NAMED_M) ?? nearest(strong, STRONG_M) ?? nearest(ranked, SAME_M);
}

/** The rank between the two route stops where `p` adds the least detour (cheapest insertion); ends included. */
export function cheapestSlot(all: Record<string, Customer>, p: LatLon): number {
  const r = Object.values(all).filter((c): c is Ranked => c.rank != null && c.lat != null && c.lon != null).sort((a, b) => a.rank - b.rank);
  if (!r.length) return 0;
  let best = r[0].rank - 1, cost = meters(p, r[0]);
  r.forEach((c, i) => {
    const n = r[i + 1], extra = n ? meters(c, p) + meters(p, n) - meters(c, n) : meters(c, p);
    if (extra < cost) { cost = extra; best = n ? (c.rank + n.rank) / 2 : c.rank + 1; }
  });
  return best;
}

/**
 * Puts tonight's stops in route order: a stop on the route parks at its pin (the supervisor's spot beats a geocoder),
 * even one the geocoder couldn't place; one not on it is `fresh`, at its cheapest slot. A tie keeps the scanner's order.
 */
export function applyRoute(placed: (Stop & LatLon)[], ungeocoded: Stop[], route: RouteDeps) {
  const onRoute = (s: Stop) => {
    const m = route.match(s);
    if (m) { Object.assign(s, { lat: m.lat, lon: m.lon, rank: m.rank, fresh: undefined }); route.learn(m.id, s); }
    return !!m;
  };
  for (const s of placed) if (!onRoute(s)) Object.assign(s, { rank: route.slot(s), fresh: true });
  const lost: Stop[] = [];
  for (const s of ungeocoded) if (onRoute(s)) placed.push(s as Stop & LatLon); else lost.push(s);
  placed.sort((a, b) => a.rank! - b.rank!);
  return { placed, ungeocoded: lost };
}

/** The rank for order[i] from its neighbours on the route: where the driver actually took a new stop. */
export function rankBetween(order: Stop[], i: number) {
  const on = (s: Stop) => s.rank != null && !s.fresh;
  const before = order.slice(0, i).reverse().find(on)?.rank, after = order.slice(i + 1).find(on)?.rank;
  if (before != null && after != null) return (before + after) / 2;
  return before != null ? before + 0.5 : after != null ? after - 0.5 : order[i]?.rank ?? 0;
}
