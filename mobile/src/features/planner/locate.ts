// One stop -> a position, by the PC's rules (server/route/geocode.mjs, `locate`), for the phone's second geocoder:
// OpenStreetMap's public Photon. The platform geocoders (Apple's, Google's) read a street named after a town
// ("Neusser Str.", "Wickrather Str.", "Weißenburgstr.") as that town and answer with it; the app rightly refuses
// that answer and the stop went unplanned. Photon answers with the street's own name and postcode, so each hit is
// checked to be that street, near that postcode, before it counts.
import type { LatLon, Stop } from '../tour/types.ts';
import { bare } from './stops.ts';

/** One geocoder answer: where, and what it says is there. `number`: the house number it found, if any. */
export interface Hit extends LatLon { street: string; postcode: string; number?: string }
export type Find = (q: string) => Promise<Hit | null>;
export type Located = LatLon & { exact: boolean; street: string };

export const label = (s: Pick<Stop, 'street' | 'number' | 'postcode' | 'city'>) =>
  `${s.street} ${s.number}, ${s.postcode ?? ''} ${s.city || 'Köln'}`.replace(/\s+/g, ' ').trim();

/**
 * Two spellings of one street: equal once folded, one the start of the other ("Aquinost." for Aquinostraße), or a
 * single character off in a name of 9+ letters with the same first letter ("Meissenstr." for Mevissenstraße; not
 * "Irgendweg" for Nirgendweg), or the scanner's shortened form of it. Like the PC's `alike` (server/route/stops.mjs).
 */
export function alike(a: string, b: string) {
  if (/…|\.\.\./.test(a + b)) return holds(a, b) || holds(b, a);
  const x = bare(a), y = bare(b);
  if (x === y) return true;
  if (x.length >= 6 && y.length >= 6 && (x.startsWith(y) || y.startsWith(x))) return true;
  return x.length >= 9 && y.length >= 9 && x[0] === y[0] && editDistance(x, y) <= 1;
}

/** `text` (a street, or a whole address) holds `street`; a shortened "Konrad-Ade...uer-Ufer" by its start and, after it, its end. */
export function holds(text: string, street: string) {
  const t = bare(text), m = /^(.*?)\s*(?:…|\.\.\.)\s*(.*)$/.exec(street);
  if (!m) return t.includes(bare(street));
  const a = bare(m[1]), b = bare(m[2]), i = t.indexOf(a);
  return a.length >= 3 && i >= 0 && t.indexOf(b, i + a.length) >= 0;
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

/**
 * OCR misreads a letter or two ("Kretelder Wall"): a street the phone has never placed takes the one street it has
 * placed before (`known`) that is that close: one letter in a name under 10 letters, two in a longer one, same first
 * letter. Two such streets, or none: left as read.
 */
export function snapStreet(street: string, known: string[]): string {
  const x = bare(street);
  if (x.length < 6 || known.some(k => bare(k) === x)) return street;
  const near = new Map(known.map(k => [bare(k), k] as const).filter(([y]) =>
    y[0] === x[0] && Math.abs(y.length - x.length) <= 2 && editDistance(x, y) <= (Math.min(x.length, y.length) < 10 ? 1 : 2)));
  return near.size === 1 ? [...near.values()][0] : street;
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
