// Planning the route and showing it: parking stops in order, tick-off, navigation links.
import { api } from './api.js';
import { log } from './log.js';
import { drawMap } from './map.js';
import { save, tour } from './state.js';
import { renderStops } from './stops.js';
import { $, TYPES, esc } from './util.js';

const L = log('plan');

const gps = () => new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
  p => { L.info('position fixed', { accuracyM: p.coords.accuracy }); resolve({ lat: p.coords.latitude, lon: p.coords.longitude }); },
  e => reject(new Error(`location unavailable: ${e.message}`)), { enableHighAccuracy: true, timeout: 15000 }));

export async function plan(fromHere) {
  const depot = $('#depot').value.trim();
  const btn = fromHere ? $('#replan') : $('#go');
  btn.disabled = true;
  $('#plan-msg').textContent = 'Planning…';
  try {
    const start = fromHere || $('#use-gps').checked ? await gps() : depot ? { q: depot } : null;
    if (!start) throw new Error('Enter a depot address or use your location');
    const end = $('#end-depot').checked && depot ? { q: depot } : null;
    const { stops, ...p } = await api('POST', '/optimize', { start, end, stops: tour.stops }); // stops come back keyed, geocoded, numbered
    tour.stops = stops;
    tour.plan = p;
    L.info('planned', { fromHere: !!fromHere, stops: stops.length, clusters: p.clusters.length, km: p.km, min: p.min, ungeocoded: p.ungeocoded.length });
    $('#plan-msg').textContent = p.ungeocoded.length ? `⚠ Not found on the map: ${p.ungeocoded.map(s => `${s.street} ${s.number}`).join(', ')}` : '';
    renderStops(); renderPlan(); save();
    $('#result').scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    L.error('plan failed', { error: e });
    $('#plan-msg').textContent = '⚠ ' + e.message;
  }
  btn.disabled = false;
}

const navUrl = p => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}&travelmode=driving`;
const badges = s => (s.express ? `<span class="badge x">⚡ ${esc(s.express)}</span>` : '')
  + (s.type !== 'private' ? `<span class="badge">${TYPES[s.type]}</span>` : '')
  + (s.exact === false ? '<span class="badge">≈ street only</span>' : '');

const stopItem = (s, done) => `<label class="it">
  <span class="no">${s.no}</span>
  <span class="grow">${esc(s.street)} ${esc(s.number)}<br><span class="mute">${esc(s.name || '')} ${s.parcels > 1 ? `· ${s.parcels} parcels` : ''}</span><br>${badges(s)}</span>
  <input type="checkbox" data-key="${esc(s.key)}" ${done.has(s.key) ? 'checked' : ''} aria-label="Delivered">
</label>`;

const clusterCard = (c, i, p, done) => {
  const clock = new Date(p.startedAt + c.eta * 60000).toTimeString().slice(0, 5);
  return `<div class="cl ${c.stops.every(s => done.has(s.key)) ? 'done' : ''}">
    <div class="cl-h"><span class="t">${i + 1}. ${esc(c.stops[0].street)} ${esc(c.stops[0].number)}${c.stops.length > 1 ? ` <span class="mute">+${c.stops.length - 1} on foot</span>` : ''}</span>
    <span class="mute">~${clock}</span><a class="btn" href="${navUrl(c.park)}" target="_blank" rel="noopener" data-nav="${i}">Navigate</a></div>
    ${c.stops.map(s => stopItem(s, done)).join('')}
  </div>`;
};

export function renderPlan() {
  const p = tour.plan;
  $('#result').classList.toggle('hidden', !p);
  $('#bar').classList.toggle('hidden', !p);
  if (!p) return;
  const done = new Set(tour.stops.filter(s => s.done).map(s => s.key));
  const left = p.clusters.filter(c => !c.stops.every(s => done.has(s.key)));
  const saves = p.baseline ? Math.round(p.baseline.min - p.min) : 0;
  $('#summary').innerHTML = `<b>${left.length} parking stops</b> · ${p.km.toFixed(1)} km · ~${Math.floor(p.min / 60)}h ${p.min % 60}m`
    + (saves > 0 ? ` · <span style="color:var(--ok)">saves ~${saves} min vs scanner order</span>` : '');
  $('#clusters').innerHTML = p.clusters.map((c, i) => clusterCard(c, i, p, done)).join('');
  drawMap(p, done);
}

export function bindPlan() {
  $('#go').onclick = () => plan(false);
  $('#replan').onclick = () => plan(true);
  $('#top').onclick = () => scrollTo({ top: 0, behavior: 'smooth' });
  $('#clusters').onclick = e => { if (e.target.dataset.nav) L.info('opened navigation', { cluster: +e.target.dataset.nav }); };
  $('#clusters').onchange = e => {
    const s = tour.stops.find(x => x.key === e.target.dataset.key);
    if (!s) return;
    s.done = e.target.checked;
    s.doneAt = s.done ? Date.now() : undefined; // ponytail: kept for learning service times later
    L.info(s.done ? 'stop delivered' : 'stop un-ticked', { key: s.key });
    renderPlan(); save();
  };
}
