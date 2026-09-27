import * as Location from 'expo-location';
import type { LatLon } from '@/features/tour/types';
import { log } from '@/shared/log';

const L = log('location');

const within = <T,>(ms: number, p: Promise<T>) =>
  Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);

/**
 * Where the phone is. Never waits forever: a GPS fix in a garage or an unanswered permission prompt used to
 * leave "Plan" doing nothing at all. After 15 s the last known position (up to 10 min old) is used instead.
 */
export async function currentPosition(): Promise<LatLon> {
  const t0 = Date.now();
  const { granted } = await within(30_000, Location.requestForegroundPermissionsAsync()).catch(() => ({ granted: false }));
  if (!granted) {
    L.warn('permission denied or unanswered');
    throw new Error('Location permission is needed to plan from where you are. Or set a depot in Settings.');
  }
  const p = await within(15_000, Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }))
    .catch(() => Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 }).catch(() => null));
  if (!p) {
    L.warn('no position', { ms: Date.now() - t0 });
    throw new Error("Couldn't get your location. Step outside for a GPS fix, or set a depot in Settings.");
  }
  L.info('position fixed', { ms: Date.now() - t0, accuracyM: p.coords.accuracy });
  return { lat: p.coords.latitude, lon: p.coords.longitude };
}

/** Where the phone points (0 = north, clockwise). For "no entry this way": the driver aims the phone down the street. */
export async function currentHeading(): Promise<number> {
  const h = await Location.getHeadingAsync();
  const deg = h.trueHeading >= 0 ? h.trueHeading : h.magHeading; // trueHeading is -1 without a location fix
  L.info('heading', { deg: Math.round(deg), accuracy: h.accuracy });
  return deg;
}
