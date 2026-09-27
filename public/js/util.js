export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const TYPES = { private: 'Private', business: 'Business', pickup: 'Pickup', shop: 'Paketshop' };

/** Per-device preferences (depot, toggles). Read with one arg, write with two. */
export const pref = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch { return null; } };
