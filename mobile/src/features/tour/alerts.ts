// What the phone says, and when: Express reminders before each open deadline (a missed one costs money), and on
// arriving at a parking stop the scanner's details the driver otherwise looks up (names, PRIO, Express, slot).
// Pure, so it's tested in node; useAlerts.ts schedules and speaks it.
import type { Cluster, Stop } from './types.ts';

/** Minutes before an Express deadline that a reminder goes off. */
export const LEADS_MIN = [30, 10];

export interface Reminder { id: string; at: number; title: string; body: string }

const today = (hhmm: string, now: number) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  return m ? new Date(now).setHours(Number(m[1]), Number(m[2]), 0, 0) : null;
};
const address = (s: Stop) => `${s.street} ${s.number}`.trim();
const tag = (s: Stop) => (s.prio ? 'PRIO' : s.express ? `Express ${s.express}` : '');

/** One reminder per deadline and lead time, for every open Express stop; those already gone by are left out. */
export function expressReminders(stops: Stop[], now: number): Reminder[] {
  const open = stops.filter(s => s.express && !s.done);
  return [...new Set(open.map(s => s.express!))].flatMap(hhmm => LEADS_MIN.map(lead => ({
    id: `express-${hhmm}-${lead}`,
    at: (today(hhmm, now) ?? 0) - lead * 60_000,
    title: `Express ${hhmm} · ${lead} min`,
    body: open.filter(s => s.express === hhmm).map(s => [address(s), s.name].filter(Boolean).join(' · ')).join('\n'),
  }))).filter(r => r.at > now).sort((a, b) => a.at - b.at);
}

/** What arriving at a parking stop shows: its address, and per stop the name, PRIO/Express and the scanner's slot. */
export function arrivalText(c: Cluster) {
  const [first] = c.stops;
  return {
    title: address(first) + (c.stops.length > 1 ? ` +${c.stops.length - 1}` : ''),
    body: c.stops.map(s => [s.name || address(s), tag(s), s.slot, s.parcels > 1 ? `${s.parcels}x` : ''].filter(Boolean).join(' · ')).join('\n'),
  };
}
