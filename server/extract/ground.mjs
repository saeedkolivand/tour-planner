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

const EXPRESS = /(?:express|dpd)\D{0,3}(\d{1,2})[:.](\d{2})|\b(0?8)[:.]30\b|\bexpress\b/i;

function expressIn(block) {
  const m = block.match(EXPRESS);
  if (!m) return '';
  const t = m[1] ? `${m[1].padStart(2, '0')}:${m[2]}` : m[3] ? '08:30' : '18:00';
  return EXPRESS_TIMES.includes(t) ? t : '18:00';
}

/** Each stop's own lines run from its street to the next stop's street; Express is read from those only. */
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
    return { ...out, express: expressIn(t.slice(at[i], next)) };
  });
}
