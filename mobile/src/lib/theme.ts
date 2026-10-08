// Raw colors for places that can't take a className (navigation theme, map pins, icon props).
// Keep in sync with the HSL tokens in global.css.
import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';

export const THEME = {
  light: {
    background: 'hsl(40 14% 97%)', foreground: 'hsl(240 10% 6%)', card: 'hsl(0 0% 100%)',
    primary: 'hsl(346 100% 43%)', muted: 'hsl(240 5% 94%)', mutedForeground: 'hsl(240 4% 44%)',
    border: 'hsl(240 6% 90%)', destructive: 'hsl(0 72% 51%)', success: 'hsl(152 65% 30%)', express: 'hsl(38 92% 50%)',
  },
  dark: {
    background: 'hsl(240 8% 4%)', foreground: 'hsl(0 0% 97%)', card: 'hsl(240 6% 8%)',
    primary: 'hsl(348 90% 56%)', muted: 'hsl(240 5% 13%)', mutedForeground: 'hsl(240 5% 64%)',
    border: 'hsl(240 5% 16%)', destructive: 'hsl(0 70% 58%)', success: 'hsl(152 55% 45%)', express: 'hsl(38 92% 55%)',
  },
} as const;

export type Scheme = keyof typeof THEME;

export const NAV_THEME: Record<Scheme, Theme> = {
  light: {
    ...DefaultTheme,
    colors: { background: THEME.light.background, border: THEME.light.border, card: THEME.light.card, notification: THEME.light.destructive, primary: THEME.light.primary, text: THEME.light.foreground },
  },
  dark: {
    ...DarkTheme,
    colors: { background: THEME.dark.background, border: THEME.dark.border, card: THEME.dark.card, notification: THEME.dark.destructive, primary: THEME.dark.primary, text: THEME.dark.foreground },
  },
};
