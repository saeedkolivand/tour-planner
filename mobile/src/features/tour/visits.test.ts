/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type Fix, type Still, step, type Visit } from './visits.ts';

const run = (fixes: Fix[]) => {
  let still: Still | null = null, prev: Fix | null = null;
  const visits: Visit[] = [];
  for (const f of fixes) { const r = step(still, prev, f); still = r.still; prev = f; if (r.visit) visits.push(r.visit); }
  return visits;
};
const s = (sec: number) => sec * 1000;

test('a stop is the time between driving: walking to the doors stays in it, a red light is no stop', () => {
  const v = run([
    { t: s(0), lat: 50.94, lon: 6.95, speed: 10 },
    { t: s(30), lat: 50.941, lon: 6.95, speed: 0 }, // red light
    { t: s(60), lat: 50.942, lon: 6.95, speed: 9 },
    { t: s(100), lat: 50.943, lon: 6.95, speed: 0.5 }, // parked
    { t: s(160), lat: 50.9432, lon: 6.95, speed: 1.4 }, // walking to a door
    { t: s(400), lat: 50.943, lon: 6.95, speed: 1.2 }, // back to the van
    { t: s(460), lat: 50.944, lon: 6.95, speed: 8 }, // drives on
  ]);
  assert.deepEqual(v, [{ from: s(100), to: s(460), min: 6, lat: 50.943, lon: 6.95 }]);
});

test('no speed from the phone (-1): taken from the distance to the fix before', () => {
  const v = run([
    { t: s(0), lat: 50.94, lon: 6.95, speed: -1 },
    { t: s(10), lat: 50.94001, lon: 6.95, speed: -1 }, // 1 m in 10 s: standing
    { t: s(200), lat: 50.9410, lon: 6.95, speed: -1 }, // 110 m in 190 s: still under driving speed
    { t: s(210), lat: 50.9420, lon: 6.95, speed: -1 }, // 111 m in 10 s: driving
  ]);
  assert.equal(v.length, 1);
  assert.equal(v[0].from, s(0));
  assert.equal(v[0].to, s(210));
});
