// The remembered customers and their access notes (CONTEXT.md): customers.json plus the photos, in the app's documents
// folder (customers/). The Files app shows that folder, so the driver can copy it away as a backup. Phone only: a note
// can hold a door code, so its text and photos are never logged or sent to the PC.
import { Directory, File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { stopKey } from '@/features/planner/stops';
import type { Stop } from '@/features/tour/types';
import { log } from '@/shared/log';
import { type Customer, findCustomer } from './match';

export type { Customer };
const usable = Platform.OS !== 'web';
const l = log('customers');
let all: Record<string, Customer> = {};
let loaded = false;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

function folder() {
  const dir = new Directory(Paths.document, 'customers');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}
const dataFile = () => new File(folder(), 'customers.json');

function load() {
  if (loaded || !usable) return all;
  loaded = true;
  try {
    const f = dataFile();
    if (f.exists) all = JSON.parse(f.textSync());
  } catch (e) {
    // unreadable: set aside, never written over (it can be weeks of notes)
    try { dataFile().moveSync(new File(folder(), `customers.broken-${Date.now()}.json`)); } catch { /* still start empty */ }
    l.error('customers file unreadable, set aside', e as Error);
  }
  return all;
}

function save(next: Record<string, Customer>) {
  all = next;
  listeners.forEach(fn => fn());
  try {
    const f = dataFile();
    if (!f.exists) f.create();
    f.write(JSON.stringify(next));
  } catch (e) { l.error('customers not saved', e as Error); }
}

/** A photo's file. Names are kept, not paths: the app's folder moves with each reinstall on iOS. */
export const photoUri = (name: string) => new File(folder(), name).uri;

/** The customer this stop is a visit to, if one is remembered. */
export function useCustomer(stop: Stop): { id?: string; customer?: Customer } {
  const map = useSyncExternalStore(subscribe, load);
  const id = findCustomer(map, stop);
  return { id, customer: id ? map[id] : undefined };
}

/**
 * Saves how to get in at this stop's customer: a new customer the first time, the remembered one after (its name and
 * address stay as first read). `keep`: photos already saved; `taken`: new ones (the camera's temporary files).
 * Nothing left: the customer is forgotten.
 */
export function saveAccess(stop: Stop, id: string | undefined, note: string, keep: string[], taken: string[]) {
  const dir = folder(), old = id ? all[id] : undefined;
  const added = taken.map((uri, i) => {
    const name = `${Date.now()}-${i}.jpg`;
    new File(uri).copySync(new File(dir, name));
    return name;
  });
  for (const p of old?.photos ?? []) if (!keep.includes(p)) try { new File(dir, p).delete(); } catch { /* gone already */ }
  const base = old ?? { name: stop.name?.split(' · ')[0], street: stop.street, number: stop.number, postcode: stop.postcode, note: '', photos: [] };
  const next = { ...all }, key = id ?? stopKey(stop), photos = [...keep, ...added];
  if (!note.trim() && !photos.length) delete next[key];
  else next[key] = { ...base, note: note.trim(), photos };
  save(next);
  l.info('access note saved', { photos: photos.length, note: !!note.trim() }); // never the text: it can hold a code
}
