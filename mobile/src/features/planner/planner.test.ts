/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Stop } from '../tour/types.ts';
import { estimateMatrix, estimateSec, osrmMatrix, osrmOptions } from './matrix.ts';
import { parseStops } from './parseText.ts';
import { dueSec, planOnPhone } from './planOnPhone.ts';
import { solveOrder } from './solve.ts';
import { cluster, dedupe, meters } from './stops.ts';

const s = (street: string, number: string, extra: Partial<Stop> = {}): Stop => ({ street, number, postcode: '50667', type: 'private', parcels: 1, ...extra });

test('phone rules match the PC: Str./Straße merge, two towns stay apart, parcels not summed', () => {
  const d = dedupe([s('Hohe Str.', '1', { parcels: 2 }), s('Hohe Straße', '1', { parcels: 2 }), s('Kölner Str.', '12', { postcode: '50226' }), s('Kölner Str.', '12', { postcode: '50354' })]);
  assert.equal(d.length, 3);
  assert.equal(d[0].parcels, 2);
  assert.equal(d[0].key, 'hohestr|1|50667');
});

test('neighbours within 80 m share a parking stop', () => {
  const at = (lat: number, x: Stop) => ({ ...x, lat, lon: 6.95 });
  const c = cluster([at(50.94, s('A', '1')), at(50.9403, s('A', '3')), at(50.95, s('B', '1'))]);
  assert.equal(c.length, 2);
  assert.equal(c[0].stops.length, 2);
  assert.ok(Math.abs(meters({ lat: 50, lon: 7 }, { lat: 50.001, lon: 7 }) - 111) < 1);
});

test('door to door: a 25 m radius keeps those neighbours on separate parking stops', () => {
  const at = (lat: number, x: Stop) => ({ ...x, lat, lon: 6.95 });
  assert.equal(cluster([at(50.94, s('A', '1')), at(50.9403, s('A', '3'))], 25).length, 2);
});

test('solver: points on a line are visited in order, and a fixed end stays last', () => {
  // start 0 at x=0, jobs at x = 5, 1, 3, 2, 4 (shuffled): the best order walks outward
  const xs = [0, 5, 1, 3, 2, 4];
  const m = xs.map(a => xs.map(b => Math.abs(a - b)));
  assert.deepEqual(solveOrder(m).map(i => xs[i]), [1, 2, 3, 4, 5]);
  // with an end point back at 0 the tour still sweeps once out and back
  const withEnd = [...xs, 0], m2 = withEnd.map(a => withEnd.map(b => Math.abs(a - b)));
  const order = solveOrder(m2, withEnd.length - 1);
  assert.equal(order.length, 5);
  assert.ok(!order.includes(withEnd.length - 1));
});

test('solver: 150 random stops are solved fast and beat nearest-neighbour alone', () => {
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pts = Array.from({ length: 151 }, () => [rnd() * 3000, rnd() * 3000]);
  const m = pts.map(a => pts.map(b => Math.hypot(a[0] - b[0], a[1] - b[1])));
  const t0 = Date.now();
  const order = solveOrder(m);
  const ms = Date.now() - t0;
  assert.equal(new Set(order).size, 150);
  const len = (r: number[]) => [0, ...r].reduce((t, p, i, a) => t + (i ? m[a[i - 1]][p] : 0), 0);
  const nn: number[] = []; const left = new Set(order); let at = 0;
  while (left.size) { const b = [...left].reduce((x, y) => (m[at][y] < m[at][x] ? y : x)); nn.push(b); left.delete(b); at = b; }
  assert.ok(len(order) < len(nn) * 0.95, `local search improves on NN (${Math.round(len(order))} vs ${Math.round(len(nn))})`);
  assert.ok(ms < 8000, `took ${ms} ms`);
  console.log(`  150 stops: ${ms} ms, ${Math.round(100 - (100 * len(order)) / len(nn))}% shorter than nearest-neighbour`);
});

test('scanner-list text read on the phone becomes stops without the PC', () => {
  const text = [
    'Tour 150X  Stopp 12', 'Hohe Str. 68', '50667 Köln', 'EXPRESS 12:00',
    'Müller GmbH', 'Konrad-Adenauer-Ufer 3-5', '50668 Köln', '3 Pakete',
    'Venloer Straße 211, 50823 Köln', 'An der Linde 12 a', '50999 Köln', 'DPD Pickup Paketshop',
  ].join('\n');
  const s = parseStops(text);
  assert.deepEqual(s.map(x => `${x.street} ${x.number} ${x.postcode}`), ['Hohe Str. 68 50667', 'Konrad-Adenauer-Ufer 3-5 50668', 'Venloer Straße 211 50823', 'An der Linde 12a 50999']);
  assert.equal(s[0].express, '12:00');
  assert.deepEqual([s[1].type, s[1].parcels, s[1].name], ['business', 3, 'Müller GmbH']); // the name line sits above its street
  assert.equal(s[3].type, 'shop');
});

test('the DPD scanner layout: name + PRIO + count above the street, "50670HX", route code and time slot below', () => {
  const text = [
    'Zustellung | T526 | 29. Sept', 'Nächste Stopps',
    'Gina Klein', '1', '09:11', '11:11', 'Steinfelder Gasse 27', '50670HY Köln', 'G 12 T 387',
    'Katholische junge Gemeinde…', 'PRIO', '1', 'Steinfelder Gasse 20-22', '50670HY Köln, Altstadt-Nord', '09:15', '11:15',
    'netspirits GmbH & Co. KG', '1', 'Im Klapperhof 33', '50670ID Köln', '09:19', '11:19',
    'Thomas Voß', '2', 'Gereonshof 16', '50670HZ Köln',
    'Kita Remmidemmi e.V.,', 'PRIO', '2', 'Gereonsm…engasse 26', '50670HL Köln', '10:35', '12:35',
    '3 PQ GmbH', '11:00-19:00', '7', 'Balthasarstr. 65', '50670II Köln, Neustadt-Nord',
    'Santesson GmbHComputer u…', '1', 'Gereonsmühlengasse 2', '50670HL Köln, Altstadt-Nord',
  ].join('\n');
  const s = parseStops(text);
  assert.deepEqual(s.map(x => `${x.street} ${x.number}`), ['Steinfelder Gasse 27', 'Steinfelder Gasse 20-22', 'Im Klapperhof 33', 'Gereonshof 16', 'Gereonsmühlengasse 26', 'Balthasarstr. 65', 'Gereonsmühlengasse 2']);
  assert.ok(s.every(x => x.postcode === '50670'), 'the two letters after the postcode are not part of it');
  assert.deepEqual(s.map(x => x.express ?? ''), ['', '12:00', '', '', '12:00', '', ''], 'PRIO only; the time slot is no deadline');
  assert.deepEqual(s.map(x => x.parcels), [1, 1, 1, 2, 2, 7, 1]);
  assert.deepEqual(s.map(x => x.name), ['Gina Klein', 'Katholische junge Gemeinde…', 'netspirits GmbH & Co. KG', 'Thomas Voß', 'Kita Remmidemmi e.V.,', '3 PQ GmbH', 'Santesson GmbHComputer u…']);
  assert.deepEqual(s.map(x => x.type), ['private', 'business', 'business', 'private', 'business', 'business', 'business']);
  assert.equal(s[1].city, 'Köln');
});

test('plan on the phone: grouped, ordered, numbered once, and compared with the scanner order', async () => {
  const pos: Record<string, { lat: number; lon: number }> = {
    'Depot, Köln': { lat: 50.94, lon: 6.90 },
    'A 1, 50667 Köln': { lat: 50.94, lon: 6.95 }, 'A 3, 50667 Köln': { lat: 50.9401, lon: 6.9501 },
    'B 1, 50667 Köln': { lat: 50.94, lon: 6.92 }, 'C 1, 50667 Köln': { lat: 50.94, lon: 6.98 },
  };
  const deps = { geocode: async (q: string) => pos[q] ?? null, matrix: async (p: { lat: number; lon: number }[]) => estimateMatrix(p), t: (k: string) => k };
  const stops = [s('C', '1'), s('A', '1'), s('Nowhere', '9'), s('B', '1'), s('A', '3'), s('', '')];
  const p = await planOnPhone({ start: { q: 'Depot' }, end: null, stops, lastNo: 4 }, deps);
  assert.deepEqual(p.clusters.map(c => c.stops.map(x => x.street).join('+')), ['B', 'A+A', 'C'], 'west to east from the depot, A 1 and A 3 walked');
  assert.deepEqual(p.clusters.flatMap(c => c.stops.map(x => x.no)), [5, 6, 7, 8], 'numbers continue after the last one handed out');
  assert.equal(p.ungeocoded.length, 2);
  assert.ok(p.baseline!.min > p.min, 'beats the scanner order C, A, B');
  assert.equal(p.by, 'phone-estimate');
});

test('Express: a deadline pulls its stop forward when the fastest order would be late', () => {
  // start at 0, A at x=-1, B at x=+3 (60 s per unit). Fastest: A then B, B reached at 300 s. B is due at 200 s:
  // B first (reached at 180 s) costs 2 min more driving but keeps the deadline.
  const xs = [0, -1, 3], m = xs.map(a => xs.map(b => Math.abs(a - b) * 60));
  assert.deepEqual(solveOrder(m).map(i => xs[i]), [-1, 3], 'fastest');
  assert.deepEqual(solveOrder(m, undefined, { service: [0, 0, 0], due: [null, null, 200] }).map(i => xs[i]), [3, -1], 'Express first');
});

test('dueSec: deadlines count from departure; a passed one is not a constraint', () => {
  const at8 = new Date(2026, 8, 28, 8, 0).getTime();
  assert.equal(dueSec('10:00', at8), 7200);
  assert.equal(dueSec('07:30', at8), null);
});

test('plan on the phone: an address found in another town (not near its postcode) is not trusted', async () => {
  const pos: Record<string, { lat: number; lon: number }> = {
    'Depot, Köln': { lat: 50.94, lon: 6.90 }, '50670 Köln': { lat: 50.95, lon: 6.955 },
    'Ring 1, 50670 Köln': { lat: 50.951, lon: 6.956 }, 'Agnesstraße 69, 50670 Köln': { lat: 50.813, lon: 7.135 },
  };
  const deps = { geocode: async (q: string) => pos[q] ?? null, matrix: async (p: { lat: number; lon: number }[]) => estimateMatrix(p), t: (k: string) => k };
  const p = await planOnPhone({ start: { q: 'Depot' }, end: null, stops: [s('Ring', '1', { postcode: '50670' }), s('Agnesstraße', '69', { postcode: '50670' })] }, deps);
  assert.deepEqual(p.ungeocoded.map(x => x.street), ['Agnesstraße']);
});

test('plan on the phone: a street-only hit (exact: false) parks alone, even next door to an exact one', async () => {
  const pos: Record<string, { lat: number; lon: number; exact?: boolean }> = {
    'Depot, Köln': { lat: 50.94, lon: 6.90 },
    'A 1, 50667 Köln': { lat: 50.94, lon: 6.95, exact: true }, 'A 3, 50667 Köln': { lat: 50.9401, lon: 6.9501, exact: false },
  };
  const deps = { geocode: async (q: string) => pos[q] ?? null, matrix: async (p: { lat: number; lon: number }[]) => estimateMatrix(p), t: (k: string) => k };
  const p = await planOnPhone({ start: { q: 'Depot' }, end: null, stops: [s('A', '1'), s('A', '3')] }, deps);
  assert.equal(p.stops.find(x => x.number === '3')?.exact, false);
  assert.equal(p.clusters.length, 2, 'the street-only stop does not walk with its exact neighbour');
});

test('public OSRM: kerb side at every stop, the course at the start; a bad course is retried without; cells with no road are estimated', async () => {
  assert.equal(osrmOptions(4, { hasEnd: true }), '&approaches=unrestricted;curb;curb;unrestricted');
  assert.equal(osrmOptions(3, { heading: 270.4 }), '&approaches=unrestricted;curb;curb&bearings=270,90;;');
  const urls: string[] = [];
  const fetchFn = (async (url: string) => {
    urls.push(url);
    const ok = !url.includes('bearings');
    return { ok: true, json: async () => (ok ? { code: 'Ok', durations: [[0, 100], [null, 0]], distances: [[0, 500], [null, 0]] } : { code: 'NoSegment' }) };
  }) as unknown as typeof fetch;
  const pts = [{ lat: 50.94, lon: 6.96 }, { lat: 50.95, lon: 6.96 }];
  const m = await osrmMatrix(pts, { heading: 90 }, fetchFn);
  assert.equal(urls.length, 2, 'once with the course, once without');
  assert.equal(m.by, 'road');
  assert.equal(m.seconds[0][1], 130, 'city factor applied');
  assert.ok(m.seconds[1][0] > 0 && m.meters[1][0] > 1000, 'no road -> estimate');
  await assert.rejects(osrmMatrix(Array(101).fill(pts[0]), {}, fetchFn), /more than 100/);
});

test('distance estimate: town legs at city pace, the depot run much faster per km', () => {
  assert.equal(estimateSec(0), 0);
  assert.ok(Math.abs(estimateSec(1000) - 400) < 60);   // OSRM: ~1 km straight ≈ 7-8 min
  assert.ok(Math.abs(estimateSec(20000) - 2600) < 400); // Erftstadt -> Köln-Nord ≈ 40-45 min
});

test('plan on the phone: a wrong position kept from an earlier plan is looked up again; a pinned one is kept', async () => {
  const pos: Record<string, { lat: number; lon: number }> = {
    'Depot, Köln': { lat: 50.94, lon: 6.90 }, '50670 Köln': { lat: 50.95, lon: 6.955 },
    'Agnesstraße 69, 50670 Köln': { lat: 50.952, lon: 6.953 },
  };
  const deps = { geocode: async (q: string) => pos[q] ?? null, matrix: async (p: { lat: number; lon: number }[]) => estimateMatrix(p), t: (k: string) => k };
  const far = { lat: 50.813, lon: 7.135 };
  const p = await planOnPhone({ start: { q: 'Depot' }, end: null, stops: [
    s('Agnesstraße', '69', { postcode: '50670', ...far }), s('Ring', '1', { postcode: '50670', ...far, pinned: true }),
  ] }, deps);
  assert.deepEqual(p.stops.find(x => x.street === 'Agnesstraße')?.lat, 50.952);
  assert.deepEqual(p.stops.find(x => x.street === 'Ring')?.lat, far.lat);
});

test('plan on the phone: the geocoder wins over a stored in-area position; a pinned one keeps its stored position', async () => {
  const pos: Record<string, { lat: number; lon: number }> = {
    'Depot, Köln': { lat: 50.94, lon: 6.90 }, '50670 Köln': { lat: 50.95, lon: 6.955 },
    'Ring 1, 50670 Köln': { lat: 50.949, lon: 6.950 },
  };
  const deps = { geocode: async (q: string) => pos[q] ?? null, matrix: async (p: { lat: number; lon: number }[]) => estimateMatrix(p), t: (k: string) => k };
  const stored = { lat: 50.951, lon: 6.956 };
  const p = await planOnPhone({ start: { q: 'Depot' }, end: null, stops: [
    s('Ring', '1', { postcode: '50670', ...stored }), s('Ring', '2', { postcode: '50670', ...stored, pinned: true }),
  ] }, deps);
  const geocoded = p.stops.find(x => x.number === '1');
  assert.deepEqual({ lat: geocoded?.lat, lon: geocoded?.lon }, pos['Ring 1, 50670 Köln'], 'geocoder answer wins over the stored position');
  const pinned = p.stops.find(x => x.number === '2');
  assert.deepEqual({ lat: pinned?.lat, lon: pinned?.lon }, stored, 'pinned stop keeps its stored position');
});

test('plan on the phone: geocoder rejecting a stop drops its stored position; a pinned one keeps it', async () => {
  const pos: Record<string, { lat: number; lon: number }> = { 'Depot, Köln': { lat: 50.94, lon: 6.90 } };
  const deps = { geocode: async (q: string) => pos[q] ?? null, matrix: async (p: { lat: number; lon: number }[]) => estimateMatrix(p), t: (k: string) => k };
  const stored = { lat: 50.951, lon: 6.956 };
  const p = await planOnPhone({ start: { q: 'Depot' }, end: null, stops: [
    s('Ring', '1', { postcode: '50670', ...stored }), s('Ring', '2', { postcode: '50670', ...stored, pinned: true }),
  ] }, deps);
  const rejected = p.stops.find(x => x.number === '1');
  assert.equal(rejected?.lat, undefined);
  assert.ok(p.ungeocoded.some(x => x.number === '1'), 'rejected stop ends up ungeocoded');
  const pinned = p.stops.find(x => x.number === '2');
  assert.deepEqual({ lat: pinned?.lat, lon: pinned?.lon }, stored, 'pinned stop stays placed');
});
