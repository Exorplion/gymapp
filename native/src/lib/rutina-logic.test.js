import { S } from './state.js';
import { ensureSlot, reorderSeq, insertWorkout, insertRest, removeSlot, routineStats, routineName, undoRutina } from './rutina-logic.js';
import { idb } from './db.js';

jest.mock('./db.js', () => ({ idb: { put: jest.fn(), clear: jest.fn(), del: jest.fn(), all: jest.fn() } }));

describe('rutina-logic — secuencia', () => {
  beforeEach(() => {
    S.routine = [
      { id: 'a', order: 0, type: 'workout', name: 'Anterior A', exercises: [{ id: 'e1', name: 'Press', sets: 4, reps: 8 }] },
      { id: 'b', order: 1, type: 'workout', name: 'Posterior', exercises: [{ id: 'e2', name: 'Remo', sets: 4, reps: 10 }] },
      { id: 'c', order: 2, type: 'rest' },
    ];
    S.cfg.routineName = '';
  });

  it('reorderSeq mueve un turno de una posición a otra y reindexa order', () => {
    reorderSeq(0, 2); // Anterior A pasa al final
    expect(S.routine.map(s => s.id)).toEqual(['b', 'c', 'a']);
    expect(S.routine.map(s => s.order)).toEqual([0, 1, 2]);
  });

  it('insertWorkout agrega un turno vacío tipo workout en la posición dada', () => {
    insertWorkout(1);
    expect(S.routine[1].type).toBe('workout');
    expect(S.routine[1].exercises).toEqual([]);
    expect(S.routine.map(s => s.order)).toEqual([0, 1, 2, 3]);
  });

  it('insertRest agrega un descanso en la posición dada', () => {
    insertRest(0);
    expect(S.routine[0].type).toBe('rest');
    expect(S.routine.length).toBe(4);
  });

  it('removeSlot saca el turno y reindexa', () => {
    removeSlot(1);
    expect(S.routine.map(s => s.id)).toEqual(['a', 'c']);
    expect(S.routine.map(s => s.order)).toEqual([0, 1]);
  });

  it('ensureSlot crea un turno workout vacío si el índice no existe todavía', () => {
    const s = ensureSlot(5);
    expect(s.type).toBe('workout');
    expect(S.routine[5]).toBe(s);
  });

  it('routineStats cuenta turnos workout/rest y totales de ejercicios/series', () => {
    const st = routineStats();
    expect(st.workoutCount).toBe(2);
    expect(st.restCount).toBe(1);
    expect(st.ex).toBe(2);
    expect(st.sets).toBe(8);
  });

  it('routineName usa S.cfg.routineName o cae a un default según si hay turnos workout', () => {
    expect(routineName()).toBe('Rutina personalizada');
    S.routine = [{ id: 'x', order: 0, type: 'rest' }];
    expect(routineName()).toBe('Sin rutina');
  });

  it('undoRutina no tira ReferenceError tras un mutator nuevo (regresión: usaba persistDay, que este task borró)', async () => {
    idb.clear.mockClear(); idb.put.mockClear();
    await insertRest(0); // pushHistory + persistAll ya corrieron acá sin explotar
    expect(S.routine.length).toBe(4);
    idb.clear.mockClear(); idb.put.mockClear();
    await expect(undoRutina()).resolves.not.toThrow();
    // persistAll (no persistDay) es lo que debe haber corrido: clear + put por cada turno
    expect(idb.clear).toHaveBeenCalledWith('routine');
    expect(idb.put).toHaveBeenCalled();
  });
});
