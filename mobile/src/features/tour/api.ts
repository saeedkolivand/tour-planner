import { request } from '../../shared/http.ts';
import type { LatLon, Plan, PlanRequest, Stop, Tour } from './types.ts';

export interface ExtractResult { stops: Stop[]; photos: { photo: number; found: number; by?: string; error?: string }[] }
export type ScanInput = { images: string[] } | { texts: string[] };

/** The server's HTTP API. The only module that knows URLs and wire formats. */
export interface TourApi {
  getTour(): Promise<Partial<Tour>>;
  saveTour(tour: Tour): Promise<void>;
  extract(input: ScanInput, known: Stop[]): Promise<ExtractResult>;
  optimize(req: PlanRequest): Promise<Plan & { stops: Stop[] }>;
  pin(key: string, at: LatLon): Promise<void>;
}

export function createTourApi(baseUrl: () => string, fetchFn: typeof fetch = fetch): TourApi {
  const call = <T,>(method: string, path: string, body?: unknown, timeoutMs?: number) => request<T>(baseUrl(), method, path, body, fetchFn, timeoutMs);
  return {
    getTour: () => call('GET', '/tour'),
    saveTour: tour => call('PUT', '/tour', tour),
    // photos go through a vision model on the PC: minutes for a batch; a plan geocodes new addresses first
    extract: (input, known) => call('POST', '/extract', { ...input, stops: known }, 300_000),
    optimize: req => call('POST', '/optimize', req, 120_000),
    pin: (key, at) => call('POST', '/pin', { key, ...at }),
  };
}
