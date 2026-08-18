// native/src/lib/db.js
// Puerto de web/src/lib/db.js — misma interfaz (idb.all/put/del/clear,
// idbOpenOnce, STORES) pero sobre AsyncStorage en vez de IndexedDB: RN no
// tiene IndexedDB. AsyncStorage no tiene "object stores" con keyPath propio
// como IndexedDB, así que cada store se guarda entero como un array JSON
// bajo una sola clave (`fierro:<store>`), y put/del hacen el find-and-replace
// a mano usando la keyPath correspondiente (PK).
import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORES = ['routine', 'sessions', 'meals', 'foods', 'body', 'settings'];

// keyPath de cada store — igual que los keyPath que usaba IndexedDB en
// web/src/lib/db.js (routine: 'order', el resto: 'id', settings: 'key').
const PK = { routine: 'order', sessions: 'id', meals: 'id', foods: 'id', body: 'id', settings: 'key' };

const storageKey = (store) => `fierro:${store}`;

async function readStore(store) {
  const raw = await AsyncStorage.getItem(storageKey(store));
  return raw ? JSON.parse(raw) : [];
}
async function writeStore(store, rows) {
  await AsyncStorage.setItem(storageKey(store), JSON.stringify(rows));
}

export const idb = {
  all: (store) => readStore(store),
  put: async (store, value) => {
    const rows = await readStore(store);
    const pk = PK[store];
    const i = rows.findIndex(r => r[pk] === value[pk]);
    if (i >= 0) rows[i] = value; else rows.push(value);
    await writeStore(store, rows);
  },
  del: async (store, key) => {
    const rows = await readStore(store);
    const pk = PK[store];
    await writeStore(store, rows.filter(r => r[pk] !== key));
  },
  clear: (store) => writeStore(store, []),
};

// AsyncStorage no tiene noción de "abrir conexión" como IndexedDB — queda
// como no-op async para que state.js (portado verbatim en Task 3) pueda
// seguir haciendo `await idbOpenOnce()` sin cambios.
export async function idbOpenOnce() {}
