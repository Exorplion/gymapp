// Reordenar ejercicios DENTRO de un grupo muscular en "Plan de hoy" (Enzo,
// 2026-09-26: "quiero iniciar con pec deck"). Antes sólo se movían bloques
// enteros.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { moverEnBloque, orderedExs } from '../session.js';
import { blocksOf } from '../muscle.js';

vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../rest.js', () => ({ startRest: vi.fn(), stopRest: vi.fn(), T: { rir: null }, pedirRir: vi.fn(), marcarRirElegido: vi.fn() }));
vi.mock('../confetti.js', () => ({ fireConfetti: vi.fn() }));
vi.mock('../alarm.js', () => ({ pedirPermiso: vi.fn() }));

const ex = (id, name, cat) => ({ id, name, sets: 3, reps: 10, cat });
const EJS = [ex('pp', 'Press plano máquina', 'Pecho'), ex('pi', 'Press inclinado', 'Pecho'), ex('pd', 'Pec deck', 'Pecho'), ex('rm', 'Remo', 'Espalda')];
const orden = () => orderedExs(0, EJS).map(e => e.id);

beforeEach(() => {
  S.routine = [{ id: 'slot1', order: 0, type: 'workout', name: 'Torso', exercises: EJS }];
  S.draft = null;
  S.hoyOrder = {};
});

describe('moverEnBloque', () => {
  it('sube un ejercicio dentro de su grupo', async () => {
    await moverEnBloque(0, orderedExs(0, EJS), 'pd', -1);
    expect(orden()).toEqual(['pp', 'pd', 'pi', 'rm']);
    await moverEnBloque(0, orderedExs(0, EJS), 'pd', -1);
    expect(orden()).toEqual(['pd', 'pp', 'pi', 'rm']);
  });

  it('no cruza al grupo vecino: el primero no sube, el último no baja', async () => {
    expect(await moverEnBloque(0, orderedExs(0, EJS), 'pp', -1)).toBe(false);
    expect(await moverEnBloque(0, orderedExs(0, EJS), 'pd', 1)).toBe(false);
    expect(orden()).toEqual(['pp', 'pi', 'pd', 'rm']);
  });

  it('los grupos siguen juntos después de mover', async () => {
    await moverEnBloque(0, orderedExs(0, EJS), 'pi', 1);
    expect(blocksOf(orderedExs(0, EJS)).map(b => b.cat)).toEqual(['Pecho', 'Espalda']);
  });

  it('con la sesión abierta escribe en el orden de la sesión', async () => {
    S.draft = { id: 'd', slotId: 'slot1', entries: {}, order: ['pp', 'pi', 'pd', 'rm'] };
    await moverEnBloque(0, orderedExs(0, EJS), 'pd', -1);
    expect(S.draft.order).toEqual(['pp', 'pd', 'pi', 'rm']);
  });
});
