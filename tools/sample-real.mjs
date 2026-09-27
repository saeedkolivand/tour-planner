#!/usr/bin/env node
// Real-address test tour: probes the local Photon geocoder for real 50670 house numbers,
// then composes a synthetic-but-real-addressed DPD tour in the same shape as sample.mjs's input.
//   node tools/sample-real.mjs <out.json>
import fs from 'node:fs';

const PHOTON = process.env.PHOTON || 'http://localhost:2322';
const POSTCODE = '50670';
// Eigelstein/Weidengasse/Im Stavenhof/Turiner Straße/Thürmchenswall/Dagobertstraße/Ursulagartenstraße/
// Eintrachtstraße are the real Eigelstein micro-neighborhood but OSM zones them 50668, not 50670 -> accept both.
const REAL_POSTCODES = new Set(['50670', '50668']);

// East of Neusser Straße = N1 Eigelstein; the rest = N2 Agnesviertel.
const STREETS_N1 = ['Eigelstein', 'Weidengasse', 'Im Stavenhof', 'Turiner Straße', 'Thürmchenswall', 'Dagobertstraße', 'Ursulagartenstraße', 'Gereonswall'];
const STREETS_N2 = ['Neusser Straße', 'Ewaldistraße', 'Balthasarstraße', 'Sudermanstraße', 'Weißenburgstraße', 'Hansaring', 'Krefelder Straße', 'Lübecker Straße', 'Bremer Straße', 'Kempener Straße', 'Maybachstraße', 'Erftstraße', 'Eintrachtstraße', 'Gladbacher Wall'];
const STREETS = [...STREETS_N1, ...STREETS_N2];

// seeded PRNG (mulberry32) -> re-running gives the same file
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(Number(process.argv[3]) || 50670); // optional seed: another set of real addresses
const pick = arr => arr[Math.floor(rng() * arr.length)];
const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Probing 1..120 in order piles up hits at the low end (a street's #1-#6 are metres apart) -> shuffle the
// probe order so accepted hits are scattered across the street's whole length before we stop early.
async function probeStreet(street, need = 24) {
  const hits = [];
  const numbers = shuffle(Array.from({ length: 120 }, (_, i) => i + 1));
  const CONCURRENCY = 8;
  for (let i = 0; i < numbers.length && hits.length < need; i += CONCURRENCY) {
    const batch = numbers.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(async n => {
      const q = encodeURIComponent(`${street} ${n}, ${POSTCODE} Köln`);
      const r = await fetch(`${PHOTON}/api?q=${q}&lat=50.94&lon=6.96&limit=3&lang=de`);
      const j = await r.json();
      const hit = j.features?.find(f => f.properties.housenumber === String(n) && f.properties.street === street && REAL_POSTCODES.has(f.properties.postcode));
      return hit ? { street, house_number: String(n), postcode: hit.properties.postcode, lat: hit.geometry.coordinates[1], lon: hit.geometry.coordinates[0] } : null;
    }));
    for (const h of results) if (h) hits.push(h);
  }
  return hits.sort((a, b) => Number(a.house_number) - Number(b.house_number));
}

const haversineM = (a, b) => {
  const R = 6371000, toRad = x => x * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};
/** Greedy farthest-point sampling over every street's candidates at once, capped per street: each pick is the
 * candidate farthest from anything picked so far (real metres). House-number order alone doesn't keep picks apart
 * on a narrow street with odd/even numbers facing each other, or between two adjacent parallel streets -> this
 * does, since it looks at every already-picked stop regardless of which street it's on. */
function farthestPointPick(byStreet, total, capPerStreet) {
  const all = [...byStreet.values()].flat();
  if (!all.length) return [];
  const used = new Map();
  const first = all[0];
  const picked = [first];
  used.set(first.street, 1);
  const minDist = new Map(all.map(c => [c, haversineM(c, first)]));
  while (picked.length < total) {
    let best = null, bestD = -1;
    for (const c of all) {
      if (minDist.get(c) == null) continue; // already picked
      if ((used.get(c.street) || 0) >= capPerStreet) continue;
      const d = minDist.get(c);
      if (d > bestD) { bestD = d; best = c; }
    }
    if (!best) break; // every street at cap or exhausted
    picked.push(best);
    used.set(best.street, (used.get(best.street) || 0) + 1);
    minDist.delete(best);
    for (const [c, d] of minDist) { const nd = haversineM(c, best); if (nd < d) minDist.set(c, nd); }
  }
  return picked;
}

async function collectAddresses() {
  const perStreet = await Promise.all(STREETS.map(s => probeStreet(s)));
  const byStreet = new Map(STREETS.map((s, i) => [s, perStreet[i]]));
  return byStreet;
}

const FIRST_NAMES = ['Noah', 'Mara', 'Sophie', 'Leon', 'Emma', 'Finn', 'Lina', 'Paul', 'Mia', 'Ben', 'Lena', 'Jonas', 'Anna', 'Felix', 'Clara', 'Tom'];
const LAST_NAMES = ['Wagner', 'Fischer', 'Richter', 'Weber', 'Schmidt', 'Becker', 'Hoffmann', 'Koch', 'Bauer', 'Klein', 'Wolf', 'Schroeder', 'Neumann', 'Zimmermann'];
const OPENING_HOURS = ['09:00-20:00', '08:00-18:30', '10:00-19:00', '09:00-13:00'];
const DELIVERY_WINDOWS = ['08:00-12:00', '12:00-16:00', '14:00-18:00'];
const EXPRESS_WINDOWS = ['08:00-10:00', '10:00-12:00', '12:00-14:00'];

function main(byStreet) {
  const MAX_PER_STREET = 5;
  const STOP_COUNT = 70, PACKETSHOP_COUNT = 14, RESIDENTIAL_COUNT = 56;
  const PARCEL_COUNT = 200, EXPRESS_COUNT = 30;

  // Pick 70 stops spread out city-wide (farthest-point sampling across every street's candidates), capped per street.
  const pool = farthestPointPick(byStreet, STOP_COUNT, MAX_PER_STREET);
  if (pool.length < STOP_COUNT) throw new Error(`only found ${pool.length} real addresses, need ${STOP_COUNT}`);

  const shuffled = shuffle(pool);
  const shopStops = shuffled.slice(0, PACKETSHOP_COUNT);
  const residentialStops = shuffled.slice(PACKETSHOP_COUNT, PACKETSHOP_COUNT + RESIDENTIAL_COUNT);
  const stops = shuffle([...shopStops.map(a => ({ ...a, isShop: true })), ...residentialStops.map(a => ({ ...a, isShop: false }))]);

  // parcels_at_stop: 1..6 per stop, summing to PARCEL_COUNT
  const counts = stops.map(() => 1);
  let remaining = PARCEL_COUNT - counts.length;
  while (remaining > 0) {
    const i = Math.floor(rng() * counts.length);
    if (counts[i] < 6) { counts[i]++; remaining--; }
  }

  // pick which parcels are express (30 total), spread across stops
  const parcelSlots = [];
  stops.forEach((s, si) => { for (let k = 0; k < counts[si]; k++) parcelSlots.push(si); });
  const expressSlots = new Set(shuffle(parcelSlots.map((_, i) => i)).slice(0, EXPRESS_COUNT));

  let n1Count = 0, n2Count = 0;
  const stopMeta = stops.map((s) => {
    const isN1 = STREETS_N1.includes(s.street);
    if (isN1) n1Count++; else n2Count++;
    return { neighborhood_id: isN1 ? 'N1' : 'N2', neighborhood: isN1 ? 'Eigelstein' : 'Agnesviertel' };
  });

  // stop ids per neighborhood, sequential
  const seq = { N1: 0, N2: 0 };
  const stopIds = stops.map((_, i) => { const nb = stopMeta[i].neighborhood_id; seq[nb]++; return `${nb}-STOP-${String(seq[nb]).padStart(3, '0')}`; });

  const parcels = [];
  let parcelIndex = 0;
  let globalSlot = 0;
  stops.forEach((stop, si) => {
    const meta = stopMeta[si];
    const shop = stop.isShop;
    const shopName = shop ? `Paketshop ${stop.street}` : '';
    const shopHours = shop ? pick(OPENING_HOURS) : '';
    for (let k = 0; k < counts[si]; k++) {
      parcelIndex++;
      const isExpress = expressSlots.has(globalSlot);
      globalSlot++;
      const expressWindow = isExpress ? pick(EXPRESS_WINDOWS) : '';
      const service = isExpress ? `DPD Express ${expressWindow.split('-')[1]}` : pick(['DPD Classic', 'DPD Predict']);
      const recipient = shop ? shopName : `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
      parcels.push({
        parcel_id: `DE50670-${String(parcelIndex).padStart(4, '0')}`,
        stop_id: stopIds[si],
        neighborhood_id: meta.neighborhood_id,
        neighborhood: meta.neighborhood,
        stop_type: shop ? 'packetshop' : 'residential',
        destination_type: shop ? 'DPD Packetshop' : 'residential',
        packetshop_name: shopName,
        packetshop_opening_hours: shopHours,
        parcel_index_at_stop: k + 1,
        parcels_at_stop: counts[si],
        recipient,
        street: stop.street,
        house_number: stop.house_number,
        postcode: stop.postcode,
        city: 'Köln',
        country: 'DE',
        address: `${stop.street} ${stop.house_number}`,
        latitude: Math.round(stop.lat * 1e6) / 1e6,
        longitude: Math.round(stop.lon * 1e6) / 1e6,
        delivery_window: pick(DELIVERY_WINDOWS),
        weight_kg: Math.round((0.3 + rng() * 24.7) * 10) / 10,
        service,
        is_express: isExpress,
        express_time_window: expressWindow,
        status: 'pending',
      });
    }
  });

  const header = {
    dataset: 'real_addresses_dpd_test_50670_200_70_stops',
    synthetic_data: true,
    parcel_count: PARCEL_COUNT,
    stop_count: STOP_COUNT,
    neighborhood_count: 2,
    postcode: POSTCODE,
    city: 'Köln',
    packetshop_stop_count: PACKETSHOP_COUNT,
    residential_stop_count: RESIDENTIAL_COUNT,
    express_parcel_count: EXPRESS_COUNT,
    express_time_windows: EXPRESS_WINDOWS,
    neighborhoods: [
      { id: 'N1', name: 'Eigelstein', parcel_count: parcels.filter(p => p.neighborhood_id === 'N1').length, stop_count: n1Count, packetshop_stop_count: stops.filter((s, i) => stopMeta[i].neighborhood_id === 'N1' && s.isShop).length },
      { id: 'N2', name: 'Agnesviertel', parcel_count: parcels.filter(p => p.neighborhood_id === 'N2').length, stop_count: n2Count, packetshop_stop_count: stops.filter((s, i) => stopMeta[i].neighborhood_id === 'N2' && s.isShop).length },
    ],
    description: 'Real-address route-testing data. Streets, house numbers and coordinates are real OSM addresses in Köln Agnesviertel/Eigelstein, looked up via the local Photon geocoder (most are 50670; a few Eigelstein-core streets are OSM-zoned 50668, kept as-is since the addresses are real). Recipients, Packetshop names, parcel counts and delivery windows are synthetic.',
  };

  return { ...header, parcels };
}

const outFile = process.argv[2];
if (!outFile) { console.error('usage: node tools/sample-real.mjs <out.json>'); process.exit(1); }

const byStreet = await collectAddresses();
for (const [street, addrs] of byStreet) if (addrs.length < 6) console.error(`warning: only ${addrs.length} exact-number hits for "${street}"`);

const data = main(byStreet);
fs.writeFileSync(outFile, JSON.stringify(data, null, 2));

const distinctStreets = new Set(data.parcels.map(p => p.street)).size;
console.log(`wrote ${outFile}`);
console.log(`stops: ${data.stop_count} (${data.residential_stop_count} residential, ${data.packetshop_stop_count} packetshop), parcels: ${data.parcel_count}, express: ${data.express_parcel_count}, distinct streets: ${distinctStreets}`);
