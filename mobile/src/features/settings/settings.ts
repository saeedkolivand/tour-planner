import { storage } from '@/shared/storage';
import { getLocales } from 'expo-localization';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { setLanguage, type Lang } from '@/shared/i18n';
import type { NavApp } from '@/services/navigation';
import type { StopOrder } from '@/features/tour/types';

export type RouteStyle = 'walk' | 'drive';
/** Metres the driver walks from one parking spot, per route style. */
export const WALK_M: Record<RouteStyle, number> = { walk: 80, drive: 25 };

export interface Settings {
  /** The PC over Tailscale (HTTPS via `tailscale serve`). */
  server: string;
  depot: string;
  endAtDepot: boolean;
  /** Which app "Navigate" opens; it's what shows on CarPlay. */
  navApp: NavApp;
  /** After "Delivered", open navigation to the next stop right away (hands-free on CarPlay). */
  autoNavigate: boolean;
  /** Scan tab: a label that isn't in the tour is added to it right away (building the tour while loading). */
  autoAddScans: boolean;
  /** The in-app camera takes a frame every second by itself while the scanner list is scrolled. */
  liveScan: boolean;
  /** Read scanner photos on the PC (its vision model) even when this phone can read text itself. */
  serverOcr: boolean;
  /**
   * Planning without the PC: 'auto' uses the PC when it answers and the phone otherwise; 'phone' never asks the PC.
   */
  planner: 'auto' | 'phone';
  /** Free OpenRouteService key: road times when OSRM is down, and its VROOM's order as a second opinion (vroom.ts). */
  orsKey: string;
  /** Geoapify key: the third geocoder, for a stop neither the phone's nor OpenStreetMap's could place. */
  geoapifyKey: string;
  /** A notification (and spoken warning while the app is open) 30 and 10 min before each open Express deadline. */
  expressAlerts: boolean;
  /** Arriving at a parking stop shows its names, PRIO and slot (needs location "Always"). */
  arrivalAlerts: boolean;
  /** Express stops reached by their deadline (the rest stays fastest). Off = fastest tour, Express shown only. */
  expressOnTime: boolean;
  /** Minutes before an Express deadline the plan aims to arrive (traffic, parking, finding the door). */
  expressMarginMin: number;
  /** Every parking stop with an Express parcel before all the others. */
  expressFirst: boolean;
  /**
   * "08:30": when you usually leave the depot; ETAs and Express deadlines count from it when planning earlier.
   * Empty: they count from the first Navigate or Delivered.
   */
  leaveAt: string;
  /** 'walk': stops within 80 m share a parking spot (park & walk). 'drive': drive up to nearly every door, only next-door stops share. */
  routeStyle: RouteStyle;
  /** 'fastest': the planner's order. 'scanned': the scanner list's order as captured, nothing re-ordered. */
  stopOrder: StopOrder;
  /** Both sides of a street in one pass (stop on the van's side, cross on foot); off = always the door's kerb side. */
  bothSides: boolean;
  /** UI language; 'system' follows the phone's language (German if set, else English). */
  language: 'system' | 'en' | 'de';
  /** Also record the why of each step (every address lookup, each plan's order) for Settings > Export log. */
  detailedLog: boolean;
  /**
   * Keep each day's tour on the phone (stops, plan, delivery times, where each Delivered was tapped) to plan better
   * later. Off: no history is written and no position is read at Delivered.
   */
  keepHistory: boolean;
}

const KEY = 'settings';
const DEFAULTS: Settings = { server: '', depot: '', endAtDepot: false, navApp: Platform.OS === 'android' ? 'google' : 'apple', autoNavigate: true, autoAddScans: false, liveScan: true, serverOcr: false, planner: 'auto', orsKey: '', geoapifyKey: '', expressAlerts: true, arrivalAlerts: true, expressOnTime: true, expressMarginMin: 0, expressFirst: false, leaveAt: '', language: 'system', routeStyle: 'walk', stopOrder: 'fastest', bothSides: true, detailedLog: false, keepHistory: true };

const deviceLang = (): Lang => (getLocales()[0]?.languageCode === 'de' ? 'de' : 'en');
const applyLang = (s: Settings) => setLanguage(s.language === 'system' ? deviceLang() : s.language);

/** What was saved, made fit for this phone; {} when nothing (or nothing readable) was. */
function stored(raw: string | null): Partial<Settings> {
  try {
    const s = raw ? JSON.parse(raw) : {};
    if (s.navApp === 'apple' && Platform.OS === 'android') s.navApp = 'google'; // Apple Maps doesn't exist on Android
    return s;
  } catch { return {}; }
}

// read synchronously: the first screen already draws with the saved settings (loadSettings still runs, for the update
// from AsyncStorage)
let current: Settings = { ...DEFAULTS, ...stored(storage.getItemSync(KEY)) };
applyLang(current);
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const getSettings = () => current;

/** True when there's no PC to plan on: no server configured, or 'Phone only' chosen. */
export const noPc = (s: Settings = current) => !s.server.trim() || s.planner === 'phone';

// Settings can't import the logger (the logger reads the server URL from here), so it registers itself.
let onChange: ((patch: Partial<Settings>) => void) | undefined;
export const onSettingsChange = (fn: typeof onChange) => { onChange = fn; };

let saveTimer: ReturnType<typeof setTimeout> | undefined;

export function setSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  if ('language' in patch) applyLang(current);
  onChange?.(patch);
  listeners.forEach(l => l());
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => storage.setItem(KEY, JSON.stringify(current)).catch(() => {}), 300);
}

export async function loadSettings() {
  const s = stored(await storage.getItem(KEY).catch(() => null));
  if (Object.keys(s).length) setSettings(s);
}

export const useSettings = () => useSyncExternalStore(subscribe, getSettings);
