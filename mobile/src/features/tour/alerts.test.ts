/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arrivalText, expressReminders } from './alerts.ts';
import type { Stop } from './types.ts';

const s = (number: string, extra: Partial<Stop> = {}): Stop =>
  ({ key: number, street: 'Klingelpütz', number, postcode: '50670', type: 'private', parcels: 1, ...extra });
const at = (hh: number, mm: number) => new Date(2026, 9, 8, hh, mm).getTime();

test('Express reminders: 30 and 10 min before each open deadline, one per deadline, none gone by or delivered', () => {
  const stops = [s('33', { express: '12:00', prio: true, name: 'Ströppche' }), s('9', { express: '12:00' }), s('20', { express: '18:00', done: true }), s('1')];
  const r = expressReminders(stops, at(11, 40));
  assert.deepEqual(r.map(x => [x.id, x.at]), [['express-12:00-10', at(11, 50)]]);
  assert.equal(r[0].title, 'Express 12:00 · 10 min');
  assert.equal(r[0].body, 'Klingelpütz 33 · Ströppche\nKlingelpütz 9');
  assert.equal(expressReminders(stops, at(8, 0)).length, 2);
});

test('arrival: the address, then each stop with its name, PRIO and slot', () => {
  const c = { park: { lat: 0, lon: 0 }, service: 60, eta: 0, stops: [s('33', { name: 'Ströppche', prio: true, express: '12:00', slot: '08:22-10:22' }), s('35', { parcels: 3 })] };
  assert.deepEqual(arrivalText(c), { title: 'Klingelpütz 33 +1', body: 'Ströppche · PRIO · 08:22-10:22\nKlingelpütz 35 · 3x' });
});
