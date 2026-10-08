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
  /** When the phone came within ~100 m of its parking stop (arrival details on): splits a stop's time into getting
   *  there and at the door. */
  arrivedAt?: number;
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
/** Arrival times by stop key: the day's first arrival at each stop, earlier days dropped. */
export type Arrivals = Record<string, number>;
export function withArrival(prev: Arrivals, keys: string[], at: number): Arrivals {
  const today = Object.fromEntries(Object.entries(prev).filter(([, t]) => dayOf(t) === dayOf(at)));
  for (const k of keys) today[k] ??= at;
  return today;
}

export function mergeDay(prev: Day | null, tour: Tour, now: number, arrivals: Arrivals = {}): Day | null {
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
      arrivedAt: arrivals[s.key] != null && dayOf(arrivals[s.key]) === date ? arrivals[s.key] : stops.get(s.key)?.arrivedAt,
    });
  });

  const plan = dayPlan(tour.plan, now), last = base.plans[base.plans.length - 1] as DayPlan | undefined;
  const plans = !last ? [plan] : sameOrder(last, plan) ? [...base.plans.slice(0, -1), { ...plan, at: last.at }] : [...base.plans, plan];
  return { date, stops: [...stops.values()], plans };
}

/** A delivered stop with its time: minutes since the Delivered tap before it (the drive or walk there included, the
 *  first stop has none), and how much later (+) or earlier (-) than the plan it was delivered. */
export interface StopTime {
  stop: DayStop; gapMin?: number; vsPlanMin?: number;
  /** With an arrival time: the gap split into getting there (drive, park) and at the stop (walk, door, scanner). */
  driveMin?: number; atStopMin?: number;
}

const minutes = (ms: number) => Math.round(ms / 6_000) / 10;

/** The day's delivered stops in the order they were delivered, each with its time. */
export function stopTimes(day: Day): StopTime[] {
  const done = day.stops.filter(s => s.doneAt).sort((a, b) => a.doneAt! - b.doneAt!);
  return done.map((stop, i) => {
    // the plan the driver was following then: the last one made before the tap that has this stop
    const has = (p: DayPlan) => p.parks.some(k => k.keys.includes(stop.key));
    const plan = day.plans.filter(p => p.at <= stop.doneAt! && has(p)).pop() ?? day.plans.find(has);
    const park = plan?.parks.find(k => k.keys.includes(stop.key));
    return {
      stop,
      ...(i > 0 && { gapMin: minutes(stop.doneAt! - done[i - 1].doneAt!) }),
      ...(i > 0 && stop.arrivedAt != null && stop.arrivedAt <= stop.doneAt! && {
        // a walk-up shares its parking stop's arrival: all of its time is at the stop
        driveMin: minutes(Math.max(0, stop.arrivedAt - done[i - 1].doneAt!)),
        atStopMin: minutes(stop.doneAt! - Math.max(stop.arrivedAt, done[i - 1].doneAt!)),
      }),
      ...(plan && park && { vsPlanMin: Math.round((stop.doneAt! - (plan.startedAt + park.eta * 60_000)) / 60_000) }),
    };
  });
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : undefined; };
const mean = (xs: number[]) => (xs.length ? minutes(xs.reduce((a, b) => a + b, 0) * 60_000 / xs.length) : undefined);

/** What a day came to: shown when the tour is done and in Past deliveries. */
export interface DaySummary {
  date: string;
  stops: number;
  delivered: number;
  parcels: number;
  /** First and last Delivered tap. */
  first?: number;
  last?: number;
  express: number;
  /** Express stops delivered after their deadline, or not at all. */
  expressMissed: DayStop[];
  /** The day's last plan. */
  km?: number;
  plannedMin?: number;
  /** Minutes from one Delivered tap to the next: mean and median (a parking stop's walk-ups count as quick ones). */
  avgMin?: number;
  medianMin?: number;
  stopsPerHour?: number;
  parcelsPerHour?: number;
  /** Mean minutes per stop by its type (the gap before it). */
  byType: Partial<Record<DayStop['type'], number>>;
  /** The last delivery against its planned time: + later, - earlier. */
  vsPlanMin?: number;
  /** Mean minutes getting to a stop and at it, over the stops with an arrival time. */
  driveMin?: number;
  atStopMin?: number;
}

export function summarize(day: Day): DaySummary {
  const done = day.stops.filter(s => s.doneAt);
  const times = done.map(s => s.doneAt!);
  const due = (s: DayStop) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(s.express ?? '');
    return m && s.doneAt ? new Date(s.doneAt).setHours(Number(m[1]), Number(m[2]), 0, 0) : null;
  };
  const express = day.stops.filter(s => s.express);
  const plan = day.plans[day.plans.length - 1] as DayPlan | undefined;
  return {
    date: day.date, stops: day.stops.length, delivered: done.length, parcels: done.reduce((n, s) => n + (s.parcels || 1), 0),
    ...(times.length && { first: Math.min(...times), last: Math.max(...times) }),
    express: express.length, expressMissed: express.filter(s => !s.doneAt || s.doneAt > due(s)!),
    km: plan?.km, plannedMin: plan?.min,
    ...timing(day, done.length),
  };
}

function timing(day: Day, delivered: number) {
  const times = stopTimes(day), gaps = times.flatMap(x => (x.gapMin != null ? [x.gapMin] : []));
  const hours = times.length > 1 ? (times[times.length - 1].stop.doneAt! - times[0].stop.doneAt!) / 3_600_000 : 0;
  const types = [...new Set(times.map(x => x.stop.type))];
  return {
    avgMin: mean(gaps), medianMin: median(gaps),
    ...(hours > 0 && { stopsPerHour: Math.round(delivered / hours * 10) / 10, parcelsPerHour: Math.round(times.reduce((n, x) => n + (x.stop.parcels || 1), 0) / hours * 10) / 10 }),
    byType: Object.fromEntries(types.map(type => [type, mean(times.filter(x => x.stop.type === type && x.gapMin != null).map(x => x.gapMin!))]).filter(([, v]) => v != null)),
    vsPlanMin: times[times.length - 1]?.vsPlanMin,
    driveMin: mean(times.flatMap(x => (x.driveMin != null ? [x.driveMin] : []))),
    atStopMin: mean(times.flatMap(x => (x.atStopMin != null ? [x.atStopMin] : []))),
  };
}
