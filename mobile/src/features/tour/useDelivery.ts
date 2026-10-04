// The driving loop in one place: navigate → deliver → (optionally) navigate to the next stop.
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
import { useSettings } from '@/features/settings/settings';
import { NAV_APPS, navigateTo } from '@/services/navigation';
import { haptic } from '@/shared/haptics';
import { useMinute } from '@/shared/useMinute';
import { routeView } from './selectors';
import { useTourState, useTourStore } from './TourProvider';
import type { Cluster, Stop } from './types';
import { t } from '@/shared/i18n';

const keysOf = (c: Cluster) => c.stops.map(s => s.key).filter((k): k is string => !!k);

export function useDelivery() {
  const store = useTourStore();
  const { tour } = useTourState();
  const { navApp, autoNavigate } = useSettings();
  const minute = useMinute();
  const view = useMemo(() => routeView(tour, minute), [tour, minute]);
  // read the latest view in callbacks without putting it in their deps, so a minute tick doesn't recreate them (and re-render memo'd rows)
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; });

  const navigate = useCallback((c: Cluster) => {
    haptic.tap();
    store.depart(); // the first Navigate is when the tour sets off (if no departure time was set)
    const first = c.stops[0];
    navigateTo(c.park, navApp, `${first.street} ${first.number}`).catch(e => Alert.alert(t('delivery.navigationError'), (e as Error).message));
  }, [store, navApp]);

  const lastDelivered = useRef(0);
  const markDelivered = useCallback((c: Cluster) => {
    lastDelivered.current = Date.now();
    haptic.success();
    store.setDone(keysOf(c), true);
    const view = viewRef.current;
    const following = view?.next === c ? view.upcoming[0]?.cluster : undefined;
    if (following && autoNavigate) navigate(following);
    if (view?.next === c && !following) haptic.success(); // tour finished
  }, [store, autoNavigate, navigate]);

  /**
   * Marks a parking stop delivered; if it was the next one and auto-navigate is on, heads to the one after.
   * The next card's button sits where the last one was: a second tap within 1.5 s (gloves, a bump) is ignored,
   * and delivering out of order asks first, so a mis-tap in the list can't leave a parcel in the van.
   */
  const deliver = useCallback((c: Cluster) => {
    if (Date.now() - lastDelivered.current < 1500) return;
    const view = viewRef.current;
    if (view?.next === c) return markDelivered(c);
    const first = c.stops[0];
    // by address: the row shows its place in the route, the stop its loading number, so a number here confuses
    const next = view?.next?.stops[0];
    const more = c.stops.length > 1 ? t('delivery.moreCount', { n: c.stops.length - 1 }) : '';
    Alert.alert(t('delivery.confirmTitle', { address: `${first.street} ${first.number}`, more }), next ? t('delivery.nextStopIs', { address: `${next.street} ${next.number}` }) : t('delivery.notNextStop'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delivered'), onPress: () => markDelivered(c) },
    ]);
  }, [markDelivered]);

  const reopen = useCallback((c: Cluster) => { haptic.warn(); store.setDone(keysOf(c), false); }, [store]);
  const toggleStop = useCallback((s: Stop) => { if (s.key) store.toggleDone(s.key); }, [store]);

  return { view, navigate, deliver, reopen, toggleStop, navLabel: NAV_APPS[navApp] };
}
