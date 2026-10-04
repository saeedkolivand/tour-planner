import * as Location from 'expo-location';
import type { LatLon } from '@/features/tour/types';
import { log } from '@/shared/log';
import { t } from '@/shared/i18n';

const L = log('location');

const within = <T,>(ms: number, p: Promise<T>) =>
  Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);

/**
 * Where the phone is. Never waits forever: a GPS fix in a garage or an unanswered permission prompt used to
 * leave "Plan" doing nothing at all. After 15 s the last known position (up to 10 min old) is used instead.
 */
export type Position = LatLon & { /** course over ground in degrees, only while moving (>= 1 m/s) */ heading?: number };

export async function currentPosition(): Promise<Position> {
  const t0 = Date.now();
  const { granted } = await within(30_000, Location.requestForegroundPermissionsAsync()).catch(() => ({ granted: false }));
  if (!granted) {
    L.warn('permission denied or unanswered');
    throw new Error(t('location.permissionNeeded'));
  }
  const p = await within(15_000, Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }))
    .catch(() => Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 }).catch(() => null));
  if (!p) {
    L.warn('no position', { ms: Date.now() - t0 });
    throw new Error(t('location.noFix'));
  }
  // a parked van reports no course (or a stale one): the planner then treats it as free to turn either way
  const moving = (p.coords.speed ?? 0) >= 1 && p.coords.heading != null && p.coords.heading >= 0;
  L.info('position fixed', { ms: Date.now() - t0, accuracyM: p.coords.accuracy, heading: moving ? Math.round(p.coords.heading!) : undefined });
  return { lat: p.coords.latitude, lon: p.coords.longitude, ...(moving && { heading: p.coords.heading! }) };
}

/**
 * Where the phone is at a Delivered tap, for the tour history. Never asks for permission (planning on the phone
 * already did; a prompt at a door would be in the way) and never waits long: with navigation running the last fix is
 * seconds old, otherwise one fix within 10 s. null when there's no permission or no fix.
 */
export async function quietPosition(): Promise<(LatLon & { acc?: number }) | null> {
  try {
    if (!(await Location.getForegroundPermissionsAsync()).granted) return null;
    const p = await Location.getLastKnownPositionAsync({ maxAge: 30_000, requiredAccuracy: 50 })
      ?? await within(10_000, Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })).catch(() => null);
    if (!p) return null;
    const { latitude, longitude, accuracy } = p.coords;
    return { lat: +latitude.toFixed(6), lon: +longitude.toFixed(6), ...(accuracy != null && { acc: Math.round(accuracy) }) };
  } catch { return null; }
}

/** Where the phone points (0 = north, clockwise). For "no entry this way": the driver aims the phone down the street. */
export async function currentHeading(): Promise<number> {
  const h = await Location.getHeadingAsync();
  const deg = h.trueHeading >= 0 ? h.trueHeading : h.magHeading; // trueHeading is -1 without a location fix
  L.info('heading', { deg: Math.round(deg), accuracy: h.accuracy });
  return deg;
}
