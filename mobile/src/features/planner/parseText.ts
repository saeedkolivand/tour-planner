// Scanner-list text (read on the phone) -> stops, without the PC's vision model. Rules instead of a model:
// a stop starts at a "Street 12a" line; its postcode, Express time and type are read from the lines up to the next.
// ponytail: rules, not a model; the PC reads messy photos better. Labels (Scan tab) need neither.
import type { Express, Stop, StopType } from '../tour/types.ts';

// "Hohe Str. 68", "Konrad-Adenauer-Ufer 3-5", "An der Linde 12 a", "Venloer Straße 211, 50823 Köln"
const ADDRESS = /^(\p{Lu}[\p{L}.'’\- ]*?\p{L}\.?)\s+(\d{1,4}(?:\s?[a-zA-Z](?![\p{L}]))?(?:\s?[-–/]\s?\d{1,4}[a-zA-Z]?)?)(?=$|[\s,])/u;
const POSTCODE = /\b(\d{5})\b(?:\s+(\p{L}[\p{L} .\-]*))?/u;
const NOT_A_STREET = /^(dpd|paket|parcel|stopp?|tour|express|predict|zustell|lieferung|empf|kunde|tel|ref)/i;

function expressIn(block: string): Express | '' {
  const m = /(?:express|dpd)\D{0,3}(\d{1,2})[:.](\d{2})|\b(0?8)[:.]30\b|\bexpress\b/i.exec(block);
  if (!m) return '';
  const t = m[1] ? `${m[1].padStart(2, '0')}:${m[2]}` : m[3] ? '08:30' : '18:00';
  return (['08:30', '10:00', '12:00', '18:00'].includes(t) ? t : '18:00') as Express;
}

function typeIn(block: string): StopType {
  if (/paketshop|pickup\s*(shop|point)|packstation/i.test(block)) return 'shop';
  if (/abholung|retoure|return/i.test(block)) return 'pickup';
  if (/\b(gmbh|ag|kg|ohg|e\.\s?k|gbr|ug|praxis|apotheke|kanzlei|hotel|restaurant|b2b)\b/i.test(block)) return 'business';
  return 'private';
}

export function parseStops(text: string): Stop[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const starts = lines.map((l, i) => ({ i, m: NOT_A_STREET.test(l) ? null : ADDRESS.exec(l) })).filter(x => x.m);
  return starts.map(({ i, m }, k) => {
    const block = lines.slice(i, starts[k + 1]?.i ?? lines.length).join('\n');
    const pc = POSTCODE.exec(block);
    const parcels = /(\d{1,2})\s*(?:pakete|packst|colli|stk|pcs|x\s*paket)/i.exec(block);
    const express = expressIn(block);
    return {
      street: m![1].trim(), number: m![2].replace(/\s/g, ''), postcode: pc?.[1] ?? '', city: pc?.[2]?.trim() || 'Köln',
      type: typeIn(block), parcels: parcels ? Number(parcels[1]) : 1, ...(express && { express }),
    };
  });
}
