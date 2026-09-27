import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import type { NavApp } from '@/services/navigation';

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
  /**
   * Planning without the PC: 'auto' uses the PC when it answers and the phone otherwise; 'phone' never asks the PC.
   */
  planner: 'auto' | 'phone';
  /** Free OpenRouteService key: real road times for plans made on the phone (else distances are estimated). */
  orsKey: string;
  /** Express stops reached by their deadline (the rest stays fastest). Off = fastest tour, Express shown only. */
  expressOnTime: boolean;
  /** "08:30": when you usually leave the depot; ETAs and Express deadlines count from it when planning earlier. */
  leaveAt: string;
}

const KEY = 'settings';
const DEFAULTS: Settings = { server: '', depot: '', endAtDepot: false, navApp: Platform.OS === 'android' ? 'google' : 'apple', autoNavigate: true, autoAddScans: false, planner: 'auto', orsKey: '', expressOnTime: true, leaveAt: '' };

let current = DEFAULTS;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const getSettings = () => current;

/** True when there's no PC to plan on: no server configured, or 'Phone only' chosen. */
export const noPc = (s: Settings = current) => !s.server.trim() || s.planner === 'phone';

// Settings can't import the logger (the logger reads the server URL from here), so it registers itself.
let onChange: ((patch: Partial<Settings>) => void) | undefined;
export const onSettingsChange = (fn: typeof onChange) => { onChange = fn; };

export function setSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  onChange?.(patch);
  listeners.forEach(l => l());
  AsyncStorage.setItem(KEY, JSON.stringify(current)).catch(() => {});
}

export async function loadSettings() {
  const raw = await AsyncStorage.getItem(KEY).catch(() => null);
  if (raw) setSettings(JSON.parse(raw));
}

export const useSettings = () => useSyncExternalStore(subscribe, getSettings);
