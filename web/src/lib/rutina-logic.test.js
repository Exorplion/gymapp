import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from './state.js';
import { ensureSlot, reorderSeq, insertWorkout, insertRest, removeSlot, routineStats, routineName, undoRutina, applyDeload, endDeload, deloadActivo } from './rutina-logic.js';

vi.mock('./db.js', () => ({ idb: { put: vi.fn(), clear: vi.fn(), del: vi.fn(), all: vi.fn() } }));

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
    const { idb } = await import('./db.js');
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


describe('descarga (deload) — aplicar y terminar', () => {
  beforeEach(() => {
    S.cfg.deload = null;
    S.routine = [
      { id: 'a', order: 0, type: 'workout', name: 'Empuje', exercises: [
        { id: 'e1', name: 'Press banca', sets: 4, reps: 8 },
        { id: 'e2', name: 'Curl con barra', sets: 3, reps: 10 },
      ] },
      { id: 'b', order: 1, type: 'workout', name: 'Tirón', exercises: [
        { id: 'e3', name: 'Remo con barra', sets: 5, reps: 8 },
      ] },
    ];
  });

  it('baja las series sólo de los grupos indicados', async () => {
    await applyDeload(['Pecho']);
    expect(S.routine[0].exercises[0].sets).toBeLessThan(4);   // Press banca → Pecho
    expect(S.routine[0].exercises[1].sets).toBe(3);           // Curl → Bíceps, intacto
    expect(S.routine[1].exercises[0].sets).toBe(5);           // Remo → Espalda, intacto
  });

  it('TERMINARLA DEVUELVE EXACTAMENTE LAS SERIES QUE HABÍA', async () => {
    // Es toda la premisa: una descarga a medias es peor que ninguna, porque
    // bajás el volumen y te quedás bajo sin querer. Si esto se rompe, la
    // función deja de ser una descarga y pasa a ser un recorte permanente.
    const antes = JSON.stringify(S.routine.map(sl => sl.exercises.map(e => e.sets)));
    await applyDeload(['Pecho', 'Espalda']);
    expect(JSON.stringify(S.routine.map(sl => sl.exercises.map(e => e.sets)))).not.toBe(antes);
    await endDeload();
    expect(JSON.stringify(S.routine.map(sl => sl.exercises.map(e => e.sets)))).toBe(antes);
  });

  it('nunca deja un ejercicio en menos de una serie', async () => {
    S.routine[0].exercises[0].sets = 1;
    await applyDeload(['Pecho']);
    expect(S.routine[0].exercises[0].sets).toBeGreaterThanOrEqual(1);
  });

  it('no se puede aplicar dos veces encima (la segunda pisaría lo guardado)', async () => {
    await applyDeload(['Pecho']);
    const trasPrimera = S.routine[0].exercises[0].sets;
    expect(await applyDeload(['Pecho'])).toBe(false);
    expect(S.routine[0].exercises[0].sets).toBe(trasPrimera);
  });

  it('un ejercicio borrado durante la descarga no impide terminarla', async () => {
    await applyDeload(['Pecho']);
    S.routine[0].exercises.shift();          // se borró el Press banca
    expect(await endDeload()).toBe(true);
    expect(deloadActivo()).toBe(null);
  });

  it('deloadActivo() es null mientras no haya ninguna', () => {
    expect(deloadActivo()).toBe(null);
  });
});
