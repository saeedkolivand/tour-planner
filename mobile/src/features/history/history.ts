// What each day's tour actually did, kept on the phone to plan better later (docs/adr/0007): every stop of the day
// with its place in the scanner list and in the plan, when and where it was delivered, and each plan made that day.
// Framework-free (the file IO is historyFile.ts) so the merge rules are tested with Node.
import type { LatLon, Plan, Stop, StopOrder, Tour } from '../tour/types.ts';

export interface DayStop {
  key: string;
  /** Place in the tour's list, 1-based: the scanner order as captured. */
  list: number;
  /** Parking stop it was in on the day's last plan, 1-based; absent when the plan could not place it. */
  planned?: number;
  no?: number;
  street: string;
  number: string;
  postcode: string;
  area?: string;
  code?: string;
  name?: string;
  type: Stop['type'];
  parcels: number;
  express?: Stop['express'];
  /** Where the geocoder (or a dragged pin) put the door. */
  lat?: number;
  lon?: number;
  exact?: boolean;
  pinned?: boolean;
  doneAt?: number;
  /** Where the phone was at the Delivered tap. */
  donePos?: Stop['donePos'];
}

export interface DayPlan {
  /** When this plan was first seen. */
  at: number;
  by?: Plan['by'];
  order?: StopOrder;
  startedAt: number;
  km: number;
  min: number;
  start: LatLon;
  end: LatLon | null;
  /** The parking stops in driving order: where the van stops, the planned minute, and the stops walked to. */
  parks: { lat: number; lon: number; eta: number; keys: string[] }[];
}

export interface Day { date: string; stops: DayStop[]; plans: DayPlan[] }

/** "2026-10-04" in the phone's time zone: a tour belongs to the day it was driven. */
export const dayOf = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const round6 = (x: number | undefined) => (x == null ? undefined : +x.toFixed(6));

function dayPlan(p: Plan, at: number): DayPlan {
  return {
    at, by: p.by, order: p.order, startedAt: p.startedAt, km: +p.km.toFixed(1), min: Math.round(p.min),
    start: { lat: round6(p.start.lat)!, lon: round6(p.start.lon)! }, end: p.end && { lat: round6(p.end.lat)!, lon: round6(p.end.lon)! },
    parks: p.clusters.map(c => ({ lat: round6(c.park.lat)!, lon: round6(c.park.lon)!, eta: c.eta, keys: c.stops.flatMap(s => (s.key ? [s.key] : [])) })),
  };
}

const sameOrder = (a: DayPlan, b: DayPlan) => JSON.stringify(a.parks.map(x => x.keys)) === JSON.stringify(b.parks.map(x => x.keys));

/**
 * Today's record with the tour folded in. Stops are merged by key: a stop removed from the tour, or a tour cleared
 * and scanned again, keeps what was already recorded; a stop delivered on another day (yesterday's tour, never
 * cleared) is not today's. A plan with a new order is added; the same order (its clock moved by the departure) replaces
 * the last one. null when there is nothing to record yet: no plan, so no keys and no order.
 */
export function mergeDay(prev: Day | null, tour: Tour, now: number): Day | null {
  const date = dayOf(now);
  const base: Day = prev?.date === date ? prev : { date, stops: [], plans: [] };
  if (!tour.plan) return prev?.date === date ? prev : null;

  const parkOf = new Map(tour.plan.clusters.flatMap((c, i) => c.stops.map(s => [s.key, i + 1] as const)));
  const stops = new Map(base.stops.map(s => [s.key, s]));
  tour.stops.forEach((s, i) => {
    if (!s.key || (s.done && s.doneAt && dayOf(s.doneAt) !== date)) return;
    stops.set(s.key, {
      key: s.key, list: i + 1, planned: parkOf.get(s.key), no: s.no,
      street: s.street, number: s.number, postcode: s.postcode, area: s.area, code: s.code, name: s.name,
      type: s.type, parcels: s.parcels, express: s.express || undefined,
      lat: round6(s.lat), lon: round6(s.lon), exact: s.exact, pinned: s.pinned,
      doneAt: s.done ? s.doneAt : undefined, donePos: s.done ? s.donePos : undefined,
    });
  });

  const plan = dayPlan(tour.plan, now), last = base.plans[base.plans.length - 1] as DayPlan | undefined;
  const plans = !last ? [plan] : sameOrder(last, plan) ? [...base.plans.slice(0, -1), { ...plan, at: last.at }] : [...base.plans, plan];
  return { date, stops: [...stops.values()], plans };
}
