import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useSettings } from '@/features/settings/settings';
import { currentPosition } from '@/services/location';
import { haptic } from '@/shared/haptics';
import { useTourStore } from './TourProvider';
import { t } from '@/shared/i18n';

/** Plans from the depot (or GPS when none is set), or re-plans the rest of the tour from where you are. */
export function usePlanning() {
  const store = useTourStore();
  const { depot, endAtDepot, expressOnTime, leaveAt } = useSettings();

  return useCallback(async (fromHere = false): Promise<boolean> => {
    haptic.tap();
    try {
      const useGps = fromHere || !depot;
      if (useGps) store.setBusy('planning.findingLocation');
      const start = useGps ? await currentPosition().finally(() => store.setBusy(null)) : { q: depot };
      // planning at the depot before leaving: count ETAs and Express deadlines from the usual departure time
      const leave = /^(\d{1,2}):(\d{2})$/.exec(leaveAt.trim());
      const departAt = !fromHere && leave ? new Date().setHours(Number(leave[1]), Number(leave[2]), 0, 0) : undefined;
      const ok = await store.plan(start, endAtDepot && depot ? { q: depot } : null, { departAt, expressOnTime });
      (ok ? haptic.success : haptic.error)();
      return ok;
    } catch (e) {
      haptic.error();
      Alert.alert(t('planning.couldNotPlan'), (e as Error).message);
      return false;
    }
  }, [store, depot, endAtDepot, expressOnTime, leaveAt]);
}
