/// <reference types="node" />
// Run: npm test  (Node's built-in runner; the store has no React Native imports)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TourApi } from './api.ts';
import { createTourStore, type Saved } from './store.ts';
import type { Stop, Tour } from './types.ts';

const stop = (street: string, extra: Partial<Stop> = {}): Stop => ({ street, number: '1', postcode: '50667', type: 'private', parcels: 1, ...extra });

function fakeApi(overrides: Partial<TourApi> = {}) {
  const saved: Tour[] = [];
  const api: TourApi = {
    getTour: async () => ({}),
    saveTour: async t => { saved.push(t); },
    extract: async (_input, known) => ({ stops: [...known, stop('Ring', { key: 'ring|1' })], photos: [{ photo: 0, found: 2 }] }),
    optimize: async req => ({
      stops: req.stops.map((s, i) => ({ ...s, no: i + 1 })),
      clusters: [], km: 1, min: 2, baseline: null, ungeocoded: [], start: { lat: 0, lon: 0 }, end: null, startedAt: 0,
    }),
    pin: async () => {},
    ...overrides,
  };
  return { api, saved };
}

test('scan merges server stops, counts new ones, and saves the tour', async () => {
  const { api, saved } = fakeApi();
  const store = createTourStore(api);
  await store.load();
  store.addStop();
  const r = await store.scan({ texts: ['...'] });
  assert.deepEqual(r, { found: 2, added: 1, error: undefined });
  assert.equal(store.getState().tour.stops.length, 2);
  assert.equal(saved.at(-1)?.stops.length, 2);
});

test('editing an address drops the position (re-geocoded on the next plan) but keeps the key, so it stays deliverable', () => {
  const store = createTourStore(fakeApi().api);
  store.addStop();
  store.editStop(0, { key: 'x', lat: 1, lon: 2 } as Partial<Stop>);
  store.editStop(0, { parcels: 3 });
  assert.equal(store.getState().tour.stops[0].key, 'x', 'non-address edit keeps the key');
  store.editStop(0, { street: 'Hohe Str.' });
  const s = store.getState().tour.stops[0];
  assert.equal(s.key, 'x');
  assert.equal(s.lat, undefined);
});

test('plan stores loading numbers from the server and the plan without its stops', async () => {
  const store = createTourStore(fakeApi().api);
  store.addStop(); store.addStop();
  await store.plan({ q: 'Depot' }, null);
  const { tour } = store.getState();
  assert.deepEqual(tour.stops.map(s => s.no), [1, 2]);
  assert.equal(tour.plan?.km, 1);
  assert.equal('stops' in (tour.plan ?? {}), false);
});

test('a failing call sets error, clears busy, and leaves the tour alone', async () => {
  const store = createTourStore(fakeApi({ optimize: async () => { throw new Error('vroom down'); } }).api);
  store.addStop();
  await store.plan({ q: 'Depot' }, null);
  const st = store.getState();
  assert.equal(st.error, 'vroom down');
  assert.equal(st.busy, null);
  assert.equal(st.tour.plan, null);
});

test('toggleDone stamps and clears doneAt', () => {
  const store = createTourStore(fakeApi().api);
  store.addStop();
  store.editStop(0, { key: 'k' } as Partial<Stop>);
  store.toggleDone('k');
  assert.ok(store.getState().tour.stops[0].doneAt);
  store.toggleDone('k');
  assert.equal(store.getState().tour.stops[0].doneAt, undefined);
});

test('setDone marks a whole parking stop and keeps the first delivery time', () => {
  const store = createTourStore(fakeApi().api);
  store.addStop(); store.addStop();
  store.editStop(0, { key: 'a' } as Partial<Stop>);
  store.editStop(1, { key: 'b' } as Partial<Stop>);
  store.setDone(['a', 'b'], true);
  const first = store.getState().tour.stops.map(s => s.doneAt);
  assert.ok(first.every(Boolean));
  store.setDone(['a', 'b'], true);
  assert.deepEqual(store.getState().tour.stops.map(s => s.doneAt), first);
  store.setDone(['a'], false);
  assert.equal(store.getState().tour.stops[0].done, false);
});

const tick = () => new Promise(r => setTimeout(r, 0));
const memory = (initial: Saved | null = null) => { let v = initial; return { local: { read: async () => v, write: (s: Saved) => { v = s; } }, get: () => v }; };

test('nothing is sent before the PC tour was seen: an offline start can never wipe the server', async () => {
  const { api, saved } = fakeApi({ getTour: async () => { throw new Error('Network request failed'); } });
  const store = createTourStore(api);
  await store.start();
  store.addStop();
  await tick();
  assert.equal(saved.length, 0);
  assert.equal(store.getState().offline, true);
  assert.equal(store.getState().busy, null, 'a background load never blocks the buttons');
});

test('a delivery made offline survives an app kill and reaches the PC before the next load', async () => {
  let online = true, server: Partial<Tour> = { stops: [stop('Ring', { key: 'k' })] };
  const { api } = fakeApi({
    getTour: async () => { if (!online) throw new Error('Network request failed'); return server; },
    saveTour: async t => { if (!online) throw new Error('Network request failed'); server = t; },
  });
  const m = memory();
  const a = createTourStore(api, undefined, m.local);
  await a.start();
  online = false;
  a.setDone(['k'], true);
  await tick();
  assert.equal(m.get()?.dirty, true);
  // app killed, reopened, still offline: the phone's copy is shown
  const b = createTourStore(api, undefined, m.local);
  await b.start();
  assert.equal(b.getState().tour.stops[0].done, true);
  // back online: the delivery goes up first, then the reload can't undo it
  online = true;
  await b.load();
  assert.equal(server.stops?.[0].done, true);
  assert.equal(b.getState().tour.stops[0].done, true);
  assert.equal(m.get()?.dirty, false);
});

test('a reload that lands after a tap does not undo the tap', async () => {
  let release!: (t: Partial<Tour>) => void;
  const { api } = fakeApi();
  const store = createTourStore(api);
  await store.load();
  store.addStop();
  store.editStop(0, { key: 'k' } as Partial<Stop>);
  await tick();
  api.getTour = () => new Promise(r => { release = r; });
  const loading = store.load();
  await tick();
  store.setDone(['k'], true);
  release({ stops: [stop('Ring', { key: 'k' })] }); // the PC's copy from before the tap
  await loading;
  assert.equal(store.getState().tour.stops[0].done, true);
});

test('reopening stamps undoneAt so the PC can tell it from a stale copy', () => {
  const store = createTourStore(fakeApi().api);
  store.addStop();
  store.editStop(0, { key: 'k' } as Partial<Stop>);
  store.setDone(['k'], true);
  store.setDone(['k'], false);
  const s = store.getState().tour.stops[0];
  assert.equal(s.doneAt, undefined);
  assert.ok(s.undoneAt);
});

test('scanned labels: an unknown one becomes a stop once; more parcels for a stop raise its count', () => {
  const store = createTourStore(fakeApi().api);
  const label = { id: 'P1', street: 'Gereonswall', number: '114', postcode: '50670' };
  store.addParcelStop(label);
  store.addParcelStop(label);
  assert.equal(store.getState().tour.stops.length, 1);
  store.editStop(0, { key: 'g' } as Partial<Stop>);
  store.linkParcel('g', 'P2');
  store.linkParcel('g', 'P2');
  const s = store.getState().tour.stops[0];
  assert.deepEqual(s.parcelIds, ['P1', 'P2']);
  assert.equal(s.parcels, 2);
});

test('PC unreachable: the phone plans and reads the list; an input error from the PC is still shown', async () => {
  const phonePlan = { clusters: [], km: 1, min: 2, baseline: null, ungeocoded: [], start: { lat: 0, lon: 0 }, end: null, startedAt: 0, by: 'phone-estimate' as const };
  const phone = { mode: () => 'auto' as const, plan: async (r: { stops: Stop[] }) => ({ ...phonePlan, stops: r.stops }), parse: (t: string) => [stop(t)] };
  const down = fakeApi({ optimize: async () => { throw new Error('Network request failed'); }, extract: async () => { throw new Error('GET /extract timed out'); } });
  const store = createTourStore(down.api, undefined, undefined, phone);
  await store.load();
  assert.equal(await store.plan({ q: 'Depot' }, null), true);
  assert.equal(store.getState().tour.plan?.by, 'phone-estimate');
  const r = await store.scan({ texts: ['Ring'] });
  assert.equal(r?.found, 1);
  const bad = createTourStore(fakeApi({ optimize: async () => { throw new Error('start location not found'); } }).api, undefined, undefined, phone);
  assert.equal(await bad.plan({ q: 'Nowhere' }, null), false);
  assert.equal(bad.getState().error, 'start location not found');
});

test('phone only: a dragged pin is kept on the stop (pinned) without calling the PC', async () => {
  const phone = { mode: () => 'phone' as const, plan: async () => { throw new Error('unused'); }, parse: () => [] };
  const store = createTourStore(fakeApi({ pin: async () => { throw new Error('Network request failed'); } }).api, undefined, undefined, phone);
  store.addStop();
  store.editStop(0, { key: 'x' } as Partial<Stop>);
  await store.pin(store.getState().tour.stops[0], { lat: 50.95, lon: 6.95 });
  const s = store.getState().tour.stops[0];
  assert.deepEqual([s.lat, s.pinned, store.getState().error], [50.95, true, null]);
});
