// Mirrors the server's JSON (../../../../server.mjs). One tour is shared by the web app and this app.
export type StopType = 'private' | 'business' | 'pickup' | 'shop';
export type Express = '' | '08:30' | '10:00' | '12:00' | '14:00' | '18:00';
export type LatLon = { lat: number; lon: number };
/** A route start/end: coordinates, or an address the server geocodes. */
export type Place = LatLon | { q: string };

export interface Stop {
  street: string;
  number: string;
  postcode: string;
  city?: string;
  name?: string;
  type: StopType;
  express?: Express;
  parcels: number;
  note?: string;
  /** Set by the server; identifies the stop across photos and re-plans. */
  key?: string;
  /** Loading number, handed out once and never changed (it's written on the parcel). */
  no?: number;
  lat?: number;
  lon?: number;
  /** false = only the street was found, not the house. */
  exact?: boolean;
  /** the driver dragged the pin here: trusted over any geocoder */
  pinned?: boolean;
  done?: boolean;
  doneAt?: number;
  /** When a delivered stop was reopened: the server keeps whichever of doneAt/undoneAt is newer. */
  undoneAt?: number;
  /** Parcel numbers scanned for this stop: the next scan of the same parcel finds it at once. */
  parcelIds?: string[];
  /** Set by the PC when today's closures leave no road to it: deliver it on foot, it isn't in the route. */
  unreachable?: boolean;
  /** Paketshop opening hours, "09:00-20:00": the plan reaches it while it's open. */
  opens?: string;
  /** The letters the scanner prints after the postcode ("50670HY" -> "HY"); likely a small area of it. Kept to learn from. */
  area?: string;
  /** The scanner row's route code, "G 12 T 387" (meaning unknown). Kept to learn from. */
  code?: string;
  /** Its place in the order the driver set by hand (manualOrder.ts); a re-plan keeps that order. Absent = the planner's. */
  seq?: number;
  /** Where the phone was when this stop was marked delivered (one reading at the tap, metres of accuracy). */
  donePos?: LatLon & { acc?: number };
}

/** One parking spot: the first stop is where the van stops, the rest are walked to. */
export interface Cluster { park: LatLon; stops: Stop[]; service: number; eta: number }

export interface Plan {
  clusters: Cluster[];
  km: number;
  min: number;
  baseline: { km: number; min: number } | null;
  ungeocoded: Stop[];
  start: LatLon;
  end: LatLon | null;
  startedAt: number;
  /** Highest loading number handed out so far, so a deleted stop's number isn't reused. */
  lastNo?: number;
  /** Express stops (keys) that can't be reached by their deadline whatever the order: warn the driver. */
  late?: string[];
  /** Phone plans: why road times weren't used (e.g. the ORS key was rejected). */
  note?: string;
  /** Who planned it: the PC (road graph + roadworks), or the phone (road times from ORS, or an estimate). */
  by?: 'pc' | 'phone-road' | 'phone-estimate';
  /** 'scanned': the stops kept the scanner list's order (nothing re-ordered). Absent = the fastest order. */
  order?: StopOrder;
  /**
   * Planned with no departure time set: until the first Navigate or Delivered, ETAs count from now; then
   * `startedAt` becomes that moment and this flag goes (see store.depart).
   */
  pendingStart?: boolean;
  /** Whether the plan kept Express deadlines (the setting at planning time): `late` is recomputed the same way. */
  expressOnTime?: boolean;
}

/** 'fastest': the planner picks the order. 'scanned': the order of the scanner list, as photographed. */
export type StopOrder = 'fastest' | 'scanned';

/** How to plan: the driver's settings, sent to the PC or to the phone's own planner. */
export interface PlanOptions {
  /** When the tour leaves (ms); ETAs and deadlines count from it. Absent or past = now. */
  departAt?: number;
  expressOnTime?: boolean;
  /** Plan Express to arrive this many minutes before its deadline (a late arrival is still judged on the deadline). */
  expressMarginMin?: number;
  /** Every parking stop with an Express parcel comes before all the others. */
  expressFirst?: boolean;
  /** Metres walked from one parking spot (the route style). */
  walkM?: number;
  /** The van's course in degrees while moving (re-plan on the move). */
  heading?: number;
  order?: StopOrder;
  /**
   * Stop on the van's own side of a street and cross on foot, so a street with stops on both sides is driven once.
   * false = always arrive on the door's side (the right-hand kerb), which can mean driving a street twice.
   */
  bothSides?: boolean;
}

export type PlanRequest = { start: Place; end: Place | null; stops: Stop[]; lastNo?: number } & PlanOptions;

export interface Tour { stops: Stop[]; plan: Plan | null; expected: string }

export const STOP_TYPES: StopType[] = ['private', 'business', 'pickup', 'shop']; // labels: locales stopType.*
export const EMPTY_TOUR: Tour = { stops: [], plan: null, expected: '' };
export const newStop = (): Stop => ({ street: '', number: '', postcode: '', city: 'Köln', type: 'private', parcels: 1 });
