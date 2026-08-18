import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { idbOpen, DB, idb } from './db.js';

describe('migración de rutina a secuencia (DB.ver 1 -> 2)', () => {
  beforeEach(() => { DB.db?.close(); DB.db = null; DB.ver = 1; indexedDB.deleteDatabase(DB.name); });

  it('convierte un routine viejo por weekday a una secuencia ordenada con descansos en los huecos', async () => {
    // Simula un usuario en ver 1: weekday 1 (lunes) y 3 (miércoles) con ejercicios.
    await idbOpen();
    await idb.put('routine', { weekday: 1, name: 'Anterior A', exercises: [{ id: 'e1', name: 'Press banca', sets: 4, reps: 8 }] });
    await idb.put('routine', { weekday: 3, name: 'Posterior', exercises: [{ id: 'e2', name: 'Remo', sets: 4, reps: 10 }] });
    DB.db.close(); DB.db = null;

    DB.ver = 2;
    await idbOpen();
    const rows = (await idb.all('routine')).sort((a, b) => a.order - b.order);

    // Orden WEEK_ORDER = [1,2,3,4,5,6,0]: lunes(1)=workout, martes(2)=rest,
    // miércoles(3)=workout, jueves..domingo=rest.
    expect(rows.map(r => r.type)).toEqual(['workout', 'rest', 'workout', 'rest', 'rest', 'rest', 'rest']);
    expect(rows[0].name).toBe('Anterior A');
    expect(rows[0].exercises).toEqual([{ id: 'e1', name: 'Press banca', sets: 4, reps: 8 }]);
    expect(rows[2].name).toBe('Posterior');
    rows.forEach(r => expect(typeof r.id).toBe('string'));
  });

  it('un routine viejo vacío (usuario sin rutina) migra a 7 descansos sin romper', async () => {
    await idbOpen();
    DB.db.close(); DB.db = null;
    DB.ver = 2;
    await idbOpen();
    const rows = await idb.all('routine');
    expect(rows.length).toBe(7);
    expect(rows.every(r => r.type === 'rest')).toBe(true);
  });
});
