// The only file allowed to import i18next/react-i18next (enforced by eslint's no-restricted-imports).
// Everything else uses useTranslation()/t()/getLanguage()/setLanguage() from here, so swapping the library
// or its API later touches one file.
import { createInstance, type ParseKeys, type TFunction } from 'i18next';
import { initReactI18next, useTranslation as useI18next } from 'react-i18next';
import en from './locales/en.json';
import de from './locales/de.json';

export type Lang = 'en' | 'de';
export type Translate = TFunction;
/** A translation key, for state that carries one (e.g. the store's `busy`) to be translated where it is shown. */
export type Key = ParseKeys;

const i18n = createInstance({
  resources: { en: { translation: en }, de: { translation: de } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});
void i18n.use(initReactI18next).init();

/** For components: re-renders when the language changes. */
export function useTranslation(): { t: Translate; lang: Lang } {
  const { t, i18n: inst } = useI18next();
  return { t, lang: inst.language as Lang };
}

/** For non-component code (hooks, stores, services). */
export const t: Translate = i18n.t.bind(i18n) as Translate;

export const getLanguage = () => i18n.language as Lang;
export const setLanguage = (lang: Lang) => void i18n.changeLanguage(lang);
