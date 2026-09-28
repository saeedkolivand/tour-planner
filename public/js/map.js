// Leaflet map of the planned stops; dragging a pin saves a corrected position on the server.
/* global L */
import { api } from './api.js';
import { log } from './log.js';
import { t } from './i18n.js';
import { $, esc } from './util.js';

const Lg = log('map');
let map, layer;

export function drawMap(plan, done) {
  if (!map) {
    map = L.map('map');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  }
  layer?.remove();
  layer = L.layerGroup().addTo(map);
  const pts = [[plan.start.lat, plan.start.lon]];
  L.circleMarker(pts[0], { radius: 8, color: '#16a34a' }).addTo(layer).bindPopup(t('map.start'));
  for (const s of plan.clusters.flatMap(c => c.stops)) {
    const m = L.marker([s.lat, s.lon], {
      draggable: true, opacity: done.has(s.key) ? 0.4 : 1,
      icon: L.divIcon({ className: '', html: `<div class="pin">${s.no}</div>`, iconSize: [26, 26] }),
    }).addTo(layer);
    m.bindPopup(`${esc(s.street)} ${esc(s.number)}<br><span class="mute">${t('map.dragHint')}</span>`);
    m.on('dragend', async () => {
      const { lat, lng } = m.getLatLng();
      Lg.info('pin moved', { key: s.key, from: { lat: s.lat, lon: s.lon }, to: { lat, lon: lng } });
      Object.assign(s, { lat, lon: lng, exact: true });
      await api('POST', '/pin', { key: s.key, lat, lon: lng });
      $('#plan-msg').textContent = t('map.savedPosition', { address: `${s.street} ${s.number}` });
    });
    pts.push([s.lat, s.lon]);
  }
  map.fitBounds(pts, { padding: [20, 20] });
}
