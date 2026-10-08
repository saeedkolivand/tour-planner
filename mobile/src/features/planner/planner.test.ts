/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Stop } from '../tour/types.ts';
import { estimateMatrix, estimateSec, osrmMatrix, osrmOptions } from './matrix.ts';
import { columnTags, parseStops } from './parseText.ts';
import { rowOrder } from './rowOrder.ts';
import { dueSec, planOnPhone } from './planOnPhone.ts';
import { alike, locate, nearbyNumbers, snapStreet, type Hit } from './locate.ts';
import { descents, revisits, solveOrder } from './solve.ts';
import { vroomOrder } from './vroom.ts';
import { chain, cluster, dedupe, meters, streetMates } from './stops.ts';

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
  // kept for the tour history: the letters after the postcode and the route code under it
  assert.deepEqual(s.map(x => x.area), ['HY', 'HY', 'ID', 'HZ', 'HL', 'II', 'HL']);
  assert.deepEqual(s.map(x => x.code ?? ''), ['G 12 T 387', '', '', '', '', '', '']);
});

test('no letters after the postcode, no area; a route code OCR read without spaces is spaced like the scanner', () => {
  const s = parseStops(['Hohe Str. 68', '50667 Köln', 'G11T387'].join('\n'));
  assert.equal(s[0].area, undefined);
  assert.equal(s[0].city, 'Köln');
  assert.equal(s[0].code, 'G 11 T 387');
});

test('a kiosk called "Späti 2" is a name, not a street; a shortened street is completed from earlier tours', async () => {
  const s = parseStops(['Späti 2', 'PRIO', '1', 'Neusser Str. 11', '50670IH Köln', 'Kita Remmidemmi e.V.,', '2', 'Gereonsm... engasse 26', '50670HL Köln'].join('\n'));
  assert.deepEqual(s.map(x => `${x.street} ${x.number}`), ['Neusser Str. 11', 'Gereonsm... engasse 26']);
  assert.deepEqual([s[0].name, s[0].express], ['Späti 2', '12:00']);
  const pos: Record<string, { lat: number; lon: number }> = { 'Depot, Köln': { lat: 50.94, lon: 6.90 }, 'Gereonsmühlengasse 26, 50670 Köln': { lat: 50.944, lon: 6.945 }, '50670 Köln': { lat: 50.944, lon: 6.95 } };
  const deps = { geocode: async (q: string) => pos[q] ?? null, matrix: async (p: { lat: number; lon: number }[]) => estimateMatrix(p), t: (k: string) => k, knownStreets: async () => ['Gereonsmühlengasse', 'Neusser Str.'] };
  const p = await planOnPhone({ start: { q: 'Depot' }, end: null, stops: [s[1]] }, deps);
  assert.equal(p.ungeocoded.length, 0, 'placed via the remembered full name');
  assert.equal(p.stops[0].street, 'Gereonsmühlengasse');
});

test('real Apple Vision text (2026-10-04/06): "00000AA" is no postcode, OCR-mangled area letters still are one, a kiosk before its hours is a name', () => {
  const s = parseStops(['Kühn', 'Wickrather Str. 7', '00000AA Köln', 'Jonas', 'Balthasarstr. 65', '50670ll Köln, Neustadt-Nord',
    'Spati 2 Klosk im Agnes', '07:00-22:00', 'Weißenburgstr. 68', '506701J Köln, Neustadt-Nord', '0221 1234567', 'Niehler Str. 3a'].join('\n'));
  assert.deepEqual(s.map(x => `${x.street} ${x.number} ${x.postcode} ${x.area ?? ''}`.trim()),
    ['Wickrather Str. 7', 'Balthasarstr. 65 50670 LL', 'Weißenburgstr. 68 50670 IJ', 'Niehler Str. 3a']);
  assert.equal(s[2].name, 'Spati 2 Klosk im Agnes');
});

test('real Apple Vision text (2026-10-07): 8/B, 0/O, 1/I in postcode lines, "Köin", a kiosk as a photo\'s last row', () => {
  const s = parseStops(['TRESONO Family Office AG', 'Konrad-Ade...uer-Ufer 21', '5066810 Köln', 'Loschelder', 'Konrad-Ade...uer-Ufer 11',
    '5066BIP Köln, Altstadt-Nord', 'Leimkuhl', 'Meissenstr. 3', '50668GI Köin', 'Riehler Str. 36', '50668HI Köln', 'Späti 2 Kiosk im Agnes', 'PRIO', '09:51'].join('\n'));
  assert.deepEqual(s.map(x => `${x.street} ${x.number} ${x.postcode} ${x.area ?? ''} ${x.city}`),
    ['Konrad-Ade...uer-Ufer 21 50668 IO Köln', 'Konrad-Ade...uer-Ufer 11 50668 IP Köln', 'Meissenstr. 3 50668 GI Köln', 'Riehler Str. 36 50668 HI Köln']);
  assert.equal(parseStops('0221 1234567\nHohe Str. 1\n50667 Köln')[0].postcode, '50667', 'a phone number is not a postcode line');
});

test('real Apple Vision text (2026-10-08): the overview\'s header lines are no names; the row marker is dropped', () => {
  const s = parseStops(['550', '10:48', '50670IE', 'G 18 T 387', 'Delivery | T550 | 08. Oct', '50670HK', '• A further 50', 'Tour Overview',
    'SERVICEPLAN', 'Von-Werth-Str. 6', '50670IE Köln, Altstadt-Nord', 'G 18 T 387', '08:19', '10:19', 'Expected arrival 10:56', 'Next stops',
    'Krafthaus by David Flacke - Fr', 'David Flacke', 'Von-Werth-Str. 9', '50670IE Köln', '• Lukas Kreuser', 'Norbertstr. 2-4', '50670HZ Köin'].join('\n'));
  assert.deepEqual(s.map(x => x.name), ['SERVICEPLAN', 'Krafthaus by David Flacke - Fr', 'Lukas Kreuser']);
  assert.equal(dedupe([{ ...s[2], area: undefined }, s[2]])[0].area, 'HZ', 'a cut-off copy takes the area from the full one');
});

test('real Apple Vision text (2026-10-08): the right column\'s "by 18:00" and PRIO find their row across photos; slots, hours, two names at one door', () => {
  const texts = [
    'Krafthaus\nVon-Werth-Str. 9\n50670IE Köln\nJonah Stettner\nVon-Werth-Str. 20\n50670HK Köln\nby 18:00\n08:22\n10:22\n08:26\n10:26',
    'Jonah Stettner\nVon-Werth-Str. 20\n50670HK Köln\nSCHULZ LINDA\nVon-Werth-Str. 41\n50670HK Köln\nFabian Schleifer\nVon-Werth-Str. 41\n50670HK Köln\n08:26\n10:26\n08:29\n10:29\n08:31\n10:31',
    'Ströppche Concept Store\nKlingelpütz 33\n50670HL Köln\nArtservice + Tube\nTheodor-Heuss-Ring 18\n50668CB Köln\nPRIO\n08:50\n10:50\n10:00-18:30\n10:00\n12:00',
    '50670HL Köln\nArtservice + Tube\nTheodor-Heuss-Ring 18\n50668CB Köln\n10:00-18:30\n10:00\n12:00',
  ];
  const s = dedupe(columnTags(texts, texts.map(t => parseStops(t))).flat());
  assert.deepEqual(s.map(x => `${x.number} ${x.name} x${x.parcels} ${x.slot} ${x.express ?? ''}${x.prio ? ' PRIO' : ''} ${x.opens ?? ''}`.trim()), [
    '9 Krafthaus x1 08:22-10:22 18:00', // Jonah is on a photo without it, every slot read: not his
    '20 Jonah Stettner x1 08:26-10:26',
    '41 SCHULZ LINDA · Fabian Schleifer x2 08:29-10:29',
    '33 Ströppche Concept Store x1 08:50-10:50 12:00 PRIO',
    '18 Artservice + Tube x1 10:00-12:00  10:00-18:30', // and not "50670HL Köln", a row cut off at the top
  ]);
});

test('our OCR\'s positions: each right-column item joins the row it sits level with; PRIO and "by 18:00" are that row\'s own', () => {
  const at = (text: string, y: number, x = 0.05) => ({ text, x, y, w: 0.3, h: 0.02 });
  const lines = [
    at('550', 0.01), at('10:48', 0.01, 0.85), at('Delivery | T550 | 08. Oct', 0.05),
    at('Krafthaus', 0.20), at('Von-Werth-Str. 9', 0.23), at('50670IE Köln', 0.26), at('G 18 T 387', 0.29),
    at('08:22', 0.21, 0.8), at('10:22', 0.24, 0.8), at('by 18:00', 0.27, 0.8),
    at('Ströppche Concept Store', 0.35), at('Klingelpütz 33', 0.38), at('50670HL Köln', 0.41), at('G 3 T 387', 0.44),
    at('PRIO', 0.35, 0.7), at('08:50', 0.36, 0.8), at('10:50', 0.39, 0.8),
    at('Theresa Loschert', 0.50), at('Klingelpütz 33', 0.53), at('50670HL Köln', 0.56), at('08:54', 0.51, 0.8), at('10:54', 0.54, 0.8),
  ].sort(() => 0.5 - Math.random()); // Vision's order is no help: positions only
  const text = rowOrder(lines);
  const s = parseStops(text);
  assert.deepEqual(s.map(x => `${x.number} ${x.name} ${x.slot} ${x.express ?? ''}${x.prio ? ' PRIO' : ''}`.trim()), [
    '9 Krafthaus 08:22-10:22 18:00', '33 Ströppche Concept Store 08:50-10:50 12:00 PRIO', '33 Theresa Loschert 08:54-10:54']);
  assert.deepEqual(columnTags([text], [s]), [s], 'nothing left to guess across photos');
});

test('a geocoder\'s full name matches the scanner\'s shortened one, and a one-letter misread of a long name', () => {
  assert.ok(alike('Konrad-Adenauer-Ufer', 'Konrad-Ade...uer-Ufer'));
  assert.ok(alike('Unter Krahnenbäumen', 'Unter Krahn...bäumen'));
  assert.ok(!alike('Probsteigasse', 'Unter Krahn...bäumen'));
  assert.ok(alike('Mevissenstraße', 'Meissenstr.'));
  assert.ok(!alike('Nirgendweg', 'Irgendweg'));
});

test('a dropped umlaut ("Lubecker") is the same street: merged on scan, accepted from a geocoder', () => {
  assert.equal(dedupe([s('Lübecker Str.', '14'), s('Lubecker Straße', '14', { postcode: '' })]).length, 1);
  assert.ok(alike('Lubecker Str.', 'Lübecker Straße'));
  assert.ok(!alike('Kretelder Wall', 'Krefelder Weg'));
});

test('a misread street snaps to the one street placed before that is a letter or two off; two candidates or a known name stay', async () => {
  const known = ['Krefelder Wall', 'Lübecker Str.', 'Blumenstr.', 'Bremer Str.', 'Brener Str.'];
  assert.equal(snapStreet('Kretelder Wall', known), 'Krefelder Wall');
  assert.equal(snapStreet('Lubecker Str.', known), 'Lubecker Str.', 'umlaut-only: already the same street');
  assert.equal(snapStreet('Blumenstr.', known), 'Blumenstr.');
  assert.equal(snapStreet('Brezer Str.', known), 'Brezer Str.', 'two candidates');
  assert.equal(snapStreet('Brunnenstr.', known), 'Brunnenstr.', 'too far from Blumenstr.');
  const pos: Record<string, { lat: number; lon: number }> = { 'Depot, Köln': { lat: 50.94, lon: 6.90 }, 'Krefelder Wall 44, 50670 Köln': { lat: 50.9547, lon: 6.9555 } };
  const deps = { geocode: async (q: string) => pos[q] ?? null, matrix: async (p: { lat: number; lon: number }[]) => estimateMatrix(p), t: (k: string) => k, knownStreets: async () => known };
  const p = await planOnPhone({ start: { q: 'Depot' }, end: null, stops: [s('Kretelder Wall', '44', { postcode: '50670' }), s('Krefelder Wall', '44', { postcode: '50670' })] }, deps);
  assert.deepEqual(p.stops.map(x => x.key), ['krefelderwall|44|50670']);
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

test('plan on the phone: a stop with no postcode is looked up in the tour\'s usual one, never Porz\'s street of that name', async () => {
  const pos: Record<string, { lat: number; lon: number }> = {
    'Depot, Köln': { lat: 50.94, lon: 6.90 }, '50670 Köln': { lat: 50.95, lon: 6.955 }, 'Ring 1, 50670 Köln': { lat: 50.951, lon: 6.956 },
    'Neusser Str. 30, Köln': { lat: 50.891, lon: 7.073 }, 'Neusser Str. 30, 50670 Köln': { lat: 50.9526, lon: 6.9574 },
  };
  const deps = { geocode: async (q: string) => pos[q] ?? null, matrix: async (p: { lat: number; lon: number }[]) => estimateMatrix(p), t: (k: string) => k };
  const p = await planOnPhone({ start: { q: 'Depot' }, end: null, stops: [s('Ring', '1', { postcode: '50670' }), s('Neusser Str.', '30', { postcode: '' })] }, deps);
  assert.equal(p.ungeocoded.length, 0);
  assert.equal(p.stops[1].lat, 50.9526);
  assert.equal(p.stops[1].postcode, '', 'the guess is not written onto the stop');
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

test('as scanned: the list order stands; only next-door neighbours on the list share a parking spot', () => {
  const at = (lat: number, x: Stop) => ({ ...x, lat, lon: 6.95 });
  // A1 and A3 next door (33 m), B far away, then A5 next door to A1 again but after B: it may not jump back
  const c = chain([at(50.94, s('A', '1')), at(50.9403, s('A', '3')), at(50.95, s('B', '1')), at(50.9401, s('A', '5'))]);
  assert.deepEqual(c.map(g => g.stops.map(x => `${x.street}${x.number}`).join('+')), ['A1+A3', 'B1', 'A5']);
  assert.deepEqual(c[0].park, { lat: 50.94, lon: 6.95 }, 'parked at the first one, a plain position');
  assert.ok(c[0].service > 2 * 120, 'the walk is in the stop time');
});

test('plan on the phone, as scanned: nothing re-ordered, no "you save", Express late flagged in that order', async () => {
  const pos: Record<string, { lat: number; lon: number }> = {
    'Depot, Köln': { lat: 50.94, lon: 6.90 },
    'A 1, 50667 Köln': { lat: 50.94, lon: 6.95 }, 'B 1, 50667 Köln': { lat: 50.94, lon: 6.92 }, 'C 1, 50667 Köln': { lat: 50.94, lon: 6.98 },
  };
  const deps = { geocode: async (q: string) => pos[q] ?? null, matrix: async (p: { lat: number; lon: number }[]) => estimateMatrix(p), t: (k: string) => k };
  const p = await planOnPhone({ start: { q: 'Depot' }, end: null, stops: [s('C', '1'), s('A', '1'), s('B', '1')], order: 'scanned' }, deps);
  assert.deepEqual(p.clusters.map(c => c.stops[0].street), ['C', 'A', 'B'], 'the fastest would be B, A, C');
  assert.deepEqual(p.clusters.flatMap(c => c.stops.map(x => x.no)), [1, 2, 3]);
  assert.equal(p.baseline, null);
  assert.equal(p.order, 'scanned');
  assert.ok(p.clusters[1].eta > p.clusters[0].eta, 'ETAs follow the list');
});

test('both sides in one pass: the public router is asked for no kerb side; off keeps the kerb side', async () => {
  assert.equal(osrmOptions(4, { hasEnd: true, curb: false }), '&approaches=unrestricted;unrestricted;unrestricted;unrestricted');
  const seen: (boolean | undefined)[] = [];
  const deps = {
    geocode: async (q: string) => (q.startsWith('Depot') ? { lat: 50.94, lon: 6.90 } : { lat: 50.94, lon: 6.95 }),
    matrix: async (p: { lat: number; lon: number }[], o?: { curb?: boolean }) => { seen.push(o?.curb); return estimateMatrix(p); },
    t: (k: string) => k,
  };
  await planOnPhone({ start: { q: 'Depot' }, end: null, stops: [s('A', '1')], bothSides: true }, deps);
  await planOnPhone({ start: { q: 'Depot' }, end: null, stops: [s('A', '1')], bothSides: false }, deps);
  assert.deepEqual(seen, [false, true]);
});

test('a stretch of street is driven once: coming back to it has to save more than REVISIT_SEC', () => {
  // start 0; 1 and 3 park on the same street, 2 on a side street. Going 1 -> 2 -> 3 saves 60 s of driving
  // over 1 -> 3 -> 2, but leaves the street and comes back to it.
  const m = [
    [0, 100, 400, 400],
    [100, 0, 100, 160],
    [400, 100, 0, 100],
    [400, 160, 100, 0],
  ];
  const mates = [[], [3], [], [1]];
  assert.deepEqual(solveOrder(m), [1, 2, 3], 'by the clock alone');
  assert.equal(revisits([1, 2, 3], mates), 1);
  assert.deepEqual(solveOrder(m, undefined, { mates }), [1, 3, 2], 'the street first, then the side street');
  // a detour that costs far more than the re-visit is still not taken
  const far = m.map(r => [...r]); far[1][3] = 900;
  assert.deepEqual(solveOrder(far, undefined, { mates }), [1, 2, 3]);
});

test('street mates: the same street within a short stretch, by the stop the van parks at', () => {
  const g = (street: string, lat: number) => ({ park: { lat, lon: 6.95 }, stops: [{ ...s(street, '1'), lat, lon: 6.95 }] });
  assert.deepEqual(streetMates([g('Hohe Str.', 50.94), g('Hohe Straße', 50.9415), g('Ring', 50.9405), g('Hohe Str.', 50.96)]), [[1], [0], [], []]);
});

test('Express first: every Express parking stop before the others, even when it costs driving', () => {
  const xs = [0, 1, 2, 5], m = xs.map(a => xs.map(b => Math.abs(a - b) * 60));
  assert.deepEqual(solveOrder(m).map(i => xs[i]), [1, 2, 5]);
  const rank = [0, 1, 1, 0]; // the far one (x=5) is Express
  const order = solveOrder(m, undefined, { rank });
  assert.deepEqual(order.map(i => xs[i]), [5, 2, 1]);
  assert.equal(descents(order, rank), 0);
});

test('Express margin: aims early, but "late" is still judged on the deadline itself', async () => {
  // start, A, B; A then B is the fastest drive and reaches B (Express) 2 min before its deadline
  const pos: Record<string, { lat: number; lon: number }> = { 'Depot, Köln': { lat: 50.94, lon: 6.90 }, 'A 1, 50667 Köln': { lat: 50.94, lon: 6.91 }, 'B 1, 50667 Köln': { lat: 50.94, lon: 6.95 } };
  const seconds = [[0, 60, 300], [60, 0, 240], [300, 240, 0]];
  const deps = { geocode: async (q: string) => pos[q] ?? null, matrix: async () => ({ seconds, meters: seconds, by: 'road' as const }), t: (k: string) => k };
  const tomorrow8 = new Date(Date.now() + 86_400_000).setHours(8, 0, 0, 0);
  const stops = () => [s('A', '1'), s('B', '1', { express: '08:08' as Stop['express'] })];
  const plain = await planOnPhone({ start: { q: 'Depot' }, end: null, stops: stops(), departAt: tomorrow8 }, deps);
  assert.deepEqual(plain.clusters.map(c => c.stops[0].street), ['A', 'B'], 'on time without a buffer: fastest');
  const early = await planOnPhone({ start: { q: 'Depot' }, end: null, stops: stops(), departAt: tomorrow8, expressMarginMin: 5 }, deps);
  assert.deepEqual(early.clusters.map(c => c.stops[0].street), ['B', 'A'], 'a 5 min buffer pulls B first');
  assert.deepEqual(early.late, [], 'B is well before 08:08');
});

// OpenStreetMap's answers for the four stops the phone's geocoder could not place (2026-10-04), shaped like Photon's
const koeln = { lat: 50.9500, lon: 6.9590 }; // 50670 Neustadt-Nord
const hit = (street: string, number: string | undefined, postcode: string, lat: number, lon: number): Hit => ({ street, number, postcode, lat, lon });

test('second geocoder, by the PC\'s rules: another town\'s Neusser Straße is refused; the street, then a neighbour, is used', async () => {
  const answers: Record<string, Hit> = {
    '50670 Köln': hit('', undefined, '50670', koeln.lat, koeln.lon),
    'Neusser Str. 30, 50670 Köln': hit('Neusser Straße', '30', '41542', 51.09, 6.84), // Dormagen
    'Neusser Str. 30, Köln': hit('Neusser Straße', '30', '41542', 51.09, 6.84),
    'Neusser Str., Köln': hit('Neusser Straße', undefined, '50670', 50.9530, 6.9560),
    'Neusser Str. 28, 50670 Köln': hit('Neusser Straße', '28', '50670', 50.9528, 6.9571),
  };
  const notes: string[] = [];
  const g = await locate(s('Neusser Str.', '30', { postcode: '50670' }), async q => answers[q] ?? null, m => notes.push(m));
  assert.deepEqual(g, { lat: 50.9528, lon: 6.9571, exact: true, street: 'Neusser Straße' });
  assert.ok(notes.includes('photon: another place, ignored'));
  assert.ok(notes.includes('photon: placed by a neighbouring number'));
});

test('second geocoder: a house is exact only when OpenStreetMap found that very number; else the street', async () => {
  const answers: Record<string, Hit> = {
    '50670 Köln': hit('', undefined, '50670', koeln.lat, koeln.lon),
    'Weißenburgstr. 62, 50670 Köln': hit('Weißenburgstraße', '6', '50670', 50.9510, 6.9620),
  };
  const g = await locate(s('Weißenburgstr.', '62', { postcode: '50670' }), async q => answers[q] ?? null);
  assert.deepEqual(g, { lat: 50.9510, lon: 6.9620, exact: false, street: 'Weißenburgstraße' }, 'number 6 is not 62: street only');
  assert.ok(alike('Weißenburgstr.', 'Weißenburgstraße') && !alike('Neusser Str.', 'Neusser Wall'));
  assert.deepEqual(nearbyNumbers('1A'), ['1', '3', '5', '2', '4']);
});

test('plan on the phone: a stop the phone\'s geocoder misses is placed by the second one; progress is reported', async () => {
  const pos: Record<string, { lat: number; lon: number }> = { 'Depot, Köln': { lat: 50.94, lon: 6.90 }, '50670 Köln': koeln, 'Ring 1, 50670 Köln': { lat: 50.951, lon: 6.956 } };
  const asked: string[] = [], stages: string[] = [], notes: string[] = [];
  const deps = {
    geocode: async (q: string) => pos[q] ?? null, matrix: async (p: { lat: number; lon: number }[]) => estimateMatrix(p), t: (k: string) => k,
    locate: async (st: Stop, q: string) => { asked.push(q); return st.street === 'Wickrather Str.' ? { lat: 50.9562, lon: 6.9541, exact: true, street: 'Wickrather Straße' } : null; },
    log: (m: string) => notes.push(m),
  };
  const p = await planOnPhone({ start: { q: 'Depot' }, end: null, stops: [s('Ring', '1', { postcode: '50670' }), s('Wickrather Str.', '7', { postcode: '50670' }), s('Nirgendwo', '9', { postcode: '50670' })] },
    deps, (st, done, total) => stages.push(total ? `${st} ${done}/${total}` : st));
  assert.deepEqual(p.ungeocoded.map(x => x.street), ['Nirgendwo']);
  assert.equal(p.stops.find(x => x.number === '7')?.street, 'Wickrather Str.', 'same street, the list\'s spelling stays');
  assert.deepEqual(asked, ['Wickrather Str. 7, 50670 Köln', 'Nirgendwo 9, 50670 Köln'], 'only for what the phone could not place');
  assert.deepEqual(stages, ['places 0/3', 'places 1/3', 'places 2/3', 'roadTimes', 'ordering']);
  assert.deepEqual(notes.filter(n => n.startsWith('stop')), ['stop placed', 'stop placed', 'stop not placed']);
});

test('VROOM (ORS): jobs with service and deadline, slowed like our road times; its order is where the phone search starts, a bad one is fixed or ignored', async () => {
  let sent: { jobs: { id: number; service: number; time_windows?: number[][] }[]; vehicles: { speed_factor: number }[] } | null = null;
  const fetchFn = (async (_url: string, init: { body: string }) => {
    sent = JSON.parse(init.body);
    return new Response(JSON.stringify({ unassigned: [], routes: [{ steps: [{ type: 'start' }, { type: 'job', job: 2 }, { type: 'job', job: 1 }, { type: 'end' }] }] }));
  }) as unknown as typeof fetch;
  const order = await vroomOrder({ start: { lat: 0, lon: 0 }, end: null, stops: [{ lat: 1, lon: 1, service: 60, due: 3600 }, { lat: 2, lon: 2, service: 90, due: null }] }, 'k', fetchFn);
  assert.deepEqual(order, [2, 1]);
  assert.deepEqual(sent!.jobs.map(j => [j.id, j.service, j.time_windows]), [[1, 60, [[0, 3600]]], [2, 90, undefined]]);
  assert.ok(Math.abs(sent!.vehicles[0].speed_factor - 1 / 1.3) < 1e-9);

  // depot, then A (near) and B (far) on one line: ours goes A, B; a VROOM answer B, A loses, one that matches stays
  const pos: Record<string, { lat: number; lon: number }> = { 'Depot, Köln': { lat: 50.90, lon: 6.95 }, 'A 1, 50667 Köln': { lat: 50.92, lon: 6.95 }, 'B 1, 50667 Köln': { lat: 50.96, lon: 6.95 } };
  const plan = (answer: number[]) => planOnPhone({ start: { q: 'Depot' }, end: null, stops: [s('B', '1'), s('A', '1')] },
    { geocode: async (q: string) => pos[q] ?? null, matrix: async (p: { lat: number; lon: number }[]) => estimateMatrix(p), t: (k: string) => k, optimize: async () => answer });
  const streets = async (answer: number[]) => (await plan(answer)).clusters.map(c => c.stops[0].street).join();
  assert.equal(await streets([1, 2]), 'A,B', 'B first (point 1) is worse: the search fixes it');
  assert.equal(await streets([2]), 'A,B', 'an answer missing a stop is ignored');
});
