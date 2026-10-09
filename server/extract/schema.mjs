// What every reader must return, and what we tell it. Shared by the appliance and Claude providers.

export const EXPRESS_TIMES = ['08:30', '10:00', '12:00', '14:00', '18:00'];

const STOP = {
  type: 'object', additionalProperties: false,
  required: ['street', 'number', 'postcode', 'city', 'type', 'express', 'parcels', 'prio'],
  properties: {
    street: { type: 'string' }, number: { type: 'string' }, postcode: { type: 'string' }, city: { type: 'string' },
    name: { type: 'string' },
    type: { type: 'string', enum: ['private', 'business', 'pickup', 'shop'] },
    express: { type: 'string', enum: ['', ...EXPRESS_TIMES] }, // '' = not express; required so small models don't skip it
    prio: { type: 'boolean' }, // the scanner's literal "PRIO" label on the row (a small model reads a flag better than it infers a deadline)
    parcels: { type: 'integer' },
    opens: { type: 'string' },
    note: { type: 'string' },
  },
};
export const SCHEMA = { type: 'object', additionalProperties: false, required: ['stops'], properties: { stops: { type: 'array', items: STOP } } };

export const isValid = o => Array.isArray(o?.stops);

const spanH = w => { const m = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(w.replace(/\s/g, '')); return m ? (m[3] * 60 + +m[4] - m[1] * 60 - m[2]) / 60 : 0; };
const NUMBER_AT_END = /^(.+?)\s+(\d+\s*[a-zA-Z]?(?:\s*-\s*\d+\s*[a-zA-Z]?)?)$/;
/**
 * What the model returns, made usable in code rather than by prompting a small model harder:
 * - the house number often lands in the street ("Steinfelder Gasse 27", number "" or "27"): split it off;
 * - PRIO is the scanner's only Express marker: due by 18:00. A picture never shows "Express 12:00", so an
 *   `express` the model inferred from the row's planned time slot is dropped (the OCR-text path keeps its own rule);
 * - a row without an address (cut off, a header) is dropped, not the whole photo.
 */
export function usable(stops, { fromImage = true } = {}) {
  return stops.flatMap(raw => {
    const s = { ...raw, street: String(raw.street ?? '').trim(), number: String(raw.number ?? '').trim() };
    const m = NUMBER_AT_END.exec(s.street);
    if (m && (!s.number || s.number === m[2].replace(/\s+/g, ''))) { s.street = m[1].trim(); s.number = m[2].replace(/\s+/g, ''); }
    if (fromImage) s.express = s.prio ? '18:00' : '';
    delete s.prio;
    // opening hours exist for shops only, and span more than the 2-hour planned slot the model likes to copy here
    if (s.opens && !(s.type === 'shop' && spanH(s.opens) > 2)) delete s.opens;
    return s.street && s.number ? [s] : [];
  });
}

const RULES = `Extract every delivery stop, top to bottom, in the order shown. One stop per row: a bold name line,
the street with house number under it, then postcode and city.
- name: the bold name line (person or company).
- street: the street name only, e.g. "Hohe Str.", "Aachener Straße", copied exactly with its umlauts.
- number: the house number incl. suffix, e.g. "12a", "3-5".
- postcode: 5 digits if present (letters after them are not part of it), else "". city: if absent use "Köln".
- type: "shop" = a DPD Pickup Paketshop being supplied (red parcel icon before the name); "pickup" = Abholung / Retoure;
  "business" = a company or practice (GmbH, KG, OHG, e.V., Praxis, Apotheke, Kanzlei, Kita); a person = "private".
- parcels: the bold number at the row's top right, else 1.
- prio: true only if the word "PRIO" is printed in that row, else false.
- express: "" unless the row literally says EXPRESS with a time ("Express 12:00" -> "12:00").
- opens: opening hours printed in the row, like "11:00-19:00"; else omit.
- note: a weight icon ">10" or ">20" as "schwer >10 kg" / "schwer >20 kg"; else omit.
Do not invent stops. Reply with JSON only: {"stops":[...]}.`;

export const IMAGE_PROMPT = `This is a phone photo of a DPD parcel scanner screen listing delivery stops in or around Cologne, Germany.
Skip rows cut off at the top or bottom edge (another photo covers them). Ignore glare and reflections.
${RULES}`;

export const TEXT_PROMPT = `Below is OCR text (possibly with recognition errors) from a DPD parcel scanner screen listing delivery stops in or around Cologne, Germany.
A stop starts at a line with a street and house number. Above it, its header: the recipient's name (a person or a company), a "PRIO" flag and the parcel count (a lone number). Below it, its trailer: "50670HX Köln" (postcode 50670; the letters are not part of it), a route code like "G 11 T 387" and the planned slot "09:11 / 11:11" (not a deadline). Assign each line to the right stop that way.
Fix obvious OCR mistakes: German street names and umlauts (Mulheimer -> Mülheimer, Koln -> Köln), and in house numbers and postcodes letters that are digits (l or I -> 1, O -> 0, S -> 5, B -> 8).
${RULES}

OCR text:
`;
