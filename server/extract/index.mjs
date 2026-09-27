// Photos or OCR text -> stops. Appliance first; Claude only when it fails (VISION=auto|appliance|claude).
import { log } from '../log.mjs';
import { applianceContent, askAppliance } from './appliance.mjs';
import { askClaude, claudeContent } from './claude.mjs';
import { ground } from './ground.mjs';
import { IMAGE_PROMPT, TEXT_PROMPT, isValid } from './schema.mjs';

const MODE = process.env.VISION || 'auto';
const L = log('extract');

const PROVIDERS = [
  { name: 'appliance', ask: askAppliance, content: applianceContent, enabled: MODE !== 'claude' },
  { name: 'claude', ask: askClaude, content: claudeContent, enabled: MODE !== 'appliance' },
].filter(p => p.enabled);

async function readOne(input, i) {
  const kind = input.image ? 'image' : 'text';
  const prompt = input.image ? IMAGE_PROMPT : TEXT_PROMPT;
  let lastError;
  for (const p of PROVIDERS) {
    const t0 = performance.now();
    try {
      const o = await p.ask(p.content(input, prompt));
      if (!isValid(o)) throw new Error('invalid stops in reply');
      const stops = input.text ? ground(o.stops, input.text) : o.stops;
      L.info('read', { input: i, kind, by: p.name, found: stops.length, ms: Math.round(performance.now() - t0) });
      return { stops, by: p.name };
    } catch (e) {
      lastError = e;
      L.warn('reader failed, trying next', { input: i, kind, by: p.name, ms: Math.round(performance.now() - t0), error: e });
    }
  }
  throw lastError;
}

/** inputs: [{image: dataUrl} | {text}]. Never throws: a failed input comes back with `error`. */
// ponytail: sequential, the appliance has one GPU; parallelize Claude-only mode if it's too slow
export async function extract(inputs) {
  const out = [];
  for (const [i, input] of inputs.entries()) {
    try { out.push({ photo: i, ...await readOne(input, i) }); }
    catch (e) {
      L.error('input unreadable', { input: i, error: e });
      out.push({ photo: i, stops: [], error: e.message });
    }
  }
  return out;
}
