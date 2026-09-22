// Rueda de porcentaje de la sesión en vivo (Hoy.jsx, SessionRing): lógica
// pura extraída a sessionProgress() para poder testearla sin renderizar.
// Casos clave (ver el brief): unilateral no pesa doble, salteados salen del
// denominador, sin sesión abierta o sin nada que medir no hay 0% — hay null.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { sessionProgress } from '../session.js';

vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../rest.js', () => ({ startRest: vi.fn(), stopRest: vi.fn(), T: { rir: null }, pedirRir: vi.fn(), marcarRirElegido: vi.fn() }));
vi.mock('../confetti.js', () => ({ fireConfetti: vi.fn() }));
vi.mock('../alarm.js', () => ({ pedirPermiso: vi.fn() }));

const ex = (id, sets = 3, unilateral = false) => ({ id, name: id, sets, reps: 12, unilateral });
const row = (n) => Array.from({ length: n }, (_, i) => ({ w: 10, r: 8, t: i }));

beforeEach(() => {
  S.routine = [{ id: 'slot1', order: 0, type: 'workout', name: 'Brazo', exercises: [] }];
  S.draft = {
    id: 'd1', date: '2026-09-17', slotId: 'slot1', dayName: 'Brazo',
    open: 1, start: Date.now(), cur: null, entries: {},
    order: [], skipped: [], extraSets: {}, extras: [],
  };
});

describe('sessionProgress', () => {
  it('sin sesión abierta devuelve null (no hay 0%, no hay rueda)', () => {
    S.draft = null;
    expect(sessionProgress([ex('a', 3)])).toBeNull();
  });

  it('sin ejercicios objetivo devuelve null', () => {
    expect(sessionProgress([])).toBeNull();
  });

  it('ejercicio sin sets (0 o undefined) no aporta al objetivo', () => {
    const exs = [{ id: 'a', name: 'a', reps: 12, unilateral: false }, ex('b', 0)];
    expect(sessionProgress(exs)).toBeNull();
  });

  it('cuenta series reales, no filas: bilateral 1 a 1', () => {
    S.draft.entries.a = { sets: row(2) };
    const exs = [ex('a', 4, false)];
    expect(sessionProgress(exs)).toEqual({ done: 2, total: 4, pct: 0.5 });
  });

  it('unilateral: dos filas son una serie real, no pesa el doble', () => {
    S.draft.entries.a = { sets: row(4) }; // 4 filas = 2 series reales
    const exs = [ex('a', 4, true)]; // objetivo: 4 series reales (ex.sets), NO targetSets (que sería 8 filas)
    expect(sessionProgress(exs)).toEqual({ done: 2, total: 4, pct: 0.5 });
  });

  it('mezcla unilateral y bilateral sin que el unilateral pese doble', () => {
    S.draft.entries.a = { sets: row(2) };  // unilateral, 2 filas = 1 serie real
    S.draft.entries.b = { sets: row(3) };  // bilateral, 3 filas = 3 series
    const exs = [ex('a', 3, true), ex('b', 3, false)];
    // objetivo total = 3 (a, series reales) + 3 (b) = 6; hecho = 1 + 3 = 4
    expect(sessionProgress(exs)).toEqual({ done: 4, total: 6, pct: 4 / 6 });
  });

  it('los salteados salen del numerador y del denominador', () => {
    S.draft.entries.a = { sets: row(1) };
    S.draft.skipped = ['b'];
    const exs = [ex('a', 3, false), ex('b', 3, false)];
    // sin b: objetivo 3, hecho 1 — si b contara, el 100% sería inalcanzable
    expect(sessionProgress(exs)).toEqual({ done: 1, total: 3, pct: 1 / 3 });
  });

  it('sesión completa da 100%', () => {
    S.draft.entries.a = { sets: row(3) };
    const exs = [ex('a', 3, false)];
    expect(sessionProgress(exs)).toEqual({ done: 3, total: 3, pct: 1 });
  });

  it('si todos los ejercicios están salteados, no hay nada que medir', () => {
    S.draft.skipped = ['a'];
    const exs = [ex('a', 3, false)];
    expect(sessionProgress(exs)).toBeNull();
  });
});
