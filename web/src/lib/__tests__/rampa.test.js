// La rampa de aproximación con un solo botón (rediseño 2026-09-27, pieza 2):
// el botón grande avanza, tocar un ✓ deshace, no se salta hacia adelante y el
// avance vive en el borrador (antes era un Map en memoria y se perdía al
// recargar).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { idb } from '../db.js';
import { vibrate } from '../format.js';
import { clampHechos, avanceLinea, estadoRampa, tocarPaso, estadoBoton } from '../rampa.js';
import { warmupSets } from '../warmup.js';
import { pasosRampa, avanzarRampa, deshacerRampa } from '../session.js';

vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));
vi.mock('../rest.js', () => ({ startRest: vi.fn(), stopRest: vi.fn(), T: { rir: null }, pedirRir: vi.fn(), marcarRirElegido: vi.fn() }));
vi.mock('../alarm.js', () => ({ pedirPermiso: vi.fn() }));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../confetti.js', () => ({ fireConfetti: vi.fn() }));
vi.mock('../format.js', async orig => ({ ...(await orig()), vibrate: vi.fn() }));

const RAMPA = warmupSets(47.5); // 25 / 35 / 42.5

describe('avanceLinea — la línea se llena hasta el círculo siguiente', () => {
  it('0 → 50 % → 100 % con tres pasos (antes el primer paso no la movía)', () => {
    expect([0, 1, 2, 3].map(h => avanceLinea(h, 3))).toEqual([0, 0.5, 1, 1]);
  });
  it('sin pasos o con uno solo no hay línea', () => {
    expect(avanceLinea(1, 1)).toBe(0);
    expect(avanceLinea(0, 0)).toBe(0);
  });
});

describe('clampHechos', () => {
  it('basura, negativos y excesos quedan dentro de 0..n', () => {
    for (const v of [undefined, null, NaN, 'x', -2]) expect(clampHechos(v, 3)).toBe(0);
    expect(clampHechos(7, 3)).toBe(3);
    expect(clampHechos(1.9, 3)).toBe(1);
  });
});

describe('estadoRampa', () => {
  it('al empezar el primer paso es el activo y los otros futuros', () => {
    const e = estadoRampa(RAMPA, 0);
    expect(e.activo).toBe(0);
    expect(e.completa).toBe(false);
    expect(e.pasos.map(p => p.estado)).toEqual(['activo', 'futuro', 'futuro']);
  });
  it('con dos hechos el activo es el 90 %', () => {
    const e = estadoRampa(RAMPA, 2);
    expect(e.activo).toBe(2);
    expect(e.pasos.map(p => p.estado)).toEqual(['hecho', 'hecho', 'activo']);
    expect(e.avance).toBe(1);
  });
  it('con los tres hechos está completa y no hay activo', () => {
    const e = estadoRampa(RAMPA, 3);
    expect(e.completa).toBe(true);
    expect(e.activo).toBe(null);
  });
  it('sin rampa no hay nada que completar', () => {
    const e = estadoRampa([], 0);
    expect(e).toMatchObject({ n: 0, completa: false, activo: null, avance: 0, pasos: [] });
  });
});

describe('tocarPaso — se deshace hacia atrás, nunca se salta hacia adelante', () => {
  it('tocar un ✓ vuelve a ese paso', () => {
    expect(tocarPaso(2, 0, 3)).toEqual({ accion: 'deshacer', hechos: 0 });
    expect(tocarPaso(2, 1, 3)).toEqual({ accion: 'deshacer', hechos: 1 });
  });
  it('tocar un paso futuro no avanza: sacude el activo', () => {
    expect(tocarPaso(0, 2, 3)).toEqual({ accion: 'sacudir', hechos: 0 });
    expect(tocarPaso(1, 2, 3)).toEqual({ accion: 'sacudir', hechos: 1 });
  });
  it('tocar el activo no hace nada: el que avanza es el botón', () => {
    expect(tocarPaso(1, 1, 3)).toEqual({ accion: 'nada', hechos: 1 });
  });
  it('con la rampa completa ya no se deshace (el bloque quedó calentado)', () => {
    expect(tocarPaso(3, 0, 3)).toEqual({ accion: 'nada', hechos: 3 });
  });
  it('un índice fuera de rango no hace nada', () => {
    expect(tocarPaso(1, 5, 3).accion).toBe('nada');
    expect(tocarPaso(1, -1, 3).accion).toBe('nada');
  });
});

describe('estadoBoton — el botón grande dice qué aproximación toca', () => {
  const serie = { etiqueta: 'Serie 1', w: 47.5, r: 7 };
  it('mientras quedan aproximaciones: variante ámbar, porcentaje y peso con unidad', () => {
    expect(estadoBoton({ rampa: RAMPA, hechos: 0, serie })).toEqual({
      variante: 'aprox', paso: 0, texto: 'Aprox. 50 % lista', valor: '25 kg × 5',
    });
    expect(estadoBoton({ rampa: RAMPA, hechos: 2, serie })).toMatchObject({ texto: 'Aprox. 90 % lista', valor: '42.5 kg × 1' });
  });
  it('después de la tercera vuelve a ser la serie de siempre', () => {
    expect(estadoBoton({ rampa: RAMPA, hechos: 3, serie })).toEqual({
      variante: 'serie', paso: null, texto: 'Serie 1 lista', valor: '47.5 kg × 7',
    });
  });
  it('sin rampa es la serie normal', () => {
    expect(estadoBoton({ rampa: [], hechos: 0, serie }).variante).toBe('serie');
  });
  it('respeta la unidad y el formateador que le pasen (lb)', () => {
    const b = estadoBoton({ rampa: RAMPA, hechos: 0, serie, unidad: 'lb', fmtPeso: kg => String(Math.round(kg * 2.20462)) });
    expect(b.valor).toBe('55 lb × 5');
  });
  it('en unilateral la etiqueta es el lado', () => {
    expect(estadoBoton({ rampa: [], hechos: 0, serie: { etiqueta: 'Izquierda', w: 20, r: 10 } }).texto).toBe('Izquierda lista');
  });
});

describe('rampa en el borrador — sobrevive a recargar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    S.draft = { id: 'd1', date: '2026-09-27', slotId: 's', entries: {}, order: ['a'], skipped: [], extraSets: {}, extras: [] };
  });

  it('sin avance guardado arranca en 0', () => {
    expect(pasosRampa('a')).toBe(0);
  });

  it('cada toque del botón suma un paso, vibra y se guarda', async () => {
    expect(await avanzarRampa('a', 3)).toBe(1);
    expect(await avanzarRampa('a', 3)).toBe(2);
    expect(S.draft.rampa).toEqual({ a: 2 });
    expect(vibrate).toHaveBeenCalledTimes(2);
    expect(idb.put).toHaveBeenLastCalledWith('settings', { key: 'draft', value: S.draft });
  });

  it('nunca pasa del total', async () => {
    S.draft.rampa = { a: 3 };
    expect(await avanzarRampa('a', 3)).toBe(3);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('lo guardado se lee de vuelta (simula recargar la app)', async () => {
    await avanzarRampa('a', 3);
    S.draft = JSON.parse(JSON.stringify(S.draft));
    expect(pasosRampa('a')).toBe(1);
  });

  it('cada ejercicio lleva su propio avance', async () => {
    await avanzarRampa('a', 3);
    await avanzarRampa('b', 3);
    await avanzarRampa('b', 3);
    expect([pasosRampa('a'), pasosRampa('b')]).toEqual([1, 2]);
  });

  it('deshacer vuelve al paso tocado', async () => {
    S.draft.rampa = { a: 2 };
    expect(await deshacerRampa('a', 0)).toBe(0);
    expect(pasosRampa('a')).toBe(0);
    expect(idb.put).toHaveBeenCalled();
  });

  it('deshacer no sirve para saltar hacia adelante', async () => {
    S.draft.rampa = { a: 1 };
    expect(await deshacerRampa('a', 2)).toBe(1);
    expect(await deshacerRampa('a', 1)).toBe(1);
    expect(idb.put).not.toHaveBeenCalled();
  });

  it('sin sesión abierta no hace nada', async () => {
    S.draft = null;
    expect(pasosRampa('a')).toBe(0);
    expect(await avanzarRampa('a', 3)).toBe(0);
    expect(await deshacerRampa('a', 0)).toBe(0);
  });

  it('un valor roto en el borrador se lee como 0', () => {
    S.draft.rampa = { a: 'x' };
    expect(pasosRampa('a')).toBe(0);
  });
});
