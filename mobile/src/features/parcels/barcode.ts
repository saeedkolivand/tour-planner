// What a DPD parcel label's codes say. Two codes, read from real labels:
// - the long Code 128: "%" + 7-digit destination postcode (zero-padded) + 14-digit parcel number
//   + 3-digit service + 3-digit country, e.g. "%005067001155072700119327276";
// - the square Aztec code (looks like a QR code, isn't): ISO 15434 "[)>" with the whole address, so a scan
//   gives street and house number without reading any text.

export interface Parcel {
  id: string;
  postcode?: string;
  service?: string;
  country?: string;
  street?: string;
  number?: string;
  city?: string;
  name?: string;
}

// Some decoders hand ISO 15434's separators over as their visible "control pictures" (␞ ␝ ␟ ␠).
const RS = '\x1e', GS = '\x1d', US = '\x1f';
const unpicture = (s: string) => s.replace(/␞/g, RS).replace(/␝/g, GS).replace(/␟/g, US).replace(/␠/g, ' ').replace(/␄/g, '\x04');

/**
 * Record "01": postcode, country, service, parcel number, …, street (12th field), city, …, name.
 * The house number sits in the "07 G03" record's sub-fields: its first short numeric one ("114", "12a").
 */
function aztec(raw: string): Parcel | null {
  const [, main = '', ...rest] = unpicture(raw).split(RS);
  const f = main.split(GS);
  if (f[0] !== '01' || !/^\d{14}$/.test(f[5] ?? '')) return null;
  const g03 = rest.find(r => r.startsWith(`07${GS}G03`)) ?? '';
  const number = g03.split(/[\x1d\x1f]/).map(x => x.trim()).find(x => /^[1-9]\d{0,3}\s?[a-zA-Z]?(-\d{1,4})?$/.test(x));
  return { id: f[5], postcode: f[2], country: f[3], service: f[4], street: f[13] || undefined, city: f[14] || undefined, name: f[16] || undefined, number };
}

export function parseParcel(data: string): Parcel | null {
  if (data.startsWith('[)>')) return aztec(data);
  const d = data.replace(/\s/g, '').toUpperCase();
  const dpd = /^%?(\d{7})(\d{14})(\d{3})(\d{3})[A-Z]?$/.exec(d);
  if (dpd) return { id: dpd[2], postcode: dpd[1].slice(-5), service: dpd[3], country: dpd[4] };
  if (/^\d{14}$/.test(d)) return { id: d };
  // other carriers' / return labels: any long code still identifies the parcel once it's been linked
  return /^[0-9A-Z%]{10,}$/.test(d) ? { id: d.replace(/^%/, '') } : null;
}
