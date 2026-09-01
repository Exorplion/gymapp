import { S } from './state.js';
import { dayCompleted, currentStreak } from './streak.js';

describe('streak.js — secuencia', () => {
  beforeEach(() => {
    S.routine = [
      { id: 'a', order: 0, type: 'workout', name: 'A', exercises: [{ id: 'e1', name: 'X', sets: 1, reps: 1 }] },
      { id: 'b', order: 1, type: 'rest' },
    ];
    S.sessions = [];
  });

  it('un turno de descanso no cuenta ni corta (null)', () => {
    // seqIndex apunta al descanso en la fecha dada
    S.cfg.seqIndex = 1; S.cfg.seqIndexDate = '2026-08-10';
    expect(dayCompleted('2026-08-10')).toBeNull();
  });

  it('un turno de entrenamiento sin sesión ese día corta (false)', () => {
    S.cfg.seqIndex = 0; S.cfg.seqIndexDate = '2026-08-10';
    expect(dayCompleted('2026-08-10')).toBe(false);
  });

  it('un turno de entrenamiento con sesión guardada ese día cumple (true)', () => {
    S.cfg.seqIndex = 0; S.cfg.seqIndexDate = '2026-08-10';
    S.sessions = [{ id: 's1', date: '2026-08-10', slotId: 'a' }];
    expect(dayCompleted('2026-08-10')).toBe(true);
  });

  it('currentStreak() no cuelga cuando el turno pendiente es descanso (regresión)', () => {
    // dayCompleted() no depende de la fecha pedida — con el turno pendiente
    // en descanso devuelve null para CUALQUIER fecha, así que sin una cota
    // dura en currentStreak() el loop caminaría hacia atrás para siempre.
    S.cfg.seqIndex = 1; S.cfg.seqIndexDate = '2026-08-10';
    S.sessions = [];
    const start = Date.now();
    const n = currentStreak();
    const elapsed = Date.now() - start;
    expect(n).toBe(0);
    expect(elapsed).toBeLessThan(2000);
  });
});
