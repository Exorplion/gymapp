import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import {
  targetSets, sessionExs, nextPending, isSkipped,
  skipExercise, unskipExercise, addExtraSet, addSessionExercise, replaceSessionExercise,
} from '../session.js';

vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../rest.js', () => ({ startRest: vi.fn(), stopRest: vi.fn() }));
vi.mock('../carousel.js', () => ({ scrollCarouselTo: vi.fn(), jumpToSlide: vi.fn(), slideCenterDist: vi.fn(), scrollToSlideEl: vi.fn() }));
vi.mock('../confetti.js', () => ({ fireConfetti: vi.fn() }));

const ex = (id, name, sets = 3) => ({ id, name, sets, reps: 10 });

beforeEach(() => {
  S.routine = { 4: { weekday: 4, name: 'Anterior A', exercises: [ex('a', 'Press'), ex('b', 'Remo'), ex('c', 'Curl')] } };
  S.draft = {
    id: 'd1', date: '2026-08-06', weekday: 4, dayName: 'Anterior A',
    open: 1, start: null, cur: null, entries: {},
    order: ['a', 'b', 'c'], skipped: [], extraSets: {}, extras: [],
  };
});

describe('targetSets', () => {
  it('sin series extra es el objetivo de la rutina', () => {
    expect(targetSets(ex('a', 'Press', 3))).toBe(3);
  });

  it('suma las series concedidas para esta sesión', () => {
    S.draft.extraSets = { a: 2 };
    expect(targetSets(ex('a', 'Press', 3))).toBe(5);
  });

  it('sin borrador abierto no explota', () => {
    S.draft = null;
    expect(targetSets(ex('a', 'Press', 3))).toBe(3);
  });

  it('un borrador viejo sin el campo tampoco explota', () => {
    delete S.draft.extraSets;
    expect(targetSets(ex('a', 'Press', 3))).toBe(3);
  });
});

describe('sessionExs', () => {
  it('devuelve los de la rutina en el orden del borrador', () => {
    S.draft.order = ['c', 'a', 'b'];
    expect(sessionExs(4).map(e => e.id)).toEqual(['c', 'a', 'b']);
  });

  it('incluye los ejercicios agregados sólo para hoy', () => {
    S.draft.extras = [ex('x', 'Face pull')];
    S.draft.order = ['a', 'b', 'c', 'x'];
    expect(sessionExs(4).map(e => e.name)).toEqual(['Press', 'Remo', 'Curl', 'Face pull']);
  });

  it('un borrador viejo sin extras sigue funcionando', () => {
    delete S.draft.extras;
    expect(sessionExs(4)).toHaveLength(3);
  });
});

describe('saltar', () => {
  it('marca y desmarca', async () => {
    await skipExercise('b');
    expect(isSkipped('b')).toBe(true);
    await unskipExercise('b');
    expect(isSkipped('b')).toBe(false);
  });

  it('no cambia el orden: restablecer lo devuelve a su lugar', async () => {
    await skipExercise('b');
    await unskipExercise('b');
    expect(S.draft.order).toEqual(['a', 'b', 'c']);
    expect(sessionExs(4).map(e => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('nextPending lo ignora', async () => {
    await skipExercise('a');
    expect(nextPending(sessionExs(4)).id).toBe('b');
  });

  it('saltar el que está en curso lo suelta', async () => {
    S.draft.cur = 'a';
    await skipExercise('a');
    expect(S.draft.cur).toBe(null);
  });

  it('con todo salteado no queda ninguno pendiente', async () => {
    await skipExercise('a'); await skipExercise('b'); await skipExercise('c');
    expect(nextPending(sessionExs(4))).toBe(null);
  });

  it('saltar dos veces no lo duplica', async () => {
    await skipExercise('b'); await skipExercise('b');
    expect(S.draft.skipped).toEqual(['b']);
  });
});

describe('addExtraSet', () => {
  it('sube el techo de a uno', async () => {
    await addExtraSet('a');
    expect(targetSets(ex('a', 'Press', 3))).toBe(4);
    await addExtraSet('a');
    expect(targetSets(ex('a', 'Press', 3))).toBe(5);
  });

  it('reabre un ejercicio que estaba completo', async () => {
    S.draft.entries.a = { name: 'Press', sets: [{ w: 50, r: 10 }, { w: 50, r: 10 }, { w: 50, r: 10 }] };
    expect(nextPending(sessionExs(4)).id).toBe('b');
    await addExtraSet('a');
    expect(nextPending(sessionExs(4)).id).toBe('a');
  });
});

describe('addSessionExercise', () => {
  it('lo agrega al final y al orden, sin tocar la rutina', async () => {
    await addSessionExercise({ name: 'Face pull', sets: 3, reps: 12 });
    expect(S.draft.extras).toHaveLength(1);
    expect(S.draft.order[S.draft.order.length - 1]).toBe(S.draft.extras[0].id);
    expect(S.routine[4].exercises).toHaveLength(3);   // la rutina no se toca
  });

  it('el agregado aparece en sessionExs', async () => {
    await addSessionExercise({ name: 'Face pull', sets: 3, reps: 12 });
    expect(sessionExs(4).map(e => e.name)).toContain('Face pull');
  });
});

describe('replaceSessionExercise', () => {
  it('saltea el viejo y pone el nuevo en su lugar exacto', async () => {
    await replaceSessionExercise('b', { name: 'Remo polea', sets: 3, reps: 10 });
    expect(isSkipped('b')).toBe(true);
    const ids = sessionExs(4).filter(e => !isSkipped(e.id)).map(e => e.name);
    expect(ids).toEqual(['Press', 'Remo polea', 'Curl']);
  });

  it('el reemplazo queda justo donde estaba el original en el orden', async () => {
    await replaceSessionExercise('a', { name: 'Press máquina', sets: 3, reps: 10 });
    const nuevo = S.draft.extras[0];
    expect(S.draft.order.indexOf(nuevo.id)).toBe(1);   // pegado detrás de 'a'
    expect(S.draft.order[0]).toBe('a');
  });
});
