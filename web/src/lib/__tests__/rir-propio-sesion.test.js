// RIR propio y "Fallo" dentro de la sesión: lo que se pide en el descanso y
// lo que queda guardado en la serie (2026-10-20). Mismo armado que
// session-rir.test.js: rest.js con un fake que sólo guarda T.rir.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { saveSet, ensureVals, setRirUltimaSerie, setRirLado } from '../session.js';
import { T } from '../rest.js';
import { FALLO } from '../rir.js';

vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../confetti.js', () => ({ fireConfetti: vi.fn() }));
vi.mock('../alarm.js', () => ({ pedirPermiso: vi.fn() }));
vi.mock('../rest.js', () => {
  const T = { rir: null };
  return {
    T,
    startRest: vi.fn(() => { T.rir = null; }),
    stopRest: vi.fn(),
    pedirRir: vi.fn(({ exId, setIdx, pedia, lados }) => { T.rir = { exId, setIdx, pedia: pedia ?? null, valor: null, lados: lados ? lados.map(l => ({ ...l, valor: null })) : null }; }),
    marcarRirElegido: vi.fn(v => { if (T.rir) T.rir.valor = v; }),
  };
});

function armar(exs) {
  S.cfg = { unit: 'kg', rest: 90, restSide: 20 };
  S.sessions = [];
  S.routine = [{ id: 'd1', name: 'Día 1', dow: new Date().getDay(), exercises: exs }];
  S.draft = null;
  T.rir = null;
  vi.clearAllMocks();
}

async function serie(e, w = 40, r = 10) {
  const v = ensureVals(e);
  v.w = w; v.r = r;
  await saveSet(e.id);
}

const setsDe = id => S.draft.entries[id].sets;

describe('el descanso pide el RIR propio', () => {
  it('con rir [2] pide RIR 2 en la primera serie (la regla habría pedido 2 en 3 series… y 3 en 4)', async () => {
    armar([{ id: 'a', name: 'Press banca', sets: 4, reps: 8, rir: [2] }]);
    await serie(S.routine[0].exercises[0]);
    expect(T.rir.pedia).toBe(2);
  });

  it('con la última serie al fallo, la pregunta dice fallo', async () => {
    armar([{ id: 'a', name: 'Press banca', sets: 2, reps: 8, rir: [1, FALLO] }]);
    const e = S.routine[0].exercises[0];
    await serie(e);
    expect(T.rir.pedia).toBe(1);
    await serie(e);
    expect(T.rir.pedia).toBe(FALLO);
  });

  it('sin rir propio sigue la regla de siempre', async () => {
    armar([{ id: 'a', name: 'Press banca', sets: 4, reps: 8 }]);
    await serie(S.routine[0].exercises[0]);
    expect(T.rir.pedia).toBe(3);
  });
});

describe('contestar Fallo', () => {
  beforeEach(() => armar([{ id: 'a', name: 'Press banca', sets: 3, reps: 8 }]));

  it('guarda rpe 10 y fallo', async () => {
    await serie(S.routine[0].exercises[0]);
    await setRirUltimaSerie(FALLO);
    expect(setsDe('a')[0]).toMatchObject({ rpe: 10, fallo: true });
  });

  it('corregir a RIR 0 deja rpe 10 pero saca el fallo', async () => {
    await serie(S.routine[0].exercises[0]);
    await setRirUltimaSerie(FALLO);
    await setRirUltimaSerie(0);
    expect(setsDe('a')[0].rpe).toBe(10);
    expect(setsDe('a')[0]).not.toHaveProperty('fallo');
  });

  it('des-seleccionar borra los dos', async () => {
    await serie(S.routine[0].exercises[0]);
    await setRirUltimaSerie(FALLO);
    await setRirUltimaSerie(null);
    expect(setsDe('a')[0].rpe).toBe(null);
    expect(setsDe('a')[0]).not.toHaveProperty('fallo');
  });

  it('en unilateral, cada lado guarda su propio fallo', async () => {
    armar([{ id: 'u', name: 'Curl concentrado', sets: 3, reps: 10, unilateral: true }]);
    const e = S.routine[0].exercises[0];
    await serie(e);
    await serie(e);
    expect(T.rir.lados).toHaveLength(2);
    await setRirLado(0, FALLO);
    await setRirLado(1, 1);
    const [izq, der] = setsDe('u');
    expect(izq).toMatchObject({ rpe: 10, fallo: true });
    expect(der.rpe).toBe(9);
    expect(der).not.toHaveProperty('fallo');
  });
});
