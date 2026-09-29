// Address -> coordinates via self-hosted Photon, with a permanent cache that hand-fixed pins override.
import fs from 'node:fs';
import { writeAtomic } from '../files.mjs';
import { log } from '../log.mjs';
import { alike, label, normStreet } from './stops.mjs';

// `localhost`, not 127.0.0.1: WSL forwards some services on IPv4 and some on IPv6 only.
const PHOTON = process.env.PHOTON_URL || 'http://localhost:2322';
const CACHE = new URL('../../data/geocache.json', import.meta.url);
const COLOGNE = { lat: 50.94, lon: 6.96 }; // location bias
const L = log('geocode');

let cache = null;
const load = () => cache ??= (() => { try { return JSON.parse(fs.readFileSync(CACHE)); } catch { return {}; } })();
const save = () => writeAtomic(CACHE, JSON.stringify(cache, null, 1));

/** A dragged pin: remembered for this stop key forever. */
export function pin(key, lat, lon) {
  load()[key] = { lat, lon, pinned: true };
  save();
  L.info('pinned', { key, lat, lon });
}

/** Free-text query (the depot, or one address). null when nothing matches. */
export async function geocodeText(q) {
  const u = `${PHOTON}/api?q=${encodeURIComponent(q)}&lat=${COLOGNE.lat}&lon=${COLOGNE.lon}&limit=1&lang=de`;
  const f = (await (await fetch(u)).json()).features?.[0];
  if (!f) return null;
  const [lon, lat] = f.geometry.coordinates, p = f.properties;
  return { lat, lon, exact: !!p.housenumber, street: p.street ?? p.name ?? '', postcode: p.postcode ?? '' };
}

/**
 * House numbers OSM may have instead of the one asked for: "12a" / "3-5" -> 12 / 3, then the neighbours on the
 * same side of the street (±2, ±4), then across (±1, ±3). Exported for the selfcheck.
 */
export function nearbyNumbers(number) {
  const n = parseInt(number, 10);
  if (!(n > 0)) return [];
  return [...new Set([String(n) === String(number).trim() ? null : n, n - 2, n + 2, n - 4, n + 4, n - 1, n + 1, n - 3, n + 3])]
    .filter(x => x > 0).map(String);
}

/**
 * Photon answers nothing at all when the postcode doesn't fit the street (misread by OCR, or wrong on the list:
 * Breslauer Platz is 50668, not 50670). Then: the same address without the postcode, else the street itself
 * (street-only) - but only a hit on that very street, never whatever Photon finds instead.
 */
const sameStreetOf = (s, near) => h => h && alike(h.street, s.street) && near(h);

async function fallback(s, find, near) {
  const sameStreet = sameStreetOf(s, near);
  const noPostcode = s.postcode ? await find(label({ ...s, postcode: '' })) : null;
  if (sameStreet(noPostcode)) { L.info('found without the postcode', { key: s.key, postcode: s.postcode, real: noPostcode.postcode }); return noPostcode; }
  const street = await find(`${s.street}, ${s.city || 'Köln'}`);
  if (sameStreet(street)) { L.info('placed on the street only', { key: s.key }); return { ...street, exact: false }; }
  return null;
}

/**
 * One stop -> {lat, lon, exact}. Photon's OSM data lacks some house numbers and then answers with the street's
 * middle: on a 5 km street that's kilometres off. A neighbour's number, checked to be on the same street and
 * postcode (a bare "Neusser Str. 398" also exists in other towns), is metres off: that counts as exact.
 */
export async function locate(s, find = geocodeText) {
  const near = await nearPostcode(s, find);
  const first = await find(label(s));
  const sameStreet = sameStreetOf(s, near);
  // Photon answers a house number that doesn't exist in this postcode with the same address elsewhere
  // ("Agnesstraße 69, 50670" -> an Agnesstraße 69 20 km away, as an exact hit): only accept what's nearby
  if (first && !near(first)) L.warn('same address in another place, ignored', { key: s.key, found: first.postcode });
  else if (first && !sameStreet(first)) L.warn('another street, ignored', { key: s.key, found: first.street });
  const g = (sameStreet(first) ? first : null) ?? (await fallback(s, find, near));
  if (!g || g.exact) return g;
  for (const n of nearbyNumbers(s.number)) {
    const h = await find(label({ ...s, number: n }));
    // same street, and either the list's postcode or right by where the street was found (the list's postcode
    // can be wrong; another town's street of that name is kilometres away)
    if (h?.exact && alike(h.street, s.street) && near(h) && (!s.postcode || h.postcode === s.postcode || km(h, g) < 1)) {
      L.info('placed by a neighbouring number', { key: s.key, used: n });
      return { lat: h.lat, lon: h.lon, exact: true, near: n };
    }
  }
  return g;
}

const km = (a, b) => Math.hypot((a.lat - b.lat) * 111, (a.lon - b.lon) * 70);

const postcodeCentre = new Map();
/**
 * A test for "is this hit where the stop can be": its own postcode, or within 3 km of that postcode's area
 * (the list's postcode can be off by one district; another town's street of the same name can't).
 */
async function nearPostcode(s, find) {
  const pc = String(s.postcode ?? '').replace(/\D/g, '');
  if (!/^\d{5}$/.test(pc)) return () => true;
  // only answers are remembered: a failed lookup must not switch the check off for the rest of the run
  const centre = postcodeCentre.get(pc) ?? (await find(`${pc} ${s.city || 'Köln'}`).catch(() => null));
  if (centre) postcodeCentre.set(pc, centre);
  return h => !h || h.postcode === pc || !centre || km(h, centre) < 3;
}

/** The vision model swaps umlauts now and then ("Kämpchenshof" for Kümpchenshof): the same name with each umlaut swapped. */
export function umlautVariants(street) {
  const out = [];
  for (const [i, ch] of [...street].entries()) {
    if (!'äöü'.includes(ch.toLowerCase())) continue;
    for (const alt of 'äöü'.replace(ch.toLowerCase(), '')) out.push(street.slice(0, i) + (ch === ch.toUpperCase() ? alt.toUpperCase() : alt) + street.slice(i + 1));
  }
  return out;
}

/** locate(), then the umlaut swaps when the street as read does not exist; the stop takes the spelling that does. */
async function locateForgiving(s) {
  const g = await locate(s);
  if (g) return g;
  for (const street of umlautVariants(s.street)) {
    const h = await locate({ ...s, street });
    if (h) { L.info('street found with an umlaut swapped', { key: s.key, street }); s.street = street; return h; }
  }
  return null;
}

/** Adds lat/lon/exact to each stop in place; returns the stops that could not be found. */
export async function geocode(stops) {
  const c = load(), missing = [];
  let hits = 0, looked = 0;
  for (const s of stops) {
    let g = c[s.key];
    if (g && (g.exact || g.pinned)) hits++; // "street only" is retried: the OSM data may have the number by now
    else {
      looked++;
      g = await locateForgiving(s).catch(e => { L.error('photon failed', { key: s.key, error: e }); return null; });
      if (g?.street && normStreet(g.street) !== normStreet(s.street)) { L.info('street spelling corrected', { key: s.key, read: s.street, real: g.street }); s.street = g.street; }
      if (g) { c[s.key] = { lat: g.lat, lon: g.lon, exact: g.exact, ...(g.near && { near: g.near }) }; save(); }
    }
    if (g) Object.assign(s, { lat: g.lat, lon: g.lon, exact: g.exact ?? true });
    else missing.push(s);
  }
  L.info('geocoded', { stops: stops.length, cacheHits: hits, looked, missing: missing.map(s => s.key) });
  return missing;
}
