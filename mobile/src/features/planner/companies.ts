// Who the driver delivers for (CONTEXT.md: Company) and how its scanner list is read. A new job is one more entry here.
import type { Stop } from '../tour/types.ts';
import { parseStops } from './parseText.ts';
import { parsePhoenix, phoenixTotal, votePhoenix } from './phoenix.ts';

interface Reader {
  name: string; parse(text: string): Stop[]; /** all photos' rows, before they join the tour */ merge(rows: Stop[]): Stop[];
  /** the stop count in a photo's header, if it shows one */ total?(text: string): number | null;
  /** The tour's order is given (a fixed route), never improved or solved: the Stop order setting doesn't apply. */
  fixedOrder?: true;
  /** Night and day shifts, each with its own fixed route (Settings > Shift). */
  shifts?: true;
}

export const COMPANIES = {
  dpd: { name: 'DPD', parse: parseStops, merge: rows => rows },
  // PHOENIX: the supervisor's route is the order; the driver asked for no improved or fastest order, ever (2026-11-03)
  phoenix: { name: 'PHOENIX', parse: parsePhoenix, merge: votePhoenix, total: phoenixTotal, fixedOrder: true, shifts: true },
} satisfies Record<string, Reader>;

export type Company = keyof typeof COMPANIES;

/** The company's reader; one saved by a newer app version falls back to the first. */
export const companyOf = (c: string): Reader => COMPANIES[c as Company] ?? COMPANIES.dpd;
