/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { glide, halves, pointAt, TOTAL, vanPose } from './geometry.ts';

test('the road runs along the check: start, low point, end', () => {
  assert.deepEqual(pointAt(0), [580, 1060]);
  assert.deepEqual(pointAt(Math.hypot(320, 320)).map(Math.round), [900, 1380]);
  assert.deepEqual(pointAt(TOTAL).map(Math.round), [1500, 700]);
});

test('the van points down the first stroke, turns through the corner, and at the end keeps pointing up the road', () => {
  assert.equal(Math.round(vanPose(0.05).deg), 45);
  const mid = vanPose(Math.hypot(320, 320) / TOTAL).deg;
  assert.ok(mid < 45 && mid > -49, `half-way through the turn at the corner: ${mid}`);
  assert.equal(Math.round(vanPose(1).deg), Math.round((Math.atan2(-680, 600) * 180) / Math.PI), 'not horizontal at the end');
});

test('the pace: soft start and stop, even in between, never faster than 1.3x the average', () => {
  assert.equal(glide(0), 0);
  assert.ok(Math.abs(glide(1) - 1) < 1e-9);
  let top = 0;
  for (let i = 1; i <= 1000; i++) top = Math.max(top, (glide(i / 1000) - glide((i - 1) / 1000)) * 1000);
  assert.ok(top <= 1.31, `top speed ${top}`);
});

test('the seam goes through the check, edge to edge, and the halves cover the screen beyond it', () => {
  const { upper, lower, pivot } = halves({ x: 0, y: 0, w: 2048, h: 4432 });
  assert.deepEqual(pivot, [900, 1380]);
  assert.ok(upper.includes('580,1060 900,1380 1500,700'));
  assert.ok(lower.includes('580,1048 900,1368 1500,688'), 'the lower half overlaps the seam, no hairline between them');
});
