// The day measured: while a tour has stops left, the phone's location in the background feeds visits.ts, and every
// stop of the van (where, from when, how long) is logged ('stopped'), so it reaches the PC with the rest of the log.
// Needs location "Always" and goes with arrival details (asked for and switched off together). Imported by the root
// layout: the task must be defined at start-up, when iOS relaunches the app for it.
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useSettings } from '@/features/settings/settings';
import { t } from '@/shared/i18n';
import { log } from '@/shared/log';
import { storage } from '@/shared/storage';
import { routeView } from './selectors';
import { useTourState } from './TourProvider';
import { type Fix, type Still, step } from './visits';

const L = log('visits');
const TASK = 'visits', STATE = 'visits-v1';

if (Platform.OS !== 'web') TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  let { still, prev } = JSON.parse((await storage.getItem(STATE)) ?? '{}') as { still?: Still | null; prev?: Fix | null };
  for (const l of data.locations) {
    const fix: Fix = { t: l.timestamp, lat: l.coords.latitude, lon: l.coords.longitude, speed: l.coords.speed };
    const r = step(still ?? null, prev ?? null, fix);
    if (r.visit) L.info('stopped', { from: new Date(r.visit.from).toISOString(), min: r.visit.min, lat: +r.visit.lat.toFixed(6), lon: +r.visit.lon.toFixed(6) });
    still = r.still; prev = fix;
  }
  await storage.setItem(STATE, JSON.stringify({ still, prev })).catch(() => {});
});

export function useVisits() {
  const { tour } = useTourState();
  const { arrivalAlerts } = useSettings();
  const on = arrivalAlerts && !!routeView(tour)?.next; // arrival details on, a planned tour with stops left
  useEffect(() => { (on ? start() : stop()).catch(e => L.warn('measuring failed', { error: e })); }, [on]);
}

async function start() {
  if (Platform.OS === 'web' || await Location.hasStartedLocationUpdatesAsync(TASK)) return;
  if (!(await Location.getBackgroundPermissionsAsync()).granted) return; // asked for by arrival details
  await storage.removeItem(STATE);
  await Location.startLocationUpdatesAsync(TASK, {
    accuracy: Location.Accuracy.High, distanceInterval: 10, activityType: Location.ActivityType.AutomotiveNavigation,
    pausesUpdatesAutomatically: false, showsBackgroundLocationIndicator: false,
    foregroundService: { notificationTitle: t('visits.title'), notificationBody: t('visits.body') }, // Android
  });
  L.info('measuring the tour');
}

async function stop() {
  if (Platform.OS === 'web' || !(await Location.hasStartedLocationUpdatesAsync(TASK).catch(() => false))) return;
  await Location.stopLocationUpdatesAsync(TASK);
  L.info('measuring stopped');
}
