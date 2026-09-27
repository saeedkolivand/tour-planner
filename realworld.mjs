// A real-shaped tour end to end: a DPD parcel list -> stops -> planned from the Erftstadt depot by the PC
// (Express on time, and fastest-only for comparison) and by the phone-only planner, all measured on OSRM.
// Run with the server up:  node realworld.mjs [tour.json]
import fs from 'node:fs';
import { estimateMatrix } from './mobile/src/features/planner/matrix.ts';
import { planOnPhone } from './mobile/src/features/planner/planOnPhone.ts';
import { toStops } from './tools/sample.mjs';

const API = 'http://localhost:3000', OSRM = 'http://localhost:5050';
const DEPOT = { q: 'Carl-Benz-Ring 1, 50374 Erftstadt' };
const file = process.argv[2];
if (!file) { console.error('usage: node --experimental-strip-types realworld.mjs <scanner-sample.json>'); process.exit(1); }
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const stops = toStops(data);
const byAddress = new Map(stops.map(s => [`${s.street}|${s.number}`, s]));

const post = async (path, body) => {
  const r = await fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${path}: ${j.error}`);
  return j;
};
/** Driving (OSRM, same city factor as the server) along points in order. */
async function drive(points) {
  const r = await (await fetch(`${OSRM}/route/v1/driving/${points.map(p => `${p.lon},${p.lat}`).join(';')}?overview=false`)).json();
  return { km: r.routes[0].distance / 1000, min: (r.routes[0].duration * 1.3) / 60 };
}
const fmt = m => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, '0')}m`;
const hhmm = d => d.toTimeString().slice(0, 5);

const express = stops.filter(s => s.express);
console.log(`${data.parcel_count} parcels -> ${stops.length} stops (${data.dataset})`);
const shops = stops.filter(s => s.type === 'shop');
console.log(`${shops.length} Paketshops (hours ${[...new Set(shops.map(s => s.opens))].join(', ')})`);
console.log(`${express.length} stops with an Express deadline: ${[...new Set(express.map(s => s.express))].sort().map(t => `${express.filter(s => s.express === t).length}x ${t}`).join(', ')}`);

// leaving the depot tomorrow at 08:00, as a driver would
const departAt = new Date(); departAt.setDate(departAt.getDate() + 1); departAt.setHours(8, 0, 0, 0);
const fastest = await post('/optimize', { start: DEPOT, end: DEPOT, stops, departAt: +departAt, expressOnTime: false });
const t0 = Date.now();
const pc = await post('/optimize', { start: DEPOT, end: DEPOT, stops, departAt: +departAt });
console.log(`\nPC plan (${Date.now() - t0} ms): ${pc.clusters.length} parking stops, ${pc.km.toFixed(1)} km, ${fmt(pc.min)} incl. stops; scanner order ${fmt(pc.baseline.min)}`);
if (pc.ungeocoded.length) console.log(`  not planned: ${pc.ungeocoded.map(s => `${s.street} ${s.number}${s.unreachable ? ' (no road today)' : ' (not found)'}`).join(', ')}`);
const streetOnly = pc.stops.filter(s => s.exact === false);
if (streetOnly.length) console.log(`  street only (house number unknown): ${streetOnly.map(s => `${s.street} ${s.number}`).join(', ')}`);
const walked = pc.clusters.filter(c => c.stops.length > 1);
console.log(`  park-and-walk: ${walked.length} parking stops serve ${walked.reduce((n, c) => n + c.stops.length, 0)} addresses on foot`);

// Express: arrival vs deadline
const arrival = (plan, s) => {
  const c = plan.clusters.find(c => c.stops.some(x => x.street === s.street && x.number === s.number));
  return c && new Date(plan.startedAt + c.eta * 60000);
};
const lateIn = plan => express.map(s => ({ s, eta: arrival(plan, s) })).filter(({ s, eta }) => eta && hhmm(eta) > s.express);
console.log(`\nExpress (leaving the depot at ${hhmm(departAt)}):`);
console.log(`  fastest only:    ${fmt(fastest.min)}, ${lateIn(fastest).length} of ${express.length} Express stops late`);
console.log(`  Express on time: ${fmt(pc.min)}, ${lateIn(pc).length} late${pc.late?.length ? ` (${pc.late.length} impossible from this depot/time)` : ''}  -> costs ${Math.round(pc.min - fastest.min)} min`);
for (const { s, eta } of lateIn(pc)) console.log(`    late: ${s.street} ${s.number} due ${s.express}, arrives ~${hhmm(eta)}`);
const closed = plan => shops.filter(s => { const t = arrival(plan, s); if (!t) return false; const [o, c] = s.opens.split('-'); return hhmm(t) < o || hhmm(t) > c; });
console.log(`
Paketshops outside opening hours: fastest only ${closed(fastest).length} of ${shops.length}, planned ${closed(pc).length}`);

// the phone planner, with the positions the PC found (isolates ordering from geocoding), fastest only (vs PC fastest)
const phoneStops = pc.stops.map(({ no, ...s }) => ({ ...s, pinned: true })); // pinned: the phone never re-geocodes them
const t1 = Date.now();
const phone = await planOnPhone({ start: pc.start, end: pc.end, stops: phoneStops, expressOnTime: false }, { geocode: async () => null, matrix: async p => estimateMatrix(p) });
const [a, b] = await Promise.all([fastest, phone].map(plan => drive([plan.start, ...plan.clusters.map(c => c.park), plan.end])));
console.log(`\nPhone-only planner (${Date.now() - t1} ms, distance estimates), driving measured on the road graph:`);
console.log(`  PC fastest: ${a.km.toFixed(1)} km, ${fmt(a.min)}   phone: ${b.km.toFixed(1)} km, ${fmt(b.min)}  (${b.min > a.min ? '+' : ''}${Math.round(((b.min - a.min) / a.min) * 100)}%)`);

console.log(`\nOrder (PC, Express on time):\n    ${pc.clusters.map(c => `${hhmm(new Date(pc.startedAt + c.eta * 60000))}  ` + c.stops.map(s => `#${s.no} ${s.street} ${s.number}${s.express ? ` [Express ${s.express}]` : ''}`).join(' + ')).join('\n    ')}`);
