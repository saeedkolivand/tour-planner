/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coverage, duration, routeView } from './selectors.ts';
import type { Plan, Stop, Tour } from './types.ts';

const s = (key: string, done = false): Stop => ({ key, no: key.charCodeAt(0), street: key, number: '1', postcode: '', type: 'private', parcels: 1, done });
const plan = (groups: string[][]): Plan => ({
  clusters: groups.map((g, i) => ({ park: { lat: 0, lon: 0 }, stops: g.map(k => s(k)), service: 60, eta: i * 5 })),
  km: 10, min: 60, baseline: { km: 20, min: 90 }, ungeocoded: [], start: { lat: 0, lon: 0 }, end: null, startedAt: 0,
});

test('next stop is the first cluster not fully delivered; done flags come from tour.stops', () => {
  const tour: Tour = { plan: plan([['a'], ['b', 'c'], ['d']]), stops: [s('a', true), s('b', true), s('c'), s('d')], expected: '' };
  const v = routeView(tour)!;
  assert.equal(v.nextIndex, 1, 'b+c is next because c is still open');
  assert.deepEqual(v.upcoming.map(u => u.index), [2]);
  assert.deepEqual(v.completed.map(u => u.index), [0]);
  assert.equal(v.delivered, 2);
  assert.equal(v.total, 4);
  assert.equal(v.savedMin, 30);
});

test('all delivered: no next stop', () => {
  const v = routeView({ plan: plan([['a']]), stops: [s('a', true)], expected: '' })!;
  assert.equal(v.next, null);
  assert.equal(v.nextIndex, -1);
});

test('coverage against the scanner count', () => {
  const t = (n: number, expected: string): Tour => ({ plan: null, stops: Array.from({ length: n }, (_, i) => s(String(i))), expected });
  assert.equal(coverage(t(3, '')).status, 'unknown');
  assert.equal(coverage(t(3, '4')).status, 'missing');
  assert.equal(coverage(t(4, '4')).status, 'complete');
  assert.equal(coverage(t(5, '4')).ratio, 1);
});

test('durations read like a clock', () => {
  assert.equal(duration(45), '45m');
  assert.equal(duration(186), '3h 06m');
});

test('after a re-plan, progress still counts the stops delivered before it', () => {
  const plan = { clusters: [{ park: { lat: 0, lon: 0 }, stops: [s('c')], service: 60, eta: 0 }], km: 1, min: 1, baseline: null, ungeocoded: [], start: { lat: 0, lon: 0 }, end: null, startedAt: 0 };
  const v = routeView({ plan, stops: [s('a', true), s('b', true), s('c')], expected: '' })!;
  assert.deepEqual([v.delivered, v.total], [2, 3]);
});

test('running late moves every remaining ETA; on time or early changes nothing', () => {
  const plan = { clusters: [{ park: { lat: 0, lon: 0 }, stops: [s('a')], service: 60, eta: 10 }, { park: { lat: 0, lon: 0 }, stops: [s('b')], service: 60, eta: 30 }], km: 1, min: 1, baseline: null, ungeocoded: [], start: { lat: 0, lon: 0 }, end: null, startedAt: 0 };
  const tour = { plan, stops: [s('a'), s('b')], expected: '' };
  assert.equal(routeView(tour, 5 * 60_000)!.etaBase, 0, 'next stop due at 10 min, it is 5 min: on time');
  assert.equal(routeView(tour, 25 * 60_000)!.etaBase, 15 * 60_000, '15 min late for the next stop: everything shifts 15 min');
});
