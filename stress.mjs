// Production-shaped load against a running server (npm start): real Cologne addresses from Photon,
// 1-20 parcels per stop, overlapping photos, OCR noise, then monkey input. Read-only: never writes
// the tour, pins, closures or logs. Run: node stress.mjs [baseUrl]
import assert from 'node:assert/strict';

const API = process.argv[2] || 'http://localhost:3000';
const PHOTON = 'http://localhost:2322';
const DEPOT = { lat: 50.7921, lon: 6.7835 }; // DPD Depot 0150, Carl-Benz-Ring 1, Erftstadt
const AREA = { lat: 50.9440, lon: 6.9480 };  // the tour's area: Neustadt-/Altstadt-Nord (50670, from a real label)
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = a => a[Math.floor(rnd() * a.length)];
// DPD reality: most stops get 1 parcel, a few 2-4, some businesses a pile of 5-20
const parcels = () => (rnd() < 0.8 ? 1 : rnd() < 0.75 ? 2 + Math.floor(rnd() * 3) : 5 + Math.floor(rnd() * 16));

async function post(path, body, raw = false) {
  const t0 = performance.now();
  const r = await fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw ? body : JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null), ms: Math.round(performance.now() - t0) };
}

/** Real house-numbered addresses: reverse-geocode random points around the depot. */
async function addresses(n, spreadKm) {
  const out = new Map();
  for (let tries = 0; out.size < n && tries < n * 6; tries++) {
    const lat = AREA.lat + (rnd() - 0.5) * spreadKm / 111, lon = AREA.lon + (rnd() - 0.5) * spreadKm / 70;
    const f = (await (await fetch(`${PHOTON}/reverse?lat=${lat}&lon=${lon}&limit=1&lang=de`)).json()).features?.[0]?.properties;
    if (!f?.housenumber || !f.street) continue;
    out.set(`${f.street}|${f.housenumber}`, { street: f.street, number: f.housenumber, postcode: f.postcode ?? '', city: 'Köln' });
  }
  return [...out.values()];
}

function tour(addrs) {
  const stops = addrs.map(a => ({
    ...a, parcels: parcels(), type: (r => (r < 0.85 ? 'private' : r < 0.96 ? 'business' : r < 0.98 ? 'pickup' : 'shop'))(rnd()), // real area mix
    express: rnd() < 0.06 ? pick(['10:00', '12:00', '18:00']) : '',
  }));
  // overlapping photos: ~15% rows seen twice, some with OCR-style variants of the street
  const dupes = stops.filter(() => rnd() < 0.15).map(s => ({ ...s, street: s.street.replace(/straße$/i, 'str.'), parcels: 1 }));
  return { stops: [...stops, ...dupes], unique: stops.length, parcels: stops.reduce((t, s) => t + s.parcels, 0) };
}

async function plan(label, t) {
  const r = await post('/optimize', { start: DEPOT, end: DEPOT, stops: t.stops });
  assert.equal(r.status, 200, `${label}: ${JSON.stringify(r.body)}`);
  const p = r.body, planned = p.clusters.flatMap(c => c.stops);
  const nos = planned.map(s => s.no);
  assert.equal(new Set(nos).size, nos.length, `${label}: loading numbers unique`);
  assert.equal(planned.length + p.ungeocoded.length, t.unique, `${label}: every unique stop planned or reported`);
  assert.equal(planned.reduce((a, s) => a + s.parcels, 0) + p.ungeocoded.reduce((a, s) => a + s.parcels, 0), t.parcels, `${label}: no parcel lost or doubled`);
  const etas = p.clusters.map(c => c.eta);
  assert.deepEqual(etas, [...etas].sort((a, b) => a - b), `${label}: ETAs increase`);
  console.log(`${label}: ${t.unique} stops/${t.parcels} parcels -> ${p.clusters.length} parking stops, ${p.km.toFixed(1)} km, ${p.min} min` +
    ` (scanner order ${p.baseline ? Math.round(p.baseline.min) : '?'} min), ${p.ungeocoded.length} not found, ${r.ms} ms`);
  return r.ms;
}

const monkey = [
  ['not JSON', '{"stops": [', true], ['array body', '[]', true], ['null body', 'null', true],
  ['stops not array', { start: DEPOT, stops: 'lol' }], ['no start', { stops: [{ street: 'Venloer Str.', number: '1' }] }],
  ['start NaN', { start: { lat: 'x', lon: null }, stops: [{ street: 'Venloer Str.', number: '1' }] }],
  ['street number type', { start: DEPOT, stops: [{ street: 42, number: {} }] }],
  ['null stop', { start: DEPOT, stops: [null, { street: 'Venloer Str.', number: '1' }] }],
  ['empty stops', { start: DEPOT, stops: [] }], ['all done', { start: DEPOT, stops: [{ street: 'Venloer Str.', number: '1', done: true }] }],
  ['nonsense address', { start: DEPOT, stops: [{ street: 'Qwxzzy Weg', number: '99999' }] }],
  ['parcels absurd', { start: DEPOT, stops: [{ street: 'Venloer Str.', number: '211', parcels: -5 }, { street: 'Venloer Str.', number: '1', parcels: 1e9 }] }],
  ['10k-char street', { start: DEPOT, stops: [{ street: 'A'.repeat(10000), number: '1' }] }],
  ['unicode junk', { start: DEPOT, stops: [{ street: '🚚\u0000‮', number: '١٢' }] }],
];

console.log('— monkey: bad input must be a 4xx/5xx JSON error or a sane plan, never a dead server');
for (const [name, body, raw] of monkey) {
  const r = await post('/optimize', body, raw);
  console.log(`  ${r.status} ${name}${r.status >= 400 ? ': ' + r.body?.error : ''}`);
  assert.ok(r.body !== null, `${name}: JSON reply`);
  assert.ok(r.status < 500, `${name}: bad input is the caller's fault (4xx), not a server error`);
}
for (const body of [{ stops: 'x' }, { stops: [{ street: 1 }, null] }]) {
  const r = await post('/extract', body);
  console.log(`  ${r.status} /extract ${JSON.stringify(body)}`);
  assert.ok(r.status < 500, '/extract: bad input is a 4xx');
}
assert.equal((await fetch(API + '/closures')).status, 200, 'server still up after monkey');

console.log('— stress: realistic tours');
const pool = await addresses(260, 3.5);
console.log(`  ${pool.length} real addresses around Ehrenfeld`);
for (const n of [40, 100, 150, 250]) await plan(`  ${n}`, tour(pool.slice(0, n)));
console.log('— dense: one real DPD area (~1 km², one postcode block), 180 stops');
const dense = await addresses(180, 1.0);
const d = tour(dense);
await plan(`  ${dense.length} dense`, d);
const dp = (await post('/optimize', { start: DEPOT, end: DEPOT, stops: d.stops })).body;
const sizes = dp.clusters.map(c => c.stops.length).sort((a, b) => b - a);
const walkMin = dp.clusters.reduce((t, c) => t + c.service, 0) / 60;
console.log(`  parking stops: ${dp.clusters.length}, biggest walks: ${sizes.slice(0, 5).join(', ')} stops, ` +
  `${(d.unique / dp.clusters.length).toFixed(1)} stops per park, time at stops ${Math.round(walkMin)} min, driving ${Math.round(dp.min - walkMin)} min`);
const postcodes = new Set(dense.map(a => a.postcode));
console.log(`  postcodes covered: ${[...postcodes].join(', ')}`);
console.log('— gorilla: 5 full tours at once');
const ms = await Promise.all([0, 1, 2, 3, 4].map(i => plan(`  #${i}`, tour(pool.slice(i * 20, i * 20 + 120)))));
console.log(`  slowest ${Math.max(...ms)} ms`);
assert.equal((await fetch(API + '/closures')).status, 200, 'server still up after load');
console.log('stress ok');
