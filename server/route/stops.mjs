// Stop identity: which scanned rows are the same stop.

/** "Hohe Straße" and "hohe str." must compare equal; NFC first, or a decomposed "ü" (u + ¨) slipped past. */
export const normStreet = s => String(s ?? '').normalize('NFC').toLowerCase()
  .replace(/ß/g, 'ss').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
  .replace(/strasse\b|str\b\.?/g, 'str').replace(/[^a-z0-9]/g, '');

const address = s => `${normStreet(s.street)}|${String(s.number).toLowerCase().replace(/\s/g, '')}`;
const plz = s => String(s.postcode ?? '').replace(/\D/g, '');
/** Street + number + postcode: "Kölner Str. 12" exists in Frechen and in Hürth. */
export const stopKey = s => address(s) + (plz(s) ? `|${plz(s)}` : '');

/** The address as a geocoder query. */
export const label = s => `${s.street} ${s.number}, ${s.postcode || ''} ${s.city || 'Köln'}`.replace(/\s+/g, ' ').trim();

/**
 * Overlapping photos show the same row twice: keep the first (= scanner order), never sum parcels.
 * A row without a postcode joins the same address with one; two different postcodes stay two stops.
 */
export function dedupe(stops) {
  const out = [];
  for (const s of stops) {
    const had = out.find(o => address(o) === address(s) && (!plz(o) || !plz(s) || plz(o) === plz(s)));
    if (!had) { out.push({ ...s, key: stopKey(s) }); continue; }
    Object.assign(had, {
      parcels: Math.max(had.parcels || 1, s.parcels || 1),
      postcode: had.postcode || s.postcode, express: had.express || s.express, name: had.name || s.name,
    });
    had.key = stopKey(had);
  }
  return out;
}
