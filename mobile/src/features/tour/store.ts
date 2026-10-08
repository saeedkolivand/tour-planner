import type { ExtractResult, ScanInput, TourApi } from './api.ts';
import { columnTags } from '../planner/parseText.ts';
import { dedupe } from '../planner/stops.ts';
import { keepOrder, moveCluster, withSeq } from './manualOrder.ts';
import { lateKeys } from './selectors.ts';
import { silent, type StoreLogger } from './storeLogger.ts';
import { EMPTY_TOUR, newStop, type LatLon, type Place, type Plan, type PlanOptions, type PlanRequest, type Stop, type Tour } from './types.ts';

export interface TourState {
  tour: Tour;
  /** What is running, for a spinner line; null when idle. Only user actions, never background syncs. */
  busy: string | null;
  /** How far the running step is (photo 3 of 12, address 12 of 38); null when it can't say. */
  progress: Progress | null;
  error: string | null;
  /** The last sync with the PC failed; changes are kept on the phone and sent when it's back. */
  offline: boolean;
}

export interface Progress { done: number; total: number }

/** What survives an app kill: the tour, and whether the PC still has to receive it. */
export interface Saved { tour: Tour; dirty: boolean; synced: boolean }
export interface LocalStore { read(): Promise<Saved | null>; write(s: Saved): void }
const NO_LOCAL: LocalStore = { read: async () => null, write: () => {} };

export type TourStore = ReturnType<typeof createTourStore>;

/** Working without the PC: plan and read scanner text on the phone. Absent in tests that only exercise the PC path. */
export interface PhoneFallback {
  mode(): 'auto' | 'phone';
  plan(req: PlanRequest, progress?: (stage: PlanStage, done?: number, total?: number) => void): Promise<Plan & { stops: Stop[] }>;
  parse(text: string): Stop[];
}

/**
 * Where the phone is right now, for the tour history (Stop.donePos); null when it can't say. Never prompts and never
 * keeps the GPS on: one reading per Delivered tap.
 */
export type Where = () => Promise<(LatLon & { acc?: number }) | null>;

/** The stages of a plan made on the phone, each shown as its own line (`planning.<stage>`). */
export type PlanStage = 'places' | 'roadTimes' | 'ordering';

/** The PC didn't answer (vs. answered with an error about the input): the phone can take over. */
export const unreachable = (e: unknown) => /network|fetch|timed? ?out|abort|resolve host|Server error 5\d\d/i.test((e as Error)?.message ?? '');

/** A dropped connection reads better as what to do about it: screens show t('store.cantReachPc') for these. */
export const cantReachPc = (m: string) => /network|fetch failed|could not be found|could not connect|timed? ?out|abort/i.test(m);
export function friendly(e: unknown) {
  const m = (e as Error)?.message ?? String(e);
  return m.replace(/\s*\(at .*\)$/, '');
}

/**
 * All tour state and every mutation of it. Framework-free: React reads it through
 * useSyncExternalStore (TourProvider.tsx), and tests drive it with a fake TourApi.
 * The phone's copy is the working copy: every change is saved on the phone first, then sent to the PC
 * (so the web app and Siri see it). Until a change reached the PC, a reload never overwrites it.
 */
export function createTourStore(api: TourApi, L: StoreLogger = silent, local: LocalStore = NO_LOCAL, phone?: PhoneFallback, where?: Where) {
  let state: TourState = { tour: EMPTY_TOUR, busy: null, progress: null, error: null, offline: false };
  /** Unsent changes; and whether we've seen the PC's tour yet (before that, a push could wipe it). */
  let dirty = false, synced = false;
  /** Bumped by every change: a reload that started before a change must not apply its older copy. */
  let version = 0;
  const listeners = new Set<() => void>();

  const set = (patch: Partial<TourState>) => {
    state = { ...state, ...patch };
    listeners.forEach(l => l());
  };
  const persist = () => local.write({ tour: state.tour, dirty, synced });

  // One save in flight at a time, always of the newest tour: two racing PUTs could land out of order.
  let pushing: Promise<void> | null = null, again = false;
  /** Phone-only mode: no PC to sync with; the phone's copy is the only one. */
  const noPc = () => phone?.mode() === 'phone';
  function push(): Promise<void> {
    if (!synced || noPc()) return Promise.resolve();
    if (pushing) { again = true; return pushing; }
    pushing = (async () => {
      do {
        again = false;
        const sent = state.tour;
        try {
          await api.saveTour(sent);
          if (state.tour === sent) { dirty = false; persist(); }
          if (state.offline) set({ offline: false });
        } catch (e) {
          L.warn('tour not saved to server, kept on the phone', { error: e });
          set({ offline: true });
          return; // retried with the next change or when the app comes back to the foreground
        }
      } while (again);
    })().finally(() => { pushing = null; });
    return pushing;
  }

  const setTour = (fn: (t: Tour) => Tour) => {
    set({ tour: fn(state.tour) });
    dirty = true; version++;
    persist();
    void push();
  };
  const editStops = (fn: (stops: Stop[]) => Stop[]) => setTour(t => ({ ...t, stops: fn(t.stops) }));

  /** The PC's /extract, done by rules on the phone: new rows merged into the list like the PC does. */
  const readOnPhone = (texts: string[]): ExtractResult => {
    const found = columnTags(texts, texts.map(t => phone!.parse(t)));
    // what the phone's rules made of each photo's text (the text itself is in the 'on-device OCR' entry)
    found.forEach((rows, photo) => L.debug('photo read on the phone', { photo, rows: rows.map(s =>
      `${s.street} ${s.number}, ${s.postcode}${s.name ? ` (${s.name})` : ''}${s.express ? ` Express ${s.express}` : ''}${s.prio ? ' PRIO' : ''}${s.slot ? ` ${s.slot}` : ''}${s.parcels > 1 ? ` x${s.parcels}` : ''}${s.type !== 'private' ? ` ${s.type}` : ''}`) }));
    // overlapping photos, "Str."/"Straße", a postcode on one row only, a dropped umlaut: one stop, as the planner keys it
    return { stops: dedupe([...state.tour.stops, ...found.flat()]), photos: found.map((f, photo) => ({ photo, found: f.length, by: 'phone' })) };
  };

  /** Runs a user-started server call with busy/error state and a log line either way. Resolves undefined on failure. */
  async function run<T>(action: string, label: string, fn: () => Promise<T>): Promise<T | undefined> {
    const t0 = Date.now();
    set({ busy: label, progress: null, error: null });
    try {
      const out = await fn();
      L.info(`${action} ok`, { ms: Date.now() - t0 });
      return out;
    } catch (e) {
      L.error(`${action} failed`, { ms: Date.now() - t0, error: e });
      set({ error: friendly(e) });
      return undefined;
    } finally { set({ busy: null, progress: null }); }
  }

  /** Background sync: sends unsent changes first, then takes the PC's tour (Siri may have delivered stops). */
  async function load() {
    if (noPc()) { if (state.offline) set({ offline: false }); return; }
    if (dirty && synced) {
      await push();
      if (dirty) return; // still offline: the phone's copy stays
    }
    const t0 = Date.now(), v = version;
    let t: Partial<Tour>;
    try { t = await api.getTour(); }
    catch (e) { L.warn('load failed, using the phone copy', { ms: Date.now() - t0, error: e }); set({ offline: true }); return; }
    if (version !== v) return; // changed while loading (maybe already sent): the PC copy is older, don't apply it
    if (dirty && !t.stops?.length) { synced = true; void push(); return; } // edited offline before the first sync, PC empty
    if (dirty) L.warn('phone edits made before the first sync are replaced by the PC tour', { stops: state.tour.stops.length });
    dirty = false; synced = true;
    set({ tour: { ...EMPTY_TOUR, ...t }, offline: false });
    persist();
    L.info('tour loaded', { ms: Date.now() - t0, stops: t.stops?.length ?? 0, planned: !!t.plan });
    if (state.tour.stops.some(s => s.done)) depart(); // Siri delivered while the app was closed: the tour has set off
  }

  /**
   * The tour sets off now: a plan made without a departure time counts its ETAs and deadlines from this moment
   * instead of from when it was planned (often an hour earlier, while loading). Once per plan; a no-op otherwise.
   */
  function depart(now = Date.now()) {
    const p = state.tour.plan;
    if (!p?.pendingStart) return;
    // already delivered (by Siri, with the app closed): it left about one drive before the first delivery
    const doneAt = new Map(state.tour.stops.filter(s => s.done && s.doneAt).map(s => [s.key, s.doneAt!]));
    const left = p.clusters.flatMap(c => c.stops.flatMap(s => (doneAt.has(s.key) ? [doneAt.get(s.key)! - c.eta * 60_000] : [])));
    const startedAt = Math.max(p.startedAt, Math.min(now, ...left));
    const late = lateKeys(p.clusters, startedAt, p.expressOnTime !== false);
    L.info('tour started', { plannedMinAgo: Math.round((now - p.startedAt) / 60_000), late: late.length });
    setTour(t => (t.plan ? { ...t, plan: { ...t.plan, startedAt, late, pendingStart: undefined } } : t));
  }

  /**
   * Marks a whole parking stop delivered (or not) in one write. The first delivery sets the tour off. Where the
   * phone was is added when the reading comes in (a second write; the tap never waits for the GPS).
   */
  function setDone(keys: string[], done: boolean) {
    if (done) depart();
    L.info(done ? 'delivered' : 'reopened', { keys });
    const set = new Set(keys), now = Date.now();
    editStops(ss => ss.map(s => !s.key || !set.has(s.key) ? s
      : done ? { ...s, done, doneAt: s.doneAt ?? now, undoneAt: undefined } : { ...s, done, doneAt: undefined, undoneAt: now, donePos: undefined }));
    if (done && where) void where().catch(() => null).then(donePos => {
      // reopened (or delivered again) meanwhile: that tap's own reading counts, not this one
      if (donePos) editStops(ss => ss.map(s => s.key && set.has(s.key) && s.done && s.doneAt === now && !s.donePos ? { ...s, donePos } : s));
    });
  }

  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getState: () => state,
    /** For waits outside a store call (a GPS fix, reading photos), so the screen shows something is happening. */
    setBusy: (busy: string | null, progress: Progress | null = null) => set({ busy, progress }),

    /** The phone's own copy, instantly and offline; then the PC's. */
    async start() {
      const saved = await local.read().catch(() => null);
      if (saved?.tour) {
        ({ dirty, synced } = saved);
        set({ tour: { ...EMPTY_TOUR, ...saved.tour } });
        L.info('tour restored from phone', { stops: saved.tour.stops?.length ?? 0, unsent: dirty });
      }
      await load();
    },

    load,

    /** Reads scanned photos/texts; returns how many rows were found and how many were new stops. */
    async scan(input: ScanInput) {
      const before = state.tour.stops.length;
      const kind = 'texts' in input ? 'text' : 'image';
      const r = await run('scan', 'store.readingStops', async () => {
        if ('texts' in input && phone && phone.mode() === 'phone') return readOnPhone(input.texts);
        try { return await api.extract(input, state.tour.stops); }
        catch (e) {
          if (!('texts' in input) || !phone || !unreachable(e)) throw e;
          L.warn('PC unreachable, reading the list on the phone', { error: e });
          return readOnPhone(input.texts);
        }
      });
      if (!r) return null;
      setTour(t => ({ ...t, stops: r.stops }));
      const result = { found: r.photos.reduce((n, p) => n + p.found, 0), added: r.stops.length - before, error: r.photos.find(p => p.error)?.error };
      L.info('scanned', { kind, inputs: r.photos.length, ...result, readers: r.photos.map(p => p.by ?? 'failed') });
      return result;
    },

    /** `pendingStart`: no departure time was given, so the tour's clock starts at the first Navigate or Delivered. */
    async plan(start: Place, end: Place | null, { pendingStart = false, ...opt }: PlanOptions & { pendingStart?: boolean } = {}) {
      const req: PlanRequest = { start, end, stops: state.tour.stops, lastNo: state.tour.plan?.lastNo, ...opt };
      const r = await run('plan', 'store.planningRoute', async () => {
        // the phone's plan takes minutes the first time (each new address looked up): say which step it's on
        const stage = (st: PlanStage, done?: number, total?: number) => set({ busy: `planning.${st}`, progress: total ? { done, total } as Progress : null });
        if (phone?.mode() === 'phone') return phone.plan(req, stage);
        try { return { ...await api.optimize(req), by: 'pc' as const }; }
        catch (e) {
          if (!phone || !unreachable(e)) throw e;
          L.warn('PC unreachable, planning on the phone', { error: e });
          return phone.plan(req, stage);
        }
      });
      if (!r) return false;
      const { stops: got, ...planned } = r; // stops come back keyed, geocoded and numbered
      // mid-tour (something delivered) the clock is already running
      const waits = pendingStart && !got.some(s => s.done);
      const fresh: Plan = { ...planned, expressOnTime: opt.expressOnTime !== false, ...(waits && { pendingStart: true }) };
      // an order the driver set by hand stands; new parking stops are fitted in
      const seq = new Map(state.tour.stops.flatMap(s => (s.key && s.seq != null ? [[s.key, s.seq] as const] : [])));
      const kept = seq.size ? keepOrder(fresh, seq) : null;
      const plan = kept ?? fresh;
      const stops = kept ? withSeq(got.map(({ seq: _, ...s }) => s), kept) : got;
      if (kept) L.info('order kept from the driver', { parkingStops: kept.clusters.length, placedByHand: seq.size });
      setTour(t => ({ ...t, stops, plan }));
      L.info('planned', { fromGps: 'lat' in start, by: plan.by, order: opt.order, pendingStart: waits, note: plan.note, stops: stops.length, clusters: plan.clusters.length, km: plan.km, min: plan.min, ungeocoded: plan.ungeocoded.length, unplaced: plan.ungeocoded.map(s => `${s.street} ${s.number}`) });
      return true;
    },

    /** The driver moves a parking stop (indices in plan.clusters); from then on, re-plans keep the driver's order. */
    moveCluster(from: number, to: number) {
      const p = state.tour.plan;
      if (!p || from === to || !p.clusters[from] || !p.clusters[to]) return;
      const plan = moveCluster(p, from, to);
      L.info('moved by hand', { from, to, stop: p.clusters[from].stops[0].key, min: plan.min, was: p.min, late: plan.late?.length ?? 0 });
      setTour(t => ({ ...t, plan, stops: withSeq(t.stops, plan) }));
    },

    /** Forgets the driver's order: the next plan is the planner's own. */
    resetOrder() {
      L.info('order by hand dropped');
      editStops(ss => ss.map(({ seq: _, ...s }) => s));
    },

    async pin(stop: Stop, at: LatLon) {
      if (!stop.key) return;
      // phone only: the pin lives on the stop (the planner trusts `pinned`); with a PC it's remembered there for good
      const ok = noPc() || await run('pin', 'store.savingPosition', async () => { await api.pin(stop.key!, at); return true; });
      if (ok) editStops(ss => ss.map(s => s.key === stop.key ? { ...s, ...at, exact: true, pinned: true } : s));
      L.info('pin moved', { key: stop.key, from: { lat: stop.lat, lon: stop.lon }, to: at });
    },

    editStop(i: number, patch: Partial<Stop>) {
      // A changed address needs a new position (the server geocodes it on the next plan). The key stays until
      // then: the plan still lists the stop under it, and without it the stop could never be delivered.
      const readdressed = 'street' in patch || 'number' in patch || 'postcode' in patch;
      L.info('stop edited', { index: i, key: state.tour.stops[i]?.key, fields: Object.keys(patch), readdressed });
      editStops(ss => ss.map((s, j) => j === i ? { ...s, ...patch, ...(readdressed && { lat: undefined, lon: undefined, exact: undefined, pinned: undefined }) } : s));
    },
    addStop() { L.info('stop added'); editStops(ss => [...ss, newStop()]); },
    removeStop(i: number) { L.info('stop removed', { index: i, key: state.tour.stops[i]?.key }); editStops(ss => ss.filter((_, j) => j !== i)); },
    /** doneAt is kept to learn real service times later; undoneAt lets the PC tell a reopen from a stale copy. */
    toggleDone(key: string) {
      const done = !state.tour.stops.find(s => s.key === key)?.done;
      setDone([key], done);
    },
    setDone,
    depart,
    /** A scanned parcel belongs to this stop: the next scan of it needs no address reading, and it counts as a parcel. */
    linkParcel(key: string, id: string) {
      if (state.tour.stops.some(s => s.key === key && s.parcelIds?.includes(id))) return;
      L.info('parcel linked', { key, id });
      editStops(ss => ss.map(s => {
        if (s.key !== key) return s;
        const parcelIds = [...(s.parcelIds ?? []), id];
        return { ...s, parcelIds, parcels: Math.max(s.parcels, parcelIds.length) };
      }));
    },
    /** A scanned label that isn't in the tour yet becomes a stop (numbered on the next plan). */
    addParcelStop(p: { id: string; street: string; number: string; postcode?: string; city?: string; name?: string }) {
      if (state.tour.stops.some(s => s.parcelIds?.includes(p.id))) return;
      L.info('stop added from label', { id: p.id, postcode: p.postcode });
      editStops(ss => [...ss, {
        street: p.street, number: p.number, postcode: p.postcode ?? '', city: p.city, name: p.name,
        type: 'private', parcels: 1, parcelIds: [p.id],
      }]);
    },
    setExpected: (expected: string) => setTour(t => ({ ...t, expected })),
    clear() { L.warn('tour cleared', { stops: state.tour.stops.length }); setTour(() => EMPTY_TOUR); },
  };
}
