// Scanner photos -> stops, one photo per request so progress shows as it goes.
import { api } from './api.js';
import { log } from './log.js';
import { save, tour } from './state.js';
import { $, esc } from './util.js';

const L = log('photos');

/** Downscales on a canvas: phone photos are 4-8 MB, the reader needs ~2000 px. */
function shrink(file, max = 2000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = Object.assign(document.createElement('canvas'), { width: img.width * k, height: img.height * k });
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error(`could not open ${file.name}`));
    img.src = URL.createObjectURL(file);
  });
}

export async function readPhotos(files, onUpdate) {
  const errors = [];
  L.info('reading photos', { count: files.length, bytes: files.reduce((n, f) => n + f.size, 0) });
  for (const [i, f] of files.entries()) {
    $('#read-msg').textContent = `Reading photo ${i + 1} of ${files.length}…`;
    try {
      const before = tour.stops.length;
      const r = await api('POST', '/extract', { images: [await shrink(f)], stops: tour.stops });
      tour.stops = r.stops;
      const p = r.photos[0];
      if (p.error) errors.push(`photo ${i + 1}: ${p.error}`);
      L.info('photo read', { photo: i, by: p.by, found: p.found, added: r.stops.length - before, error: p.error });
      onUpdate();
    } catch (e) {
      errors.push(`photo ${i + 1}: ${e.message}`);
      L.error('photo failed', { photo: i, error: e });
    }
  }
  $('#read-msg').innerHTML = errors.length ? `<span class="warn">${esc(errors.join(' · '))}</span>` : `Read ${files.length} photo(s).`;
  save();
}
