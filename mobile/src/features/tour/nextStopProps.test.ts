/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextStopProps, propsKey } from './nextStopProps.ts';
import type { Plan, Stop, Tour } from './types.ts';

const s = (key: string, no: number, extra: Partial<Stop> = {}): Stop =>
  ({ key, no, street: 'Ring', number: String(no), postcode: '50667', type: 'private', parcels: 1, ...extra });
const plan: Plan = {
  clusters: [
    { park: { lat: 0, lon: 0 }, stops: [s('a', 1)], service: 60, eta: 0 },
    { park: { lat: 0, lon: 0 }, stops: [s('b', 2, { type: 'business' }), s('c', 3, { express: '12:00' })], service: 60, eta: 30 },
  ],
  km: 1, min: 40, baseline: null, ungeocoded: [], start: { lat: 0, lon: 0 }, end: null, startedAt: Date.UTC(2026, 8, 27, 7, 0),
};

test('no route: nothing to show', () => {
  assert.equal(nextStopProps({ plan: null, stops: [], expected: '' }), null);
});

test('next open parking stop: walk-ups, Express from any of its stops, counts and ETA', () => {
  const tour: Tour = { plan, stops: [s('a', 1, { done: true }), s('b', 2, { type: 'business' }), s('c', 3, { express: '12:00' })], expected: '' };
  const p = nextStopProps(tour, plan.startedAt)!; // on time
  assert.equal(p.no, 2);
  assert.equal(p.address, 'Ring 2');
  assert.equal(p.postcode, '50667');
  assert.equal(p.walk, 1);
  assert.equal(p.express, '12:00');
  assert.equal(p.type, 'business');
  assert.equal(p.left, 1);
  assert.deepEqual([p.delivered, p.total], [1, 3]);
  assert.equal(p.etaMs, plan.startedAt + 30 * 60_000);
});

test('a stop without address never shows a blank line', () => {
  const empty: Plan = { ...plan, clusters: [{ park: { lat: 0, lon: 0 }, stops: [s('x', 8, { street: '', number: '' })], service: 60, eta: 0 }] };
  assert.equal(nextStopProps({ plan: empty, stops: [s('x', 8, { street: '', number: '' })], expected: '' })!.address, 'Address missing');
});

test('all delivered: a completed state, and its key differs from an open one', () => {
  const tour: Tour = { plan, stops: ['a', 'b', 'c'].map((k, i) => s(k, i + 1, { done: true })), expected: '' };
  const p = nextStopProps(tour)!;
  assert.equal(p.left, 0);
  assert.equal(p.delivered, 3);
  assert.notEqual(propsKey(p), propsKey(nextStopProps({ ...tour, stops: [s('a', 1)] })));
});
