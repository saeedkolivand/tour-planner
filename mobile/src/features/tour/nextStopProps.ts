import type { NextStopProps } from '../../widgets/types.ts';
import { clock, routeView } from './selectors.ts';
import type { Tour } from './types.ts';

/** What the Live Activity / widget should show for this tour; null when there's no route. */
export function nextStopProps(tour: Tour, now = Date.now()): NextStopProps | null {
  const view = routeView(tour, now);
  if (!view || !tour.plan) return null;
  const counts = { delivered: view.delivered, total: view.total };
  if (!view.next) {
    return { no: 0, address: 'Tour complete', postcode: '', walk: 0, express: '', type: 'private', left: 0, eta: '', etaMs: 0, ...counts };
  }
  const [first, ...walk] = view.next.stops;
  return {
    no: first.no ?? view.nextIndex + 1,
    address: `${first.street} ${first.number}`.trim() || 'Address missing',
    postcode: first.postcode ?? '',
    walk: walk.length,
    express: view.next.stops.map(s => s.express).find(Boolean) ?? '',
    type: first.type,
    left: view.upcoming.length + 1,
    eta: clock(view.etaBase, view.next.eta),
    etaMs: view.etaBase + view.next.eta * 60_000,
    ...counts,
  };
}

/** Identity of what's shown: only a change here is worth updating the Live Activity. */
export const propsKey = (p: NextStopProps | null) =>
  (p ? `${p.no}|${p.left}|${p.address}|${p.express}|${p.delivered}/${p.total}|${p.eta}` : 'none');
