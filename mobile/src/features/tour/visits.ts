// Where the van stood and for how long, from the phone's location updates: the day measured (drive vs time at a
// stop), so the planner can be judged and tuned on real days. The phone walks to the doors with the driver, so
// "standing" is "not driving" (below DRIVE_MS), not "not moving"; a red light is shorter than MIN_STOP_S.
// Framework-free: useVisits.ts feeds it from a background location task and logs what it returns.

export const DRIVE_MS = 4; // m/s, ~14 km/h: walking and shuffling the van stay below it
export const MIN_STOP_S = 90; // a stop shorter than this is traffic, not a delivery

export interface Fix { t: number; lat: number; lon: number; speed?: number | null }
export interface Still { since: number; last: number; lat: number; lon: number }
export interface Visit { from: number; to: number; min: number; lat: number; lon: number }

const metres = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const k = Math.PI / 180, x = (b.lon - a.lon) * k * Math.cos(((a.lat + b.lat) / 2) * k), y = (b.lat - a.lat) * k;
  return Math.hypot(x, y) * 6_371_000;
};

/** Feeds one fix: the new state, and a finished visit when driving resumes after one. `prev`: the fix before. */
export function step(still: Still | null, prev: Fix | null, fix: Fix): { still: Still | null; visit?: Visit } {
  // iOS gives -1 when it has no speed: from the distance to the fix before, then
  const speed = fix.speed != null && fix.speed >= 0 ? fix.speed
    : prev && fix.t > prev.t ? metres(prev, fix) / ((fix.t - prev.t) / 1000) : 0;
  if (speed < DRIVE_MS) return { still: still ? { ...still, last: fix.t } : { since: fix.t, last: fix.t, lat: fix.lat, lon: fix.lon } };
  if (!still) return { still: null };
  // no fixes while standing still (the phone reports every few metres): the stop lasted until this one
  const to = fix.t, s = (to - still.since) / 1000;
  return { still: null, ...(s >= MIN_STOP_S && { visit: { from: still.since, to, min: Math.round(s / 6) / 10, lat: still.lat, lon: still.lon } }) };
}
