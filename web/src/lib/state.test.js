import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dstr } from './format.js';

vi.mock('./db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn() } }));

import { S, resolveAutoRest, esDiaLibre, setDiaLibre } from './state.js';
import { idb } from './db.js';
import { currentStreak } from './streak.js';

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

  it('consume UN descanso por día transcurrido, no todos de una vez', () => {
    // Dos descansos seguidos en la rutina y un solo día calendario pasado:
    // antes se saltaban los dos y la app se adelantaba al plan real.
    const ayer = dstr(new Date(Date.now() - 86400000));
    S.routine = [
      { id: 'r1', order: 0, type: 'rest' },
      { id: 'r2', order: 1, type: 'rest' },
      { id: 'w1', order: 2, type: 'workout', name: 'Turno', exercises: [] },
    ];
    S.cfg.seqIndex = 0;
    S.cfg.seqIndexDate = ayer;

    resolveAutoRest();

    expect(S.cfg.seqIndex).toBe(1);
  });

  it('dos días de descanso sí consumen los dos descansos', () => {
    const anteayer = dstr(new Date(Date.now() - 2 * 86400000));
    S.routine = [
      { id: 'r1', order: 0, type: 'rest' },
      { id: 'r2', order: 1, type: 'rest' },
      { id: 'w1', order: 2, type: 'workout', name: 'Turno', exercises: [] },
    ];
    S.cfg.seqIndex = 0;
    S.cfg.seqIndexDate = anteayer;

    resolveAutoRest();

    expect(S.cfg.seqIndex).toBe(2);
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

/* Días libres declarados — el bug que los trajo: tocar un día del calendario
   y decir "no entrené" no guardaba nada, así que Inicio te seguía diciendo
   "ENTRENAR" el mismo día que habías decidido descansar. */
describe('días libres declarados', () => {
  beforeEach(() => {
    S.cfg.diasLibres = [];
    S.sessions = [];
    S.routine = [
      { id: 'w1', order: 0, type: 'workout', name: 'Posterior A', exercises: [{ id: 'e1' }] },
      { id: 'w2', order: 1, type: 'workout', name: 'Anterior A', exercises: [{ id: 'e2' }] },
    ];
    S.cfg.seqIndex = 0;
    S.cfg.seqIndexDate = null;
  });

  it('registrar un día libre lo deja marcado y lo persiste', async () => {
    await setDiaLibre('2026-09-21');
    expect(esDiaLibre('2026-09-21')).toBe(true);
    expect(idb.put).toHaveBeenCalledWith('settings', { key: 'cfg', value: S.cfg });
  });

  it('se puede deshacer', async () => {
    await setDiaLibre('2026-09-21');
    await setDiaLibre('2026-09-21', false);
    expect(esDiaLibre('2026-09-21')).toBe(false);
  });

  it('no duplica si lo marcás dos veces', async () => {
    await setDiaLibre('2026-09-21');
    await setDiaLibre('2026-09-21');
    expect(S.cfg.diasLibres).toEqual(['2026-09-21']);
  });

  it('un cfg viejo sin la clave no rompe la lectura', () => {
    delete S.cfg.diasLibres;
    expect(esDiaLibre('2026-09-21')).toBe(false);
  });

  it('NO corre el puntero de la secuencia: mañana te toca el mismo turno', async () => {
    await setDiaLibre(dstr());
    expect(S.cfg.seqIndex).toBe(0);
    expect(S.routine[S.cfg.seqIndex].name).toBe('Posterior A');
    /* Y el paso del tiempo tampoco lo corre: resolveAutoRest sólo consume
       turnos de tipo 'rest', y el pendiente es un entrenamiento. */
    S.cfg.seqIndexDate = '2000-01-01';
    resolveAutoRest();
    expect(S.routine[S.cfg.seqIndex].name).toBe('Posterior A');
  });

  it('no toca la racha: un día sin sesión ya era descanso, declararlo no cambia nada', async () => {
    const hoy = dstr();
    const ayer = dstr(new Date(Date.now() - 86400000));
    S.sessions = [{ id: 's1', date: ayer }];
    const antes = currentStreak();
    await setDiaLibre(hoy);
    expect(currentStreak()).toBe(antes);
  });
});
