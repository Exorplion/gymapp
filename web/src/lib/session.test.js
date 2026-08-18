import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from './state.js';

vi.mock('./db.js', () => ({ idb: { put: vi.fn(), del: vi.fn() } }));
vi.mock('./rest.js', () => ({ startRest: vi.fn(), stopRest: vi.fn() }));
vi.mock('./alarm.js', () => ({ pedirPermiso: vi.fn() }));
vi.mock('./carousel.js', () => ({ scrollCarouselTo: vi.fn() }));

import { startSession, completeSession, pendingSlot } from './session.js';

describe('session.js — secuencia', () => {
  beforeEach(() => {
    S.routine = [
      { id: 'a', order: 0, type: 'workout', name: 'Anterior A', exercises: [{ id: 'e1', name: 'Press', sets: 1, reps: 8 }] },
      { id: 'b', order: 1, type: 'rest' },
      { id: 'c', order: 2, type: 'workout', name: 'Posterior', exercises: [{ id: 'e2', name: 'Remo', sets: 1, reps: 8 }] },
    ];
    S.cfg.seqIndex = 0; S.cfg.seqIndexDate = null;
    S.draft = null; S.sessions = [];
  });

  it('startSession abre el draft con slotId (no weekday)', async () => {
    await startSession(0);
    expect(S.draft.slotId).toBe('a');
    expect(S.draft.dayName).toBe('Anterior A');
  });

  it('completeSession avanza seqIndex al turno siguiente', async () => {
    await startSession(0);
    S.draft.entries['e1'] = { name: 'Press', sets: [{ w: 50, r: 8, t: Date.now() }] };
    await completeSession();
    expect(S.cfg.seqIndex).toBe(1); // pasa al descanso
  });

  it('pendingSlot() devuelve el turno en seqIndex', () => {
    S.cfg.seqIndex = 2;
    expect(pendingSlot().id).toBe('c');
  });
});
