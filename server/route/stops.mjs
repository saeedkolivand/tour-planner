// Stop identity: which scanned rows are the same stop.

/** "Hohe Straße" and "hohe str." must compare equal; NFC first, or a decomposed "ü" (u + ¨) slipped past. */
export const normStreet = s => String(s ?? '').normalize('NFC').toLowerCase()
  .replace(/ß/g, 'ss').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
  .replace(/strasse\b|str\b\.?/g, 'str').replace(/[^a-z0-9]/g, '');

/**
 * Two spellings of one street: equal once folded, one the start of the other ("Aquinost." for Aquinostraße), or a
 * single character off in a long name ("Gereonsmühlangasse"). Guards the geocoder's "is this the street I asked for".
 */
export function alike(a, b) {
  const x = normStreet(a), y = normStreet(b);
  if (x === y) return true;
  if (x.length >= 6 && y.length >= 6 && (x.startsWith(y) || y.startsWith(x))) return true;
  // one character off, only in long names that start the same: "Nirgendweg" is not "Irgendweg"
  return x.length >= 12 && y.length >= 12 && x.slice(0, 3) === y.slice(0, 3) && editDistance(x, y) <= 1;
}
function editDistance(a, b) {
  let prev = [...Array(b.length + 1).keys()];
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

const address = s => `${normStreet(s.street)}|${String(s.number).toLowerCase().replace(/\s/g, '')}`;
const plz = s => String(s.postcode ?? '').replace(/\D/g, '');
/** Street + number + postcode: "Kölner Str. 12" exists in Frechen and in Hürth. */
export const stopKey = s => address(s) + (plz(s) ? `|${plz(s)}` : '');

/** The address as a geocoder query. */
export const label = s => `${s.street} ${s.number}, ${s.postcode || ''} ${s.city || 'Köln'}`.replace(/\s+/g, ' ').trim();

/**
 * Overlapping photos show the same row twice: keep the first (= scanner order), never sum parcels.
 * Two different recipients at one door are one stop with both their parcels.
 * A row without a postcode joins the same address with one; two different postcodes stay two stops.
 */
const sameName = (a, b) => !a || !b || normStreet(a) === normStreet(b);
export function dedupe(stops) {
  const out = [];
  for (const s of stops) {
    const had = out.find(o => address(o) === address(s) && (!plz(o) || !plz(s) || plz(o) === plz(s)));
    if (!had) { out.push({ ...s, key: stopKey(s) }); continue; }
    Object.assign(had, {
      parcels: sameName(had.name, s.name) ? Math.max(had.parcels || 1, s.parcels || 1) : (had.parcels || 1) + (s.parcels || 1),
      postcode: had.postcode || s.postcode, express: had.express || s.express, name: had.name || s.name,
    });
    had.key = stopKey(had);
  }
  return out;
}
