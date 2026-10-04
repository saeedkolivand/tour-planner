// Scanner-list text (read on the phone) -> stops, without the PC's vision model. Rules instead of a model.
// The DPD scanner prints one row per stop: a bold name line (with "PRIO" and the parcel count at its right), the
// street + number, "50670HX Köln" (postcode + two letters that are NOT part of it), a route code "G 11 T 387" and
// the planned slot "09:11 / 11:11" (which is not a deadline). OCR returns roughly that order, so the lines after a
// street are its trailer while they look like attributes; what remains before the next street is that next stop's
// header: its name, PRIO and count. The letters and the code are kept on the stop (`area`, `code`) for the tour
// history; nothing plans by them yet.
// ponytail: rules, not a model; the PC reads messy photos better. Labels (Scan tab) need neither.
import type { Express, Stop, StopType } from '../tour/types.ts';

// "Hohe Str. 68", "Konrad-Adenauer-Ufer 3-5", "An der Linde 12 a", "Venloer Straße 211, 50823 Köln", "Gereonsm…engasse 26"
const ADDRESS = /^(\p{Lu}[\p{L}.…'’\- ]*?\p{L}\.?)\s+(\d{1,4}(?:\s?[a-zA-Z](?![\p{L}]))?(?:\s?[-–/]\s?\d{1,4}[a-zA-Z]?)?)(?=$|[\s,])/u;
const POSTCODE = /\b(\d{5})([A-Z]{1,2})?\b(?:\s+(\p{L}[\p{L} .\-]*))?/u;
const ROUTE_CODE = /^G\s?(\d+)\s?T\s?(\d+)\b/im;
const NOT_A_STREET = /^(dpd|paket|parcel|stopp?|tour|express|predict|zustell|lieferung|empf|kunde|tel|ref|nächste|erwartete)/i;
// lines that describe the stop above them rather than name the one below
const TRAILER = /^(?:\d{5}[A-Z]{0,2}\b|G\s?\d+\s?T\s?\d+|\d{1,2}[:.]\d{2}\b|köln\b|altstadt|neustadt|erwartete|express|dpd\b|\d+\s*(?:pakete|packst|colli|stk|pcs)|paketshop|pickup|packstation|abholung|retoure)/i;
const COUNT = /^\d{1,2}$/;
const TIME = /^\d{1,2}[:.]\d{2}(?:\s*[-–]\s*\d{1,2}[:.]\d{2})?$/;

function expressIn(head: string, tail: string): Express | '' {
  if (/\bprio\b/i.test(head)) return '12:00';
  const m = /(?:express|dpd)\D{0,3}(\d{1,2})[:.](\d{2})|\bexpress\b/i.exec(tail);
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
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  // the trailer of each stop runs from its street line while the lines look like attributes; the header of the
  // next stop is whatever is left before its street line
  const trailerOf = (list: { i: number }[]) => list.map(({ i }, k) => {
    const limit = list[k + 1]?.i ?? lines.length;
    let e = i + 1;
    while (e < limit && TRAILER.test(lines[e])) e++;
    return e;
  });
  // a name can look like an address ("Späti 2", a kiosk): a street has a postcode after it (or on its line); an
  // address-like line with neither, followed by another address, is the next stop's name
  const cands = lines.map((l, i) => ({ i, m: NOT_A_STREET.test(l) ? null : ADDRESS.exec(l) })).filter(x => x.m);
  const candEnd = trailerOf(cands);
  const starts = cands.filter((x, k) => !(cands[k + 1] && candEnd[k] === x.i + 1 && !POSTCODE.test(lines[x.i])));
  const trailerEnd = trailerOf(starts);
  const stops = starts.map(({ i, m }, k) => {
    const head = lines.slice(k ? trailerEnd[k - 1] : 0, i).filter(l => !NOT_A_STREET.test(l));
    const tail = lines.slice(i, trailerEnd[k]).join('\n');
    const pc = POSTCODE.exec(tail), code = ROUTE_CODE.exec(tail);
    const count = head.find(l => COUNT.test(l));
    const parcelsText = /(\d{1,2})\s*(?:pakete|packst|colli|stk|pcs|x\s*paket)/i.exec(tail);
    const name = head.find(l => !COUNT.test(l) && !TIME.test(l) && !/^prio$/i.test(l) && /\p{L}{3}/u.test(l));
    const hours = head.map(l => /^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/.exec(l)).find(Boolean);
    const express = expressIn(head.join('\n'), tail);
    const block = `${name ?? ''}\n${tail}`;
    const type = typeIn(block);
    return {
      street: m![1].trim(), number: m![2].replace(/\s/g, ''), postcode: pc?.[1] ?? '', city: pc?.[3]?.trim().replace(/,.*$/, '') || 'Köln',
      ...(pc?.[2] && { area: pc[2] }), ...(code && { code: `G ${code[1]} T ${code[2]}` }),
      type, parcels: parcelsText ? Number(parcelsText[1]) : count ? Number(count) : 1,
      ...(name && { name }), ...(express && { express }), ...(hours && type === 'shop' && { opens: `${hours[1]}-${hours[2]}` }),
    } as Stop;
  });
  return untruncate(stops);
}
