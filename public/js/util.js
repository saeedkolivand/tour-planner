export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const TYPE_KEYS = ['private', 'business', 'pickup', 'shop']; // labels: locales types.*

/** Per-device preferences (depot, toggles). Read with one arg, write with two. */
export const pref = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch { return null; } };
