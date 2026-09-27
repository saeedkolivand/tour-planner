#!/usr/bin/env node
// Test tours from DPD-shaped parcel lists (JSON with a `parcels` array, one row per parcel).
//   node tools/sample.mjs load <file.json> [shiftHours]   clear today's tour and load this one (the app picks it
//                                                         up on its next sync); shiftHours moves Express/shop
//                                                         times, to test deadlines later in the day
import fs from 'node:fs';

const API = process.env.API || 'http://localhost:3000';

/** "DPD Express 12:00" / "DPD 10:00", else the end of express_time_window when marked express. */
function deadline(p) {
  const inService = /(\d{1,2}:\d{2})\s*$/.exec(p.service ?? '')?.[1];
  if (inService) return inService.padStart(5, '0');
  return String(p.is_express).toLowerCase() === 'true' ? (String(p.express_time_window ?? '').split('-')[1] ?? '') : '';
}
const shift = (hhmm, h) => {
  if (!h || !hhmm) return hhmm;
  const [a, b] = hhmm.split(':').map(Number);
  return `${String(Math.min(23, a + h)).padStart(2, '0')}:${String(b).padStart(2, '0')}`;
};

/** Parcel rows -> stops the app understands; rows of one address become one stop (earliest deadline wins). */
export function toStops(data, shiftHours = 0) {
  const byAddress = new Map();
  for (const p of data.parcels) {
    const k = `${p.street}|${p.house_number}`, had = byAddress.get(k);
    const express = shift(deadline(p), shiftHours);
    const shop = /packetshop|paketshop/i.test(`${p.stop_type} ${p.destination_type}`);
    const opens = shop && p.packetshop_opening_hours ? p.packetshop_opening_hours.split('-').map(t => shift(t, shiftHours)).join('-') : '';
    if (had) {
      had.parcels++; had.parcelIds.push(p.parcel_id);
      if (express && (!had.express || express < had.express)) had.express = express;
      continue;
    }
    byAddress.set(k, {
      street: p.street, number: String(p.house_number), postcode: String(p.postcode ?? ''), city: p.city ?? 'Köln',
      name: shop ? p.packetshop_name || p.recipient : p.recipient, type: shop ? 'shop' : 'private', parcels: 1, parcelIds: [p.parcel_id],
      ...(express && { express }), ...(opens && { opens }),
    });
  }
  return [...byAddress.values()];
}

async function put(tour) {
  const r = await fetch(`${API}/tour`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(tour) });
  if (!r.ok) throw new Error(`PUT /tour ${r.status}`);
}

if (process.argv[1]?.endsWith('sample.mjs') && process.argv[2] === 'load') {
  const [file, h = '0'] = process.argv.slice(3);
  const stops = toStops(JSON.parse(fs.readFileSync(file, 'utf8')), Number(h));
  await put({ stops: [], plan: null, expected: '' }); // a new tour: loading numbers start again at 1
  await put({ stops, plan: null, expected: String(stops.length) });
  console.log(`loaded ${stops.length} stops: ${stops.filter(s => s.type === 'shop').length} Paketshops, ${stops.filter(s => s.express).length} Express`);
}
