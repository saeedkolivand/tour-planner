import assert from 'node:assert/strict';
import { fixNumber, fixPostcode, ground } from './server/extract/ground.mjs';
import { cluster, meters, serviceSec } from './server/route/cluster.mjs';
import { insertLate, timeline } from './server/route/lateness.mjs';
import { roadFor } from './server/route/snap.mjs';
import { arrivalWindow, dueSec, osrmOptions, vroomJob } from './server/route/solve.mjs';
import { dedupe, normStreet, stopKey } from './server/route/stops.mjs';
import { distToSegment, segmentsAt } from './server/roads/segments.mjs';
import { mergeLines, speedLines } from './server/roads/speeds.mjs';
import { mergeTour } from './server/tour.mjs';
import { levelOf } from './server/roads/verkehrskalender.mjs';
import { locate, nearbyNumbers } from './server/route/geocode.mjs';
import { utm32ToLatLon } from './server/roads/utm.mjs';
import { sayable } from './server/siri.mjs';

// street spellings from OCR must collapse
assert.equal(normStreet('Hohe Straße'), normStreet('hohe str.'));
assert.equal(normStreet('Aachener Strasse'), normStreet('Aachener Str'));
assert.equal(stopKey({ street: 'Hohe Str.', number: '12 A' }), stopKey({ street: 'Hohe Straße', number: '12a' }));
assert.notEqual(stopKey({ street: 'Hohe Str.', number: '12' }), stopKey({ street: 'Hohe Str.', number: '12a' }));

// overlapping photos: same row twice -> one stop, first position kept, parcels not summed
const d = dedupe([
  { street: 'Hohe Str.', number: '1', parcels: 2 },
  { street: 'Ring', number: '5', parcels: 1 },
  { street: 'Hohe Straße', number: '1', parcels: 2, postcode: '50667' },
]);
assert.equal(d.length, 2);
assert.equal(d[0].parcels, 2);
assert.equal(d[0].postcode, '50667');
// same street + number in two towns stays two stops; a row without postcode still joins its twin
assert.equal(dedupe([{ street: 'Kölner Str.', number: '12', postcode: '50226' }, { street: 'Kölner Straße', number: '12', postcode: '50354' }]).length, 2);
assert.equal(dedupe([{ street: 'Kölner Str.', number: '12', postcode: '50226' }, { street: 'Kölner Str.', number: '12' }]).length, 1);
assert.equal(normStreet('Mülheimer Str.'), normStreet('Mülheimer Straße'), 'decomposed umlaut');

// ~111 m per 0.001° lat
assert.ok(Math.abs(meters({ lat: 50, lon: 7 }, { lat: 50.001, lon: 7 }) - 111) < 1);

// neighbours within 80 m share one parking stop; the far one does not
const s = [
  { lat: 50.9400, lon: 6.9600, type: 'private', parcels: 1 },
  { lat: 50.9403, lon: 6.9600, type: 'private', parcels: 1 }, // ~33 m
  { lat: 50.9500, lon: 6.9600, type: 'business', parcels: 3 }, // ~1.1 km
];
const c = cluster(s);
assert.equal(c.length, 2);
assert.equal(c[0].stops.length, 2);
assert.equal(serviceSec(s[2]), 4 * 60 + 60);
assert.ok(c[0].service > 2 * 120, 'walking time added for the second stop');

// VROOM gets our own matrix (city factor included): start = index 0, jobs 1..n, Express = a latest arrival
const job = vroomJob(c, { durations: [[0]], distances: [[0]] }, false, [null, [0, 3600]]);
assert.equal(job.vehicles[0].start_index, 0);
assert.equal(job.vehicles[0].end_index, undefined);
assert.deepEqual(job.jobs.map(j => [j.id, j.location_index, j.time_windows]), [[0, 1, undefined], [1, 2, [[0, 3600]]]]);
assert.equal(vroomJob(c, {}, true).vehicles[0].end_index, 3);
const at8 = new Date(2026, 8, 28, 8, 0).getTime();
assert.equal(dueSec('10:00', at8), 7200);
assert.equal(dueSec('07:30', at8), null, 'a deadline already past cannot be kept');
assert.equal(dueSec('', at8), null);
// a Paketshop's hours narrowed by an Express deadline; a shop already closed gives no window
assert.deepEqual(arrivalWindow([{ opens: '09:00-18:00' }], at8), [3600, 36000]);
assert.deepEqual(arrivalWindow([{ opens: '09:00-18:00' }, { express: '12:00' }], at8), [3600, 14400]);
assert.equal(arrivalWindow([{ opens: '06:00-07:30' }], at8), null);
assert.deepEqual(arrivalWindow([{ opens: '07:00-18:00' }], at8), [0, 36000], 'already open');

// text path: OCR digit look-alikes, and Express only on the stop whose lines carry it
assert.equal(fixNumber('27l'), '271');
assert.equal(fixNumber('2OO'), '200');
assert.equal(fixNumber('12B'), '12B');
assert.equal(fixNumber('12a'), '12a');
assert.equal(fixPostcode('5O9S1'), '50951');
const text = 'Kalker Hauptstr. 100\n51103 Koln\nBonner Str. 27l\n50968 Köln · DPD 10:00\nDeutz-Mulheimer Str 30\nEXPRESS';
const g = ground([
  { street: 'Kalker Hauptstr.', number: '100', postcode: '51103', express: '10:00' },
  { street: 'Bonner Str.', number: '27l', postcode: '50968', express: '' },
  { street: 'Deutz-Mülheimer Str', number: '30', postcode: '', express: '' },
], text);
assert.deepEqual(g.map(s => s.express), ['', '10:00', '18:00']);
assert.equal(g[1].number, '271');

// Siri reads street abbreviations badly
assert.equal(sayable('Hohe Str. 68'), 'Hohe straße 68');
assert.equal(sayable('Severinstr. 15'), 'Severinstraße 15');
assert.equal(sayable('Strunder Weg 2'), 'Strunder Weg 2');

// UTM 32N → lat/lon: central meridian is 9°E; 50°N lies 5,538,630.70 m north (GRS80 arc × 0.9996)
const near = (a, b, eps) => Math.abs(a - b) < eps;
const p50 = utm32ToLatLon(500000, 5538630.70);
assert.ok(near(p50.lat, 50, 1e-5) && near(p50.lon, 9, 1e-9), JSON.stringify(p50));
const west = utm32ToLatLon(400000, 5645000), east = utm32ToLatLon(600000, 5645000);
assert.ok(near(west.lat, east.lat, 1e-9) && near(9 - west.lon, east.lon - 9, 1e-9), 'symmetric about the central meridian');
assert.ok(west.lon > 7.5 && west.lon < 7.7 && west.lat > 50.9 && west.lat < 51, JSON.stringify(west));

// speed file: both directions per segment, the slowest wins where points overlap, closures are 0 km/h
const fakeNear = async (p, radiusM) => (radiusM >= 15 ? ['1,2', '2,1'] : []);
const lines = await speedLines([{ lat: 0, lon: 0, level: 'mild' }, { lat: 0, lon: 0, level: 'closed' }, { lat: 0, lon: 0, level: 'strong' }], fakeNear);
assert.deepEqual(lines.sort(), ['1,2,0', '2,1,0']);
assert.deepEqual(mergeLines(['1,2,15', '3,4,5'], ['1,2,0']).sort(), ['1,2,0', '3,4,5']);

// segment geometry: distance from a point to a segment, and only segments near the point are taken
const P = { lat: 50.94, lon: 6.96 }, eastOf = m => ({ lat: 50.94, lon: 6.96 + m / (111_320 * Math.cos(50.94 * Math.PI / 180)) });
const northOf = (m, base = P) => ({ lat: base.lat + m / 111_320, lon: base.lon });
assert.ok(near(distToSegment(P, northOf(10, eastOf(-50)), northOf(10, eastOf(50))), 10, 0.01), 'perpendicular distance');
assert.ok(near(distToSegment(P, eastOf(30), eastOf(80)), 30, 0.01), 'closest point is the segment end');
const road = { nodes: [1, 2, 3], coords: [eastOf(-100), eastOf(0), eastOf(100)].map(p => [p.lon, p.lat]) };      // through P
const parallel = { nodes: [7, 8], coords: [northOf(40, eastOf(-100)), northOf(40, eastOf(100))].map(p => [p.lon, p.lat]) }; // 40 m away
const segs = await segmentsAt(P, 20, async () => ({ ...road, nodes: [...road.nodes] })) ;
assert.deepEqual(segs.sort(), ['1,2', '2,1', '2,3', '3,2']);
assert.deepEqual(await segmentsAt(P, 20, async () => parallel), [], 'a parallel street 40 m away is left alone');
// one-way report: the road runs west→east (nodes 1→2→3); "no entry heading east" closes only that direction
assert.deepEqual((await segmentsAt({ ...P, heading: 85 }, 20, async () => ({ ...road }))).sort(), ['1,2', '2,3']);
assert.deepEqual((await segmentsAt({ ...P, heading: 270 }, 20, async () => ({ ...road }))).sort(), ['2,1', '3,2']);

// Verkehrskalender text -> level: only an explicit full closure is a hard closure
assert.equal(levelOf('Die Richmodstraße ist zwischen Neumarkt und Wolfsstraße in beide Fahrtrichtungen gesperrt.'), 'closed');
assert.equal(levelOf('Die Straße ist zwischen A und B voll gesperrt.'), 'closed');
assert.equal(levelOf('Die Boltensternstraße ist in Fahrtrichtung Riehler Straße abschnittsweise gesperrt.'), 'strong');
assert.equal(levelOf('Der Deutzer Ring ist in Fahrtrichtung Severinsbrücke eingeengt.'), 'mild');
assert.equal(levelOf('Konzert im Stadion'), 'mild');

// geocoding: a missing house number is placed at a neighbour's on the same street + postcode, never another town's
assert.deepEqual(nearbyNumbers('211'), ['209', '213', '207', '215', '210', '212', '208', '214']);
assert.deepEqual(nearbyNumbers('1253a').slice(0, 2), ['1253', '1251']);
assert.deepEqual(nearbyNumbers('Hinterhaus'), []);
const photon = { 'Venloer Str. 211, 50823 Köln': { lat: 1, lon: 1, exact: false, street: 'Venloer Straße', postcode: '50823' },
  'Venloer Str. 209, 50823 Köln': { lat: 2, lon: 2, exact: true, street: 'Venloer Straße', postcode: '50823' },
  'Neusser Str. 400, 50733 Köln': { lat: 3, lon: 3, exact: false, street: 'Neusser Straße', postcode: '50733' },
  'Neusser Str. 398, 50733 Köln': { lat: 9, lon: 9, exact: true, street: 'Neusser Straße', postcode: '51373' } };
const find = async q => photon[q] ?? null;
assert.deepEqual(await locate({ street: 'Venloer Str.', number: '211', postcode: '50823' }, find), { lat: 2, lon: 2, exact: true, near: '209' });
assert.equal((await locate({ street: 'Neusser Str.', number: '400', postcode: '50733' }, find)).exact, false, 'other town rejected');
// a wrong postcode makes Photon answer nothing: retried without it, then the street alone (same street only)
const photon2 = { 'Breslauer Platz 1, 50668 Köln': { lat: 5, lon: 5, exact: true, street: 'Breslauer Platz', postcode: '50668' },
  'Am Zuckerberg, Köln': { lat: 6, lon: 6, exact: false, street: 'Am Zuckerberg', postcode: '50668' }, 'Nirgendweg, Köln': { lat: 7, lon: 7, exact: false, street: 'Irgendweg' } };
assert.equal((await locate({ street: 'Am Zuckerberg', number: '32', postcode: '50670' }, async q => photon2[q] ?? null)).exact, false, 'street only');
assert.equal(await locate({ street: 'Nirgendweg', number: '1', postcode: '50670' }, async q => photon2[q] ?? null), null, 'a different street is not accepted');

// OCR text grouped by street: each stop reads its own lines, not the first same-street stop's
const grounded = ground([{ street: 'Hohe Str.', number: '5', postcode: '' }, { street: 'Hohe Str.', number: '68', postcode: '' }],
  ['Hohe Str. 5', '50667 Köln', 'Hohe Str. 68', '50667 Köln', 'EXPRESS 10:00'].join('\n'));
assert.deepEqual(grounded.map(s => s.express), ['', '10:00']);

// a save from an older copy can't undo a newer delivery (Siri), but a newer reopen wins; numbers are never reused
const saved = { stops: [{ key: 'a', no: 1, done: true, doneAt: 200 }, { key: 'b', no: 2, done: false, undoneAt: 300 }, { key: 'c', no: 3 }] };
const merged = mergeTour(saved, { stops: [{ key: 'a', no: 1, done: false }, { key: 'b', no: 2, done: true, doneAt: 100 }] });
assert.deepEqual(merged.stops.map(s => !!s.done), [true, false]);
assert.equal(merged.lastNo, 3, 'deleted stop #3 keeps its number taken');
assert.equal(mergeTour(merged, { stops: [], plan: null }).lastNo, 0, 'a cleared tour starts again at 1');

// street-only stops (all at the street's middle) never share a parking stop
const same = { lat: 50.94, lon: 6.95 };
assert.equal(cluster([{ ...same, exact: false }, { ...same, exact: false }, { ...same }]).length, 3);
assert.equal(cluster([{ ...same }, { ...same, lat: 50.9401 }]).length, 1, 'exact neighbours still walk');

// lateness: a stop VROOM couldn't fit goes where it's least late; a shop not yet open means waiting
{
  const m = [[0, 60, 60], [60, 0, 60], [60, 60, 0]]; // start, A, B: one minute apart
  assert.deepEqual(timeline([1, 2], m, [0, 0, 0], [null, null, [300, 400]]).arrive, [60, 300], 'waits for opening');
  assert.deepEqual(insertLate([1], [2], m, [0, 600, 0], [null, null, [0, 30]]), [2, 1], 'the late one goes first');
}

// the same address in another town (Photon's answer for a number that doesn't exist here) is not accepted
{
  const far = { lat: 50.80, lon: 7.10, exact: true, street: 'Agnesstraße', postcode: '53859' };
  const places = { 'Agnesstraße 69, 50670 Köln': far, 'Agnesstraße 69, Köln': far, '50670 Köln': { lat: 50.95, lon: 6.955 },
    'Agnesstraße, Köln': { lat: 50.955, lon: 6.958, exact: false, street: 'Agnesstraße', postcode: '50670' } };
  const g = await locate({ street: 'Agnesstraße', number: '69', postcode: '50670' }, async q => places[q] ?? null);
  assert.deepEqual([g.lat, g.exact], [50.955, false], 'street only, in the right place');
}

// a nearby-but-wrong street ("Ludwigstraße 117" -> Deutz-Kalker Straße 114, both within 3 km) is rejected too
{
  const near = { lat: 50.94, lon: 6.965, exact: true, street: 'Deutz-Kalker Straße', postcode: '50679' };
  const streetOnly = { lat: 50.941, lon: 6.966, exact: false, street: 'Ludwigstraße', postcode: '50670' };
  const places = { 'Ludwigstraße 117, 50670 Köln': near, '50670 Köln': { lat: 50.94, lon: 6.96 }, 'Ludwigstraße, Köln': streetOnly };
  const g = await locate({ street: 'Ludwigstraße', number: '117', postcode: '50670' }, async q => places[q] ?? null);
  assert.deepEqual([g.lat, g.exact], [streetOnly.lat, false], 'wrong street rejected, street-only hit used instead');
}

// the van parks on the address's own street, not the nearer alley round the corner; nothing named -> door point
const roads = [{ name: "", distance: 12, location: [6.9401, 50.9401] }, { name: 'Hohe Straße', distance: 40, location: [6.9405, 50.9402] }, { name: 'Hohe Str.', distance: 400, location: [6.95, 50.95] }];
assert.deepEqual(roadFor({ street: "Hohe Str." }, roads), { lat: 50.9402, lon: 6.9405 });
assert.equal(roadFor({ street: "Ring" }, roads), null);
assert.equal(roadFor({ street: 'Hohe Str.' }, roads.slice(2)), null, 'too far');
// the road point is where the van parks; the door stays where the driver walks to
assert.deepEqual(cluster([{ lat: 50.94, lon: 6.96, road: { lat: 50.9401, lon: 6.9601 }, type: 'private' }])[0].park, { lat: 50.9401, lon: 6.9601 });
// kerb side for every stop, free for start and end; the course only on the start
assert.equal(osrmOptions(4, { hasEnd: true }), '&approaches=unrestricted;curb;curb;unrestricted');
assert.equal(osrmOptions(3, { heading: 270.4 }), '&approaches=unrestricted;curb;curb&bearings=270,90;;');

// every server module loads (catches duplicate names and bad imports before a restart does)
await import('./server/api.mjs');

console.log('selfcheck ok');
