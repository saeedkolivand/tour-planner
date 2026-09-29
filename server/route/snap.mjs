// Which street the van stops on. A door's coordinate snaps to the nearest drivable road, which for a corner
// house or a courtyard entrance can be the neighbouring street: the plan then arrives from the wrong side and
// navigation points round the corner. Ask OSRM for several nearby roads and prefer the one named like the
// address; when none is (footways, squares, unnamed service roads) the door point stays and OSRM snaps as before.
import { log } from '../log.mjs';
import { normStreet } from './stops.mjs';

const OSRM = process.env.OSRM_URL || 'http://localhost:5050';
const MAX_M = 150; // farther away it is a different street with the same name, or the geocode is off
const L = log('snap');

/** OSRM `nearest` waypoints -> the point on the stop's own street, or null when none of them is it. */
export function roadFor(stop, waypoints) {
  const want = normStreet(stop.street);
  if (!want) return null;
  const w = waypoints.find(w => w.distance <= MAX_M && normStreet(w.name) === want);
  return w ? { lat: w.location[1], lon: w.location[0] } : null;
}

/** Sets `road` on every placed stop whose street OSRM finds nearby (in place). Best effort: a failure keeps the door point. */
export async function snapToStreet(stops) {
  let onStreet = 0;
  await Promise.all(stops.map(async s => {
    try {
      const r = await (await fetch(`${OSRM}/nearest/v1/driving/${s.lon},${s.lat}?number=8`)).json();
      const road = r.code === 'Ok' && roadFor(s, r.waypoints);
      if (road) { s.road = road; onStreet++; }
    } catch (e) { L.warn('nearest failed', { key: s.key, error: e }); }
  }));
  L.info('snapped to streets', { stops: stops.length, onStreet });
}
