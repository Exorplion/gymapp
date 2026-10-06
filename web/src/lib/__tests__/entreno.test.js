import { describe, it, expect, beforeEach } from 'vitest';
import { S } from '../state.js';
import {
  turnoQueToca, turnoElegido, marcaDeTurno, seriesPorZonaDeTurno, seriesSemanaDelPlan,
  progresoDeEjercicio, turnosDeEjercicio, indicesDeTurnos, minutosDeTurno,
} from '../entreno.js';

const W = (id, name, exs) => ({ id, type: 'workout', name, exercises: exs.map(([n, sets], i) => ({ id: `${id}-${i}`, name: n, sets, reps: 9 })) });
const R = id => ({ id, type: 'rest' });
const RUTINA = [
  W('a', 'Anterior A', [['Press banca', 3], ['Leg press', 3]]),
  W('b', 'Posterior A', [['Jalón al pecho', 4], ['Curl femoral sentado', 2]]),
  R('r1'),
  W('c', 'Anterior B', [['Press banca', 2]]),
  R('r2'), R('r3'), R('r4'),
];

const ses = (date, name, w, extra = {}) => ({ id: date + name, date, slotId: extra.slotId, duration: extra.duration, entries: [{ name, sets: [{ w, r: 8 }, { w: w - 5, r: 8 }] }] });

beforeEach(() => {
  S.routine = RUTINA;
  S.cfg.seqIndex = 0;
  S.rutOpen = null;
  S.sessions = [];
});

describe('qué turno se muestra', () => {
  it('el pendiente si es de entrenamiento', () => {
    S.cfg.seqIndex = 1;
    expect(turnoQueToca()).toBe(1);
    expect(marcaDeTurno(1)).toBe('hoy');
  });
  it('si el pendiente es un descanso, el turno que sigue, marcado "sigue"', () => {
    S.cfg.seqIndex = 2;
    expect(turnoQueToca()).toBe(3);
    expect(marcaDeTurno(3)).toBe('sigue');
    expect(marcaDeTurno(0)).toBe(null);
  });
  it('da la vuelta al final del ciclo', () => {
    S.cfg.seqIndex = 5;
    expect(turnoQueToca()).toBe(0);
  });
  it('S.rutOpen gana sólo si apunta a un entrenamiento', () => {
    S.rutOpen = 3;
    expect(turnoElegido()).toBe(3);
    S.rutOpen = 2;
    expect(turnoElegido()).toBe(0);
  });
  it('sin turnos, -1', () => {
    S.routine = [R('x')];
    expect(turnoQueToca()).toBe(-1);
    expect(indicesDeTurnos()).toEqual([]);
  });
});

describe('series por zona', () => {
  it('el turno suma series por zona, de mayor a menor', () => {
    expect(seriesPorZonaDeTurno(RUTINA[1])).toEqual([['Dorsal bajo', 4], ['Femoral', 2]]);
  });
  it('el plan, por semana con un ciclo de 7', () => {
    const { filas, factor, sinEntrenar } = seriesSemanaDelPlan();
    expect(factor).toBe(1);
    expect(filas.find(f => f.zona === 'Pecho').series).toBe(5);
    expect(sinEntrenar).toContain('Gemelos');
    expect(sinEntrenar).not.toContain('Pecho');
  });
  it('un ciclo de otra duración se lleva a 7 días y lo dice', () => {
    S.routine = RUTINA.slice(0, 4); // 4 días
    const { filas, factor, dias } = seriesSemanaDelPlan();
    expect(dias).toBe(4);
    expect(factor).toBeCloseTo(7 / 4);
    expect(filas.find(f => f.zona === 'Pecho').series).toBe(Math.round(5 * 7 / 4));
  });
});

describe('peso y progreso de un ejercicio', () => {
  it('sin registro, null: no se inventa un peso', () => {
    expect(progresoDeEjercicio('Press banca')).toBe(null);
  });
  it('último peso (la serie más pesada) sin tendencia si no hay 3 semanas', () => {
    S.sessions = [ses('2026-10-05', 'Press banca', 60), ses('2026-09-28', 'Press banca', 57.5)];
    expect(progresoDeEjercicio('Press banca')).toEqual({ kg: 60, delta: null, semanas: null });
  });
  it('compara contra la sesión más nueva de hace 3+ semanas', () => {
    S.sessions = [ses('2026-10-05', 'Press banca', 60), ses('2026-09-14', 'Press banca', 55), ses('2026-09-01', 'Press banca', 50)];
    expect(progresoDeEjercicio('press banca')).toEqual({ kg: 60, delta: 5, semanas: 3 });
  });
  it('en qué turnos está, por nombre', () => {
    expect(turnosDeEjercicio('Press banca').map(t => t.id)).toEqual(['a', 'c']);
  });
  it('minutos: la última vez, o ~3 por serie', () => {
    expect(minutosDeTurno(RUTINA[0])).toBe(20);
    S.sessions = [{ slotId: 'a', duration: 52, date: '2026-10-05', entries: [] }];
    expect(minutosDeTurno(RUTINA[0])).toBe(50);
  });
});
