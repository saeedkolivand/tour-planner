// The fixed route on the phone: read once from customers/route.json (dropped in through the Files app, with its photos
// next to it), then kept as ranked customers in customers.json, so the door photos and notes are the access notes.
// Phone only, like the access notes: names, photos and notes are never logged.
import { File } from 'expo-file-system';
import type { Stop } from '@/features/tour/types';
import { log } from '@/shared/log';
import { type Customer, customersFolder, customersNow, updateCustomers } from './customers';
import { cheapestSlot, routeMatch, type RouteDeps } from './fixedRoute';

const l = log('fixed-route');
interface RouteFile { stops: { no: number; name: string; lat: number; lon: number; note?: string; media?: string[] }[] }

const isRoute = (id: string) => id.startsWith('route-');

/** route.json -> the route. A newer file replaces the whole route (addresses learned from it are learned again). */
export function importRoute() {
  try {
    const f = new File(customersFolder(), 'route.json');
    if (!f.exists) return;
    const { stops } = JSON.parse(f.textSync()) as RouteFile;
    updateCustomers(all => {
      const next = Object.fromEntries(Object.entries(all).filter(([id]) => !isRoute(id)));
      for (const s of stops) {
        next[`route-${s.no}`] = { name: s.name, street: '', number: '', postcode: '', note: s.note ?? '', photos: (s.media ?? []).filter(m => /\.jpe?g$/i.test(m)), rank: s.no, lat: s.lat, lon: s.lon };
      }
      return next;
    });
    f.moveSync(new File(customersFolder(), `route.imported-${Date.now()}.json`));
    l.info('fixed route imported', { stops: stops.length });
  } catch (e) { l.error('fixed route not imported', e as Error); }
}

/** How many stops the route has (0: none imported). */
export const routeSize = () => Object.values(customersNow()).filter(c => c.rank != null).length;

export const routeDeps: RouteDeps = {
  match: s => {
    const m = routeMatch(customersNow(), s);
    return m ? { id: m[0], lat: m[1].lat, lon: m[1].lon, rank: m[1].rank } : null;
  },
  slot: p => cheapestSlot(customersNow(), p),
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
  updateCustomers(all => ({ ...all, [`route-${Date.now()}`]: c }));
  l.info('stop joined the fixed route', { rank });
}
