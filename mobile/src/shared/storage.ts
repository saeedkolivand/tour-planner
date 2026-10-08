// The phone's key-value store: SQLite (expo-sqlite/kv-store), with synchronous reads, so settings are there before the
// first screen draws. It used to be AsyncStorage: a key not in SQLite yet is read from there once and copied over,
// so an update keeps today's tour, settings and address cache. The old copy is left alone (an older app still finds it).
import Old from '@react-native-async-storage/async-storage';
import Kv from 'expo-sqlite/kv-store';

export const storage = {
  async getItem(key: string) {
    const v = await Kv.getItem(key);
    if (v != null) return v;
    const old = await Old.getItem(key).catch(() => null);
    if (old != null) await Kv.setItem(key, old);
    return old;
  },
  /** Only what is already in SQLite: null on the first start after the update (getItem then copies it over). */
  getItemSync: (key: string) => { try { return Kv.getItemSync(key); } catch { return null; } },
  setItem: (key: string, value: string) => Kv.setItem(key, value),
  removeItem: (key: string) => Promise.all([Kv.removeItem(key), Old.removeItem(key)]).then(() => {}),
};
