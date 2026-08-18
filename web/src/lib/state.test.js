import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dstr } from './format.js';

vi.mock('./db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn() } }));

import { S, resolveAutoRest } from './state.js';

describe('resolveAutoRest', () => {
  beforeEach(() => {
    S.cfg.seqIndex = 0;
    S.cfg.seqIndexDate = null;
  });

  it('salta VARIOS descansos seguidos en una sola llamada, no uno por vez', () => {
    // Bug real encontrado en review: seqIndexDate se pisaba con "hoy" DENTRO
    // del loop, así que la siguiente vuelta comparaba contra "hoy" en vez de
    // la fecha vieja y el while cortaba después de un solo paso — se
    // comportaba como un `if`. routine=[rest, rest, workout] es el caso que
    // lo destapa: con seqIndex=0 y una fecha vieja, tiene que llegar de una
    // al índice 2 (el workout), no quedarse en el 1 (todavía rest).
    S.routine = [
      { id: 'r1', order: 0, type: 'rest' },
      { id: 'r2', order: 1, type: 'rest' },
      { id: 'w1', order: 2, type: 'workout', name: 'Turno', exercises: [] },
    ];
    S.cfg.seqIndex = 0;
    S.cfg.seqIndexDate = '2000-01-01'; // bien vieja, siempre "antes de hoy"

    resolveAutoRest();

    expect(S.cfg.seqIndex).toBe(2);
    expect(S.routine[S.cfg.seqIndex].type).toBe('workout');
  });

  it('no toca el puntero si el turno pendiente ya es un entrenamiento', () => {
    S.routine = [
      { id: 'w1', order: 0, type: 'workout', name: 'Turno', exercises: [] },
      { id: 'r1', order: 1, type: 'rest' },
    ];
    S.cfg.seqIndex = 0;
    S.cfg.seqIndexDate = '2000-01-01';

    resolveAutoRest();

    expect(S.cfg.seqIndex).toBe(0);
  });

  it('no avanza si seqIndexDate es de hoy (el descanso recién empezó)', () => {
    S.routine = [
      { id: 'r1', order: 0, type: 'rest' },
      { id: 'w1', order: 1, type: 'workout', name: 'Turno', exercises: [] },
    ];
    S.cfg.seqIndex = 0;
    S.cfg.seqIndexDate = dstr();

    resolveAutoRest();

    expect(S.cfg.seqIndex).toBe(0);
  });

  it('rutina 100% descanso: termina sin loop infinito y no rompe el puntero', () => {
    S.routine = [
      { id: 'r1', order: 0, type: 'rest' },
      { id: 'r2', order: 1, type: 'rest' },
      { id: 'r3', order: 2, type: 'rest' },
    ];
    S.cfg.seqIndex = 0;
    S.cfg.seqIndexDate = '2000-01-01';

    expect(() => resolveAutoRest()).not.toThrow();
    expect(S.routine[S.cfg.seqIndex].type).toBe('rest');
  });

  it('inicializa seqIndexDate a hoy si todavía es null y hay rutina', () => {
    S.routine = [{ id: 'w1', order: 0, type: 'workout', name: 'Turno', exercises: [] }];
    S.cfg.seqIndex = 0;
    S.cfg.seqIndexDate = null;

    resolveAutoRest();

    expect(S.cfg.seqIndexDate).toBe(dstr());
  });
});
