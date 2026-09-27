import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { getSettings, loadSettings, noPc } from '@/features/settings/settings';
import { log, startLogging } from '@/shared/log';
import { createTourApi } from './api';
import { parseStops } from '@/features/planner/parseText';
import { phoneDeps } from '@/features/planner/phoneDeps';
import { planOnPhone } from '@/features/planner/planOnPhone';
import { createTourStore, type LocalStore, type PhoneFallback, type Saved, type TourStore } from './store';

// Without the PC (no server set, 'Phone only', or it doesn't answer): plan and read lists on the phone.
const phone: PhoneFallback = {
  mode: () => (noPc() ? 'phone' : 'auto'),
  plan: req => planOnPhone(req, phoneDeps),
  parse: parseStops,
};

// The phone's copy of the tour: a killed app or a dead connection mid-tour must not lose deliveries.
const KEY = 'tour-v1';
const local: LocalStore = {
  read: async () => { const v = await AsyncStorage.getItem(KEY); return v ? (JSON.parse(v) as Saved) : null; },
  write: s => { AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {}); },
};

const StoreContext = createContext<TourStore | null>(null);

/** Owns the one tour store for the app; the API reads the server URL from settings on every call. */
export function TourProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createTourStore(createTourApi(() => getSettings().server), log('tour'), local, phone));
  useEffect(() => { loadSettings().then(startLogging).then(store.start); }, [store]);
  // Siri shortcuts can deliver stops on the server while the app is in the background: resync on return.
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => { if (s === 'active') store.load(); });
    return () => sub.remove();
  }, [store]);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
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
