// Enzo, 2026-10: "registré una serie, me di cuenta de que el número estaba
// mal, le di a la X para eliminarla pero el descanso ya estaba corriendo;
// en las unilaterales pasa algo parecido, la secuencia se bugea".
//  - Si el número estaba mal la serie SÍ se hizo: se corrige, no se borra,
//    y el descanso sigue contando.
//  - Borrar es "esta serie no pasó": si su descanso estaba corriendo, se
//    cancela; Deshacer lo devuelve con el tiempo que le quedaba.
//  - En unilateral el lado que sigue se recalcula después de borrar.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { T, startRest, stopRest, reanudarRest } from '../rest.js';
import { toast } from '../toast.js';
import { borrarSeries, editarSerie, saveSet, setsDone } from '../session.js';

vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../rest.js', () => ({
  startRest: vi.fn(), stopRest: vi.fn(), reanudarRest: vi.fn(),
  T: { rir: null, state: 'hidden', serie: null, end: 0, total: 0 },
  pedirRir: vi.fn(), marcarRirElegido: vi.fn(),
}));
vi.mock('../confetti.js', () => ({ fireConfetti: vi.fn() }));

const ex = (id, name, sets = 3, extra = {}) => ({ id, name, sets, reps: 10, ...extra });
const serie = (w, r = 8, side = null) => ({ w, r, side });
const deshacer = () => toast.mock.calls.at(-1)[1].onAction();

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(T, { rir: null, state: 'hidden', serie: null, end: 0, total: 0 });
  S.routine = [{ id: 'slot1', order: 0, type: 'workout', name: 'Anterior', exercises: [
    ex('a', 'Press'), ex('b', 'Remo'), ex('u', 'Curl unilateral', 3, { unilateral: true }),
  ] }];
  S.hoyVals = {};
  S.draft = {
    id: 'd1', date: '2026-10-12', slotId: 'slot1', dayName: 'Anterior',
    open: 1, start: 1, cur: 'a',
    entries: { a: { name: 'Press', sets: [serie(60), serie(60)] } },
    order: ['a', 'b', 'u'], skipped: [], extraSets: {}, extras: [],
  };
});

describe('corregir una serie', () => {
  it('cambia peso y reps de esa serie y nada más', async () => {
    expect(await editarSerie('a', 1, { w: 62.5, r: 7 })).toBe(true);
    expect(setsDone('a')).toEqual([serie(60), { w: 62.5, r: 7, side: null }]);
    expect(S.draft.cur).toBe('a');
  });

  it('no toca el descanso que está corriendo', async () => {
    Object.assign(T, { state: 'minimized', serie: { exId: 'a', idx: 1 } });
    await editarSerie('a', 1, { w: 62.5, r: 7 });
    expect(stopRest).not.toHaveBeenCalled();
    expect(startRest).not.toHaveBeenCalled();
    expect(T.state).toBe('minimized');
  });

  it('redondea el peso y no deja reps en cero', async () => {
    await editarSerie('a', 0, { w: 61.26, r: 0 });
    expect(setsDone('a')[0]).toMatchObject({ w: 61.3, r: 1 });
  });

  it('conserva el lado y el esfuerzo de la serie', async () => {
    S.draft.entries.u = { name: 'Curl unilateral', sets: [{ w: 12, r: 10, side: 'left', rpe: 8 }] };
    await editarSerie('u', 0, { w: 14, r: 9 });
    expect(setsDone('u')[0]).toEqual({ w: 14, r: 9, side: 'left', rpe: 8 });
  });

  it('avisa qué serie corrigió', async () => {
    await editarSerie('a', 1, { w: 62.5, r: 7 }, { n: 2 });
    expect(toast.mock.calls.at(-1)[0]).toBe('Serie 2 corregida');
  });

  it('si la serie no existe no hace nada', async () => {
    expect(await editarSerie('a', 5, { w: 1, r: 1 })).toBe(false);
    expect(await editarSerie('b', 0, { w: 1, r: 1 })).toBe(false);
  });
});

describe('el descanso sabe de qué serie es', () => {
  it('registrar una serie lo ata a esa serie', async () => {
    S.hoyVals.a = { w: 60, r: 8, side: null, rpe: null };
    await saveSet('a');
    expect(startRest).toHaveBeenCalled();
    expect(T.serie).toEqual({ exId: 'a', idx: 2 });
  });
});

describe('borrar la serie cuyo descanso corre', () => {
  beforeEach(() => {
    Object.assign(T, { state: 'minimized', serie: { exId: 'a', idx: 1 }, end: Date.now() + 90_000, total: 120 });
  });

  it('cancela ese descanso', async () => {
    await borrarSeries('a', [1]);
    expect(stopRest).toHaveBeenCalled();
  });

  it('borrar otra serie no lo toca', async () => {
    await borrarSeries('a', [0]);
    expect(stopRest).not.toHaveBeenCalled();
  });

  it('si el descanso ya terminó no hay nada que cancelar', async () => {
    T.state = 'hidden';
    await borrarSeries('a', [1]);
    expect(stopRest).not.toHaveBeenCalled();
  });

  it('deshacer devuelve el descanso con el tiempo que le quedaba', async () => {
    const end = T.end;
    await borrarSeries('a', [1]);
    await deshacer();
    expect(reanudarRest).toHaveBeenCalledWith({ end, total: 120 });
    expect(T.serie).toEqual({ exId: 'a', idx: 1 });
  });

  it('si el descanso ya habría terminado, deshacer no lo revive', async () => {
    T.end = Date.now() + 50;
    await borrarSeries('a', [1]);
    await new Promise(r => setTimeout(r, 80));
    await deshacer();
    expect(reanudarRest).not.toHaveBeenCalled();
  });
});

describe('unilateral: el lado que sigue después de borrar', () => {
  beforeEach(() => { S.draft.cur = 'u'; });

  it('borrar una serie a medias vuelve a empezar por ese lado', async () => {
    // Hizo izquierda; la rueda ya había pasado a derecha.
    S.draft.entries.u = { name: 'Curl unilateral', sets: [serie(12, 10, 'left')] };
    S.hoyVals.u = { w: 12, r: 10, side: 'right', rpe: null };
    await borrarSeries('u', [0]);
    expect(S.hoyVals.u.side).toBe('left');
  });

  it('borrar una serie completa deja el lado como estaba', async () => {
    S.draft.entries.u = { name: 'Curl unilateral', sets: [serie(12, 10, 'left'), serie(12, 10, 'right'), serie(12, 9, 'left'), serie(12, 9, 'right')] };
    S.hoyVals.u = { w: 12, r: 10, side: 'left', rpe: null };
    await borrarSeries('u', [2, 3]);
    expect(S.hoyVals.u.side).toBe('left');
  });

  it('con una serie a medias anotada, borrar una completa sigue por el lado que falta', async () => {
    S.draft.entries.u = { name: 'Curl unilateral', sets: [serie(12, 10, 'left'), serie(12, 10, 'right'), serie(12, 9, 'left')] };
    S.hoyVals.u = { w: 12, r: 10, side: 'right', rpe: null };
    await borrarSeries('u', [0, 1]);
    expect(S.hoyVals.u.side).toBe('right');
  });
});
