// Hands a stop to a navigation app. All three run on CarPlay, so the route appears on the car's screen.
// URL formats per the vendors' docs (checked 2026-09-27):
//   Apple  https://maps.apple.com/?daddr=LAT,LON&dirflg=d          (dirflg=d = by car; opens Maps)
//   Google comgooglemaps://?daddr=LAT,LON&directionsmode=driving   (needs LSApplicationQueriesSchemes, see app.json)
//          https://www.google.com/maps/dir/?api=1&destination=…    (fallback when the app isn't installed)
//   Waze   https://waze.com/ul?ll=LAT,LON&navigate=yes             (official; waze:// silently does nothing if not installed)
import { Linking, Platform } from 'react-native';
import type { LatLon } from '@/features/tour/types';
import { log } from '@/shared/log';
import { t } from '@/shared/i18n';

export type NavApp = 'apple' | 'google' | 'waze';
export const NAV_APPS: Record<NavApp, string> = { apple: 'Apple Maps', google: 'Google Maps', waze: 'Waze' };

const L = log('navigate');

export async function navigateTo({ lat, lon }: LatLon, app: NavApp, label?: string) {
  if (app === 'apple' && Platform.OS === 'android') app = 'google'; // Apple Maps doesn't exist on Android
  let url = `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
  if (app === 'waze') url = `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
  if (app === 'google') {
    const native = `comgooglemaps://?daddr=${lat},${lon}&directionsmode=driving`;
    url = await Linking.canOpenURL(native).catch(() => false)
      ? native
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
  }
  try {
    await Linking.openURL(url);
    L.info('opened maps', { app, to: { lat, lon }, label, url: url.split('?')[0] });
  } catch (e) {
    L.error('maps did not open', { app, url, error: e });
    throw new Error(t('route.couldNotOpen', { app: NAV_APPS[app] }));
  }
}
