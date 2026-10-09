// Grounding for the text path (on-device OCR from the phone).
// A small model reading OCR text misattributes details between neighbouring stops and keeps
// OCR digit look-alikes ("27l"). Both are checked against the text itself, in code.
import { EXPRESS_TIMES } from './schema.mjs';

const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const DIGIT = { O: '0', o: '0', I: '1', l: '1', '|': '1', S: '5', B: '8' };

/** House numbers: only O/I/l next to digits, because "12B" is a real house number. */
export const fixNumber = s => String(s).replace(/[OoIl|](?=\d|$)|(?<=\d)[OoIl|]/g, c => DIGIT[c]);
/** Postcodes are all digits, so every look-alike is converted. */
export const fixPostcode = s => String(s).replace(/[OoIl|SB]/g, c => DIGIT[c]).replace(/\D/g, '');

// "PRIO" is this scanner's priority flag (due by 18:00). A bare time is never a deadline: every row carries its
// planned slot ("09:11 11:11"), so a plain "08:30" would flag the first stop of the day as Express.
const EXPRESS = /(?:express|dpd)\D{0,3}(\d{1,2})[:.](\d{2})|\b(prio)\b|\bexpress\b/i;

function expressIn(block) {
  const m = block.match(EXPRESS);
  if (!m) return '';
  const t = m[1] ? `${m[1].padStart(2, '0')}:${m[2]}` : '18:00';
  return EXPRESS_TIMES.includes(t) ? t : '18:00';
}

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * The scanner shortens long street names in the middle ("Gereonsm…engasse"): fill in the full name when another
 * row of the batch (or a known stop) spells it out; otherwise it stays as shown and is geocoded as best it can.
 */
export function untruncate(stops, known = []) {
  const tight = s => s.replace(/\s+/g, '');
  const full = [...new Set([...known, ...stops].map(s => s.street).filter(s => s && !/…|\.\.\./.test(s)))];
  return stops.map(s => {
    const m = /^(.*?)(?:…|\.\.\.)(.*)$/.exec(s.street ?? '');
    if (!m) return s;
    const re = new RegExp(`^${esc(tight(m[1]))}.*${esc(tight(m[2]))}$`, 'i');
    const hit = full.filter(f => re.test(tight(f)));
    return hit.length === 1 ? { ...s, street: hit[0] } : s;
  });
}

/**
 * Each stop's own lines run from its street to the next stop's street; Express is read from those only.
 * The scanner prints "PRIO" in a row's header, above the street: that part is searched for PRIO only, and the
 * lines after the street for the written forms ("Express 12:00"), so a PRIO never lands on the stop above.
 */
export function ground(stops, text) {
  const t = fold(text);
  // search on from the previous stop: lists are grouped by street, and searching from the top gave every
  // "Hohe Str." the first one's lines (and its Express)
  let from = 0;
  const at = stops.map(s => {
    const p = t.indexOf(fold(s.street).slice(0, 5), from);
    if (p >= 0) from = p + 1;
    return p;
  });
  return stops.map((s, i) => {
    const out = { ...s, number: fixNumber(s.number), postcode: fixPostcode(s.postcode) };
    if (at[i] < 0) return out; // can't place it in the text: keep what the model said
    const next = Math.min(...at.filter(p => p > at[i]), t.length);
    const prev = Math.max(-1, ...at.filter(p => p >= 0 && p < at[i]));
    // the header: after the previous stop's postcode line (or its street), up to this street
    const pcAfterPrev = prev >= 0 ? t.slice(prev, at[i]).search(/\d{5}/) : -1;
    const head = t.slice(prev < 0 ? Math.max(0, at[i] - 200) : pcAfterPrev >= 0 ? prev + pcAfterPrev + 5 : prev, at[i]);
    const tail = t.slice(at[i], next);
    return { ...out, express: /\bprio\b/.test(head) ? '18:00' : expressIn(tail.replace(/\bprio\b/g, '')) };
  });
}
