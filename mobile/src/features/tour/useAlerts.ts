// Express reminders and arrival details, local only (no push, no server): scheduled notifications for the deadlines,
// geofences around the next parking stops for arrival. While the app is open the reminder is also spoken.
// Imported by the root layout: the geofence task must be defined at start-up, when iOS relaunches the app for one.
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import * as TaskManager from 'expo-task-manager';
import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { useSettings } from '@/features/settings/settings';
import { log } from '@/shared/log';
import { storage } from '@/shared/storage';
import { useMinute } from '@/shared/useMinute';
import { arrivalText, expressReminders } from './alerts';
import { routeView } from './selectors';
import { useTourState } from './TourProvider';

const L = log('alerts');
const TASK = 'arrival', TEXTS = 'arrival-v1', CHANNEL = 'alerts';
// ponytail: iOS watches at most 20 regions and only reliably from ~100 m; the next 18 parking stops, re-set on every change
const AHEAD = 18, RADIUS_M = 100;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

let allowed: Promise<boolean> | null = null;
const permitted = () => (allowed ??= (async () => {
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Express & arrival', importance: Notifications.AndroidImportance.HIGH });
  const p = await Notifications.requestPermissionsAsync();
  if (!p.granted) L.warn('notifications not allowed');
  return p.granted;
})().catch(e => { L.warn('notification permission failed', { error: e }); return false; }));

// not on the web preview, which has no background tasks
if (Platform.OS !== 'web') TaskManager.defineTask<{ eventType: Location.GeofencingEventType; region: Location.LocationRegion }>(TASK, async ({ data, error }) => {
  if (error || data.eventType !== Location.GeofencingEventType.Enter) return;
  const texts = JSON.parse((await storage.getItem(TEXTS)) ?? '{}') as Record<string, { title: string; body: string }>;
  const text = texts[data.region.identifier ?? ''];
  if (!text) return;
  L.info('arrived', { at: text.title });
  await Notifications.scheduleNotificationAsync({ content: { ...text, sound: true }, trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null });
});

export function useAlerts() {
  const { tour } = useTourState();
  const { expressAlerts, arrivalAlerts } = useSettings();
  const minute = useMinute();
  const reminders = useMemo(() => (expressAlerts ? expressReminders(tour.stops, minute) : []), [tour.stops, expressAlerts, minute]);
  const remindKey = JSON.stringify(reminders.map(r => [r.id, r.at, r.body]));
  useEffect(() => { syncReminders(reminders).catch(e => L.warn('express reminders failed', { error: e })); }, [remindKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const view = useMemo(() => routeView(tour), [tour]);
  const ahead = arrivalAlerts && view?.next ? [view.next, ...view.upcoming.map(u => u.cluster)].slice(0, AHEAD) : [];
  const fenceKey = ahead.map(c => c.stops[0].key).join();
  useEffect(() => { syncFences(ahead).catch(e => L.warn('arrival alerts failed', { error: e })); }, [fenceKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // read out while the app is open (in the van it usually is; the notification sounds otherwise); German, so street
  // names come out right
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(n => {
      const { title, body } = n.request.content;
      Speech.speak(`${title}. ${body}`.replace(/·/g, ','), { language: 'de-DE' });
    });
    return () => sub.remove();
  }, []);
}

async function syncReminders(list: ReturnType<typeof expressReminders>) {
  const old = (await Notifications.getAllScheduledNotificationsAsync()).filter(n => n.identifier.startsWith('express-'));
  await Promise.all(old.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  if (!list.length || !(await permitted())) return;
  for (const r of list) {
    await Notifications.scheduleNotificationAsync({ identifier: r.id, content: { title: r.title, body: r.body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL } });
  }
  L.info('express reminders set', { reminders: list.map(r => r.title) });
}

async function syncFences(clusters: Parameters<typeof arrivalText>[0][]) {
  const running = await Location.hasStartedGeofencingAsync(TASK).catch(() => false);
  if (!clusters.length) { if (running) await Location.stopGeofencingAsync(TASK); return; }
  if (!(await Location.getForegroundPermissionsAsync()).granted || !(await permitted())) return; // planning asks for location
  let bg = await Location.getBackgroundPermissionsAsync();
  if (!bg.granted && bg.canAskAgain) bg = await Location.requestBackgroundPermissionsAsync();
  if (!bg.granted) { L.info('arrival alerts need location "Always"'); return; }
  const id = (c: (typeof clusters)[number]) => c.stops[0].key ?? `${c.park.lat},${c.park.lon}`;
  await storage.setItem(TEXTS, JSON.stringify(Object.fromEntries(clusters.map(c => [id(c), arrivalText(c)]))));
  await Location.startGeofencingAsync(TASK, clusters.map(c => ({ identifier: id(c), latitude: c.park.lat, longitude: c.park.lon, radius: RADIUS_M, notifyOnExit: false })));
  L.info('arrival alerts set', { stops: clusters.length });
}
