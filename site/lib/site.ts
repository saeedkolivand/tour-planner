import { de } from './de';
import { en, type Text } from './en';

export const LANGS = ['en', 'de'] as const;
export type Lang = (typeof LANGS)[number];
export const text = (lang: string): Text => (lang === 'de' ? de : en);

/** The path the site is served under (GitHub Pages project site); public files need it spelled out. */
export const BASE = process.env.NEXT_PUBLIC_BASE ?? '';
export const REPO = 'https://github.com/saeedkolivand/tour-planner';
export const RELEASE = `${REPO}/releases/latest`;
