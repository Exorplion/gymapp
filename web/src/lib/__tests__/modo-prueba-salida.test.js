// Que el modo prueba no pueda volver a comerse datos reales (2026-09-29).
// Enzo registró el domingo 27 y el lunes 28 estando en prueba y, al salir, la
// copia se borró entera con esas dos sesiones adentro. Ahora salir dice qué
// hay en la copia que la base real no tiene y ofrece pasarlo.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { DB, idb, idbOpen } from '../db.js';
import {
  BASE_REAL, BASE_PRUEBA, CLAVE, DESDE, borrarBase, copiarAPrueba,
  diferenciasPrueba, textoResumen, resumenPrueba, pasarPruebaAReal,
  pruebaDeOtroDia, seguirEnPrueba, entrarModoPrueba,
} from '../modoPrueba.js';

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

const ses = (id, date, extra = {}) => ({ id, date, slotId: 's1', dayName: 'Posterior A', start: Date.parse(date + 'T12:00:00'), entries: [{ name: 'Remo', sets: [{ w: 40, r: 8 }] }], ...extra });

describe('diferenciasPrueba', () => {
  const real = { sessions: [ses('a', '2026-09-24')], body: [{ id: 'b0', date: '2026-09-24', weight: 80 }], meals: [{ id: 'm0', date: '2026-09-24' }] };

  it('cuenta las sesiones que la real no tiene', () => {
    const d = diferenciasPrueba(real, { ...real, sessions: [ses('dom', '2026-09-27'), ses('lun', '2026-09-28'), ...real.sessions] });
    expect(d.sesiones.map(s => s.id)).toEqual(['dom', 'lun']);
  });

  it('una sesión copiada tal cual no cuenta', () => {
    expect(diferenciasPrueba(real, real).sesiones).toEqual([]);
  });

  it('una sesión corregida en la prueba cuenta como cambio', () => {
    const corregida = ses('a', '2026-09-24', { entries: [{ name: 'Remo', sets: [{ w: 45, r: 8 }] }] });
    expect(diferenciasPrueba(real, { ...real, sessions: [corregida] }).sesiones.map(s => s.id)).toEqual(['a']);
  });

  it('no duplica: el mismo turno el mismo día con otro id no cuenta', () => {
    expect(diferenciasPrueba(real, { ...real, sessions: [ses('otro-id', '2026-09-24')] }).sesiones).toEqual([]);
  });

  it('cuenta los pesos y comidas nuevos, y no los que ya estaban', () => {
    const d = diferenciasPrueba(real, {
      ...real,
      body: [...real.body, { id: 'b1', date: '2026-09-27', weight: 79.5 }, { id: 'dup', date: '2026-09-24', weight: 80 }],
      meals: [...real.meals, { id: 'm1', date: '2026-09-27' }],
    });
    expect(d.pesos.map(b => b.id)).toEqual(['b1']);
    expect(d.comidas.map(m => m.id)).toEqual(['m1']);
  });
});

describe('textoResumen', () => {
  it('dice cuántas sesiones y pesos hay en la copia', () => {
    expect(textoResumen({ sesiones: [1, 2], pesos: [1], comidas: [] })).toBe('Registraste 2 sesiones y 1 peso en la prueba.');
    expect(textoResumen({ sesiones: [1], pesos: [], comidas: [] })).toBe('Registraste 1 sesión en la prueba.');
    expect(textoResumen({ sesiones: [], pesos: [1, 2], comidas: [1] })).toBe('Registraste 2 pesos y 1 comida en la prueba.');
  });
  it('sin nada nuevo lo dice', () => {
    expect(textoResumen({ sesiones: [], pesos: [], comidas: [] })).toBe('No registraste nada nuevo en la prueba.');
  });
});

describe('pasar lo de la prueba a la base real', () => {
  beforeEach(async () => {
    localStorage.clear();
    DB.db?.close(); DB.db = null; DB.ver = 3;
    await borrarBase(BASE_REAL);
    await borrarBase(BASE_PRUEBA);
    DB.name = BASE_REAL;
  });

  it('las sesiones y pesos de la prueba quedan en la real, sin duplicar', async () => {
    await abrir(BASE_REAL);
    await idb.put('sessions', ses('a', '2026-09-24'));
    await idb.put('settings', { key: 'cfg', value: { seqIndex: 1, seqIndexDate: '2026-09-24' } });
    await copiarAPrueba();

    await abrir(BASE_PRUEBA);
    await idb.put('sessions', ses('dom', '2026-09-27'));
    await idb.put('body', { id: 'b1', date: '2026-09-27', weight: 79.5 });
    await idb.put('settings', { key: 'cfg', value: { seqIndex: 3, seqIndexDate: '2026-09-27' } });

    const dif = await resumenPrueba();
    expect(dif.sesiones.map(s => s.id)).toEqual(['dom']);
    expect(dif.pesos.map(b => b.id)).toEqual(['b1']);
    await pasarPruebaAReal(dif);
    await pasarPruebaAReal(dif);   // dos veces no duplica

    await abrir(BASE_REAL);
    expect((await idb.all('sessions')).map(s => s.id).sort()).toEqual(['a', 'dom']);
    expect((await idb.all('body')).map(b => b.id)).toEqual(['b1']);
    // La sesión pasada es la más reciente: el puntero de la secuencia sigue a la prueba.
    expect((await idb.get('settings', 'cfg')).value.seqIndex).toBe(3);
  });

  it('si la real tiene algo más reciente, el puntero de la real no se toca', async () => {
    await abrir(BASE_REAL);
    await idb.put('settings', { key: 'cfg', value: { seqIndex: 1 } });
    await copiarAPrueba();
    await abrir(BASE_PRUEBA);
    await idb.put('sessions', ses('vieja', '2026-09-20'));
    await idb.put('settings', { key: 'cfg', value: { seqIndex: 5 } });
    const dif = await resumenPrueba();
    await abrir(BASE_REAL);
    await idb.put('sessions', ses('nueva', '2026-09-28'));
    await abrir(BASE_PRUEBA);
    await pasarPruebaAReal(dif);
    await abrir(BASE_REAL);
    expect((await idb.get('settings', 'cfg')).value.seqIndex).toBe(1);
  });
});

describe('¿seguís en modo prueba?', () => {
  beforeEach(() => localStorage.clear());

  it('pregunta si se entró otro día', () => {
    localStorage.setItem(CLAVE, '1');
    localStorage.setItem(DESDE, '2026-09-27');
    expect(pruebaDeOtroDia('2026-09-29')).toBe(true);
    expect(pruebaDeOtroDia('2026-09-27')).toBe(false);
  });

  it('una prueba de antes de este arreglo (sin fecha) también pregunta', () => {
    localStorage.setItem(CLAVE, '1');
    expect(pruebaDeOtroDia('2026-09-29')).toBe(true);
  });

  it('fuera del modo prueba nunca pregunta', () => {
    localStorage.setItem(DESDE, '2026-09-27');
    expect(pruebaDeOtroDia('2026-09-29')).toBe(false);
  });

  it('"sigo probando" deja de preguntar por hoy', () => {
    localStorage.setItem(CLAVE, '1');
    seguirEnPrueba('2026-09-29');
    expect(pruebaDeOtroDia('2026-09-29')).toBe(false);
  });

  it('entrar al modo prueba anota el día', async () => {
    DB.db?.close(); DB.db = null; DB.ver = 3;
    await borrarBase(BASE_REAL); await borrarBase(BASE_PRUEBA);
    await abrir(BASE_REAL);
    globalThis.location = { reload: vi.fn() };
    await entrarModoPrueba('2026-09-25');
    expect(localStorage.getItem(DESDE)).toBe('2026-09-25');
  });
});

describe('sesión en curso en la prueba', () => {
  it('el resumen avisa que hay una sesión abierta (no se pasa: no está completa)', async () => {
    localStorage.clear();
    DB.db?.close(); DB.db = null; DB.ver = 3;
    await borrarBase(BASE_REAL); await borrarBase(BASE_PRUEBA);
    await abrir(BASE_REAL);
    await copiarAPrueba();
    await abrir(BASE_PRUEBA);
    expect((await resumenPrueba()).enCurso).toBe(false);
    await idb.put('settings', { key: 'draft', value: { id: 'd', entries: { e1: { sets: [{ w: 1, r: 1 }] } } } });
    expect((await resumenPrueba()).enCurso).toBe(true);
  });
});
