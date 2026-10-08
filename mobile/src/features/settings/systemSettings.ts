// Only iOS has a page for apps in its Settings app (systemSettings.ios.ts); elsewhere there's nothing to mirror.
import type { Settings } from './settings';

export const fromSystem = (_current: Settings): Partial<Settings> => ({});
export const toSystem = (_values: Partial<Settings>) => {};
export const watchSystem = (_current: () => Settings, _apply: (patch: Partial<Settings>) => void) => {};
