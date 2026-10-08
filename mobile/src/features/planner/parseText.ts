// Scanner-list text (read on the phone) -> stops, without the PC's vision model. Rules instead of a model.
// The DPD scanner prints one row per stop: a bold name line (with "PRIO" and the parcel count at its right), the
// street + number, "50670HX Köln" (postcode + two letters that are NOT part of it), a route code "G 11 T 387" and
// the planned slot "09:11 / 11:11" (which is not a deadline). OCR returns roughly that order, so the lines after a
// street are its trailer while they look like attributes; what remains before the next street is that next stop's
// header: its name, PRIO and count. The letters and the code are kept on the stop (`area`, `code`) for the tour
// history; nothing plans by them yet.
// ponytail: rules, not a model; the PC reads messy photos better. Labels (Scan tab) need neither.
import type { Express, Stop, StopType } from '../tour/types.ts';
import { ROWS } from './rowOrder.ts';
import { bare } from './stops.ts';

// "Hohe Str. 68", "Konrad-Adenauer-Ufer 3-5", "An der Linde 12 a", "Venloer Straße 211, 50823 Köln", "Gereonsm…engasse 26"
const ADDRESS = /^(\p{Lu}[\p{L}.…'’\- ]*?\p{L}\.?)\s+(\d{1,4}(?:\s?[a-zA-Z](?![\p{L}]))?(?:\s?[-–/]\s?\d{1,4}[a-zA-Z]?)?)(?=$|[\s,])/u;
// OCR reads the two letters as "IH", "ll", "1J" (an I as a 1): at least one letter, so a phone number is no postcode
const POSTCODE = /\b(\d{5})([A-Za-z][A-Za-z0-9]?|\d[A-Za-z])?\b(?:\s+(\p{L}[\p{L} .\-]*))?/u;
const ROUTE_CODE = /^G\s?(\d+)\s?T\s?(\d+)\b/im;
const NOT_A_STREET = /^(dpd|paket|parcel|stopp?|tour|express|predict|zustell|lieferung|empf|kunde|tel|ref|nächste|erwartete|delivery\b|expected|next stops|•?\s*a further)/i;
// lines that describe the stop above them rather than name the one below
const TRAILER = /^(?:\d{5}(?:[A-Za-z][A-Za-z0-9]?|\d[A-Za-z])?\b|G\s?\d+\s?T\s?\d+|\d{1,2}[:.]\d{2}\b|köln\b|altstadt|neustadt|erwartete|expected|express|dpd\b|\d+\s*(?:pakete|packst|colli|stk|pcs)|paketshop|pickup|packstation|abholung|retoure)/i;
// "5066BIO Köln", "5066810 Köln", "506681V": OCR swaps 8/B, 0/O, 1/I in the postcode line. Its first five are digits,
// the (up to) two after them letters; only a line that is that and a town (or nothing), so a phone number stays one.
const PC_LINE = /^(\d[\dBOIl]{4})([A-Za-z\d]{0,2})(?=\s+\p{L}|$)/u;
const fixPostcode = (l: string) => l.replace(PC_LINE, (_, d: string, a: string) =>
  d.replace(/B/g, '8').replace(/O/g, '0').replace(/[Il]/g, '1') + a.toUpperCase().replace(/1/g, 'I').replace(/0/g, 'O').replace(/8/g, 'B'));
const COUNT = /^\d{1,2}$/;
const TIME = /^\d{1,2}[:.]\d{2}(?:\s*[-–]\s*\d{1,2}[:.]\d{2})?$/;
// the right column's tags: "PRIO", and the Express deadline "by 18:00"
const TAG = /^(prio|by\s*\d{1,2}[:.]\d{2})$/i;

const EXPRESS: Express[] = ['08:30', '10:00', '12:00', '18:00'];
/** "by 11:00" -> the Express time at or before it (10:00): early is safe, late costs money. */
const expressBy = (hhmm: string) => [...EXPRESS].reverse().find(e => e <= hhmm.padStart(5, '0')) ?? '08:30';

/** `rows`: the text was put in row order (rowOrder.ts), so a row's own lines hold its PRIO and "by 18:00". */
function expressIn(head: string, tail: string, rows = false): Express | '' {
  if (/\bprio\b/i.test(rows ? `${head}\n${tail}` : head)) return '12:00';
  const by = rows ? /^by\s*(\d{1,2})[:.](\d{2})$/im.exec(`${head}\n${tail}`) : null;
  if (by) return expressBy(`${by[1]}:${by[2]}`);
  const m =/(?:express|dpd)\D{0,3}(\d{1,2})[:.](\d{2})|\bexpress\b/i.exec(tail);
  if (!m) return '';
  const t = m[1] ? `${m[1].padStart(2, '0')}:${m[2]}` : '18:00';
  return (['08:30', '10:00', '12:00', '18:00'].includes(t) ? t : '18:00') as Express;
}

function typeIn(block: string): StopType {
  if (/paketshop|pickup\s*(shop|point)|packstation|kiosk|lotto/i.test(block)) return 'shop';
  if (/abholung|retoure|return/i.test(block)) return 'pickup';
  // "GmbHComputer": the scanner glues the next word to a truncated company name, so GmbH needs no boundary after it
  if (/\bgmbh|\b(ag|kg|ohg|e\.\s?k|gbr|ug|e\.\s?v|praxis|apotheke|kanzlei|hotel|restaurant|b2b|kita|gemeinde|verein|center|studio|büro|reisecenter)\b|&/i.test(block)) return 'business';
  return 'private';
}

/**
 * The scanner shortens long street names in the middle ("Gereonsm…engasse"): another row usually spells them out,
 * or a street from an earlier tour does (`known`, the phone's geocode history).
 */
export function untruncate(stops: Stop[], known: string[] = []): Stop[] {
  const tight = (s: string) => s.replace(/\s+/g, '');
  const full = [...new Set([...stops.map(s => s.street), ...known].filter(s => s && !/…|\.\.\./.test(s)))];
  return stops.map(s => {
    const m = /^(.*?)(?:…|\.\.\.)(.*)$/.exec(s.street);
    if (!m) return s;
    const re = new RegExp(`^${tight(m[1]).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*${tight(m[2]).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const hit = full.filter(f => re.test(tight(f)));
    return hit.length === 1 ? { ...s, street: hit[0] } : s;
  });
}

export function parseStops(text: string): Stop[] {
  const rows = text.startsWith(ROWS);
  const lines = text.split(/\r?\n/).slice(rows ? 1 : 0).map(l => fixPostcode(l.trim())).filter(Boolean);
  const trailing = (l: string) => TRAILER.test(l) || (rows && TAG.test(l));
  // the trailer of each stop runs from its street line while the lines look like attributes; the header of the
  // next stop is whatever is left before its street line
  const trailerOf = (list: { i: number }[]) => list.map(({ i }, k) => {
    const limit = list[k + 1]?.i ?? lines.length;
    let e = i + 1;
    while (e < limit && trailing(lines[e])) e++;
    return e;
  });
  // a name can look like an address ("Späti 2", a kiosk): a street has a postcode after it (or on its line); an
  // address-like line with neither, followed by another address (past its opening hours, at most), is the next stop's
  // name; so is one with words after its number ("Späti 2 Kiosk im Agnes"), even as a photo's last row
  const cands = lines.map((l, i) => ({ i, m: NOT_A_STREET.test(l) ? null : ADDRESS.exec(l) })).filter(x => x.m);
  const candEnd = trailerOf(cands);
  const named = (x: { i: number; m: RegExpExecArray | null }, k: number) => !POSTCODE.test(lines.slice(x.i, candEnd[k]).join('\n'))
    && (/^\s+\p{L}{2}/u.test(lines[x.i].slice(x.m![0].length)) || (!!cands[k + 1] && lines.slice(x.i + 1, candEnd[k]).every(l => TIME.test(l))));
  const starts = cands.filter((x, k) => !named(x, k));
  const trailerEnd = trailerOf(starts);
  const stops = starts.map(({ i, m }, k) => {
    const head = lines.slice(k ? trailerEnd[k - 1] : 0, i).filter(l => !NOT_A_STREET.test(l));
    const tail = lines.slice(i, trailerEnd[k]).join('\n');
    const read = POSTCODE.exec(tail), code = ROUTE_CODE.exec(tail);
    const pc = read?.[1] === '00000' ? null : read; // "00000AA": the scanner's "Unknown area", not a postcode 9 km away
    const count = head.find(l => COUNT.test(l));
    const parcelsText = /(\d{1,2})\s*(?:pakete|packst|colli|stk|pcs|x\s*paket)/i.exec(tail);
    // not a row cut off at the photo's top ("50670HJ Köln", "506/OIL Köln"), nor the column's "by 18:00"
    const name = head.find(l => !COUNT.test(l) && !TIME.test(l) && !TAG.test(l) && !TRAILER.test(l) && !/^\d{3}/.test(l) && /\p{L}{3}/u.test(l))
      ?.replace(/^[^\p{L}\d]+/u, ''); // "• Lukas Kreuser": the scanner marks the current row
    const hours = head.map(l => /^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/.exec(l)).find(Boolean);
    const express = expressIn(head.join('\n'), tail, rows);
    const block = `${name ?? ''}\n${tail}`;
    const type = typeIn(block);
    return {
      street: m![1].trim(), number: m![2].replace(/\s/g, ''), postcode: pc?.[1] ?? '', city: pc?.[3]?.trim().replace(/,.*$/, '').replace(/^K\S{2,3}n$/i, 'Köln') || 'Köln', // "Köin"
      ...(pc?.[2] && { area: pc[2].toUpperCase().replace(/1/g, 'I') }), ...(code && { code: `G ${code[1]} T ${code[2]}` }),
      type, parcels: parcelsText ? Number(parcelsText[1]) : count ? Number(count) : 1,
      ...(name && { name }), ...(express && { express }), ...(/\bprio\b/i.test(rows ? `${head.join('\n')}\n${tail}` : head.join('\n')) && { prio: true }),
      ...(hours && type === 'shop' && { opens: `${hours[1]}-${hours[2]}` }),
    } as Stop;
  });
  // the planned slot, "08:19" over "10:19" at a row's right, a business's hours ("10:00-18:30") above it: Vision prints
  // that column after the rows, in their order (the scanner's clock, "10:48", starts no pair). Only when every row got
  // one: a photo with a time cut off leaves it to the overlapping photo
  const min = (x: string) => Number(x.split(':')[0]) * 60 + Number(x.split(':')[1]);
  const times = lines.filter(l => /^\d{1,2}:\d{2}(\s*[-–]\s*\d{1,2}:\d{2})?$/.test(l)), slots: { slot: string; hours?: string }[] = [];
  let hours: string | undefined;
  for (let k = 0; k < times.length; k++) {
    if (times[k].length > 5) { hours = times[k].replace(/\s*[-–]\s*/, '-'); continue; }
    const next = times[k + 1] ?? '', d = next.length <= 5 ? min(next) - min(times[k]) : NaN;
    if (d >= 60 && d <= 240) { slots.push({ slot: `${times[k]}-${next}`, hours }); k++; }
    hours = undefined;
  }
  // hours drift a row in the column now and then: kept only on a business or shop, or a slot starting as it opens
  if (slots.length === stops.length) stops.forEach((s, k) => {
    const { slot, hours: h } = slots[k];
    s.slot = slot;
    if (h && !s.opens && (s.type !== 'private' || slot.slice(0, 5) === h.slice(0, 5))) s.opens = h;
  });
  return untruncate(stops);
}

/**
 * "PRIO" and "by 18:00" (Express) sit in the scanner's right column, and Vision prints that column apart from its rows:
 * a photo says only that one of its rows has the tag. Across the run of photos showing it, the row is the one on every
 * photo, and not one shown whole (every slot read) on a photo without the tag. Still two: both get it; a missed Express
 * costs money, an early stop doesn't. `found`: each photo's parseStops.
 */
export function columnTags(texts: string[], found: Stop[][]): Stop[][] {
  if (texts.some(t => t.startsWith(ROWS))) return found; // our OCR put each tag on its row already
  const id = (s: Stop) => `${bare(s.street)}|${s.number}`;
  const lineSets = texts.map(t => t.split(/\r?\n/).map(l => l.trim()));
  const tags = [...new Set(lineSets.flat().filter(l => TAG.test(l)).map(l => l.toLowerCase().replace(/\s+/g, '').replace('.', ':')))];
  const whole = found.map(f => f.length > 0 && f.every(s => s.slot));
  const seen = (s: Stop, p: number) => found[p].some(x => id(x) === id(s)) || (!!s.name && lineSets[p].some(l => l.endsWith(s.name!)));
  const out = found.map(f => f.map(s => ({ ...s })));
  for (const tag of tags) {
    const has = lineSets.map(ls => ls.some(l => TAG.test(l) && l.toLowerCase().replace(/\s+/g, '').replace('.', ':') === tag));
    for (let i = 0, j = 0; i < has.length; i = Math.max(j, i + 1)) {
      if (!has[i]) continue;
      for (j = i; j < has.length && has[j]; j++);
      const run = [...Array(j - i).keys()].map(k => i + k);
      const rows = run.flatMap(p => found[p]).filter(s => !has.some((h, p) => !h && whole[p] && found[p].some(x => id(x) === id(s))));
      const every = rows.filter(s => run.every(p => seen(s, p)));
      const ids = new Set((every.length ? every : rows).map(id));
      const express = /\d/.test(tag) ? expressBy(tag.slice(2)) : '12:00'; // ponytail: PRIO read as Express 12:00, unconfirmed
      out.forEach(f => f.forEach(s => {
        if (!ids.has(id(s))) return;
        if (tag === 'prio') s.prio = true;
        if (!s.express || s.express > express) s.express = express;
      }));
    }
  }
  return out;
}
