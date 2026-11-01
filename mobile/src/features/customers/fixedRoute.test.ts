import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Stop } from '../tour/types.ts';
import { applyRoute, cheapestSlot, rankBetween, routeMatch, sameName, type RouteDeps } from './fixedRoute.ts';
import type { Customer } from './match.ts';

// made-up names and places (never real customers in fixtures), shaped like the supervisor's list and PHOENIX's rows
const pin = (rank: number, name: string, lat: number, lon: number): Customer => ({ name, street: '', number: '', postcode: '', note: '', photos: [], rank, lat, lon });
const route: Record<string, Customer> = {
  'route-1': pin(1, 'Linden Apotheke', 51.1000, 7.0000),
  'route-2': pin(2, 'Fillmann 15 Optik', 51.1100, 7.0000),
  'route-3': pin(3, 'Turm Apotheke', 51.1200, 7.0000),
  'route-4': pin(4, 'Am Turm Optik', 51.1300, 7.0000),
  'route-5': pin(5, 'Fillmann 1', 51.1400, 7.0000),
  'other': { name: 'Rosen-Apotheke', street: 'Hauptstr.', number: '3', postcode: '42651', note: 'key safe', photos: [] },
};
const row = (name: string, extra: Partial<Stop> = {}): Stop => ({ street: 'Teststr.', number: '1', postcode: '42651', city: 'Solingen', type: 'business', parcels: 1, name, ...extra });

test('names match through PHOENIX abbreviations and the supervisor\'s typing', () => {
  assert.ok(sameName('Fillmann 15 Optik', 'Fielmann AG & Co. OHG'));
  assert.ok(sameName('Avia Apotheke', 'Avie Apo am Blumentopf'));
  assert.ok(sameName('Mc pill', 'McPill'));
  assert.ok(sameName('Bergische Apotheke', 'Bergische Apo im Kaufland'));
  assert.ok(!sameName('Linden Apotheke', 'Rosen-Apotheke'));
  assert.ok(!sameName('Apotheke', 'Optik'));
});

test('a cut-off name with its street run in is read without the street', () => {
  // as on the 2026-10-31 scan: "Optik Lan" + "Neuer Markt 3"; "Markt" is the street, not the Markt-Apotheke
  assert.ok(sameName('Langenhof Optik', 'Optik Lan Neuer Markt 3', 'Neuer Markt'));
  assert.ok(!sameName('Markt Apotheke', 'Optik Lan Neuer Markt 3', 'Neuer Markt'));
  assert.ok(sameName('Sehwunder Optik', 'Sehwunde Bahnstr. 1A', 'Bahnstr.', true)); // sure enough to trust a far pin
  assert.ok(!sameName('Brillen Kunterbunt', 'Brillen R Kirchstr. 14-', 'Kirchstr.', true)); // "Brillen R…" is another
  assert.ok(sameName('Deutzer Apotheke', 'Deutzerhof-Apotheke', '', true));
});

test('a name two route stops share needs the position; a unique one does not', () => {
  assert.equal(routeMatch(route, row('Linden-Apotheke'))?.[0], 'route-1'); // not placed, unique name
  assert.equal(routeMatch(route, row('Fielmann')), undefined); // two Fielmanns, no position yet
  assert.equal(routeMatch(route, row('Fielmann', { lat: 51.1401, lon: 7.0002 }))?.[0], 'route-5');
  assert.equal(routeMatch(route, row('Turm-Apotheke', { lat: 51.1199, lon: 7.0 }))?.[0], 'route-3');
  // misread beyond recognition, but at the same door
  assert.equal(routeMatch(route, row('Tvrrn Apcthk', { lat: 51.12002, lon: 7.0 }))?.[0], 'route-3');
  assert.equal(routeMatch(route, row('Neue Apotheke', { lat: 51.125, lon: 7.0 })), undefined);
});

test('a learned address matches without name or position', () => {
  const learned = { ...route, 'route-2': { ...route['route-2'], street: 'Teststr.', number: '1', postcode: '42651' } };
  assert.equal(routeMatch(learned, row('Optiker'))?.[0], 'route-2');
});

test('a new stop is offered the slot with the least detour', () => {
  assert.equal(cheapestSlot(route, { lat: 51.125, lon: 7.0 }), 3.5);
  assert.equal(cheapestSlot(route, { lat: 51.09, lon: 7.0 }), 0);
  assert.equal(cheapestSlot(route, { lat: 51.16, lon: 7.0 }), 6);
});

test('tonight\'s stops come out in route order, on their pins; unknown ones are fresh', () => {
  const learnt: string[] = [];
  const deps: RouteDeps = {
    match: s => { const m = routeMatch(route, s); return m ? { id: m[0], lat: m[1].lat, lon: m[1].lon, rank: m[1].rank } : null; },
    slot: p => cheapestSlot(route, p),
    learn: id => learnt.push(id),
  };
  const placed = [
    row('Turm-Apotheke', { lat: 51.1199, lon: 7.0 }), row('Neue Apotheke', { lat: 51.125, lon: 7.0 }), row('Linden-Apotheke', { lat: 51.1003, lon: 7.0 }),
  ] as (Stop & { lat: number; lon: number })[];
  const r = applyRoute(placed, [row('Fillmann'), row('Nowhere')], deps);
  assert.deepEqual(r.placed.map(s => s.name), ['Linden-Apotheke', 'Turm-Apotheke', 'Neue Apotheke']);
  assert.deepEqual([r.placed[0].lat, r.placed[2].fresh], [51.1, true]); // the pin, not the geocoder's spot
  assert.deepEqual(r.ungeocoded.map(s => s.name), ['Fillmann', 'Nowhere']); // two Fielmanns: can't tell which
  assert.deepEqual(learnt, ['route-3', 'route-1']);
});

test('a new stop joins between its delivered neighbours', () => {
  const order = [{ rank: 2 }, { rank: 2.5, fresh: true }, { rank: 3 }] as Stop[];
  assert.equal(rankBetween(order, 1), 2.5);
  assert.equal(rankBetween([order[1], order[2]], 0), 2.5);
  assert.equal(rankBetween([order[0], order[1]], 1), 2.5);
});
