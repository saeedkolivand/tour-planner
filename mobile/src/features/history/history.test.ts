/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Plan, Stop, Tour } from '../tour/types.ts';
import { dayOf, mergeDay } from './history.ts';

const at = (h: number, m = 0, day = 5) => new Date(2026, 9, day, h, m).getTime();
const stop = (key: string, extra: Partial<Stop> = {}): Stop => ({ key, street: key, number: '1', postcode: '50670', type: 'private', parcels: 1, lat: 50.9, lon: 6.9, ...extra });
const plan = (...parks: string[][]): Plan => ({
  clusters: parks.map((keys, i) => ({ park: { lat: 50.9 + i / 1000, lon: 6.9 }, stops: keys.map(k => stop(k)), service: 60, eta: 10 * (i + 1) })),
  km: 12.345, min: 95.4, baseline: null, ungeocoded: [], start: { lat: 50.95, lon: 6.95 }, end: null, startedAt: at(8), by: 'phone-road',
});

test('nothing to record before the first plan', () => {
  assert.equal(mergeDay(null, { stops: [stop('a')], plan: null, expected: '' }, at(7)), null);
});

test('a day keeps each stop with its scanner place, planned parking stop, delivery time and position', () => {
  const tour: Tour = {
    stops: [stop('a', { area: 'HY', code: 'G 12 T 387', no: 1 }), stop('b', { no: 2, done: true, doneAt: at(9, 5), donePos: { lat: 50.91, lon: 6.91, acc: 6 } }), stop('c', { no: 3 })],
    plan: plan(['b'], ['a', 'c']), expected: '',
  };
  const d = mergeDay(null, tour, at(9, 6))!;
  assert.equal(d.date, '2026-10-05');
  assert.deepEqual(d.stops.map(s => [s.key, s.list, s.planned, s.area ?? '', s.code ?? '']), [['a', 1, 2, 'HY', 'G 12 T 387'], ['b', 2, 1, '', ''], ['c', 3, 2, '', '']]);
  assert.deepEqual(d.stops[1].donePos, { lat: 50.91, lon: 6.91, acc: 6 });
  assert.equal(d.stops[1].doneAt, at(9, 5));
  assert.equal(d.plans.length, 1);
  assert.deepEqual(d.plans[0].parks.map(p => p.keys), [['b'], ['a', 'c']]);
  assert.equal(d.plans[0].km, 12.3);
});

test('the departure moving the clock updates the plan; a new order is added as a second plan', () => {
  const p = plan(['a'], ['b']);
  const d1 = mergeDay(null, { stops: [stop('a'), stop('b')], plan: p, expected: '' }, at(7))!;
  const d2 = mergeDay(d1, { stops: [stop('a'), stop('b')], plan: { ...p, startedAt: at(8, 20) }, expected: '' }, at(8, 20))!;
  assert.equal(d2.plans.length, 1);
  assert.equal(d2.plans[0].startedAt, at(8, 20));
  assert.equal(d2.plans[0].at, at(7), 'first seen stays');
  const d3 = mergeDay(d2, { stops: [stop('a'), stop('b')], plan: plan(['b'], ['a']), expected: '' }, at(11))!;
  assert.equal(d3.plans.length, 2);
});

test('a cleared and re-scanned tour keeps the stops recorded earlier that day', () => {
  const d1 = mergeDay(null, { stops: [stop('a', { done: true, doneAt: at(9) })], plan: plan(['a']), expected: '' }, at(9))!;
  const d2 = mergeDay(d1, { stops: [stop('x')], plan: plan(['x']), expected: '' }, at(13))!;
  assert.deepEqual(d2.stops.map(s => s.key), ['a', 'x']);
  assert.equal(d2.stops[0].doneAt, at(9));
  // cleared, not planned yet: the day stays as it was
  assert.equal(mergeDay(d2, { stops: [], plan: null, expected: '' }, at(14)), d2);
});

test("yesterday's tour never cleared: its delivered stops are not today's, the open ones are", () => {
  const tour: Tour = { stops: [stop('old', { done: true, doneAt: at(16, 0, 4) }), stop('open')], plan: plan(['open']), expected: '' };
  const yesterday = mergeDay(null, tour, at(16, 0, 4))!;
  const today = mergeDay(yesterday, tour, at(8))!;
  assert.equal(today.date, '2026-10-05');
  assert.deepEqual(today.stops.map(s => s.key), ['open']);
  assert.equal(dayOf(at(23, 59, 4)), '2026-10-04');
});

test('a reopened stop loses its delivery time and position', () => {
  const done = mergeDay(null, { stops: [stop('a', { done: true, doneAt: at(9), donePos: { lat: 1, lon: 1 } })], plan: plan(['a']), expected: '' }, at(9))!;
  const reopened = mergeDay(done, { stops: [stop('a', { done: false, undoneAt: at(9, 1) })], plan: plan(['a']), expected: '' }, at(9, 1))!;
  assert.equal(reopened.stops[0].doneAt, undefined);
  assert.equal(reopened.stops[0].donePos, undefined);
});
