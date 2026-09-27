// Keeps the "Next stop" Live Activity (Lock Screen, Dynamic Island, CarPlay Dashboard) and the
// small widget (Home Screen, CarPlay widgets) in step with the tour. iOS only (useLiveSurfaces.ts elsewhere):
// @expo/ui's SwiftUI components can't even be imported on other platforms.
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { log } from '@/shared/log';
import { useMinute } from '@/shared/useMinute';
import NextStopActivity from '../../widgets/NextStopActivity';
import NextStopWidget from '../../widgets/NextStopWidget';
import { nextStopProps, propsKey } from './nextStopProps';
import { useTourState } from './TourProvider';

const L = log('surfaces');
const NOT_FOREGROUND = /not foreground/i; // cold start: tour restores before iOS considers us foregrounded

export function useLiveSurfaces() {
  const { tour } = useTourState();
  const props = nextStopProps(tour, useMinute()); // ETAs move with a delay
  const key = propsKey(props);
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (key === last.current) return;
    // remembered only once it worked: a failed start (Live Activities off, too many running) retries on the next change
    sync(props).then(() => { last.current = key; }, e => {
      if (!(e instanceof Error && NOT_FOREGROUND.test(e.message))) {
        L.error('live surfaces update failed', { error: e });
        return;
      }
      L.warn('live surfaces update failed', { error: e }); // expected on cold start; retried once we're foreground
      const sub = AppState.addEventListener('change', state => {
        if (state !== 'active') return;
        sub.remove();
        L.info('live surfaces retrying now that app is foreground');
        sync(props).then(() => { last.current = key; }, e2 => L.error('live surfaces update failed', { error: e2 }));
      });
    });
    // props is derived from key; depending on key alone skips identical updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

async function sync(props: ReturnType<typeof nextStopProps>) {
  const running = NextStopActivity.getInstances();
  if (!props) {
    await Promise.all(running.map(a => a.end('immediate')));
    if (running.length) L.info('live activity ended', { reason: 'no route' });
    return;
  }
  NextStopWidget.updateSnapshot(props);
  if (props.left === 0) {
    await Promise.all(running.map(a => a.end('default', props)));
    L.info('live activity ended', { reason: 'tour complete' });
  } else if (running.length) {
    await running[0].update(props);
    L.info('live activity updated', { no: props.no, left: props.left });
  } else {
    NextStopActivity.start(props, 'tourplanner://route');
    L.info('live activity started', { no: props.no, left: props.left });
  }
}
