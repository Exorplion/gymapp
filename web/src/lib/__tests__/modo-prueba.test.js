import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { DB, idb, idbOpen, STORES } from '../db.js';
import {
  BASE_REAL, BASE_PRUEBA, CLAVE, enModoPrueba, elegirBase, copiarAPrueba, borrarBase,
} from '../modoPrueba.js';

/* El modo prueba existe para que Enzo pueda simular un entrenamiento sin
   tocar su progreso real. Lo único que importa de verdad: la base real nunca
   se escribe mientras se prueba, y salir no deja rastro. */

// Los tests corren en node, sin localStorage de navegador.
const memoria = new Map();
globalThis.localStorage = {
  getItem: k => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => { memoria.set(k, String(v)); },
  removeItem: k => { memoria.delete(k); },
  clear: () => { memoria.clear(); },
};

async function abrir(nombre) {
  DB.db?.close(); DB.db = null; DB.name = nombre;
  await idbOpen();
}

describe('modo prueba', () => {
  beforeEach(async () => {
    localStorage.clear();
    DB.db?.close(); DB.db = null; DB.ver = 3;
    await borrarBase(BASE_REAL);
    await borrarBase(BASE_PRUEBA);
    DB.name = BASE_REAL;
  });

  it('sin la marca abre la base real; con la marca, la de prueba', () => {
    elegirBase();
    expect(DB.name).toBe(BASE_REAL);
    expect(enModoPrueba()).toBe(false);
    localStorage.setItem(CLAVE, '1');
    elegirBase();
    expect(DB.name).toBe(BASE_PRUEBA);
    expect(enModoPrueba()).toBe(true);
  });

  it('copia todos los datos reales a la base de prueba, sin el relleno de rutina vacía', async () => {
    await abrir(BASE_REAL);
    await idb.put('sessions', { id: 's1', date: '2026-09-20', exercises: [{ name: 'Press banca', sets: [{ w: 60, r: 10 }] }] });
    await idb.put('settings', { key: 'cfg', unit: 'kg' });
    await idb.put('gymPhotos', { id: 'g1|Press', blob: new Blob(['x']), ts: 1 });
    const rutinaReal = await idb.all('routine');

    await copiarAPrueba();
    // La conexión sigue siendo la real después de copiar.
    expect(DB.name).toBe(BASE_REAL);

    await abrir(BASE_PRUEBA);
    expect(await idb.all('sessions')).toHaveLength(1);
    expect((await idb.get('settings', 'cfg')).unit).toBe('kg');
    expect(await idb.all('gymPhotos')).toHaveLength(1);
    expect(await idb.all('routine')).toEqual(rutinaReal);
    for (const st of STORES) expect(DB.db.objectStoreNames.contains(st)).toBe(true);
  });

  it('lo que se hace en prueba no llega a la base real', async () => {
    await abrir(BASE_REAL);
    await idb.put('sessions', { id: 's1', date: '2026-09-20' });
    await copiarAPrueba();

    await abrir(BASE_PRUEBA);
    await idb.put('sessions', { id: 's2', date: '2026-09-25' });
    await idb.del('sessions', 's1');

    await abrir(BASE_REAL);
    expect((await idb.all('sessions')).map(s => s.id)).toEqual(['s1']);
  });

  it('volver a entrar arranca de una copia fresca, no de la prueba anterior', async () => {
    await abrir(BASE_REAL);
    await copiarAPrueba();
    await abrir(BASE_PRUEBA);
    await idb.put('sessions', { id: 'basura', date: '2026-09-25' });

    await abrir(BASE_REAL);
    await copiarAPrueba();
    await abrir(BASE_PRUEBA);
    expect(await idb.all('sessions')).toEqual([]);
  });

  it('no copia si la conexión abierta no es la real', async () => {
    await abrir(BASE_PRUEBA);
    await expect(copiarAPrueba()).rejects.toThrow();
  });
});
