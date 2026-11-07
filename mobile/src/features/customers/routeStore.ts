// The fixed route on the phone: read once from customers/route.json (PHOENIX's day shift: route-day.json) (dropped in through the Files app, with its photos
// next to it), then kept as ranked customers in customers.json, so the door photos and notes are the access notes.
// Phone only, like the access notes: names, photos and notes are never logged.
import { File } from 'expo-file-system';
import { companyOf } from '@/features/planner/companies';
import { getSettings } from '@/features/settings/settings';
import type { Stop, StopOrder } from '@/features/tour/types';
import { log } from '@/shared/log';
import { type Customer, customersFolder, customersNow, updateCustomers } from './customers';
import { cheapestSlot, routeMatch, type RouteDeps } from './fixedRoute';

const l = log('fixed-route');
interface RouteFile { stops: { no: number; name: string; lat: number; lon: number; note?: string; media?: string[]; street?: string; number?: string; postcode?: string }[] }

// Each shift its own route, told apart by the customer's id: night (and DPD) 'route-', PHOENIX's day shift 'day-'
const SHIFTS = { night: { prefix: 'route-', file: 'route' }, day: { prefix: 'day-', file: 'route-day' } };
const shiftNow = () => { const s = getSettings(); return SHIFTS[companyOf(s.company).shifts ? s.shift : 'night'] ?? SHIFTS.night; };
/** The customers on this shift's route (the other shift's and plain access notes left out). */
const routeNow = () => { const { prefix } = shiftNow(); return Object.fromEntries(Object.entries(customersNow()).filter(([id]) => id.startsWith(prefix))); };

/** route.json / route-day.json -> that shift's route. A newer file replaces it whole (its addresses are learned again). */
export function importRoute() { for (const sh of Object.values(SHIFTS)) importOne(sh.prefix, sh.file); }

function importOne(prefix: string, name: string) {
  try {
    const f = new File(customersFolder(), `${name}.json`);
    if (!f.exists) return;
    const { stops } = JSON.parse(f.textSync()) as RouteFile;
    updateCustomers(all => {
      const next = Object.fromEntries(Object.entries(all).filter(([id]) => !id.startsWith(prefix)));
      for (const s of stops) {
        // the scanner's address, where it's known, matches the row before anything is geocoded (two Fielmanns, one name)
        next[`${prefix}${s.no}`] = { name: s.name, street: s.street ?? '', number: s.number ?? '', postcode: s.postcode ?? '', note: s.note ?? '', photos: (s.media ?? []).filter(m => /\.jpe?g$/i.test(m)), rank: s.no, lat: s.lat, lon: s.lon };
      }
      return next;
    });
    f.moveSync(new File(customersFolder(), `${name}.imported-${Date.now()}.json`));
    l.info('fixed route imported', { stops: stops.length, file: name });
  } catch (e) { l.error('fixed route not imported', e as Error); }
}

/** How many stops the route has (0: none imported). */
export const routeSize = () => Object.values(routeNow()).filter(c => c.rank != null).length;

/** The order a plan uses: a company with a fixed order always the route's (none on the phone yet: the scanner's). */
export const orderOf = (s: { company: string; stopOrder: StopOrder }): StopOrder =>
  companyOf(s.company).fixedOrder ? (routeSize() ? 'route' : 'scanned') : s.stopOrder;

export const routeDeps: RouteDeps = {
  match: s => {
    const m = routeMatch(routeNow(), s);
    return m ? { id: m[0], lat: m[1].lat, lon: m[1].lon, rank: m[1].rank } : null;
  },
  slot: p => cheapestSlot(routeNow(), p),
  learn: (id, s) => {
    const c = customersNow()[id];
    if (!c || c.street || !s.street) return;
    updateCustomers(all => ({ ...all, [id]: { ...c, street: s.street, number: s.number, postcode: s.postcode } }));
  },
};

/** A new stop delivered at `rank` joins the route there, so tomorrow it's on it. */
export function joinRoute(s: Stop, rank: number) {
  if (s.lat == null || s.lon == null) return;
  const c: Customer = { name: s.name, street: s.street, number: s.number, postcode: s.postcode, note: '', photos: [], rank, lat: s.lat, lon: s.lon };
  updateCustomers(all => ({ ...all, [`${shiftNow().prefix}${Date.now()}`]: c }));
  l.info('stop joined the fixed route', { rank });
}

/** The route's stops in order, for the driver to pick from. */
export const routeStops = () => Object.entries(routeNow()).filter(([, c]) => c.rank != null)
  .map(([id, c]) => ({ id, name: c.name ?? '', rank: c.rank! })).sort((a, b) => a.rank - b.rank);

/** The driver says this row is that route stop: it takes the row's address, so this plan and every later one match it. */
export function teachRoute(id: string, s: Stop) {
  updateCustomers(all => ({ ...all, [id]: { ...all[id], street: s.street, number: s.number, postcode: s.postcode } }));
  l.info('route stop picked by hand', { rank: customersNow()[id]?.rank });
}
