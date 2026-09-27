// The driving loop in one place: navigate → deliver → (optionally) navigate to the next stop.
import { useCallback, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
import { useSettings } from '@/features/settings/settings';
import { NAV_APPS, navigateTo } from '@/services/navigation';
import { haptic } from '@/shared/haptics';
import { useMinute } from '@/shared/useMinute';
import { routeView } from './selectors';
import { useTourState, useTourStore } from './TourProvider';
import type { Cluster, Stop } from './types';

const keysOf = (c: Cluster) => c.stops.map(s => s.key).filter((k): k is string => !!k);

export function useDelivery() {
  const store = useTourStore();
  const { tour } = useTourState();
  const { navApp, autoNavigate } = useSettings();
  const minute = useMinute();
  const view = useMemo(() => routeView(tour, minute), [tour, minute]);

  const navigate = useCallback((c: Cluster) => {
    haptic.tap();
    const first = c.stops[0];
    navigateTo(c.park, navApp, `${first.street} ${first.number}`).catch(e => Alert.alert('Navigation', (e as Error).message));
  }, [navApp]);

  const lastDelivered = useRef(0);
  const markDelivered = useCallback((c: Cluster) => {
    lastDelivered.current = Date.now();
    haptic.success();
    store.setDone(keysOf(c), true);
    const following = view?.next === c ? view.upcoming[0]?.cluster : undefined;
    if (following && autoNavigate) navigate(following);
    if (view?.next === c && !following) haptic.success(); // tour finished
  }, [store, view, autoNavigate, navigate]);

  /**
   * Marks a parking stop delivered; if it was the next one and auto-navigate is on, heads to the one after.
   * The next card's button sits where the last one was: a second tap within 1.5 s (gloves, a bump) is ignored,
   * and delivering out of order asks first, so a mis-tap in the list can't leave a parcel in the van.
   */
  const deliver = useCallback((c: Cluster) => {
    if (Date.now() - lastDelivered.current < 1500) return;
    if (view?.next === c) return markDelivered(c);
    const first = c.stops[0];
    // by address: the row shows its place in the route, the stop its loading number, so a number here confuses
    const next = view?.next?.stops[0];
    const more = c.stops.length > 1 ? ` (+${c.stops.length - 1})` : '';
    Alert.alert(`Deliver ${first.street} ${first.number}${more} now?`, next ? `Your next stop is ${next.street} ${next.number}.` : 'It is not your next stop.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delivered', onPress: () => markDelivered(c) },
    ]);
  }, [view, markDelivered]);

  const reopen = useCallback((c: Cluster) => { haptic.warn(); store.setDone(keysOf(c), false); }, [store]);
  const toggleStop = useCallback((s: Stop) => { if (s.key) store.toggleDone(s.key); }, [store]);

  return { view, navigate, deliver, reopen, toggleStop, navLabel: NAV_APPS[navApp] };
}
