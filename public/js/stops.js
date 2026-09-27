// The editable stop list and the "all stops captured?" check.
import { log } from './log.js';
import { save, tour } from './state.js';
import { $, TYPES, esc } from './util.js';

const L = log('stops');
const ADDRESS = new Set(['street', 'number', 'postcode']);

function renderCount() {
  const n = tour.stops.length, want = Number(tour.expected);
  $('#n').textContent = `(${n})`;
  $('#count-msg').innerHTML = !want ? '' : n === want ? '<span style="color:var(--ok)">✓ All stops captured</span>'
    : `<span class="warn">${n < want ? `${want - n} stop(s) missing: take more photos` : `${n - want} more than the scanner shows: check for duplicates`}</span>`;
}

const row = (s, i) => `
  <div class="stop" data-i="${i}">
    <div class="f">
      <input data-k="street" value="${esc(s.street)}" placeholder="Street" aria-label="Street" style="flex:3 1 150px">
      <input data-k="number" value="${esc(s.number)}" placeholder="No." aria-label="House number" style="flex:0 1 70px">
      <input data-k="postcode" value="${esc(s.postcode)}" placeholder="PLZ" aria-label="Postcode" inputmode="numeric" style="flex:0 1 80px">
      <select data-k="type" aria-label="Stop type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${s.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <input data-k="parcels" type="number" value="${s.parcels || 1}" style="flex:0 1 60px" aria-label="Parcels">
      ${s.express ? `<span class="badge x">⚡ ${esc(s.express)}</span>` : ''}
      ${s.name ? `<span class="mute" style="flex-basis:100%">${esc(s.name)}${s.note ? ' · ' + esc(s.note) : ''}</span>` : ''}
    </div>
    <button class="del" aria-label="Remove stop">✕</button>
  </div>`;

export function renderStops() {
  $('#stops').innerHTML = tour.stops.map(row).join('');
  renderCount();
}

export function bindStops() {
  $('#expected').oninput = e => { tour.expected = e.target.value; renderCount(); save(); };

  // `change`, not `input`: commit once per edit instead of once per key
  $('#stops').onchange = e => {
    const i = e.target.closest('.stop')?.dataset.i, k = e.target.dataset.k;
    if (i == null || !k) return;
    const s = tour.stops[i];
    s[k] = k === 'parcels' ? Number(e.target.value) || 1 : e.target.value;
    // a changed address is a different stop to the server: drop the key so it re-keys and re-geocodes
    if (ADDRESS.has(k)) { delete s.key; delete s.lat; delete s.lon; }
    L.info('stop edited', { index: +i, field: k });
    save();
  };
  $('#stops').onclick = e => {
    if (!e.target.classList.contains('del')) return;
    const i = +e.target.closest('.stop').dataset.i;
    L.info('stop removed', { index: i, key: tour.stops[i]?.key });
    tour.stops.splice(i, 1);
    renderStops(); save();
  };
  $('#add').onclick = () => {
    tour.stops.push({ street: '', number: '', postcode: '', city: 'Köln', type: 'private', parcels: 1 });
    L.info('stop added');
    renderStops();
  };
}
