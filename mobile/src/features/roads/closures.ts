// Street closures reported from the app. The server applies each change to the router in seconds,
// alongside the City of Cologne's roadworks (server/roads/*).
import { useCallback, useEffect, useState } from 'react';
import { getSettings } from '@/features/settings/settings';
import type { LatLon } from '@/features/tour/types';
import { request } from '@/shared/http';
import { log } from '@/shared/log';

/** `heading` set = a one-way report: no entry in that compass direction. */
export interface Closure { id: string; lat: number; lon: number; heading?: number; note: string; at: number }
export interface RoadsStatus { appliedAt: string | null; closures: number; roadworks: number; calendar?: number; segments: number; error: string | null }

const L = log('closures');
// a report waits for the router to re-weight (~5-25 s)
const api = <T,>(method: string, path: string, body?: unknown) => request<T>(getSettings().server, method, path, body, fetch, 60_000);

export async function reportClosure(at: LatLon, note: string, heading?: number) {
  L.info('reporting', { at, heading, hasNote: !!note });
  return api<{ added: Closure }>('POST', '/closures', { ...at, heading, note });
}

/** The current closures and the router's road-data status, with actions that keep the list fresh. */
export function useClosures() {
  const [closures, setClosures] = useState<Closure[]>([]);
  const [roads, setRoads] = useState<RoadsStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => api<{ closures: Closure[]; roads: RoadsStatus }>('GET', '/closures');
  // whatever answered (a captive portal, a proxy page): the screen must never crash on the shape of it
  const apply = useCallback((r: { closures: Closure[]; roads: RoadsStatus }) => { setClosures(Array.isArray(r?.closures) ? r.closures : []); setRoads(r?.roads ?? null); setError(null); }, []);
  const fail = useCallback((e: unknown) => setError((e as Error).message), []);
  const reload = useCallback(() => load().then(apply, fail), [apply, fail]);

  const remove = useCallback(async (id: string) => {
    L.info('removing', { id });
    try { setClosures((await api<{ closures: Closure[] }>('POST', '/closures/remove', { id })).closures ?? []); }
    catch (e) { setError((e as Error).message); L.error('remove failed', { id, error: e }); }
  }, []);

  useEffect(() => {
    let live = true; // the screen may unmount before the server answers
    load().then(r => { if (live) apply(r); }, e => { if (live) fail(e); });
    return () => { live = false; };
  }, [apply, fail]);
  return { closures, roads, error, reload, remove };
}
