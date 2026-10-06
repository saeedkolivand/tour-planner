/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { keepOrder, moveCluster, seqOf } from './manualOrder.ts';
import type { Cluster, Plan } from './types.ts';

// parking stops on a line east of the start, ~700 m apart; every leg 5 min in the plan, 1 min at each stop
const c = (key: string, lon: number, eta: number, express?: '12:00'): Cluster =>
  ({ park: { lat: 50.94, lon }, stops: [{ key, street: key, number: '1', postcode: '50670', type: 'private', parcels: 1, ...(express && { express }) }], service: 60, eta });
const plan = (): Plan => ({
  clusters: [c('a', 6.91, 5), c('b', 6.92, 11), c('c', 6.93, 17)], km: 6, min: 18, baseline: null, ungeocoded: [],
  start: { lat: 50.94, lon: 6.90 }, end: null, startedAt: new Date('2026-10-06T08:00').getTime(),
});

test('a parking stop moved by hand: legs that stay neighbours keep their times, the new ones are estimated, the rest follows', () => {
  const p = moveCluster(plan(), 2, 0);
  assert.deepEqual(p.clusters.map(x => x.stops[0].key), ['c', 'a', 'b']);
  assert.equal(p.clusters[2].eta - p.clusters[1].eta, 6, 'a -> b kept: 1 min there + 5 min driving');
  assert.ok(p.clusters[0].eta > 5, 'the far one first now takes longer to reach');
  assert.ok(p.km > 6 && p.min > 18, 'going back and forth costs more');
  assert.deepEqual([...seqOf(p)], [['c', 0], ['a', 1], ['b', 2]]);
});

test('an Express moved after its deadline is flagged late', () => {
  const p0 = plan();
  p0.clusters[0] = c('a', 6.91, 5, '12:00');
  p0.startedAt = new Date('2026-10-06T11:50').getTime();
  assert.deepEqual(moveCluster(p0, 0, 2).late, ['a']);
});

test('a re-plan keeps the driver\'s order and fits a new parking stop in where it costs least', () => {
  const fresh = plan(); // the planner's order a, b, c, plus a new stop between a and b
  fresh.clusters.splice(1, 0, c('new', 6.915, 8));
  const kept = keepOrder(fresh, new Map([['c', 0], ['b', 1], ['a', 2]]))!;
  assert.deepEqual(kept.clusters.map(x => x.stops[0].key), ['c', 'b', 'new', 'a']);
  assert.equal(keepOrder(fresh, new Map()), null, 'nothing placed by hand: the planner\'s order');
});
