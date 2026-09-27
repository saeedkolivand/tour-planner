// Today's approved roadworks from the City of Cologne (open data, "Datenlizenz Deutschland – Zero 2.0").
// https://offenedaten-koeln.de/dataset/baustellen-koeln · the service only returns current permits.
// Permits are points with no "closed vs one lane" flag, and the permit period isn't the work period,
// so they become slow-downs ("strong"/"mild"), never hard closures.
import { log } from '../log.mjs';
import { utm32ToLatLon } from './utm.mjs';

const WFS = 'https://geoportal.stadt-koeln.de/wss/service/baustellen_wfs/guest?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&OUTPUTFORMAT=geojson&TYPENAMES=ms:';
const L = log('roadworks');

/** Categories that affect driving. Scaffolding, containers, site setup and greenery mostly sit off the carriageway. */
export const CATEGORIES = {
  strassenbauarbeiten: 'strong', kanalsanierung: 'strong', notfall: 'strong', brueckenarbeiten: 'strong', tunnelarbeiten: 'strong',
  versorgungsarbeiten: 'mild', markierungsarbeiten: 'mild', ampelarbeiten: 'mild', sondierungsarbeiten: 'mild', gleisbau: 'mild',
};

async function fetchCategory(type) {
  const r = await fetch(WFS + type, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`roadworks ${type}: HTTP ${r.status}`);
  return (await r.json()).features ?? [];
}

/** [{id, lat, lon, level, label}] for today's roadworks that affect driving. Categories that fail are skipped. */
export async function roadworks() {
  const out = new Map();
  const results = await Promise.allSettled(Object.keys(CATEGORIES).map(async type => ({ type, features: await fetchCategory(type) })));
  for (const r of results) {
    if (r.status === 'rejected') { L.warn('category failed', { error: r.reason }); continue; }
    for (const f of r.value.features) {
      const [e, n] = f.geometry?.coordinates ?? [];
      if (f.geometry?.type !== 'Point' || !e || !n) continue;
      const id = `koeln:${f.properties.Aktenzeichen}`;
      if (!out.has(id)) out.set(id, { id, ...utm32ToLatLon(e, n), level: CATEGORIES[r.value.type], label: `${f.properties.Kategorie}: ${f.properties.Adresse}` });
    }
  }
  const list = [...out.values()];
  L.info('fetched', { total: list.length, strong: list.filter(p => p.level === 'strong').length, failedCategories: results.filter(r => r.status === 'rejected').length });
  return list;
}
