import { storage } from '@/shared/storage';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { flushHistory, recordTour } from '@/features/history/historyFile';
import { getSettings, loadSettings, noPc } from '@/features/settings/settings';
import { quietPosition } from '@/services/location';
import { log, startLogging } from '@/shared/log';
import { createTourApi } from './api';
import { parseStops } from '@/features/planner/parseText';
import { phoneDeps } from '@/features/planner/phoneDeps';
import { planOnPhone } from '@/features/planner/planOnPhone';
import { createTourStore, type LocalStore, type PhoneFallback, type Saved, type TourStore, type Where } from './store';

// Without the PC (no server set, 'Phone only', or it doesn't answer): plan and read lists on the phone.
const phone: PhoneFallback = {
  mode: () => (noPc() ? 'phone' : 'auto'),
  plan: (req, progress) => planOnPhone(req, phoneDeps, progress),
  parse: parseStops,
};

// The phone's copy of the tour: a killed app or a dead connection mid-tour must not lose deliveries. Every saved
// change also goes to the day's tour history.
const KEY = 'tour-v1';
const local: LocalStore = {
  read: async () => { const v = await storage.getItem(KEY); return v ? (JSON.parse(v) as Saved) : null; },
  write: s => { storage.setItem(KEY, JSON.stringify(s)).catch(() => {}); recordTour(s.tour); },
};

// where each Delivered was tapped, for the tour history (Settings > Tour history)
const where: Where = () => (getSettings().keepHistory ? quietPosition() : Promise.resolve(null));

const StoreContext = createContext<TourStore | null>(null);

/** Owns the one tour store for the app; the API reads the server URL from settings on every call. */
export function TourProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createTourStore(createTourApi(() => getSettings().server), log('tour'), local, phone, where));
  useEffect(() => { loadSettings().then(startLogging).then(store.start); }, [store]);
  // Siri shortcuts can deliver stops on the server while the app is in the background: resync on return. Leaving
  // the app writes the tour history now (iOS may suspend it before the delayed write).
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => { if (s === 'active') store.load(); else flushHistory(); });
    return () => sub.remove();
  }, [store]);
  return <StoreContext.Provider value={store}><AwakeWhileBusy />{children}</StoreContext.Provider>;
}

// Reading a batch of photos on the PC takes minutes; if the screen locks meanwhile iOS drops the upload and the
// app only learns of it when reopened (25 min of "Reading stops" on day one). Keep the screen on until done.
function AwakeWhileBusy() {
  const { busy } = useTourState();
  useEffect(() => {
    if (!busy) return;
    activateKeepAwakeAsync('busy').catch(() => {});
    return () => { deactivateKeepAwake('busy').catch(() => {}); };
  }, [busy]);
  return null;
}

/** The store's actions (stable across renders). */
export function useTourStore(): TourStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useTourStore must be used inside <TourProvider>');
  return store;
}

/** The store's state; re-renders on change. */
export function useTourState() {
  const store = useTourStore();
  return useSyncExternalStore(store.subscribe, store.getState);
}
