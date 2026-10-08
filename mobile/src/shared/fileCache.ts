// The app's cache folder: every scanner photo (camera shots, and the copies the photo picker makes) lands here and
// nothing else removes them, ~15 a day of a few MB each. Logs and the tour history live in documents, not here.
import { Directory, File, Paths } from 'expo-file-system';

const bytes = (x: Directory | File): number => (x instanceof File ? x.size ?? 0 : x.list().reduce((n, y) => n + bytes(y), 0));

/** How much the cache folder holds, in bytes. */
export function cacheSize() {
  try { return bytes(new Directory(Paths.cache)); } catch { return 0; }
}

/** Empties the cache folder; returns the bytes freed. A file in use is skipped. */
export function clearFileCache() {
  let freed = 0;
  try {
    for (const x of new Directory(Paths.cache).list()) {
      const n = bytes(x);
      try { x.delete(); freed += n; } catch { /* in use: next time */ }
    }
  } catch { /* no cache folder */ }
  return freed;
}
