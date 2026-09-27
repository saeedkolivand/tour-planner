// Closures the driver reports from the app: "this street is closed" (kept 14 days), or "no entry this way"
// with the phone's compass heading, a new one-way street (kept 180 days: OSM, refreshed nightly, catches up).
// Both expire so a forgotten report can't block a street forever.
import fs from 'node:fs';
import { writeAtomic } from '../files.mjs';
import { log } from '../log.mjs';

const FILE = new URL('../../data/closures.json', import.meta.url);
const DAY = 24 * 3600_000;
const ttl = c => (Number.isFinite(c.heading) ? 180 : 14) * DAY;
const L = log('closures');

const read = () => { try { return JSON.parse(fs.readFileSync(FILE)); } catch { return []; } };
const write = list => writeAtomic(FILE, JSON.stringify(list, null, 1));

/** Current (unexpired) closures. */
export function listClosures(now = Date.now()) {
  return read().filter(c => now - c.at < ttl(c));
}

export function addClosure({ lat, lon, heading, note = '' }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw Object.assign(new Error('closure needs lat and lon'), { status: 400 });
  if (heading != null && !(Number.isFinite(heading) && heading >= 0 && heading < 360)) throw Object.assign(new Error('heading must be 0-359°'), { status: 400 });
  const c = { id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, lat, lon, ...(heading != null && { heading: Math.round(heading) }), note: String(note).slice(0, 200), at: Date.now() };
  write([...listClosures(), c]);
  L.info('reported', c);
  return c;
}

export function removeClosure(id) {
  const list = listClosures();
  write(list.filter(c => c.id !== id));
  L.info('removed', { id, found: list.some(c => c.id === id) });
}
