// Modo prueba (pedido de Enzo, 2026-09-25): una copia de sus datos donde
// simular un entrenamiento —abrir la sesión, ver las tarjetas, descartar—
// sin tocar la base donde vive su progreso real.
//
// Por qué una segunda base y no otra dirección publicada: IndexedDB es por
// origen, y cualquier copia de la app en exorplion.github.io vería la MISMA
// base `fierro`. Lo que separa los datos es el nombre de la base, así que el
// modo prueba es eso: abrir `fierro-prueba` en vez de `fierro`.
//
// La marca vive en localStorage (no en la base: hay que leerla ANTES de
// saber cuál abrir). Es el único uso de localStorage de la app.
import { DB, STORES, idbOpen } from './db.js';

export const CLAVE = 'fierro-modo-prueba';
export const BASE_REAL = 'fierro';
export const BASE_PRUEBA = 'fierro-prueba';

export function enModoPrueba() {
  try { return localStorage.getItem(CLAVE) === '1'; } catch { return false; }
}

/** Fija qué base abre idbOpen(). Se llama una vez, antes de abrirla. */
export function elegirBase() {
  DB.name = enModoPrueba() ? BASE_PRUEBA : BASE_REAL;
}

export function borrarBase(nombre) {
  return new Promise((res, rej) => {
    const r = indexedDB.deleteDatabase(nombre);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
    // Otra pestaña la tiene abierta: el borrado queda en cola y se completa
    // cuando la suelte. No hay que esperarlo para seguir.
    r.onblocked = () => res();
  });
}

function leerStore(db, st) {
  return new Promise((res, rej) => {
    const q = db.transaction(st).objectStore(st).getAll();
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}

/** Copia la base real ENTERA a una base de prueba nueva. Necesita la
    conexión real abierta, y la deja abierta y activa al terminar. */
export async function copiarAPrueba() {
  const real = DB.db;
  if (!real || DB.name !== BASE_REAL) throw new Error('El modo prueba se arma desde la base real');

  const datos = {};
  for (const st of STORES) {
    if (real.objectStoreNames.contains(st)) datos[st] = await leerStore(real, st);
  }

  await borrarBase(BASE_PRUEBA);
  DB.name = BASE_PRUEBA;
  try {
    // idbOpen() crea el esquema al día (y, en una base nueva, una rutina de
    // 7 descansos de relleno): se vacía todo antes de volcar la copia.
    await idbOpen();
    const prueba = DB.db;
    await new Promise((res, rej) => {
      const t = prueba.transaction(STORES, 'readwrite');
      for (const st of STORES) {
        const store = t.objectStore(st);
        store.clear();
        for (const fila of datos[st] || []) store.put(fila);
      }
      t.oncomplete = res;
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error('No se pudo copiar a la base de prueba'));
    });
    prueba.close();
  } finally {
    DB.name = BASE_REAL;
    DB.db = real;
  }
}

/** Arma la copia, marca el modo y recarga: la app arranca sobre la copia. */
export async function entrarModoPrueba() {
  await copiarAPrueba();
  localStorage.setItem(CLAVE, '1');
  if (!enModoPrueba()) throw new Error('Este navegador no deja guardar la marca del modo prueba');
  location.reload();
}

/** Tira la copia entera y vuelve a la base real. */
export async function salirModoPrueba() {
  try { localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento: igual se recarga */ }
  DB.db?.close();
  DB.db = null;
  await borrarBase(BASE_PRUEBA);
  location.reload();
}
