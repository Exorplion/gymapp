// native/src/lib/db.test.js
import { idb, idbOpenOnce, STORES } from './db.js';

describe('db.js — capa de almacenamiento (AsyncStorage, interfaz idb)', () => {
  beforeEach(async () => {
    await idbOpenOnce();
    for (const s of STORES) await idb.clear(s);
  });

  it('put + all: guarda y lee filas de un store', async () => {
    await idb.put('sessions', { id: 's1', date: '2026-08-18' });
    const rows = await idb.all('sessions');
    expect(rows).toEqual([{ id: 's1', date: '2026-08-18' }]);
  });

  it('put con la misma key reemplaza en vez de duplicar', async () => {
    await idb.put('settings', { key: 'cfg', value: { a: 1 } });
    await idb.put('settings', { key: 'cfg', value: { a: 2 } });
    const rows = await idb.all('settings');
    expect(rows).toEqual([{ key: 'cfg', value: { a: 2 } }]);
  });

  it('del quita sólo la fila con esa key', async () => {
    await idb.put('meals', { id: 'm1', name: 'Pollo' });
    await idb.put('meals', { id: 'm2', name: 'Arroz' });
    await idb.del('meals', 'm1');
    expect(await idb.all('meals')).toEqual([{ id: 'm2', name: 'Arroz' }]);
  });

  it('clear vacía el store', async () => {
    await idb.put('body', { id: 'b1', date: '2026-08-18', weight: 74 });
    await idb.clear('body');
    expect(await idb.all('body')).toEqual([]);
  });

  it('routine usa order como key (no id)', async () => {
    await idb.put('routine', { id: 'x', order: 0, type: 'rest' });
    await idb.put('routine', { id: 'y', order: 0, type: 'workout' });
    expect(await idb.all('routine')).toEqual([{ id: 'y', order: 0, type: 'workout' }]);
  });

  it('STORES incluye los 6 stores de la PWA', () => {
    expect([...STORES].sort()).toEqual(['body', 'foods', 'meals', 'routine', 'sessions', 'settings']);
  });
});
