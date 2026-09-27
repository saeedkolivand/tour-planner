// Writes that survive a crash or power cut mid-write: a plain writeFileSync empties the file first,
// and the readers treat an unreadable file as "nothing saved", so the next save would make the loss permanent.
import fs from 'node:fs';

export function writeAtomic(url, data) {
  const tmp = new URL(`${url.href}.tmp`);
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, url);
}
