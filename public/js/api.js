import { log } from './log.js';

const L = log('api');

/** JSON call to the server; throws with the server's error message. Every call is logged with its duration. */
export async function api(method, path, body) {
  const t0 = performance.now();
  try {
    const r = await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(json.error || `Server error ${r.status}`);
    L.debug('call', { method, path, ms: Math.round(performance.now() - t0) });
    return json;
  } catch (e) {
    L.error('call failed', { method, path, ms: Math.round(performance.now() - t0), error: e });
    throw e;
  }
}
