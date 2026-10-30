// Which remembered customer a stop is a visit to (CONTEXT.md: Customer). The scanner is read fresh every night, so a
// pharmacy comes back with OCR's slips in it ("Rathaus-Apothcke", a postcode digit off); those still find it. Two
// pharmacies a letter apart ("Linden-" / "Lindner-Apotheke") only merge when their street agrees too.
import { alike, editDistance } from '../planner/locate.ts';
import { bare, samePlz } from '../planner/stops.ts';
import type { Stop } from '../tour/types.ts';

/** A place delivered to again and again, and how to get the goods in there. `photos`: file names in customers/. */
export interface Customer { name?: string; street: string; number: string; postcode: string; note: string; photos: string[] }

const plz = (p?: string) => String(p ?? '').replace(/\D/g, '');
const num = (n?: string) => String(n ?? '').toLowerCase().replace(/\s/g, '');
// "Rathaus-Apotheke · Herr Kunz": the first name; "1 Getränke Ucar": a count glued on (as in dedupe)
const firstName = (n?: string) => bare(String(n ?? '').split(' · ')[0]).replace(/^\d+/, '');

export function isVisitTo(c: Customer, s: Stop): boolean {
  if (!samePlz(plz(c.postcode), plz(s.postcode))) return false;
  const street = !!c.street && !!s.street && alike(c.street, s.street);
  if (street && num(c.number) === num(s.number)) return true;
  const a = firstName(c.name), b = firstName(s.name);
  if (a.length < 6 || b.length < 6) return false;
  const d = editDistance(a, b);
  return d === 0 || (d <= 2 && street); // the same name with a mangled street, or a misread name on the same street
}

/** The id of the customer this stop is a visit to, if any. ponytail: first match wins, fine for a few hundred. */
export const findCustomer = (all: Record<string, Customer>, s: Stop) =>
  Object.entries(all).find(([, c]) => isVisitTo(c, s))?.[0];
