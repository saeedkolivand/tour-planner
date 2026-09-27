// Today's tour, shared with the iOS app through the server's /tour.
import { api } from './api.js';
import { log } from './log.js';

const L = log('tour');
export const EMPTY = () => ({ stops: [], plan: null, expected: '' });
export const tour = EMPTY();

/** Replaces the tour's contents (keeps the same object so every module sees it). */
export function setTour(next) { Object.assign(tour, EMPTY(), next); }

export function save() { api('PUT', '/tour', tour).catch(e => L.warn('tour not saved', { error: e })); }

export async function loadTour() {
  const t = await api('GET', '/tour');
  if (t.stops) setTour(t);
  L.info('tour loaded', { stops: tour.stops.length, planned: !!tour.plan });
}
