/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Stop } from '../tour/types.ts';
import { parseParcel } from './barcode.ts';
import { matchStop } from './matchStop.ts';

// decoded from a real label (Gereonswall 114); the recipient's name and e-mail replaced
const AZTEC = '[)>␞01␝02␝50670␝276␝327␝01155072700119␝GEOP␝90000002406069521␝261␝FBRP-RP␠202609-2269716AU␝001/001␝22.00KG␝N␝Gereonswall␝Köln,␠Altstadt-Nord␝␝Muster␠GmbH␝␞07␝G03␝0␝0␝0␝␟Max␠Muster␟␟␟␟␟x@example.com␟114␟␟␟E␝22.0KG␝␝␝FBRP-RP␠202609-2269716AU␝DPD␠Classic␝␝␝DPD␠Classic␝0␝␝␞07␝S010␝Logistikzentrum␠Cottbus␟␟␟15␟Gerhart-Hauptmann-Str.␟␟Cottbus,␠Schmellwitz␟03044␟276␟␞␄';

test('DPD label: the Aztec code carries the whole address, not the sender house number', () => {
  assert.deepEqual(parseParcel(AZTEC), { id: '01155072700119', postcode: '50670', country: '276', service: '327', street: 'Gereonswall', city: 'Köln, Altstadt-Nord', name: 'Muster GmbH', number: '114' });
  const raw = AZTEC.replace(/␞/g, '\x1e').replace(/␝/g, '\x1d').replace(/␟/g, '\x1f').replace(/␠/g, ' ');
  assert.equal(parseParcel(raw)?.number, '114', 'raw control characters, as the iPhone camera delivers them');
});

test('DPD label barcode: postcode, parcel number, service, country', () => {
  assert.deepEqual(parseParcel('%005067001155072700119327276'), { id: '01155072700119', postcode: '50670', service: '327', country: '276' });
  assert.deepEqual(parseParcel('0123 4567 8901 23'), { id: '01234567890123' });
  assert.equal(parseParcel('hello'), null);
});

const s = (street: string, number: string, postcode = '50823', extra: Partial<Stop> = {}): Stop =>
  ({ street, number, postcode, type: 'private', parcels: 1, key: `${street}|${number}`, ...extra });
const stops = [s('Venloer Str.', '211'), s('Venloer Straße', '21'), s('Hohe Str.', '68', '50667'), s('Hohe Str.', '68a', '50667'), s('Subbelrather Straße', '5')];

test('the label address picks the stop; a shorter or suffixed number is a different house', () => {
  const label = 'DPD Classic\nMax Mustermann\nVenloer Straße 211\n50823 Köln';
  assert.equal((matchStop(stops, { id: '1', postcode: '50823' }, label) as { stop: Stop }).stop.number, '211');
  assert.equal((matchStop(stops, { id: '2' }, 'Hohe Str. 68\n50667 Köln') as { stop: Stop }).stop.number, '68');
  assert.equal((matchStop(stops, { id: '3' }, 'HOHE STRASSE 68 A') as { stop: Stop }).stop.number, '68a');
});

test('a scanned Aztec code finds its stop without any OCR', () => {
  const p = parseParcel(AZTEC)!;
  const tour = [...stops, s('Gereonswall', '114', '50670'), s('Gereonswall', '14', '50670')];
  assert.equal((matchStop(tour, p, `${p.street} ${p.number}`) as { stop: Stop }).stop.number, '114');
});

test('a linked parcel is found by its number alone; unreadable labels fall back to the postcode', () => {
  const linked = [...stops.slice(0, 4), s('Subbelrather Straße', '5', '50823', { parcelIds: ['0999'] })];
  assert.equal((matchStop(linked, { id: '0999' }) as { stop: Stop }).stop.street, 'Subbelrather Straße');
  const r = matchStop(stops, { id: 'x', postcode: '50667' }, 'smudged') as { candidates: Stop[] };
  assert.deepEqual(r.candidates.map(c => c.number), ['68', '68a']);
  assert.equal(matchStop(stops, { id: 'x' }, 'nothing'), null);
});
