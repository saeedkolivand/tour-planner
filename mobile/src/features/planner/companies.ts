// Who the driver delivers for (CONTEXT.md: Company) and how its scanner list is read. A new job is one more entry here.
import type { Stop } from '../tour/types.ts';
import { parseStops } from './parseText.ts';
import { parsePhoenix, votePhoenix } from './phoenix.ts';

interface Reader { name: string; parse(text: string): Stop[]; /** all photos' rows, before they join the tour */ merge(rows: Stop[]): Stop[] }

export const COMPANIES = {
  dpd: { name: 'DPD', parse: parseStops, merge: rows => rows },
  phoenix: { name: 'PHOENIX', parse: parsePhoenix, merge: votePhoenix },
} satisfies Record<string, Reader>;

export type Company = keyof typeof COMPANIES;

/** The company's reader; one saved by a newer app version falls back to the first. */
export const companyOf = (c: string): Reader => COMPANIES[c as Company] ?? COMPANIES.dpd;
