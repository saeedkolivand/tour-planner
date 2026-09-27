// Structured logs with Pino: JSON lines in data/logs/app.YYYY-MM-DD.N.jsonl (rolled daily, 30 days kept), plus stdout.
// Server, web app and iOS app all end up in the same file (clients post to /log), tagged by `src`.
// multistream (in-process) rather than worker transports: transports forbid `formatters.level`,
// and readers of these files expect "level":"info", not 30.
import { fileURLToPath } from 'node:url';
import pino from 'pino';
import roll from 'pino-roll';

const DIR = fileURLToPath(new URL('../data/logs/', import.meta.url));
// → data/logs/app.2026-09-27.1.jsonl  (pino-roll needs the extension in `file` and a dateFormat to put the date in the name)
const file = await roll({ file: DIR + 'app.jsonl', frequency: 'daily', dateFormat: 'yyyy-MM-dd', mkdir: true, limit: { count: 30 } });

const root = pino({
  level: 'debug',
  base: undefined, // no pid/hostname: one process, one machine
  messageKey: 'msg',
  timestamp: () => `,"t":"${new Date().toISOString()}"`,
  formatters: { level: label => ({ level: label }) },
}, pino.multistream([{ level: 'debug', stream: file }, { level: 'info', stream: process.stdout }]));

const errorFields = e => e instanceof Error ? { error: e.message, stack: e.stack } : {};

/** Appends one entry ({level, msg, ...fields}); used directly for client logs. */
export function write({ level = 'info', msg = '', ...fields }) {
  root[level](fields, msg);
}

/** log('extract').info('photo read', { by: 'appliance', ms: 812 }); an Error, or data.error, becomes error + stack. */
export function log(scope, src = 'server') {
  const child = root.child({ src, scope });
  const at = level => (msg, data = {}) =>
    child[level](data instanceof Error ? errorFields(data) : { ...data, ...errorFields(data.error) }, msg);
  return { debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error') };
}

/** Before a crash exit: the file stream is async, so write out what's buffered. */
export const flushLogs = () => { try { file.flushSync(); } catch { /* nothing buffered */ } };
