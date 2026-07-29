// Puerto verbatim del wrapper de IndexedDB de la app original (index.html).
// Mismo nombre de base y mismos object stores: los datos de un usuario que
// ya usaba la versión vainilla siguen siendo válidos acá.
export const DB = { name: 'fierro', ver: 1, db: null };
export const STORES = ['routine', 'sessions', 'meals', 'foods', 'body', 'settings'];

export function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB.name, DB.ver);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('routine')) db.createObjectStore('routine', { keyPath: 'weekday' });
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meals')) db.createObjectStore('meals', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('foods')) db.createObjectStore('foods', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('body')) db.createObjectStore('body', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
    };
    r.onsuccess = () => { DB.db = r.result; res(); };
    r.onerror = () => rej(r.error);
  });
}

export const idb = {
  all: st => new Promise((res, rej) => { const q = DB.db.transaction(st).objectStore(st).getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }),
  put: (st, v) => new Promise((res, rej) => { const t = DB.db.transaction(st, 'readwrite'); t.objectStore(st).put(v); t.oncomplete = res; t.onerror = () => rej(t.error); }),
  del: (st, k) => new Promise((res, rej) => { const t = DB.db.transaction(st, 'readwrite'); t.objectStore(st).delete(k); t.oncomplete = res; t.onerror = () => rej(t.error); }),
  clear: st => new Promise((res, rej) => { const t = DB.db.transaction(st, 'readwrite'); t.objectStore(st).clear(); t.oncomplete = res; t.onerror = () => rej(t.error); }),
};

// idbOpen() usa indexedDB.open, que es seguro de llamar más de una vez (cada
// llamada abre su propia conexión); StrictMode de React invoca los efectos
// dos veces en desarrollo, así que evitamos abrir dos conexiones a la vez.
let openPromise = null;
export function idbOpenOnce() {
  if (!openPromise) openPromise = idbOpen();
  return openPromise;
}
