// App-wide logger: console in dev, and every entry queued (persisted on the phone) and shipped to the
// server's /log, which writes it into the same daily JSONL file as the server's own logs (src: "ios").
// Every entry is also kept in a file on the phone (logFile.ts) for Settings > Export log. Debug entries (the
// "why" of each address and plan) are only recorded while Settings > Detailed log is on.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { getSettings, onSettingsChange } from '@/features/settings/settings';
import { appendToLogFile, flushLogFile, seedLogFile } from './logFile';
import { createLogQueue, type Entry, type Level } from './logQueue';

const KEY = 'log-queue';
let queue: ReturnType<typeof createLogQueue> | null = null;
const early: [Level, string, string, Record<string, unknown> | Error][] = []; // logged before start()

export interface Logger {
  debug(msg: string, data?: Record<string, unknown> | Error): void;
  info(msg: string, data?: Record<string, unknown> | Error): void;
  warn(msg: string, data?: Record<string, unknown> | Error): void;
  error(msg: string, data?: Record<string, unknown> | Error): void;
}

/** log('scan').info('photos read', { count: 3 }) */
export function log(scope: string): Logger {
  const at = (level: Level) => (msg: string, data: Record<string, unknown> | Error = {}) => {
    if (__DEV__) console[level === 'debug' ? 'log' : level](`[${scope}] ${msg}`, data);
    if (level === 'debug' && !getSettings().detailedLog) return;
    if (queue) appendToLogFile(queue.add(level, scope, msg, data)); else early.push([level, scope, msg, data]);
  };
  return { debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error') };
}

async function send(entries: Entry[]) {
  const r = await fetch(getSettings().server.replace(/\/$/, '') + '/log', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ src: Platform.OS === 'android' || Platform.OS === 'web' ? Platform.OS : 'ios', entries }),
  });
  if (!r.ok) throw new Error(`log upload ${r.status}`);
}

/** Call once at app start: restores unsent logs, starts periodic upload, and captures crashes. */
export async function startLogging() {
  if (queue) return;
  const saved = await AsyncStorage.getItem(KEY).then(v => (v ? JSON.parse(v) : []) as Entry[]).catch(() => []);
  queue = createLogQueue({ send, persist: q => AsyncStorage.setItem(KEY, JSON.stringify(q)) }, saved);
  seedLogFile(saved);
  early.splice(0).forEach(([level, scope, msg, data]) => appendToLogFile(queue!.add(level, scope, msg, data)));

  const L = log('app');
  onSettingsChange(patch => log('settings').info('changed', { fields: Object.keys(patch) }));
  const prev = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((e, isFatal) => {
    L.error(isFatal ? 'fatal crash' : 'uncaught error', e);
    flushLogFile();
    queue!.flush().finally(() => prev(e, isFatal));
  });

  setInterval(() => queue!.flush(), 10_000);
  AppState.addEventListener('change', state => {
    L.info('app state', { state });
    if (state !== 'active') { flushLogFile(); queue!.flush(); } // keep and ship before iOS suspends us
  });
  L.info('app started', { os: Platform.OS, osVersion: String(Platform.Version), unsentFromLastRun: saved.length });
  queue.flush();
}
