// idb.tx: una sola transacción sobre varios stores (turnos universales,
// Fase 1). Es la pieza que hace atómicos persistTurno, persistAll y la
// reconciliación: o se escribe todo, o no se escribe nada.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { idbOpen, DB, idb } from '../db.js';

async function baseNueva() {
  DB.db?.close(); DB.db = null; DB.ver = 3; DB.name = 'fierro-tx-test';
  await new Promise(res => { const r = indexedDB.deleteDatabase(DB.name); r.onsuccess = r.onerror = r.onblocked = () => res(); });
  await idbOpen();
  await idb.clear('routine');
}

describe('idb.tx', () => {
  beforeEach(baseNueva);
  afterEach(() => vi.restoreAllMocks());

  it('escribe en dos stores en la misma transacción', async () => {
    await idb.tx(['routine', 'settings'], ({ routine, settings }) => {
      routine.put({ id: 'a', order: 0, type: 'rest' });
      settings.put({ key: 'turnos', value: [{ id: 't1' }] });
    });
    expect(await idb.all('routine')).toEqual([{ id: 'a', order: 0, type: 'rest' }]);
    expect((await idb.get('settings', 'turnos')).value).toEqual([{ id: 't1' }]);
  });

  it('si la función tira, no queda nada escrito y rechaza', async () => {
    await idb.put('routine', { id: 'viejo', order: 0, type: 'rest' });
    await expect(idb.tx(['routine', 'settings'], ({ routine, settings }) => {
      routine.clear();
      settings.put({ key: 'turnos', value: [] });
      throw new Error('a mitad');
    })).rejects.toThrow('a mitad');
    expect(await idb.all('routine')).toEqual([{ id: 'viejo', order: 0, type: 'rest' }]);
    expect(await idb.get('settings', 'turnos')).toBeUndefined();
  });

  it('un put que falla por espacio (QuotaExceededError) aborta todo', async () => {
    await idb.put('routine', { id: 'viejo', order: 0, type: 'rest' });
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (v, k) {
      if (v?.key === 'turnos') throw new DOMException('sin lugar', 'QuotaExceededError');
      return put.call(this, v, k);
    });
    await expect(idb.tx(['routine', 'settings'], ({ routine, settings }) => {
      routine.clear();
      routine.put({ id: 'nuevo', order: 0, type: 'rest' });
      settings.put({ key: 'turnos', value: [] });
    })).rejects.toThrow();
    vi.restoreAllMocks();
    expect(await idb.all('routine')).toEqual([{ id: 'viejo', order: 0, type: 'rest' }]);
  });
});
