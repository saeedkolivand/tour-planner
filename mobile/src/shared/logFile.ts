// The log kept on the phone for Settings > Export log: every entry as one JSON line in the app's documents folder,
// whether or not it ever reached the PC (in phone-only mode it never does). Written in batches, a few MB at most.
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import type { Entry } from './logQueue';

const MAX_CHARS = 4_000_000, KEEP_CHARS = 2_000_000; // ponytail: weeks of tours; the oldest half goes past this
const usable = Platform.OS !== 'web';
let pending: string[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

function logFile() {
  const dir = new Directory(Paths.document, 'logs');
  if (!dir.exists) dir.create({ intermediates: true });
  return new File(dir, 'app.jsonl');
}

/** Writes what's waiting. Never throws: a log that can't be written must not break the app. */
export function flushLogFile() {
  clearTimeout(timer);
  if (!usable || !pending.length) return;
  const lines = pending.join('');
  pending = [];
  try {
    const f = logFile();
    if (!f.exists) f.create();
    f.write(lines, { append: true });
    if ((f.size ?? 0) > MAX_CHARS) {
      const text = f.textSync();
      f.write(text.slice(text.indexOf('\n', text.length - KEEP_CHARS) + 1));
    }
  } catch { /* full disk or no file system (web preview): the PC upload still has it */ }
}

export function appendToLogFile(e: Entry) {
  if (!usable) return;
  pending.push(JSON.stringify(e) + '\n');
  clearTimeout(timer);
  timer = setTimeout(flushLogFile, 2000);
}

/** The first run with a log file: start it with what the upload queue still holds (phone-only: everything so far). */
export function seedLogFile(entries: Entry[]) {
  if (!usable) return;
  try {
    if (logFile().exists) return;
    pending.unshift(...entries.map(e => JSON.stringify(e) + '\n'));
    flushLogFile();
  } catch { /* see flushLogFile */ }
}

/** Everything kept, oldest first, as JSON lines. */
export function readLogFile(): string {
  flushLogFile();
  try { const f = logFile(); return f.exists ? f.textSync() : ''; } catch { return ''; }
}
