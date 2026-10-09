// The route demo's planner: the phone app's own code (park-and-walk groups, street mates, the order search), with
// the straight-line road times the app uses offline. Express deadlines need a departure time, so only
// "Express first" is offered here.
import { estimateMatrix } from '@app/features/planner/matrix';
import { solveOrderAsync } from '@app/features/planner/solve';
import { cluster, streetMates } from '@app/features/planner/stops';
import type { Cluster, LatLon, Stop } from '@app/features/tour/types';
import sample from './sample.json';

export type DemoStop = Stop & LatLon;
export type Group = Omit<Cluster, 'eta'>;
export const SAMPLE = sample as DemoStop[];
export const START: LatLon = { lat: 50.9497, lon: 6.9576 }; // Ebertplatz
export const WALK_M = { walk: 80, door: 25 }; // the app's walking radius per route style (settings.ts)

const drive = (m: number[][], p: number[]) => p.slice(1).reduce((t, j, k) => t + m[p[k]][j], 0);

/** Minutes of driving the stops in list order, door to door: what the scanner's order costs. */
export function scannerMin(stops: DemoStop[]) {
  const m = estimateMatrix([START, ...stops]).seconds;
  return drive(m, [0, ...stops.map((_, i) => i + 1)]) / 60;
}

/** Parking stops in the planned order and their minutes of driving. */
export async function plan(stops: DemoStop[], walkM: number, expressFirst: boolean, budgetMs = 1200) {
  const groups = cluster(stops, walkM);
  const m = estimateMatrix([START, ...groups.map(g => g.park)]).seconds;
  const rank = expressFirst ? [0, ...groups.map(g => (g.stops.some(s => s.express) ? 0 : 1))] : [];
  const mates = [[], ...streetMates(groups).map(ms => ms.map(j => j + 1))];
  const order = await solveOrderAsync(m, undefined, { service: [0, ...groups.map(g => g.service)], rank, mates, budgetMs });
  return { groups: order.map(i => groups[i - 1]) as Group[], min: drive(m, [0, ...order]) / 60 };
}
