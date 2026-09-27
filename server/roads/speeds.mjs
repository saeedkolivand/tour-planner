// Turns closures, roadworks and the city's traffic calendar into an OSRM segment-speed file and applies it to the running graph.
import { writeAtomic } from '../files.mjs';
import { log } from '../log.mjs';
import { listClosures } from './closures.mjs';
import { roadworks } from './roadworks.mjs';
import { segmentsAt } from './segments.mjs';
import { verkehrskalender } from './verkehrskalender.mjs';
import { osrm } from './wsl.mjs';

const FILE = new URL('../../data/speeds.csv', import.meta.url);
const L = log('roads');

/** km/h a segment is set to, and the most a road may be from the point (GPS / permit position) to count. */
export const LEVELS = { closed: { kmh: 0, radiusM: 20 }, strong: { kmh: 5, radiusM: 20 }, mild: { kmh: 15, radiusM: 15 } };

/** points: [{lat, lon, level}] → CSV lines; where points overlap the slowest wins. Exported for the selfcheck. */
export async function speedLines(points, near = segmentsAt) {
  const kmh = new Map();
  const BATCH = 16; // local OSRM answers in ~1 ms; batching turns ~900 points × 8 routes from ~2 min into seconds
  for (let i = 0; i < points.length; i += BATCH) {
    const batch = points.slice(i, i + BATCH);
    const found = await Promise.all(batch.map(p => near(p, LEVELS[p.level].radiusM)));
    batch.forEach((p, j) => {
      const speed = LEVELS[p.level].kmh;
      for (const pair of found[j]) if (!kmh.has(pair) || speed < kmh.get(pair)) kmh.set(pair, speed);
    });
  }
  return [...kmh].map(([pair, speed]) => `${pair},${speed}`);
}

/** Combines speed-file lines; where both name a segment, the slower speed wins. */
export function mergeLines(...lists) {
  const kmh = new Map();
  for (const line of lists.flat()) {
    const at = line.lastIndexOf(','), pair = line.slice(0, at), speed = Number(line.slice(at + 1));
    if (!kmh.has(pair) || speed < kmh.get(pair)) kmh.set(pair, speed);
  }
  return [...kmh].map(([pair, speed]) => `${pair},${speed}`);
}

let status = { appliedAt: null, closures: 0, roadworks: 0, calendar: 0, segments: 0, error: null };
export const roadsStatus = () => status;
// Roadworks snapped to segments once per fetch (~900 lookups); a reported closure only snaps itself.
let works = { rw: [], vk: [], lines: [] };

/**
 * Merges reported closures with the city's roadworks and applies them. `refetch` downloads (and re-snaps)
 * roadworks, else the last result is reused so a reported closure applies in seconds; `refreshMap` rebuilds the map first.
 */
let running = Promise.resolve();
/** One at a time: overlapping runs write the same speeds.csv, and the later write could drop a new closure. */
export function updateRoads(opts) {
  const next = running.then(() => update(opts), () => update(opts));
  running = next.catch(() => {});
  return next;
}

async function update({ refreshMap = false, refetch = true } = {}) {
  try {
    if (refetch) {
      // each source may fail on its own: keep its last fetch rather than forget known works
      const [rw, vk] = await Promise.all([
        roadworks().catch(e => { L.warn('roadworks unavailable', { error: e }); return null; }),
        verkehrskalender().catch(e => { L.warn('verkehrskalender unavailable', { error: e }); return null; }),
      ]);
      if (rw || vk) works = { rw: rw ?? works.rw, vk: vk ?? works.vk, lines: await speedLines([...(rw ?? works.rw), ...(vk ?? works.vk)]) };
    }
    const closures = listClosures().map(c => ({ ...c, level: 'closed' }));
    const lines = mergeLines(await speedLines(closures), works.lines);
    writeAtomic(FILE, lines.join('\n') + '\n');
    await osrm(refreshMap ? 'refresh' : 'apply', FILE);
    status = { appliedAt: new Date().toISOString(), closures: closures.length, roadworks: works.rw.length, calendar: works.vk.length, segments: lines.length, error: null };
    L.info(refreshMap ? 'map refreshed and roads applied' : 'roads applied', status);
  } catch (e) {
    status = { ...status, error: e.message };
    L.error('roads update failed', { error: e });
    throw e;
  }
  return status;
}
