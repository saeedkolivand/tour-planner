// The phone's own geocoder and travel times, for planning without the PC.
import { storage } from '@/shared/storage';
import * as Location from 'expo-location';
import { getSettings } from '@/features/settings/settings';
import type { LatLon } from '@/features/tour/types';
import { t } from '@/shared/i18n';
import { log } from '@/shared/log';
import { alike, holds, locate as locateBy, type Hit } from './locate';
import { estimateMatrix, orsMatrix, osrmMatrix, type MatrixOptions } from './matrix';
import type { PhoneDeps } from './planOnPhone';
import { meters } from './stops';
import { VROOM_MAX_JOBS, vroomOrder, type VroomInput } from './vroom';

const L = log('phone-planner');
// on a corner, Apple/Google may reverse-geocode to the cross street instead of the queried one;
// accept the hit if the queried street shows up in any of the address's name-ish fields
const onStreet = (p: Location.LocationGeocodedAddress | undefined, street: string) =>
  !!p && ([p.street, p.name, p.formattedAddress].some((x) => x && holds(x, street)) || (!!p.street && alike(p.street, street)));
const KEY = 'geocache-v2'; // v1 could return the wrong street's hit; force a re-lookup
const COLOGNE = { lat: 50.94, lon: 6.96 };
let cache: Record<string, LatLon & { exact?: boolean }> | null = null;
const load = async () => (cache ??= JSON.parse((await storage.getItem(KEY).catch(() => null)) ?? '{}') as Record<string, LatLon & { exact?: boolean }>);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
// Apple's CLGeocoder rate-limits bursts per app: after a few dozen back-to-back lookups every further
// geocodeAsync/reverseGeocodeAsync call starts failing within the same second. Space every platform call
// at least 700ms apart via a single promise-chain gate, shared by all four call sites below.
let gateAt = 0;
let gate = Promise.resolve();
function paced<T>(fn: () => Promise<T>): Promise<T> {
  const run = gate.then(() => {
    const wait = gateAt - Date.now();
    gateAt = Math.max(gateAt, Date.now()) + 700;
    return wait > 0 ? sleep(wait) : undefined;
  });
  gate = run.catch(() => {});
  return run.then(fn);
}
// throttling is transient: on failure, wait 3s (clear of the gate) and retry once before giving up
async function pacedRetry<T>(fn: () => Promise<T>): Promise<T> {
  try { return await paced(fn); }
  catch { await sleep(3000); return paced(fn); }
}
// ponytail: first plan of ~70 unseen addresses takes ~2-3 min on the phone (pacing + retries); later
// plans hit the cache and are fast. No progress UI; add one if that wait proves confusing in practice.

/**
 * Apple's geocoder on iPhone, Google's on Android; remembered on the phone, so each address is looked up once.
 * Both happily answer a house number that doesn't exist with a different, nearby street (the PC's Photon does
 * the same, see server/route/geocode.mjs): reverse-geocode the hit and check its street before trusting it.
 */
async function geocode(q: string): Promise<(LatLon & { exact?: boolean }) | null> {
  const c = await load(), k = q.toLowerCase();
  if (c[k]) { L.debug('geocode: remembered', { q, ...c[k] }); return c[k]; }
  // Android's geocoder needs location permission (iOS's doesn't, and asking again is free once granted)
  await Location.requestForegroundPermissionsAsync().catch(() => null);
  const hits = await pacedRetry(() => Location.geocodeAsync(q)).catch((e) => { L.warn('geocoder failed', { q, error: e }); return null; });
  if (!hits) return null; // the call itself failed (already logged) — don't also warn "not found"
  const [hit] = hits;
  L.debug('geocode: phone answered', { q, hits: hits.length, first: hit && { lat: hit.latitude, lon: hit.longitude, kmFromKoeln: Math.round(meters(COLOGNE, { lat: hit.latitude, lon: hit.longitude }) / 1000) } });
  // the platform geocoders happily answer "somewhere in Germany": only take results in the Cologne region
  if (!hit || meters(COLOGNE, { lat: hit.latitude, lon: hit.longitude }) > 60_000) { L.warn('not found near Köln', { q }); return null; }

  const parts = /^([^\d]*)\d+(.*)$/.exec(q); // "Ludwigstraße 117, 50670 Köln" -> street "Ludwigstraße", rest ", 50670 Köln"
  const street = parts?.[1].trim();
  let g: (LatLon & { exact?: boolean }) | null = { lat: hit.latitude, lon: hit.longitude, exact: true };
  if (street) {
    const [place] = await pacedRetry(() => Location.reverseGeocodeAsync({ latitude: hit.latitude, longitude: hit.longitude })).catch(() => []);
    L.debug('geocode: what is there', { q, street: place?.street, name: place?.name, city: place?.city, postcode: place?.postalCode, matches: !!place && onStreet(place, street) });
    if (place && !onStreet(place, street)) {
      const rest = parts![2].replace(/\b\d{5}\b/, '').replace(/^[\s,]+/, '').replace(/\s+/g, ' ');
      const retryQ = `${street}, ${rest}`;
      const [hit2] = await pacedRetry(() => Location.geocodeAsync(retryQ)).catch((e) => { L.warn('geocoder failed', { q: retryQ, error: e }); return []; });
      const [place2] = hit2 ? await pacedRetry(() => Location.reverseGeocodeAsync({ latitude: hit2.latitude, longitude: hit2.longitude })).catch(() => []) : [];
      g = onStreet(place2, street) ? { lat: hit2!.latitude, lon: hit2!.longitude, exact: false } : null;
      if (!g) L.warn('another street, ignored', { q, found: place.street });
    }
  }
  if (!g) return null;
  c[k] = g;
  storage.setItem(KEY, JSON.stringify(c)).catch(() => {});
  return g;
}

// OpenStreetMap's public Photon (komoot), the same geocoder the PC runs itself: the second opinion for an address
// the phone's own geocoder could not place. Asked only for those, so a handful of lookups per tour (fair use).
const PHOTON = 'https://photon.komoot.io/api/';
type PhotonFeature = { geometry: { coordinates: [number, number] }; properties: { name?: string; street?: string; housenumber?: string; postcode?: string; city?: string } };

async function photon(q: string): Promise<Hit | null> {
  const url = `${PHOTON}?q=${encodeURIComponent(q)}&lat=${COLOGNE.lat}&lon=${COLOGNE.lon}&limit=5&lang=de`;
  const r = await fetch(url, { signal: AbortSignal.timeout?.(15_000) });
  if (!r.ok) throw new Error(`Photon ${r.status}`);
  const { features = [] } = (await r.json()) as { features?: PhotonFeature[] };
  // the whole world's addresses: the first answer in the Cologne region, as the phone's geocoder is held to
  const f = features.find(x => meters(COLOGNE, { lat: x.geometry.coordinates[1], lon: x.geometry.coordinates[0] }) <= 60_000);
  const hit = f && { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], street: f.properties.street ?? f.properties.name ?? '', postcode: f.properties.postcode ?? '', number: f.properties.housenumber };
  L.debug('photon answered', { q, answers: features.length, hit: hit && `${hit.street} ${hit.number ?? ''}, ${hit.postcode}` });
  return hit ?? null;
}

// Geoapify (the driver's own key; free up to 3,000 lookups a day): the third opinion, by the same rules as Photon.
type GeoapifyResult = { lat: number; lon: number; street?: string; name?: string; housenumber?: string; postcode?: string };

async function geoapify(q: string): Promise<Hit | null> {
  const key = getSettings().geoapifyKey.trim();
  const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(q)}&filter=circle:${COLOGNE.lon},${COLOGNE.lat},60000&bias=proximity:${COLOGNE.lon},${COLOGNE.lat}&lang=de&limit=1&format=json&apiKey=${encodeURIComponent(key)}`;
  const r = await fetch(url, { signal: AbortSignal.timeout?.(15_000) });
  if (!r.ok) throw new Error(r.status === 401 ? 'Geoapify rejected the key (401)' : `Geoapify ${r.status}`);
  const [f] = ((await r.json()) as { results?: GeoapifyResult[] }).results ?? [];
  L.debug('geoapify answered', { q, hit: f && `${f.street ?? f.name ?? ''} ${f.housenumber ?? ''}, ${f.postcode ?? ''}` });
  return f ? { lat: f.lat, lon: f.lon, street: f.street ?? f.name ?? '', postcode: f.postcode ?? '', number: f.housenumber } : null;
}

/** A stop the phone's geocoder could not place, by OpenStreetMap, then Geoapify (with a key); remembered like the phone's own answers. */
async function locate(s: Parameters<NonNullable<PhoneDeps['locate']>>[0], q: string) {
  let g = await locateBy(s, photon, (msg, data) => L.debug(msg, { q, ...data }));
  L.info(g ? 'placed by OpenStreetMap' : 'not found by OpenStreetMap either', { q, ...(g && { exact: g.exact, street: g.street }) });
  if (!g && getSettings().geoapifyKey.trim()) {
    g = await locateBy(s, geoapify, (msg, data) => L.debug(msg.replace('photon', 'geoapify'), { q, ...data }))
      .catch(e => { L.warn('Geoapify unavailable', { q, error: e }); return null; });
    L.info(g ? 'placed by Geoapify' : 'not found by Geoapify either', { q, ...(g && { exact: g.exact, street: g.street }) });
  }
  if (g) {
    const c = await load();
    c[q.toLowerCase()] = { lat: g.lat, lon: g.lon, exact: g.exact };
    storage.setItem(KEY, JSON.stringify(c)).catch(() => {});
  }
  return g;
}

// road times: a public OSRM (kerb side, course; no key), then OpenRouteService if a key is set, else the estimate
async function matrix(points: LatLon[], opts: MatrixOptions = {}) {
  const why: string[] = [];
  try { return await osrmMatrix(points, opts); }
  catch (e) { L.warn('public OSRM unavailable', { error: e }); why.push((e as Error).message); }
  const key = getSettings().orsKey.trim();
  if (key) {
    try { return await orsMatrix(points, key); }
    catch (e) { L.warn('OpenRouteService unavailable', { error: e }); why.push((e as Error).message); }
  }
  L.warn('road times unavailable, estimating', { why });
  return { ...estimateMatrix(points), why: why.join('; ') };
}

/** OpenRouteService's VROOM, with the driver's key and up to its 48 parking stops; otherwise the search starts from nearest-neighbour. */
async function optimize(input: VroomInput) {
  const key = getSettings().orsKey.trim();
  if (!key || input.stops.length > VROOM_MAX_JOBS) return null;
  return vroomOrder(input, key);
}

/** Streets this phone has placed before, from the geocache keys ("gereonsmühlengasse 2, 50670 köln"), title-cased. */
async function knownStreets(): Promise<string[]> {
  const keys = Object.keys(await load());
  const names = keys.map(k => /^([^\d,]+?)\s+\d/.exec(k)?.[1]).filter((s): s is string => !!s);
  const cased = names.map(n => n.replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase()));
  return [...new Set(cased)];
}

/** Forgets every remembered address (Settings → Clear address cache): a wrong position kept from an older lookup goes with it. */
export async function clearGeocache() {
  const n = Object.keys(await load()).length;
  cache = {};
  await storage.removeItem(KEY).catch(() => {});
  L.info('address cache cleared', { addresses: n });
}

export const phoneDeps: PhoneDeps = { geocode, matrix, t: key => t(key), knownStreets, locate, optimize, log: (msg, data) => L.debug(msg, data) };
