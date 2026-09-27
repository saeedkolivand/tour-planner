// Web app logs -> server /log (same daily JSONL file as the server, src: "web").
// Queued in localStorage first, so logs written offline or just before a crash are sent on the next load.
const KEY = 'log-queue';
const MAX = 2000;

const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const persist = q => { try { localStorage.setItem(KEY, JSON.stringify(q.slice(-MAX))); } catch { /* storage full or blocked */ } };
let queue = read();
let flushing = false;

const errorFields = v => v instanceof Error ? { error: v.message, stack: v.stack } : {};

/** log('plan').info('planned', { km: 52 }) */
export function log(scope) {
  const at = level => (msg, data = {}) => {
    const extra = data instanceof Error ? errorFields(data) : { ...data, ...errorFields(data.error) };
    queue.push({ ...extra, t: new Date().toISOString(), level, scope, msg });
    persist(queue);
    console[level === 'debug' ? 'log' : level](`[${scope}] ${msg}`, data);
  };
  return { debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error') };
}

export async function flush() {
  if (flushing || !queue.length) return;
  flushing = true;
  const batch = queue.slice(0, 500);
  try {
    const r = await fetch('/log', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ src: 'web', entries: batch }) });
    if (r.ok) { queue = queue.slice(batch.length); persist(queue); }
  } catch { /* offline: keep it for the next flush */ }
  finally { flushing = false; }
}

export function startLogging() {
  const L = log('app');
  addEventListener('error', e => L.error('uncaught error', { error: e.error ?? new Error(e.message) }));
  addEventListener('unhandledrejection', e => L.error('unhandled rejection', { error: e.reason instanceof Error ? e.reason : new Error(String(e.reason)) }));
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  setInterval(flush, 10_000);
  L.info('app started', { ua: navigator.userAgent, standalone: matchMedia('(display-mode: standalone)').matches, unsentFromLastRun: queue.length });
  flush();
}
