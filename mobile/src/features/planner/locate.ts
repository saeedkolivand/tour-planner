// One stop -> a position, by the PC's rules (server/route/geocode.mjs, `locate`), for the phone's second geocoder:
// OpenStreetMap's public Photon. The platform geocoders (Apple's, Google's) read a street named after a town
// ("Neusser Str.", "Wickrather Str.", "Weißenburgstr.") as that town and answer with it; the app rightly refuses
// that answer and the stop went unplanned. Photon answers with the street's own name and postcode, so each hit is
// checked to be that street, near that postcode, before it counts.
import type { LatLon, Stop } from '../tour/types.ts';
import { fold } from './stops.ts';

/** One geocoder answer: where, and what it says is there. `number`: the house number it found, if any. */
export interface Hit extends LatLon { street: string; postcode: string; number?: string }
export type Find = (q: string) => Promise<Hit | null>;
export type Located = LatLon & { exact: boolean; street: string };

export const label = (s: Pick<Stop, 'street' | 'number' | 'postcode' | 'city'>) =>
  `${s.street} ${s.number}, ${s.postcode ?? ''} ${s.city || 'Köln'}`.replace(/\s+/g, ' ').trim();

/**
 * Two spellings of one street: equal once folded, one the start of the other ("Aquinost." for Aquinostraße), or a
 * single character off in a long name. Same as the PC's `alike` (server/route/stops.mjs).
 */
export function alike(a: string, b: string) {
  const x = fold(a), y = fold(b);
  if (x === y) return true;
  if (x.length >= 6 && y.length >= 6 && (x.startsWith(y) || y.startsWith(x))) return true;
  return x.length >= 12 && y.length >= 12 && x.slice(0, 3) === y.slice(0, 3) && editDistance(x, y) <= 1;
}
function editDistance(a: string, b: string) {
  let prev = [...Array(b.length + 1).keys()];
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** House numbers OSM may have instead: "12a" / "3-5" -> 12 / 3, then the same side (±2, ±4), then across (±1, ±3). */
export function nearbyNumbers(number: string): string[] {
  const n = parseInt(number, 10);
  if (!(n > 0)) return [];
  return [...new Set([String(n) === String(number).trim() ? null : n, n - 2, n + 2, n - 4, n + 4, n - 1, n + 1, n - 3, n + 3])]
    .filter((x): x is number => x != null && x > 0).map(String);
}

/** "1A" and "1 a" are one number; "12" is not "120". */
const sameNumber = (a?: string, b?: string) => !!a && !!b && a.toLowerCase().replace(/\s/g, '') === b.toLowerCase().replace(/\s/g, '');
const km = (a: LatLon, b: LatLon) => Math.hypot((a.lat - b.lat) * 111, (a.lon - b.lon) * 70);

/**
 * The PC's rules: the full address, accepted only on the same street near the postcode (a bare "Neusser Str. 30"
 * exists in other towns); else without the postcode (misread, or wrong on the list); else the street itself
 * (street-only). A street-level answer then tries the neighbouring house numbers, metres off instead of the street's
 * middle. `note` explains each decision, for the detailed log.
 */
export async function locate(s: Stop, find: Find, note: (msg: string, data?: Record<string, unknown>) => void = () => {}): Promise<Located | null> {
  const pc = String(s.postcode ?? '').replace(/\D/g, '');
  const centre = /^\d{5}$/.test(pc) ? await find(`${pc} ${s.city || 'Köln'}`).catch(() => null) : null;
  const near = (h: Hit) => !pc || h.postcode === pc || !centre || km(h, centre) < 3;
  const onStreet = (h: Hit) => alike(h.street, s.street) && near(h);
  const exact = (h: Hit, number: string) => sameNumber(h.number, number);
  const out = (h: Hit, isExact: boolean): Located => ({ lat: h.lat, lon: h.lon, exact: isExact, street: h.street || s.street });

  const first = await find(label(s));
  if (first && !onStreet(first)) note('photon: another place, ignored', { found: `${first.street} ${first.number ?? ''}, ${first.postcode}` });
  let g = first && onStreet(first) ? out(first, exact(first, s.number)) : null;
  if (!g && pc) {
    const h = await find(label({ ...s, postcode: '' }));
    if (h && onStreet(h)) { note('photon: found without the postcode', { real: h.postcode }); g = out(h, exact(h, s.number)); }
  }
  if (!g) {
    const h = await find(`${s.street}, ${s.city || 'Köln'}`);
    if (h && onStreet(h)) { note('photon: street only'); g = out(h, false); }
  }
  if (!g || g.exact) return g;
  for (const n of nearbyNumbers(s.number)) {
    const h = await find(label({ ...s, number: n }));
    if (h && onStreet(h) && exact(h, n) && (!pc || h.postcode === pc || km(h, g) < 1)) {
      note('photon: placed by a neighbouring number', { used: n });
      return out(h, true);
    }
  }
  return g;
}
