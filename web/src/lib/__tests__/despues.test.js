// "Hacer después" pregunta a dónde (Enzo, 2026-09-25): antes mandaba el
// ejercicio al final sin preguntar y sin forma de deshacerlo.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { moverEjercicio, hacerDespues, sessionExs } from '../session.js';
import { toast } from '../toast.js';

vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../rest.js', () => ({ startRest: vi.fn(), stopRest: vi.fn(), T: { rir: null }, pedirRir: vi.fn(), marcarRirElegido: vi.fn() }));
vi.mock('../confetti.js', () => ({ fireConfetti: vi.fn() }));
vi.mock('../alarm.js', () => ({ pedirPermiso: vi.fn() }));

const ex = (id, name) => ({ id, name, sets: 3, reps: 10 });
const orden = () => sessionExs(0).map(e => e.id);

beforeEach(() => {
  vi.clearAllMocks();
  S.routine = [{ id: 'slot1', order: 0, type: 'workout', name: 'Pecho', exercises: [ex('a', 'Press'), ex('b', 'Aperturas'), ex('c', 'Fondos'), ex('d', 'Cruces')] }];
  S.draft = {
    id: 'd1', date: '2026-09-26', slotId: 'slot1', dayName: 'Pecho',
    open: 1, start: Date.now(), cur: 'a', entries: {},
    order: ['a', 'b', 'c', 'd'], skipped: [], extraSets: {}, extras: [],
  };
  S.hoyVals = {};
});

describe('moverEjercicio', () => {
  it('lo deja justo después del elegido y pasa al siguiente', async () => {
    await moverEjercicio('a', 'c');
    expect(orden()).toEqual(['b', 'c', 'a', 'd']);
    expect(S.draft.cur).toBe('b');
  });

  it('sin destino va al final (lo que hacía "Hacer después")', async () => {
    await hacerDespues('a');
    expect(orden()).toEqual(['b', 'c', 'd', 'a']);
  });

  it('el aviso ofrece deshacer, y deshacer vuelve el orden y el ejercicio actual', async () => {
    await moverEjercicio('a', 'b');
    const opts = toast.mock.calls.at(-1)[1];
    expect(opts.actionLabel).toBe('Deshacer');
    await opts.onAction();
    expect(orden()).toEqual(['a', 'b', 'c', 'd']);
    expect(S.draft.cur).toBe('a');
  });

  it('el aviso dice dónde quedó', async () => {
    await moverEjercicio('a', 'c');
    expect(toast.mock.calls.at(-1)[0]).toMatch(/Press.*después de Fondos/);
  });
});
