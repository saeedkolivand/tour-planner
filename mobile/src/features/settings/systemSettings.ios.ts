// The settings also on the app's page in the iOS Settings app (ios-settings/Settings.bundle, Apple: the ones changed
// rarely), kept the same both ways through NSUserDefaults: the app writes every change of them there, and a change made
// in the Settings app comes back while the app runs (watchKeys only reports changes made outside the app, so no loop).
import { Settings as Defaults } from 'react-native';
import type { Settings } from './settings';

const KEYS = ['navApp', 'autoNavigate', 'expressAlerts', 'arrivalAlerts', 'keepHistory', 'detailedLog'] as const;
type Mirrored = Pick<Settings, (typeof KEYS)[number]>;

/** The Settings app's values that differ from the app's (it stores switches as 0/1). */
export function fromSystem(current: Settings): Partial<Mirrored> {
  const out: Partial<Record<string, unknown>> = {};
  for (const k of KEYS) {
    const v = Defaults.get(k);
    if (v == null) continue;
    const value = typeof current[k] === 'boolean' ? !!v : String(v);
    if (value !== current[k]) out[k] = value;
  }
  return out as Partial<Mirrored>;
}

/** Writes the mirrored ones among `values` to the Settings app's page. */
export function toSystem(values: Partial<Settings>) {
  const out = Object.fromEntries(KEYS.filter(k => k in values).map(k => [k, values[k]]));
  if (Object.keys(out).length) Defaults.set(out);
}

/** Calls `apply` with what changed whenever one of them is changed in the Settings app. */
export function watchSystem(current: () => Settings, apply: (patch: Partial<Mirrored>) => void) {
  Defaults.watchKeys([...KEYS], () => {
    const patch = fromSystem(current());
    if (Object.keys(patch).length) apply(patch);
  });
}
