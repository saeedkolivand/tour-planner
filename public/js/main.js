// Boot: logging first, then wire the sections and load today's tour.
import { log, startLogging } from './log.js';
import { readPhotos } from './photos.js';
import { bindPlan, renderPlan } from './plan.js';
import { EMPTY, loadTour, save, setTour, tour } from './state.js';
import { bindStops, renderStops } from './stops.js';
import { $, pref } from './util.js';

startLogging();
const L = log('app');

function renderAll() { $('#expected').value = tour.expected || ''; renderStops(); renderPlan(); }

$('#photos').onchange = e => {
  const files = [...e.target.files];
  e.target.value = '';
  readPhotos(files, renderStops);
};

$('#clear').onclick = () => {
  if (!confirm('Clear the whole tour?')) return;
  L.warn('tour cleared');
  setTour(EMPTY());
  $('#expected').value = '';
  renderStops(); renderPlan(); save();
};

// per-device preferences survive reloads
for (const id of ['depot', 'use-gps', 'end-depot']) {
  const el = $('#' + id), v = pref(id);
  if (v != null) { if (el.type === 'checkbox') el.checked = v === '1'; else el.value = v; }
  el.onchange = () => { pref(id, el.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value); L.info('preference changed', { id }); };
}

bindStops();
bindPlan();
loadTour()
  .then(() => renderAll())
  .catch(e => { L.error('tour load failed', { error: e }); renderStops(); });
