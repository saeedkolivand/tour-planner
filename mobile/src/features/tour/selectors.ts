// Derived views of a tour, kept out of components so they're computed one way and unit-tested.
import type { Cluster, Plan, Stop, Tour } from './types.ts';

export const isDone = (s: Stop) => !!s.done;

/** The plan's clusters with each stop replaced by its live copy (done flags, dragged pins). */
export function liveClusters(plan: Plan, stops: Stop[]): Cluster[] {
  const byKey = new Map(stops.map(s => [s.key, s]));
  return plan.clusters.map(c => ({ ...c, stops: c.stops.map(s => byKey.get(s.key) ?? s) }));
}

export interface RouteView {
  next: Cluster | null;
  nextIndex: number;
  upcoming: { cluster: Cluster; index: number }[];
  completed: { cluster: Cluster; index: number }[];
  delivered: number;
  total: number;
  /** Minutes saved against the scanner's order; 0 when unknown or not better. */
  savedMin: number;
  /**
   * What ETAs count from: the plan's start, pushed back by however late the driver is for the next stop,
   * so a delay moves every remaining ETA instead of showing arrival times that already passed. Before a pending
   * plan sets off: now.
   */
  etaBase: number;
}

export function routeView(tour: Tour, now = Date.now()): RouteView | null {
  if (!tour.plan) return null;
  const clusters = liveClusters(tour.plan, tour.stops).map((cluster, index) => ({ cluster, index }));
  const open = clusters.filter(c => !c.cluster.stops.every(isDone));
  // counted over every numbered stop, not just this plan's: a re-plan only plans what's left, and progress
  // must not restart at 0 of 70 after stop 80
  const numbered = tour.stops.filter(s => s.no != null);
  return {
    next: open[0]?.cluster ?? null,
    nextIndex: open[0]?.index ?? -1,
    upcoming: open.slice(1),
    completed: clusters.filter(c => c.cluster.stops.every(isDone)),
    delivered: numbered.filter(isDone).length,
    total: numbered.length,
    // not set off yet (no departure time was given): the tour leaves no earlier than now
    etaBase: tour.plan.pendingStart ? Math.max(tour.plan.startedAt, now)
      : tour.plan.startedAt + Math.max(0, open[0] ? now - (tour.plan.startedAt + open[0].cluster.eta * 60_000) : 0),
    savedMin: tour.plan.baseline ? Math.max(0, Math.round(tour.plan.baseline.min - tour.plan.min)) : 0,
  };
}

/**
 * The parking stops (their keys) that arrive after a deadline when the tour leaves at `startedAt`: an Express time
 * (if the plan keeps them) or a Paketshop's closing time. A deadline already gone by then counts as missed.
 */
export function lateKeys(clusters: Cluster[], startedAt: number, expressOnTime = true): string[] {
  const today = (hhmm?: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
    return m ? new Date(startedAt).setHours(Number(m[1]), Number(m[2]), 0, 0) : null;
  };
  return clusters.filter(c => c.stops.some(s => [expressOnTime ? s.express : '', s.opens?.split('-')[1]].some(hhmm => {
    const due = today(hhmm);
    return due != null && startedAt + c.eta * 60_000 > due;
  }))).flatMap(c => c.stops.flatMap(s => (s.key ? [s.key] : [])));
}

/** How complete the capture is against the count the scanner shows. */
export function coverage(tour: Tour) {
  const want = Number(tour.expected) || 0;
  const have = tour.stops.length;
  return { have, want, ratio: want ? Math.min(1, have / want) : 0, status: !want ? 'unknown' : have === want ? 'complete' : have < want ? 'missing' : 'extra' } as const;
}

export const clock = (startedAt: number, etaMin: number) => new Date(startedAt + etaMin * 60_000).toTimeString().slice(0, 5);
export const duration = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m` : `${min}m`);
