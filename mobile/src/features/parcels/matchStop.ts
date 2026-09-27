// Which stop a parcel belongs to: by its number once linked, else by the address read off its label.
import type { Stop } from '../tour/types.ts';

/** Same folding as the server's stop identity: "Hohe Straße 68" and "hohe str. 68" compare equal. */
const fold = (s: string) => s.normalize('NFC').toLowerCase()
  .replace(/ß/g, 'ss').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
  .replace(/strasse\b|str\b\.?/g, 'str').replace(/[^a-z0-9]/g, '');
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export type Match = { stop: Stop } | { candidates: Stop[] } | null;

/**
 * `text` is the label as read by OCR, line by line. A stop matches when one line holds its street directly
 * followed by its house number, and not by more digits or a letter ("Hohe Str. 6" is not 68 or 6a).
 * With nothing readable, the barcode's postcode still narrows it to a short list to tap from.
 */
export function matchStop(stops: Stop[], parcel: { id: string; postcode?: string }, text = ''): Match {
  const linked = stops.find(s => s.parcelIds?.includes(parcel.id));
  if (linked) return { stop: linked };
  const inPostcode = stops.filter(s => !parcel.postcode || !s.postcode || s.postcode === parcel.postcode);
  const lines = text.split('\n').map(fold).filter(Boolean);
  const hits = inPostcode.filter(s => {
    const re = new RegExp(`${esc(fold(s.street))}${esc(fold(String(s.number)))}(?![0-9a-z])`);
    return fold(s.street) && lines.some(l => re.test(l));
  });
  if (hits.length === 1) return { stop: hits[0] };
  const candidates = hits.length ? hits : parcel.postcode ? inPostcode.filter(s => s.postcode === parcel.postcode) : [];
  return candidates.length ? { candidates } : null;
}
