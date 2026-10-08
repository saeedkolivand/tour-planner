// The tour history on the phone: one JSON file per day in the app's documents folder (history/2026-10-04.json),
// written a few seconds after the tour changes and when the app goes to the background. Never sent anywhere except in
// Settings > Export log.
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { getSettings } from '@/features/settings/settings';
import type { Tour } from '@/features/tour/types';
import { storage } from '@/shared/storage';
import { mergeDay, type Arrivals, type Day } from './history';

const DAYS_KEPT = 365; // ponytail: about 40 KB a day (~15 MB a year), all read at once by Past deliveries; page it past a year
const usable = Platform.OS !== 'web';
let pending: Tour | null = null;

/** Where the arrival task (useAlerts.ts) keeps the day's arrival times, by stop key. */
export const ARRIVALS = 'arrivals-v1';
export const readArrivals = (): Arrivals => { try { return JSON.parse(storage.getItemSync(ARRIVALS) ?? '{}'); } catch { return {}; } };
let timer: ReturnType<typeof setTimeout> | undefined;

function folder() {
  const dir = new Directory(Paths.document, 'history');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

const dayFiles = () => folder().list().filter((f): f is File => f instanceof File && /^\d{4}-\d{2}-\d{2}\.json$/.test(f.name))
  .sort((a, b) => a.name.localeCompare(b.name));

/** Writes what's waiting. Never throws: a history that can't be written must not break the tour. */
export function flushHistory() {
  clearTimeout(timer);
  const tour = pending;
  pending = null;
  if (!tour || !usable) return;
  try {
    const now = Date.now();
    const files = dayFiles();
    const last = files[files.length - 1];
    const prev = last ? (JSON.parse(last.textSync()) as Day) : null;
    const day = mergeDay(prev, tour, now, readArrivals());
    if (!day || day === prev) return;
    const f = new File(folder(), `${day.date}.json`);
    if (!f.exists) f.create();
    f.write(JSON.stringify(day));
    for (const old of files.slice(0, Math.max(0, files.length + (last?.name === f.name ? 0 : 1) - DAYS_KEPT))) old.delete();
  } catch { /* full disk: the tour itself is saved separately */ }
}

/** The tour changed: record it soon (once, for a burst of changes). Off with Settings > Tour history. */
export function recordTour(tour: Tour) {
  if (!usable || !getSettings().keepHistory) return;
  pending = tour;
  clearTimeout(timer);
  timer = setTimeout(flushHistory, 3000);
}

/** Every kept day, oldest first. */
export function readHistory(): Day[] {
  if (!usable) return [];
  flushHistory();
  try {
    return dayFiles().flatMap(f => { try { return [JSON.parse(f.textSync()) as Day]; } catch { return []; } });
  } catch { return []; }
}
