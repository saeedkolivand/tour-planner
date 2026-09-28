import type { Translate } from '@/shared/i18n';
import type { NextStopProps } from '../../widgets/types.ts';
import { clock, routeView } from './selectors.ts';
import type { Tour } from './types.ts';

// ponytail: the widget/Live Activity layout functions are serialized into expo-widgets' runtime and can only
// use their props + @expo/ui (no imports), so every string they show is translated here first and passed in.
export function nextStopProps(tour: Tour, t: Translate, now = Date.now()): NextStopProps | null {
  const view = routeView(tour, now);
  if (!view || !tour.plan) return null;
  const counts = { delivered: view.delivered, total: view.total };
  const deliveredOfTotal = t('route.deliveredOfTotal', { delivered: counts.delivered, total: counts.total });
  if (!view.next) {
    return {
      no: 0, address: t('route.tourCompleteTitle'), postcode: '', walk: 0, express: '', type: 'private', left: 0, eta: '', etaMs: 0, ...counts,
      doneLabel: t('route.tourCompleteTitle'), nextLabel: t('scan.nextStop'), widgetDoneLabel: t('common.done'), widgetNextLabel: t('scan.nextStop'),
      widgetDoneAddress: t('route.allDeliveredAddress'), leftPhrase: '', leftShort: '', deliveredOfTotal, onFootPhrase: '', expressPhrase: '', arriveLabel: t('route.arriveLabel'),
    };
  }
  const [first, ...walk] = view.next.stops;
  const left = view.upcoming.length + 1;
  return {
    no: first.no ?? view.nextIndex + 1,
    address: `${first.street} ${first.number}`.trim() || t('route.addressMissing'),
    postcode: first.postcode ?? '',
    walk: walk.length,
    express: view.next.stops.map(s => s.express).find(Boolean) ?? '',
    type: first.type,
    left,
    eta: clock(view.etaBase, view.next.eta),
    etaMs: view.etaBase + view.next.eta * 60_000,
    ...counts,
    doneLabel: t('route.tourCompleteTitle'),
    nextLabel: t('route.nextStopLabel'),
    widgetDoneLabel: t('common.done'),
    widgetNextLabel: t('scan.nextStop'),
    widgetDoneAddress: t('route.allDeliveredAddress'),
    leftPhrase: t('count.parkingStops', { count: left }),
    leftShort: t('route.leftShort', { n: left }),
    deliveredOfTotal,
    onFootPhrase: walk.length ? t('route.onFootPhrase', { n: walk.length }) : '',
    expressPhrase: view.next.stops.some(s => s.express) ? t('common.expressValue', { value: view.next.stops.map(s => s.express).find(Boolean) }) : '',
    arriveLabel: t('route.arriveLabel'),
  };
}

/** Identity of what's shown: only a change here is worth updating the Live Activity. */
export const propsKey = (p: NextStopProps | null) =>
  (p ? `${p.no}|${p.left}|${p.address}|${p.express}|${p.delivered}/${p.total}|${p.eta}` : 'none');
