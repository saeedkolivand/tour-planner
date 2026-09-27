// Today's tour, shared by the web app and the iOS app: one JSON file per day.
import fs from 'node:fs';
import { writeAtomic } from './files.mjs';

const DATA = new URL('../data/', import.meta.url);
const file = () => new URL(`tour-${new Date().toLocaleDateString('sv')}.json`, DATA);

export function readTour() {
  try { return JSON.parse(fs.readFileSync(file())); } catch { return {}; }
}

export function writeTour(tour) {
  fs.mkdirSync(DATA, { recursive: true });
  writeAtomic(file(), JSON.stringify(tour));
}

const lastEvent = s => Math.max(s?.doneAt ?? 0, s?.undoneAt ?? 0);

/**
 * A client's whole-tour save, merged per stop: the newer delivered/reopened event wins. Otherwise a phone
 * or browser holding an older copy undoes what Siri (or the other device) delivered in the meantime.
 */
export function mergeTour(saved, incoming) {
  const known = new Map((saved.stops ?? []).map(s => [s.key, s]));
  const stops = (incoming.stops ?? []).map(s => {
    const k = s.key && known.get(s.key);
    return k && lastEvent(k) > lastEvent(s) ? { ...s, done: k.done, doneAt: k.doneAt, undoneAt: k.undoneAt } : s;
  });
  // loading numbers are written on parcels: never hand one out twice, even after its stop was deleted.
  // An empty tour is a new one ("Clear tour"): numbering starts again at 1.
  const lastNo = stops.length ? Math.max(saved.lastNo ?? 0, ...[...known.values(), ...stops].map(s => s.no ?? 0)) : 0;
  return { ...incoming, stops, lastNo };
}

export const saveTour = tour => writeTour(mergeTour(readTour(), tour));
