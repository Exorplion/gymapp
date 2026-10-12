// La hidratación: en memoria, `name` y `exercises` de cada slot de
// entrenamiento son propiedades de acceso que leen y escriben su turno.
import { describe, it, expect } from 'vitest';
import { esVinculado, hidratar, filaDe, firma } from '../turnos.js';

const ex = (id, name, sets = 3) => ({ id, name, sets, reps: 10 });

function estado() {
  const turno = { id: 'T', name: 'Posterior', exercises: [ex('p1', 'Remo', 4)], creado: '2026-10-12' };
  return {
    turnos: [turno],
    turnosSinVincular: [],
    routine: [
      { id: 's1', order: 0, type: 'workout', turnoId: 'T', turnoFirma: 'vieja', name: 'Posterior', exercises: [ex('p1', 'Remo', 4)] },
      { id: 'r', order: 1, type: 'rest' },
      { id: 's4', order: 2, type: 'workout', turnoId: 'T', name: 'Posterior', exercises: [ex('p1', 'Remo', 4)] },
    ],
  };
}

describe('vincular / hidratar', () => {
  it('dos slots del mismo turno comparten el mismo array de ejercicios', () => {
    const st = estado();
    hidratar(st);
    const [s1, , s4] = st.routine;
    expect(esVinculado(s1) && esVinculado(s4)).toBe(true);
    expect(s1.exercises).toBe(s4.exercises);
    expect(s1.exercises).toBe(st.turnos[0].exercises);
    s1.exercises[0].sets = 2;           // mutar un ejercicio
    expect(s4.exercises[0].sets).toBe(2);
  });

  it('reasignar exercises o name en un slot cae en el turno (las seis reasignaciones del editor)', () => {
    const st = estado();
    hidratar(st);
    const [s1, , s4] = st.routine;
    s4.exercises = [...s4.exercises, ex('p9', 'Curl')];
    s4.name = 'Posterior nuevo';
    expect(st.turnos[0].exercises.map(e => e.name)).toEqual(['Remo', 'Curl']);
    expect(s1.name).toBe('Posterior nuevo');
    expect(s1.exercises).toBe(s4.exercises);
  });

  it('structuredClone, JSON y spread dan datos planos, con la copia del turno', () => {
    const st = estado();
    hidratar(st);
    const plano = structuredClone(st.routine[0]);
    expect(Object.getOwnPropertyDescriptor(plano, 'exercises').get).toBeUndefined();
    expect(plano.exercises).toEqual(st.turnos[0].exercises);
    expect(JSON.parse(JSON.stringify(st.routine[2])).name).toBe('Posterior');
    expect({ ...st.routine[2] }.exercises).toBe(st.turnos[0].exercises);
    // la firma vieja que traía la fila no queda en memoria
    expect('turnoFirma' in st.routine[0]).toBe(false);
  });

  it('filaDe da la fila completa con su firma; un descanso sale tal cual', () => {
    const st = estado();
    hidratar(st);
    const f = filaDe(st.routine[2]);
    expect(f).toEqual({ id: 's4', order: 2, type: 'workout', turnoId: 'T', name: 'Posterior', exercises: st.turnos[0].exercises, turnoFirma: firma(st.turnos[0]) });
    expect(Object.getOwnPropertyDescriptor(f, 'name').get).toBeUndefined();
    expect(filaDe(st.routine[1])).toBe(st.routine[1]);
  });

  it('en el modo viejo (turnos = null) no toca nada', () => {
    const st = { ...estado(), turnos: null };
    const antes = structuredClone(st.routine);
    hidratar(st);
    expect(st.routine).toEqual(antes);
    expect(esVinculado(st.routine[0])).toBe(false);
  });

  it('respeta las filas que tienen que quedar sin vincular (reconciliación postergada)', () => {
    const st = estado();
    st.turnosSinVincular = ['s4'];
    hidratar(st);
    expect(esVinculado(st.routine[0])).toBe(true);
    expect(esVinculado(st.routine[2])).toBe(false);
    expect(st.routine[2].turnoId).toBe('T');   // conserva su turnoId para la próxima
  });

  it('un slot de entrenamiento sin turno (recién creado) recibe uno nuevo', () => {
    const st = estado();
    st.routine.push({ id: 'n', order: 3, type: 'workout', name: '', exercises: [] });
    hidratar(st);
    const n = st.routine[3];
    expect(esVinculado(n)).toBe(true);
    expect(st.turnos).toHaveLength(2);
    expect(n.turnoId).toBe(st.turnos[1].id);
    n.exercises = [ex('z', 'Press')];
    expect(st.turnos[1].exercises).toHaveLength(1);
  });

  it('volver a hidratar es inocuo, y re-vincula si el turno se reemplazó (deshacer)', () => {
    const st = estado();
    hidratar(st);
    hidratar(st);
    expect(st.routine[0].exercises).toBe(st.turnos[0].exercises);
    st.turnos = structuredClone(st.turnos);
    hidratar(st);
    expect(st.routine[0].exercises).toBe(st.turnos[0].exercises);
    expect(st.routine[2].exercises).toBe(st.turnos[0].exercises);
  });
});
