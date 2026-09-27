// The phone's own geocoder and travel times, for planning without the PC.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { getSettings } from '@/features/settings/settings';
import type { LatLon } from '@/features/tour/types';
import { log } from '@/shared/log';
import { estimateMatrix, orsMatrix } from './matrix';
import type { PhoneDeps } from './planOnPhone';
import { fold, meters } from './stops';

const L = log('phone-planner');
// on a corner, Apple/Google may reverse-geocode to the cross street instead of the queried one;
// accept the hit if the queried street shows up in any of the address's name-ish fields
const onStreet = (p: Location.LocationGeocodedAddress | undefined, street: string) =>
  !!p && [p.street, p.name, p.formattedAddress].some((x) => x && fold(x).includes(fold(street)));
const KEY = 'geocache-v2'; // v1 could return the wrong street's hit; force a re-lookup
const COLOGNE = { lat: 50.94, lon: 6.96 };
let cache: Record<string, LatLon & { exact?: boolean }> | null = null;
const load = async () => (cache ??= JSON.parse((await AsyncStorage.getItem(KEY).catch(() => null)) ?? '{}') as Record<string, LatLon & { exact?: boolean }>);

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
  if (c[k]) return c[k];
  // Android's geocoder needs location permission (iOS's doesn't, and asking again is free once granted)
  await Location.requestForegroundPermissionsAsync().catch(() => null);
  const hits = await pacedRetry(() => Location.geocodeAsync(q)).catch((e) => { L.warn('geocoder failed', { q, error: e }); return null; });
  if (!hits) return null; // the call itself failed (already logged) — don't also warn "not found"
  const [hit] = hits;
  // the platform geocoders happily answer "somewhere in Germany": only take results in the Cologne region
  if (!hit || meters(COLOGNE, { lat: hit.latitude, lon: hit.longitude }) > 60_000) { L.warn('not found near Köln', { q }); return null; }

  const parts = /^([^\d]*)\d+(.*)$/.exec(q); // "Ludwigstraße 117, 50670 Köln" -> street "Ludwigstraße", rest ", 50670 Köln"
  const street = parts?.[1].trim();
  let g: (LatLon & { exact?: boolean }) | null = { lat: hit.latitude, lon: hit.longitude, exact: true };
  if (street) {
    const [place] = await pacedRetry(() => Location.reverseGeocodeAsync({ latitude: hit.latitude, longitude: hit.longitude })).catch(() => []);
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
  AsyncStorage.setItem(KEY, JSON.stringify(c)).catch(() => {});
  return g;
}

async function matrix(points: LatLon[]) {
  const key = getSettings().orsKey.trim();
  if (key) {
    try { return await orsMatrix(points, key); }
    catch (e) { L.warn('road times unavailable, estimating', { error: e }); return { ...estimateMatrix(points), why: (e as Error).message }; }
  }
  return estimateMatrix(points);
}

export const phoneDeps: PhoneDeps = { geocode, matrix };
