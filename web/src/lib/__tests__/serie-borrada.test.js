// Enzo, 2026-10: "eliminé una serie y el ejercicio se cerró y pasó al
// siguiente y no me dejaba terminarlo". Dos caminos llevaban ahí:
//  - la ✕ de la tabla borraba la serie pero sólo reabría el ejercicio si no
//    había otro en curso — y casi siempre lo hay, porque la app ya avanzó;
//  - "Una serie menos" baja el OBJETIVO (no borra nada), cierra el ejercicio
//    y pasa al siguiente, sin forma de volver.
// Y la tarjeta que quedaba "En espera" con series hechas no tenía ningún
// botón para retomarla.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { T } from '../rest.js';
import { toast } from '../toast.js';
import { borrarSeries, dropSet, retomarEjercicio, setsDone } from '../session.js';

vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../rest.js', () => ({ startRest: vi.fn(), stopRest: vi.fn(), T: { rir: null }, pedirRir: vi.fn(), marcarRirElegido: vi.fn() }));
vi.mock('../confetti.js', () => ({ fireConfetti: vi.fn() }));

const ex = (id, name, sets = 3) => ({ id, name, sets, reps: 10 });
const serie = w => ({ w, r: 8 });
/** La acción "Deshacer" del último aviso. */
const deshacer = () => toast.mock.calls.at(-1)[1].onAction();

beforeEach(() => {
  toast.mockClear();
  T.rir = null;
  S.routine = [{ id: 'slot1', order: 0, type: 'workout', name: 'Anterior', exercises: [ex('a', 'Press'), ex('b', 'Remo'), ex('c', 'Curl')] }];
  // Press completo (3/3), la app ya pasó sola a Remo.
  S.draft = {
    id: 'd1', date: '2026-10-12', slotId: 'slot1', dayName: 'Anterior',
    open: 1, start: 1, cur: 'b',
    entries: { a: { name: 'Press', sets: [serie(60), serie(60), serie(62)] } },
    order: ['a', 'b', 'c'], skipped: [], extraSets: {}, extras: [],
  };
});

describe('borrar una serie', () => {
  it('reabre el ejercicio aunque la app ya haya pasado a otro', async () => {
    await borrarSeries('a', [2]);
    expect(setsDone('a')).toHaveLength(2);
    expect(S.draft.cur).toBe('a');
  });

  it('borrar del ejercicio en curso no cambia nada más', async () => {
    S.draft.entries.b = { name: 'Remo', sets: [serie(40), serie(40)] };
    await borrarSeries('b', [1]);
    expect(setsDone('b')).toHaveLength(1);
    expect(S.draft.cur).toBe('b');
  });

  it('si con la serie extra sigue completo, no se reabre', async () => {
    S.draft.entries.a.sets.push(serie(62));   // 4 de 3: hizo una de más
    await borrarSeries('a', [3]);
    expect(S.draft.cur).toBe('b');
  });

  it('un omitido no se reabre al borrarle una serie', async () => {
    S.draft.skipped = ['a'];
    await borrarSeries('a', [0]);
    expect(S.draft.cur).toBe('b');
  });

  it('borra los dos lados de una serie unilateral de una vez', async () => {
    S.draft.entries.a.sets = [serie(10), serie(10), serie(12), serie(12)];
    await borrarSeries('a', [2, 3]);
    expect(setsDone('a').map(s => s.w)).toEqual([10, 10]);
  });

  it('avisa qué serie borró y que el ejercicio vuelve a estar en curso', async () => {
    await borrarSeries('a', [2], { n: 3 });
    expect(toast.mock.calls.at(-1)[0]).toBe('Serie 3 borrada · Press vuelve a estar en curso');
    expect(toast.mock.calls.at(-1)[1].actionLabel).toBe('Deshacer');
  });

  it('deshacer devuelve la serie a su lugar y el ejercicio que estaba en curso', async () => {
    await borrarSeries('a', [1]);
    await deshacer();
    expect(setsDone('a').map(s => s.w)).toEqual([60, 60, 62]);
    expect(S.draft.cur).toBe('b');
  });

  it('deshacer recupera también la última serie (cuando la entrada se había borrado)', async () => {
    S.draft.entries.c = { name: 'Curl', sets: [serie(12)] };
    S.draft.cur = 'c';
    await borrarSeries('c', [0]);
    expect(S.draft.entries.c).toBeUndefined();
    await deshacer();
    expect(setsDone('c').map(s => s.w)).toEqual([12]);
  });

  it('deshacer no pisa una serie anotada después de borrar', async () => {
    await borrarSeries('a', [2]);
    S.draft.entries.a.sets.push(serie(65));
    await deshacer();
    expect(setsDone('a').map(s => s.w)).toEqual([60, 60, 65]);
  });

  it('cierra la pregunta de RIR si apuntaba a ese ejercicio', async () => {
    T.rir = { exId: 'a', setIdx: 2 };
    await borrarSeries('a', [2]);
    expect(T.rir).toBe(null);
  });

  it('no toca la pregunta de RIR de otro ejercicio', async () => {
    T.rir = { exId: 'b', setIdx: 0 };
    await borrarSeries('a', [2]);
    expect(T.rir).toEqual({ exId: 'b', setIdx: 0 });
  });
});

describe('una serie menos', () => {
  beforeEach(() => {
    S.draft.cur = 'a';
    S.draft.entries.a.sets = [serie(60), serie(60)];   // 2 de 3
  });

  it('avisa con Deshacer', async () => {
    await dropSet('a');
    expect(toast.mock.calls.at(-1)[1].actionLabel).toBe('Deshacer');
  });

  it('deshacer devuelve el objetivo y el ejercicio en curso', async () => {
    await dropSet('a');
    expect(S.draft.cur).toBe('b');
    await deshacer();
    expect(S.draft.extraSets.a).toBe(0);
    expect(S.draft.cur).toBe('a');
  });
});

describe('retomar un ejercicio en espera', () => {
  it('lo pone en curso y el que estaba queda en espera', async () => {
    S.draft.entries.a.sets.pop();   // Press 2/3, en espera
    await retomarEjercicio('a');
    expect(S.draft.cur).toBe('a');
  });

  it('sin sesión abierta no hace nada', async () => {
    S.draft = null;
    await retomarEjercicio('a');
    expect(S.draft).toBe(null);
  });
});
