// HTTP API: "METHOD /path" -> handler(body). Handlers stay thin; the work lives in the modules they call.
import { dedupe } from './route/stops.mjs';
import { extract } from './extract/index.mjs';
import { untruncate } from './extract/ground.mjs';
import { log, write } from './log.mjs';
import { pin } from './route/geocode.mjs';
import { clean, planTour } from './route/plan.mjs';
import { addClosure, listClosures, removeClosure } from './roads/closures.mjs';
import { LEVELS, roadsStatus, speedLines, updateRoads } from './roads/speeds.mjs';
import { deliverNext, nextStop } from './siri.mjs';
import { readTour, saveTour } from './tour.mjs';

const L = log('api');
const CLIENTS = new Set(['web', 'ios', 'android']);
const LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error']);

export const routes = {
  /** {images?: [dataUrl], texts?: [ocrText], stops?: [known]} -> merged + deduped stops, in scanner order. */
  async 'POST /extract'({ images = [], texts = [], stops = [] }) {
    const photos = await extract([...images.map(image => ({ image })), ...texts.map(text => ({ text }))]);
    const merged = dedupe(clean([...clean(stops), ...untruncate(photos.flatMap(p => p.stops), stops)]));
    L.info('extracted', { images: images.length, texts: texts.length, before: stops.length, after: merged.length });
    return { stops: merged, photos: photos.map(({ stops, ...p }) => ({ ...p, found: stops.length })) };
  },

  /** {start, end?, stops} -> clusters in driving order + savings vs scanner order. */
  'POST /optimize': planTour,

  async 'POST /pin'({ key, lat, lon }) {
    if (typeof key !== 'string' || !Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('pin needs key, lat, lon');
    pin(key, lat, lon);
    return { ok: true };
  },

  /** Siri Shortcuts (CarPlay by voice). ?app=apple|google|waze picks the navigation link. */
  async 'GET /siri/next'(_body, query) { return nextStop(query); },
  async 'POST /siri/delivered'(_body, query) { return deliverNext(query); },

  /** Street closures reported from the app; each change is applied to the router right away. */
  async 'GET /closures'() { return { closures: listClosures(), roads: roadsStatus() }; },
  async 'POST /closures'(c) {
    // a report that matches no road would look saved but change nothing: refuse it instead
    if (!(await speedLines([{ ...c, level: 'closed' }])).length) {
      throw Object.assign(new Error(`No road found within ${LEVELS.closed.radiusM} m of your position`), { status: 422 });
    }
    const added = addClosure(c);
    await updateRoads({ refetch: false });
    return { added, closures: listClosures() };
  },
  async 'POST /closures/remove'({ id }) { removeClosure(id); await updateRoads({ refetch: false }); return { closures: listClosures() }; },
  /** Re-fetch the city's roadworks now (also runs daily at 05:30). */
  async 'POST /roads/update'() { return updateRoads(); },

  async 'GET /tour'() { return readTour(); },
  async 'PUT /tour'(tour) { saveTour(tour); return { ok: true }; },

  /** {src: 'web'|'ios', entries: [{level, scope, msg, t?, ...data}]} -> appended to the same log file. */
  async 'POST /log'({ src, entries }) {
    if (!CLIENTS.has(src) || !Array.isArray(entries)) throw new Error('log needs src and entries[]');
    for (const e of entries.slice(0, 500)) {
      if (!e || typeof e !== 'object') continue;
      const { t, ...rest } = e; // the server stamps its own time; the client's is kept as clientT
      write({ ...rest, level: LOG_LEVELS.has(e.level) ? e.level : 'info', src, clientT: t });
    }
    return { ok: true, written: Math.min(entries.length, 500) };
  },
};
