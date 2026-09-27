// Voice commands for CarPlay without a CarPlay app: Siri Shortcuts call these, speak `speech`,
// and open `url` (navigation), which shows on the car's screen. They work with the phone locked.
import { log } from './log.mjs';
import { readTour, writeTour } from './tour.mjs';

const L = log('siri');

const MAPS = {
  apple: p => `https://maps.apple.com/?daddr=${p.lat},${p.lon}&dirflg=d`,
  google: p => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}&travelmode=driving`,
  waze: p => `https://waze.com/ul?ll=${p.lat},${p.lon}&navigate=yes`,
};

/** "Hohe Str. 68" reads badly aloud. */
export const sayable = s => s.replace(/str\.(?=\s|$)/gi, 'straße').replace(/\s+/g, ' ');

/** Open parking stops in route order, with each stop's live done flag. */
function openClusters(tour) {
  const live = new Map((tour.stops ?? []).map(s => [s.key, s]));
  return (tour.plan?.clusters ?? [])
    // a stop deleted since planning can't be delivered: kept, its cluster would stay "next" forever
    .map(c => ({ ...c, stops: c.stops.map(s => live.get(s.key)).filter(Boolean) }))
    .filter(c => c.stops.length && !c.stops.every(s => s.done));
}

function describe(tour, app) {
  const open = openClusters(tour);
  if (!tour.plan) return { speech: 'There is no route planned yet.', url: null, left: 0 };
  if (!open.length) return { speech: 'All stops are delivered. Tour complete.', url: null, left: 0 };
  const [first, ...walk] = open[0].stops;
  const express = open[0].stops.map(s => s.express).find(Boolean);
  const speech = [
    `Next stop ${first.no}, ${sayable(`${first.street} ${first.number}`)}.`,
    walk.length ? `Then ${walk.length} more on foot.` : '',
    express ? `Express by ${express}.` : '',
    `${open.length} ${open.length === 1 ? 'stop' : 'stops'} left.`,
  ].filter(Boolean).join(' ');
  return { speech, url: (MAPS[app] ?? MAPS.apple)(open[0].park), left: open.length, no: first.no };
}

export function nextStop({ app }) {
  const out = describe(readTour(), app);
  L.info('next asked', { no: out.no, left: out.left });
  return out;
}

export function deliverNext({ app }) {
  const tour = readTour();
  const [current] = openClusters(tour);
  if (!current) return describe(tour, app);
  const keys = new Set(current.stops.map(s => s.key));
  const now = Date.now();
  tour.stops = (tour.stops ?? []).map(s => keys.has(s.key) ? { ...s, done: true, doneAt: s.doneAt ?? now } : s);
  writeTour(tour);
  const out = describe(tour, app);
  L.info('delivered by voice', { keys: [...keys], nextNo: out.no, left: out.left });
  return { ...out, speech: `Delivered. ${out.speech}` };
}
