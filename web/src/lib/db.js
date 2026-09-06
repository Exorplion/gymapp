// Puerto verbatim del wrapper de IndexedDB de la app original (index.html).
// Mismo nombre de base y mismos object stores: los datos de un usuario que
// ya usaba la versión vainilla siguen siendo válidos acá.
export const DB = { name: 'fierro', ver: 3, db: null };
export const STORES = ['routine', 'sessions', 'meals', 'foods', 'body', 'settings', 'gymPhotos'];

// ver 1 -> 2: la rutina pasa de objeto indexado por weekday a una secuencia
// ordenada (ver plan rutina-por-secuencia). WEEK_ORDER fija el orden en que
// se recorrían los weekday viejos (lunes primero) para que la migración
// conserve el orden que el usuario ya veía.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB.name, DB.ver);
    r.onupgradeneeded = (ev) => {
      const db = r.result;
      const tx = ev.target.transaction;
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meals')) db.createObjectStore('meals', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('foods')) db.createObjectStore('foods', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('body')) db.createObjectStore('body', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      // ver 2 -> 3: foto de máquina/equipo por gym+ejercicio (gyms.js). Blob
      // nativo, no base64 en 'settings' — evita inflar ese blob cada vez que
      // se lee/escribe cualquier cosa de config.
      if (!db.objectStoreNames.contains('gymPhotos')) db.createObjectStore('gymPhotos', { keyPath: 'id' });

      // ev.newVersion es la versión a la que se está abriendo esta conexión
      // (no necesariamente DB.ver=2 fijo: el test de migración fuerza
      // DB.ver=1 para simular una apertura vieja antes de subir a 2). Sólo
      // se migra/crea el store nuevo cuando el open apunta a ver >= 2; un
      // open a ver 1 crea el store viejo (keyPath weekday) tal cual la app
      // original, para que la migración 1->2 tenga algo real que leer.
      if (ev.newVersion >= 2) {
        if (ev.oldVersion < 2) {
          // Migración routine: weekday -> secuencia ordenada.
          const migrate = (oldRows) => {
            if (db.objectStoreNames.contains('routine')) db.deleteObjectStore('routine');
            const store = db.createObjectStore('routine', { keyPath: 'order' });
            const byWd = new Map(oldRows.map(r => [r.weekday, r]));
            WEEK_ORDER.forEach((wd, i) => {
              const old = byWd.get(wd);
              const hasWorkout = old?.exercises?.length;
              store.put(hasWorkout
                ? { id: uid(), order: i, type: 'workout', name: old.name || '', exercises: old.exercises }
                : { id: uid(), order: i, type: 'rest' });
            });
          };
          if (db.objectStoreNames.contains('routine')) {
            const req = tx.objectStore('routine').getAll();
            req.onsuccess = () => migrate(req.result || []);
          } else {
            migrate([]);
          }
        } else if (!db.objectStoreNames.contains('routine')) {
          db.createObjectStore('routine', { keyPath: 'order' });
        }
      } else if (!db.objectStoreNames.contains('routine')) {
        db.createObjectStore('routine', { keyPath: 'weekday' });
      }
    };
    r.onsuccess = () => {
      DB.db = r.result;
      /* Si OTRA pestaña abre la base con una versión más nueva, esta conexión
         la bloquearía. Cerrarla acá deja que la otra siga adelante en vez de
         que las dos queden trabadas esperándose. */
      DB.db.onversionchange = () => DB.db.close();
      res();
    };
    r.onerror = () => rej(r.error);
    /* El tercer final posible de indexedDB.open(), y el que faltaba: cuando
       otra pestaña tiene abierta una conexión con una versión ANTERIOR, el
       navegador dispara `blocked` y NO dispara ni success ni error. Sin este
       handler la promesa quedaba pendiente para siempre — y como loadAll()
       nunca volvía, S.ready se quedaba en false y la app mostraba una
       pantalla vacía permanente, sin ningún error en consola que lo
       explicara. Rechazar convierte un cuelgue mudo en un mensaje. */
    r.onblocked = () => rej(new Error('Hay otra pestaña de FIERRO abierta con una versión anterior. Cerrala y volvé a entrar.'));
  });
}

export const idb = {
  all: st => new Promise((res, rej) => { const q = DB.db.transaction(st).objectStore(st).getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }),
  get: (st, k) => new Promise((res, rej) => { const q = DB.db.transaction(st).objectStore(st).get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }),
  /* Las tres escrituras llevan `onabort` además de `onerror`, y no es
     redundante: una transacción ABORTADA —el caso típico es quedarse sin
     espacio (QuotaExceededError)— dispara `abort`, no siempre `error`. Sin
     este handler la promesa quedaba pendiente para siempre.
     La consecuencia era concreta y silenciosa: en saveSet() (session.js) el
     `await saveDraft()` nunca volvía, así que no corría el bump(), ni el
     toast, ni el arranque del descanso. La serie quedaba en memoria pero no
     en disco, la pantalla no se actualizaba, y al recargar no existía —
     todo sin un solo mensaje. */
  put: (st, v) => new Promise((res, rej) => { const t = DB.db.transaction(st, 'readwrite'); t.objectStore(st).put(v); t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('transacción abortada')); }),
  del: (st, k) => new Promise((res, rej) => { const t = DB.db.transaction(st, 'readwrite'); t.objectStore(st).delete(k); t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('transacción abortada')); }),
  clear: st => new Promise((res, rej) => { const t = DB.db.transaction(st, 'readwrite'); t.objectStore(st).clear(); t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('transacción abortada')); }),
};

// idbOpen() usa indexedDB.open, que es seguro de llamar más de una vez (cada
// llamada abre su propia conexión); StrictMode de React invoca los efectos
// dos veces en desarrollo, así que evitamos abrir dos conexiones a la vez.
let openPromise = null;
export function idbOpenOnce() {
  if (!openPromise) openPromise = idbOpen();
  return openPromise;
}
