// Daily jobs, run by the app server itself (no OS scheduler to set up): the PC just has to be on.
//   03:30  download today's OpenStreetMap extract, rebuild the graph, apply closures + roadworks
//   05:30  re-fetch the city's roadworks (permits change during the day before)
// Also applies closures + roadworks once at startup. ROADS_JOBS=off disables all of it (dev).
import { log } from '../log.mjs';
import { updateRoads } from './speeds.mjs';

const L = log('schedule');

function daily(hh, mm, name, job) {
  const next = () => {
    const at = new Date();
    at.setHours(hh, mm, 0, 0);
    if (at <= new Date()) at.setDate(at.getDate() + 1);
    return at;
  };
  const arm = () => {
    const at = next();
    L.info('scheduled', { job: name, at: at.toISOString() });
    setTimeout(async () => {
      L.info('job started', { job: name });
      await job().catch(() => {}); // updateRoads logs its own failure
      arm();
    }, at - Date.now());
  };
  arm();
}

export function startRoadJobs() {
  if (process.env.ROADS_JOBS === 'off') return L.info('road jobs disabled (ROADS_JOBS=off)');
  daily(3, 30, 'map refresh', () => updateRoads({ refreshMap: true }));
  daily(5, 30, 'roadworks', () => updateRoads());
  updateRoads().catch(() => {});
}
