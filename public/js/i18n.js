// The only module that touches window.i18next (vendored UMD build, loaded by index.html). Everything else
// uses t(), setLang() and onLanguageChange() from here, so swapping the library later touches one file.
import { pref } from './util.js';

const LANGS = ['en', 'de'];
const listeners = new Set();
const i18n = () => window.i18next;

const pick = () => { const saved = pref('lang'); return LANGS.includes(saved) ? saved : navigator.language?.startsWith('de') ? 'de' : 'en'; };

export const t = (key, opts) => i18n().t(key, opts);
export const lang = () => i18n().language;
/** Runs after every language switch, once the static texts are re-applied: re-render your dynamic parts. */
export const onLanguageChange = fn => listeners.add(fn);

export async function initI18n() {
  const resources = Object.fromEntries(await Promise.all(LANGS.map(async l => [l, { translation: await (await fetch(`locales/${l}.json`)).json() }])));
  await i18n().init({ lng: pick(), fallbackLng: 'en', resources, interpolation: { escapeValue: false } });
  apply();
}

export async function setLang(l) {
  pref('lang', l);
  await i18n().changeLanguage(l);
  apply();
  listeners.forEach(fn => fn());
}

/** Static texts: data-i18n="key" (textContent) and data-i18n-placeholder / -title / -aria-label attributes. */
function apply() {
  document.documentElement.lang = lang();
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const attr of ['placeholder', 'title', 'aria-label'])
    for (const el of document.querySelectorAll(`[data-i18n-${attr}]`)) el.setAttribute(attr, t(el.getAttribute(`data-i18n-${attr}`)));
  for (const b of document.querySelectorAll('[data-lang]')) b.classList.toggle('on', b.dataset.lang === lang());
}
