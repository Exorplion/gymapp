// El orden que se VE es el orden que se HACE (auditoría 2026-09-27, tanda 1).
// Tres bugs con la misma raíz: el plan y el editor muestran los ejercicios
// agrupados por músculo (blocksOf), pero la sesión, las flechas del editor y
// el arrastre de bloques trabajaban sobre el orden guardado, que puede no
// estar agrupado (un ejercicio agregado después cae al final del array).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { orderedExs, startSession } from '../session.js';
import { moveEx } from '../rutina-logic.js';
import { commitSort } from '../drag.js';
import { blocksOf } from '../muscle.js';
import { toast } from '../toast.js';

vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../rest.js', () => ({ startRest: vi.fn(), stopRest: vi.fn(), T: { rir: null }, pedirRir: vi.fn(), marcarRirElegido: vi.fn() }));
vi.mock('../confetti.js', () => ({ fireConfetti: vi.fn() }));
vi.mock('../alarm.js', () => ({ pedirPermiso: vi.fn() }));

const ex = (id, name, cat) => ({ id, name, sets: 3, reps: 10, cat });
/* Como el turno de Enzo: Aperturas se agregó al final, detrás de Abs. */
const guardado = () => [
  ex('p1', 'Press plano máquina', 'Pecho'),
  ex('p2', 'Press inclinado', 'Pecho'),
  ex('h1', 'Elevaciones laterales', 'Hombro'),
  ex('ab', 'Abs polea', 'Abs'),
  ex('p3', 'Aperturas en polea', 'Pecho'),
];
/* Lo que pinta Plan de hoy y el editor: bloques, en orden de aparición. */
const visto = exs => blocksOf(exs).flatMap(b => b.exs).map(e => e.id);
const ids = exs => exs.map(e => e.id);

beforeEach(() => {
  S.routine = [{ id: 'slot1', order: 0, type: 'workout', name: 'Anterior A', exercises: guardado() }];
  S.cfg.seqIndex = 0;
  S.draft = null;
  S.hoyOrder = {};
  vi.mocked(toast).mockClear();
});

describe('A.10 · la sesión arranca en el orden que numera el plan', () => {
  it('orderedExs devuelve los bloques juntos, no el array guardado', () => {
    expect(ids(orderedExs(0, S.routine[0].exercises))).toEqual(['p1', 'p2', 'p3', 'h1', 'ab']);
  });

  it('startSession: Aperturas (#3 en Pecho) es el 3º de la sesión, no el 5º', async () => {
    const plan = visto(orderedExs(0, S.routine[0].exercises));
    await startSession(0);
    expect(S.draft.order).toEqual(plan);
    expect(S.draft.order.indexOf('p3')).toBe(2);
  });

  it('respeta un orden elegido antes de empezar (S.hoyOrder), agrupado', async () => {
    S.hoyOrder = { slot1: ['h1', 'p3', 'ab', 'p1', 'p2'] };
    expect(ids(orderedExs(0, S.routine[0].exercises))).toEqual(['h1', 'p3', 'p1', 'p2', 'ab']);
  });

  it('con la sesión abierta no reagrupa: el orden libre de la sesión se respeta', () => {
    S.draft = { id: 'd', slotId: 'slot1', entries: {}, order: ['h1', 'p1', 'ab', 'p2', 'p3'] };
    expect(ids(orderedExs(0, S.routine[0].exercises))).toEqual(['h1', 'p1', 'ab', 'p2', 'p3']);
  });
});

describe('A.9 · las flechas del editor mueven lo que se ve', () => {
  it('↑ en Aperturas la sube dentro de Pecho y el cambio se ve', async () => {
    expect(visto(S.routine[0].exercises)).toEqual(['p1', 'p2', 'p3', 'h1', 'ab']);
    expect(await moveEx(0, 'p3', -1)).toBe(true);
    expect(visto(S.routine[0].exercises)).toEqual(['p1', 'p3', 'p2', 'h1', 'ab']);
    // lo guardado queda igual a lo que se ve
    expect(ids(S.routine[0].exercises)).toEqual(['p1', 'p3', 'p2', 'h1', 'ab']);
    expect(toast).toHaveBeenCalledWith('Ejercicios reordenados', expect.anything());
  });

  it('no cruza al grupo vecino y no avisa "reordenados" si no pasó nada', async () => {
    expect(await moveEx(0, 'p3', 1)).toBe(false);   // último de Pecho
    expect(await moveEx(0, 'h1', -1)).toBe(false);  // primero de Hombro
    expect(await moveEx(0, 'p1', -1)).toBe(false);  // primero de todo
    expect(toast).not.toHaveBeenCalled();
    expect(ids(S.routine[0].exercises)).toEqual(ids(guardado()));
  });

  it('arrastrar en el editor (kind "rut") guarda los bloques juntos', async () => {
    // un arrastre suelta Abs entre dos de Pecho: el editor lo reagrupa al
    // pintar, así que lo guardado tiene que quedar igual a lo que se va a ver
    await commitSort('rut', '0', ['p1', 'ab', 'p2', 'p3', 'h1']);
    expect(ids(S.routine[0].exercises)).toEqual(['p1', 'p2', 'p3', 'ab', 'h1']);
  });
});

describe('A.11 · arrastrar un bloque en Plan de hoy guarda el orden', () => {
  it('sin sesión: el nuevo orden de bloques queda en S.hoyOrder', async () => {
    await commitSort('hoy-blocks', undefined, ['Hombro', 'Pecho', 'Abs']);
    expect(ids(orderedExs(0, S.routine[0].exercises))).toEqual(['h1', 'p1', 'p2', 'p3', 'ab']);
  });

  it('con la sesión abierta escribe en el orden de la sesión', async () => {
    S.draft = { id: 'd', slotId: 'slot1', entries: {}, order: ['p1', 'p2', 'p3', 'h1', 'ab'] };
    await commitSort('hoy-blocks', undefined, ['Abs', 'Pecho', 'Hombro']);
    expect(S.draft.order).toEqual(['ab', 'p1', 'p2', 'p3', 'h1']);
  });

  it('un grupo que no vino en la lista no se pierde', async () => {
    await commitSort('hoy-blocks', undefined, ['Abs', 'Pecho']);
    expect(ids(orderedExs(0, S.routine[0].exercises))).toEqual(['ab', 'p1', 'p2', 'p3', 'h1']);
  });
});
