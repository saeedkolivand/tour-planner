// The City of Cologne's traffic calendar ("Verkehrskalender", open data): closures and narrowings with dates
// and a sentence like "… ist zwischen A und B in beide Fahrtrichtungen gesperrt". More precise than the
// roadworks permits (roadworks.mjs), which say nothing about closed vs one lane.
// https://ckan.open.nrw.de/dataset/verkehrsbeeintrachtigungen-stadt-koln-k · points in WGS84.
import { log } from '../log.mjs';

const URL_ = 'https://geoportal.stadt-koeln.de/arcgis/rest/services/verkehr/verkehrskalender/MapServer/0/query?where=1%3D1&outFields=*&f=geojson&outSR=4326';
const L = log('verkehrskalender');

/**
 * Only an explicit full closure becomes a hard one; "in Fahrtrichtung X gesperrt" closes one direction we
 * can't tell from a point, so it's a strong slow-down; narrowings, events and the rest are mild.
 */
export function levelOf(text = '') {
  if (/beiden? Fahrtrichtung(en)? (voll )?gesperrt|voll ?gesperrt|vollsperrung/i.test(text)) return 'closed';
  if (/gesperrt|sperrung/i.test(text)) return 'strong';
  return 'mild';
}

/** [{id, lat, lon, level, label}] for entries active today. */
export async function verkehrskalender(now = Date.now()) {
  const r = await fetch(URL_, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`verkehrskalender: HTTP ${r.status}`);
  const endOfDay = new Date(now).setHours(23, 59, 59, 999);
  const list = ((await r.json()).features ?? [])
    .filter(f => f.geometry?.type === 'Point' && f.properties.datum_von <= endOfDay && f.properties.datum_bis >= now)
    .map(f => {
      const [lon, lat] = f.geometry.coordinates, p = f.properties;
      return { id: `vk:${p.objectid}`, lat, lon, level: levelOf(p.beschreibung), label: `${p.name}: ${p.beschreibung ?? ''}`.slice(0, 200) };
    });
  L.info('fetched', { active: list.length, closed: list.filter(p => p.level === 'closed').length, strong: list.filter(p => p.level === 'strong').length });
  return list;
}
