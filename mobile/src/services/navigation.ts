// Hands a stop to a navigation app. All three run on CarPlay, so the route appears on the car's screen.
// URL formats per the vendors' docs (checked 2026-09-27):
//   Apple  https://maps.apple.com/?daddr=LAT,LON&dirflg=d          (dirflg=d = by car; opens Maps)
//   Google comgooglemaps://?daddr=LAT,LON&directionsmode=driving   (iOS; needs LSApplicationQueriesSchemes, see app.json)
//          google.navigation:q=LAT,LON&mode=d                         (Android: starts turn-by-turn right away)
//          https://www.google.com/maps/dir/?api=1&destination=…    (fallback when the app isn't installed)
//   Waze   https://waze.com/ul?ll=LAT,LON&navigate=yes             (official; waze:// silently does nothing if not installed)
// Each also takes an address instead of LAT,LON (Waze: q=), for a stop the app could not place on its map.
import { Linking, Platform } from 'react-native';
import type { LatLon } from '@/features/tour/types';
import { log } from '@/shared/log';
import { t } from '@/shared/i18n';

export type NavApp = 'apple' | 'google' | 'waze';
export const NAV_APPS: Record<NavApp, string> = { apple: 'Apple Maps', google: 'Google Maps', waze: 'Waze' };

const L = log('navigate');

/** Turn-by-turn to a position, or to an address the maps app looks up itself. */
export async function navigateTo(to: LatLon | string, app: NavApp, label?: string) {
  if (app === 'apple' && Platform.OS === 'android') app = 'google'; // Apple Maps doesn't exist on Android
  const dest = typeof to === 'string' ? encodeURIComponent(to) : `${to.lat},${to.lon}`;
  let url = `https://maps.apple.com/?daddr=${dest}&dirflg=d`;
  if (app === 'waze') url = typeof to === 'string' ? `https://waze.com/ul?q=${dest}&navigate=yes` : `https://waze.com/ul?ll=${dest}&navigate=yes`;
  if (app === 'google' && Platform.OS === 'android') url = `google.navigation:q=${dest}&mode=d`;
  else if (app === 'google') {
    const native = `comgooglemaps://?daddr=${dest}&directionsmode=driving`;
    url = await Linking.canOpenURL(native).catch(() => false)
      ? native
      : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
  }
  try {
    await Linking.openURL(url);
    L.info('opened maps', { app, to, label, url: url.split('?')[0] });
  } catch (e) {
    L.error('maps did not open', { app, url, error: e });
    throw new Error(t('route.couldNotOpen', { app: NAV_APPS[app] }));
  }
}
