import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useSettings, WALK_M } from '@/features/settings/settings';
import { currentPosition } from '@/services/location';
import { haptic } from '@/shared/haptics';
import { useTourStore } from './TourProvider';
import { t } from '@/shared/i18n';

/** Plans from the depot (or GPS when none is set), or re-plans the rest of the tour from where you are. */
export function usePlanning() {
  const store = useTourStore();
  const { depot, endAtDepot, expressOnTime, expressMarginMin, expressFirst, leaveAt, routeStyle, stopOrder, bothSides } = useSettings();

  return useCallback(async (fromHere = false): Promise<boolean> => {
    haptic.tap();
    try {
      const useGps = fromHere || !depot;
      if (useGps) store.setBusy('planning.findingLocation');
      const here = useGps ? await currentPosition().finally(() => store.setBusy(null)) : null;
      const start = here ? { lat: here.lat, lon: here.lon } : { q: depot };
      // planning at the depot before leaving: count ETAs and Express deadlines from the usual departure time, or,
      // when none is set, from the moment the tour actually sets off (the first Navigate or Delivered)
      const leave = /^(\d{1,2}):(\d{2})$/.exec(leaveAt.trim());
      const departAt = !fromHere && leave ? new Date().setHours(Number(leave[1]), Number(leave[2]), 0, 0) : undefined;
      const ok = await store.plan(start, endAtDepot && depot ? { q: depot } : null, {
        departAt, expressOnTime, expressMarginMin, expressFirst, walkM: WALK_M[routeStyle], heading: here?.heading,
        order: stopOrder, bothSides, pendingStart: !fromHere && !leave,
      });
      (ok ? haptic.success : haptic.error)();
      return ok;
    } catch (e) {
      haptic.error();
      Alert.alert(t('planning.couldNotPlan'), (e as Error).message);
      return false;
    }
  }, [store, depot, endAtDepot, expressOnTime, expressMarginMin, expressFirst, leaveAt, routeStyle, stopOrder, bothSides]);
}
