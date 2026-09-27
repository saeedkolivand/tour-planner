// What every reader must return, and what we tell it. Shared by the appliance and Claude providers.

export const EXPRESS_TIMES = ['08:30', '10:00', '12:00', '14:00', '18:00'];

const STOP = {
  type: 'object', additionalProperties: false,
  required: ['street', 'number', 'postcode', 'city', 'type', 'express', 'parcels'],
  properties: {
    street: { type: 'string' }, number: { type: 'string' }, postcode: { type: 'string' }, city: { type: 'string' },
    name: { type: 'string' },
    type: { type: 'string', enum: ['private', 'business', 'pickup', 'shop'] },
    express: { type: 'string', enum: ['', ...EXPRESS_TIMES] }, // '' = not express; required so small models don't skip it
    parcels: { type: 'integer' },
    note: { type: 'string' },
  },
};
export const SCHEMA = { type: 'object', additionalProperties: false, required: ['stops'], properties: { stops: { type: 'array', items: STOP } } };

export const isValid = o => Array.isArray(o?.stops) && o.stops.every(s => s.street?.trim() && s.number?.trim());

const RULES = `Extract every delivery stop, top to bottom, in the order shown.
- street: as written, e.g. "Hohe Str." or "Aachener Straße". number: house number incl. suffix, e.g. "12a", "3-5".
- postcode: 5 digits if present, else "". city: if absent use "Köln".
- name: recipient or company if shown.
- type: "shop" = a DPD Pickup Paketshop or parcel station being supplied; "pickup" = Abholung / Retoure / collecting a parcel;
  "business" = any company or trade (GmbH, AG, KG, Praxis, Apotheke, Kanzlei, a shop's name); otherwise "private".
- express: if the stop shows "EXPRESS", "Express 12:00", "DPD 10:00", "8:30" or similar, set it to that deadline ("08:30", "10:00", "12:00" or "18:00"; plain "Express" = "18:00"); otherwise "".
- parcels: number of parcels for that stop if shown, else 1.
- note: other useful details (floor, Hinterhaus, Ablageort), else omit.
Do not invent stops. Reply with JSON only: {"stops":[...]}.`;

export const IMAGE_PROMPT = `This is a phone photo of a DPD parcel scanner screen listing delivery stops in or around Cologne, Germany.
Skip rows cut off at the top or bottom edge (another photo covers them). Ignore glare and reflections.
${RULES}`;

export const TEXT_PROMPT = `Below is OCR text (possibly with recognition errors) from a DPD parcel scanner screen listing delivery stops in or around Cologne, Germany.
A stop starts at a line with a street and house number; the following lines until the next street line belong to that same stop, and only to it.
Fix obvious OCR mistakes: German street names and umlauts (Mulheimer -> Mülheimer, Koln -> Köln), and in house numbers and postcodes letters that are digits (l or I -> 1, O -> 0, S -> 5, B -> 8).
${RULES}

OCR text:
`;
