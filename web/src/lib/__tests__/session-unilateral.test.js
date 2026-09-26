// D1/D2/D5 (docs/superpowers/specs/2026-09-17-unilateral-design.md):
// una serie son los dos lados, el descanso se parte en dos, y el toggle
// persiste sólo antes de la primera serie del día.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import {
  targetSets, seriesCompletas, saveSet, ensureVals, toggleUnilateral,
} from '../session.js';
import { startRest } from '../rest.js';
import { toast } from '../toast.js';
import { idb } from '../db.js';

vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../rest.js', () => ({ startRest: vi.fn(), stopRest: vi.fn(), T: { rir: null }, pedirRir: vi.fn(), marcarRirElegido: vi.fn() }));
vi.mock('../confetti.js', () => ({ fireConfetti: vi.fn() }));
vi.mock('../alarm.js', () => ({ pedirPermiso: vi.fn() }));

const ex = (id, name, sets = 3, unilateral = false) => ({ id, name, sets, reps: 12, unilateral });

beforeEach(() => {
  vi.clearAllMocks();
  S.routine = [{ id: 'slot1', order: 0, type: 'workout', name: 'Brazo', exercises: [ex('a', 'Curl', 3, true), ex('b', 'Press', 3, false)] }];
  S.draft = {
    id: 'd1', date: '2026-09-17', slotId: 'slot1', dayName: 'Brazo',
    open: 1, start: Date.now(), cur: 'a', entries: {},
    order: ['a', 'b'], skipped: [], extraSets: {}, extras: [],
  };
  S.hoyVals = {};
  S.cfg = { ...S.cfg, rest: 90, restSide: 20 };
});

describe('targetSets con unilateral', () => {
  it('3x12 unilateral necesita 6 filas', () => {
    expect(targetSets(ex('a', 'Curl', 3, true))).toBe(6);
  });

  it('3x12 bilateral sigue necesitando 3 filas', () => {
    expect(targetSets(ex('b', 'Press', 3, false))).toBe(3);
  });
});

describe('seriesCompletas', () => {
  it('cuenta de a dos filas cuando es unilateral', () => {
    const esperado = [0, 0, 1, 1, 2, 2, 3];
    esperado.forEach((v, filas) => expect(seriesCompletas(filas, true)).toBe(v));
  });

  it('cuenta 1 a 1 cuando es bilateral', () => {
    [0, 1, 2, 3].forEach(filas => expect(seriesCompletas(filas, false)).toBe(filas));
  });
});

describe('saveSet: unilateral completo a la 6, no a la 5', () => {
  it('a la fila 5 el ejercicio sigue abierto', async () => {
    ensureVals(ex('a', 'Curl', 3, true));
    S.hoyVals.a = { w: 20, r: 12, rpe: null, side: 'left' };
    for (let i = 0; i < 5; i++) {
      await saveSet('a');
    }
    expect(S.draft.entries.a.sets).toHaveLength(5);
    expect(S.draft.cur).toBe('a'); // no se cerró
  });

  it('a la fila 6 el ejercicio queda completo', async () => {
    ensureVals(ex('a', 'Curl', 3, true));
    S.hoyVals.a = { w: 20, r: 12, rpe: null, side: 'left' };
    for (let i = 0; i < 6; i++) {
      await saveSet('a');
    }
    expect(S.draft.entries.a.sets).toHaveLength(6);
    expect(S.draft.cur).not.toBe('a');
  });
});

describe('saveSet: descanso partido (D2)', () => {
  it('tras la fila 1 (impar) el descanso es restSide', async () => {
    ensureVals(ex('a', 'Curl', 3, true));
    S.hoyVals.a = { w: 20, r: 12, rpe: null, side: 'left' };
    await saveSet('a');
    expect(startRest).toHaveBeenLastCalledWith(S.cfg.restSide);
  });

  it('tras la fila 2 (par) el descanso es cfg.rest normal', async () => {
    ensureVals(ex('a', 'Curl', 3, true));
    S.hoyVals.a = { w: 20, r: 12, rpe: null, side: 'left' };
    await saveSet('a');
    await saveSet('a');
    expect(startRest).toHaveBeenLastCalledWith();
  });

  it('bilateral sigue llamando startRest sin argumento en cada fila', async () => {
    S.draft.cur = 'b';
    ensureVals(ex('b', 'Press', 3, false));
    S.hoyVals.b = { w: 40, r: 10, rpe: null, side: null };
    await saveSet('b');
    expect(startRest).toHaveBeenLastCalledWith();
  });
});

describe('ensureVals: side inicial (D1)', () => {
  it('arranca en left para un ejercicio unilateral', () => {
    const v = ensureVals(ex('a', 'Curl', 3, true));
    expect(v.side).toBe('left');
  });

  it('sigue en null para un ejercicio bilateral', () => {
    const v = ensureVals(ex('b', 'Press', 3, false));
    expect(v.side).toBe(null);
  });
});

describe('toggleUnilateral: persistencia (D5)', () => {
  it('sin series registradas hoy, escribe en la rutina y persiste el slot', async () => {
    await toggleUnilateral('b');
    const b = S.routine[0].exercises.find(e => e.id === 'b');
    expect(b.unilateral).toBe(true);
    expect(idb.put).toHaveBeenCalledWith('routine', S.routine[0]);
  });

  it('con series ya registradas hoy, no cambia nada y avisa', async () => {
    S.draft.entries.b = { name: 'Press', sets: [{ w: 40, r: 10, t: Date.now(), rpe: null, side: null }] };
    const before = S.routine[0].exercises.find(e => e.id === 'b').unilateral;
    await toggleUnilateral('b');
    const after = S.routine[0].exercises.find(e => e.id === 'b').unilateral;
    expect(after).toBe(before);
    expect(toast).toHaveBeenCalled();
  });
});

describe('el lado que toca se deduce de lo anotado (2026-09-25)', () => {
  it('pasar a unilateral a mitad de sesión deja un lado y alterna', async () => {
    const press = S.routine[0].exercises[1];
    S.draft.cur = 'b';
    ensureVals(press);                 // bilateral: side queda en null
    expect(S.hoyVals.b.side).toBeNull();
    await toggleUnilateral('b');
    const v = ensureVals(press);
    expect(v.side).toBe('left');
    await saveSet('b');
    await saveSet('b');
    expect(S.draft.entries.b.sets.map(s => s.side)).toEqual(['left', 'right']);
  });

  it('al recargar con una serie a medias pide el lado que falta', () => {
    S.draft.entries.a = { name: 'Curl', sets: [{ w: 10, r: 12, side: 'left' }] };
    S.hoyVals = {};                    // recargar: los valores en memoria se pierden
    expect(ensureVals(S.routine[0].exercises[0]).side).toBe('right');
  });
});
