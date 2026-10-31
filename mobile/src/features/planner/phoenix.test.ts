import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePhoenix, votePhoenix } from './phoenix.ts';

// a real photo's Apple Vision text (2026-10-31), the top row cut off and the last row's town not on the photo
const photo = `[rows]
© 01:09
Stoppliste
FEEC9
50616
Rhein
5
Zu
Bergische Apo im Kaufland
Stresemannstr. 37
DE 42719 Solingen
* To
Abh
Avie Apo am Blumentopf
Hugo-Zade-Weg 2b
DE 40764 Langenfeld
(Rheinland)
7
zu
Löwen-Apo
Solinger Str. 201
DE 40789 Monheim am
Rhein
Reusrather Apo
Opladener Str. 143`;

test('PHOENIX rows: name, count, Zu/Abh and the row\'s own town; the status bar and cut-off rows are not stops', () => {
  assert.deepEqual(parsePhoenix(photo), [
    { street: 'Stresemannstr.', number: '37', postcode: '42719', city: 'Solingen', type: 'business', parcels: 5, name: 'Bergische Apo im Kaufland' },
    { street: 'Hugo-Zade-Weg', number: '2b', postcode: '40764', city: 'Langenfeld', type: 'pickup', parcels: 0, name: 'Avie Apo am Blumentopf' },
    { street: 'Solinger Str.', number: '201', postcode: '40789', city: 'Monheim am Rhein', type: 'business', parcels: 7, name: 'Löwen-Apo' },
  ]);
});

test('overlapping photos: misread copies of one pharmacy vote into one stop, parcels never summed', () => {
  const a = parsePhoenix(photo);
  const b = parsePhoenix(photo.replace('Hugo-Zade-Weg 2b', 'Hugo-Zade-Weg 26').replace('* To', '9').replace('DE 42719 Solingen', 'DE 10607 Calin:'));
  const out = votePhoenix([...a, ...b, ...a]);
  assert.equal(out.length, 3);
  assert.deepEqual(out.map(s => [s.number, s.postcode, s.parcels]), [['37', '42719', 5], ['2b', '40764', 9], ['201', '40789', 7]]);
  assert.equal(parsePhoenix('Neue Apo\nNeuer Markt 5l\nDE 42781 Haan').length, 0, 'a misread digit is no house letter');
});
