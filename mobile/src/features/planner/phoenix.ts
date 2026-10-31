// PHOENIX's scanner list ("Stoppliste") -> stops. One row per pharmacy: the parcel count over "Zu" (delivery) or "Abh"
// (pickup) at the left, then the bold name, the street + number and "DE 42651 Solingen" (a long town wraps: "Monheim am"
// / "Rhein", "Langenfeld" / "(Rheinland)"). No times, no priorities. The "DE" line anchors a row: a row cut off before
// it is left to the overlapping photo, and the status bar ("01:03", "FEEC9", "Stoppliste") is never a name. A count the
// photo didn't show is 0 here; `votePhoenix` takes the one the other photos read.
import { isVisitTo } from '../customers/match.ts';
import type { Stop } from '../tour/types.ts';
import { ADDRESS } from './parseText.ts';
import { ROWS } from './rowOrder.ts';
import { stopKey } from './stops.ts';

const TOWN = /^D[EF]?\s*(\d{5})\s+(.+)$/; // "DE 42651 Solingen"
const KIND = /^(zu|abh)\.?$/i;
const COUNT = /^\d{1,2}$/;
const NOISE = /^[^\p{L}\d]*$|^[^\p{L}]*\d{1,2}:\d{2}|stoppliste|tournr|abholungen|zustellungen|zebra|^[A-F\d]{5}$/iu;
const WRAP = /\b(am|an der|im|bei|in der)$/; // "Monheim am" goes on in the next line

export function parsePhoenix(text: string): Stop[] {
  const lines = text.split(/\r?\n/).slice(text.startsWith(ROWS) ? 1 : 0).map(l => l.trim()).filter(Boolean);
  const stops: Stop[] = [];
  let from = 0; // first line of the current row
  lines.forEach((l, i) => {
    const town = TOWN.exec(l);
    if (!town) return;
    const row = lines.slice(from, i);
    let city = town[2].trim();
    const next = lines[i + 1] ?? '';
    if (WRAP.test(city) || next.startsWith('(')) { city += ` ${next}`; from = i + 2; } else from = i + 1;
    const words = row.filter(x => !KIND.test(x) && !COUNT.test(x) && !NOISE.test(x));
    const street = words.at(-1), m = street ? ADDRESS.exec(street) : null;
    if (!m || /[ilo]$/i.test(m[2])) return; // "Neuer Markt 5l": a misread digit, not a house letter
    const name = words.slice(0, -1).filter(x => /\p{L}{3}/u.test(x)).at(-1); // not "* To", a cut-off icon
    const count = row.find(x => COUNT.test(x));
    stops.push({
      street: m[1].trim(), number: m[2].replace(/\s/g, ''), postcode: town[1], city: city.replace(/\s*\(.*\)$/, ''),
      type: row.some(x => /^abh\.?$/i.test(x)) ? 'pickup' : 'business', parcels: count ? Number(count) : 0,
      ...(name && { name }),
    });
  });
  return stops;
}

/** The reading seen most often; a tie goes to the first. */
const mode = <T>(xs: T[]) => xs.reduce((best, x) => (xs.filter(y => y === x).length > xs.filter(y => y === best).length ? x : best), xs[0]);

/**
 * Overlapping photos read each row several times, each with its own slips ("Utergarten 1", "Hugo-Zade-Weg 26", "Eich-
 * Apotheke"): copies of one customer (same rules as the access notes) become one stop, taking the reading seen most.
 * A pharmacy is one stop: its parcels are never summed.
 */
export function votePhoenix(rows: Stop[]): Stop[] {
  const groups: Stop[][] = [];
  for (const s of rows) {
    // or the same name and number with a mangled postcode ("10607 Calin:" for 42697 Solingen)
    const g = groups.find(g => g.some(o => isVisitTo({ ...o, note: '', photos: [] }, s) || (!!s.name && o.name === s.name && o.number === s.number)));
    if (g) g.push(s); else groups.push([s]);
  }
  return groups.map(g => {
    const key = mode(g.map(stopKey)), names = g.flatMap(s => s.name ?? []), counts = g.map(s => s.parcels).filter(n => n > 0);
    const pc = mode(g.map(s => s.postcode)), city = mode(g.flatMap(s => (s.postcode === pc && s.city) || []));
    return { ...g.find(s => stopKey(s) === key)!, postcode: pc, city, ...(names.length && { name: mode(names) }), parcels: counts.length ? mode(counts) : 1 };
  });
}
