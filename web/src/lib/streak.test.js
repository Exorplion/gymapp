import { describe, it, expect, beforeEach } from 'vitest';
import { S } from './state.js';
import { currentStreak, bestStreak, streakHeatmap, toleranciaDescanso, dayTrained } from './streak.js';
import { dstr } from './format.js';

const hace = n => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dstr(d);
};
/** `dias` = cuántos días atrás. 0 = hoy. */
const entrenoEn = (...dias) => { S.sessions = dias.map(n => ({ id: `s${n}`, date: hace(n) })); };

const EX = [{ id: 'e1', name: 'X', sets: 1, reps: 1 }];
const workout = id => ({ id, order: 0, type: 'workout', name: id, exercises: EX });
const rest = id => ({ id, order: 0, type: 'rest' });

beforeEach(() => {
  // Alterna entreno / descanso: la tolerancia queda en 2 (un descanso + un día
  // de respiro).
  S.routine = [workout('a'), rest('b')];
  S.sessions = [];
});

describe('toleranciaDescanso', () => {
  it('sale de la tanda más larga de descansos de TU rutina, más un día', () => {
    expect(toleranciaDescanso()).toBe(2);                       // 1 descanso + 1
    S.routine = [workout('a'), rest('b'), rest('c')];
    expect(toleranciaDescanso()).toBe(3);                       // 2 descansos + 1
  });

  it('una rutina sin descansos igual deja saltarse un día', () => {
    S.routine = [workout('a'), workout('b')];
    expect(toleranciaDescanso()).toBe(1);
  });

  it('cuenta la tanda que cruza el final de la secuencia: es circular', () => {
    // rest, workout, rest → los dos descansos son consecutivos dando la vuelta.
    S.routine = [rest('a'), workout('b'), rest('c')];
    expect(toleranciaDescanso()).toBe(3);
  });

  it('sin rutina no explota', () => {
    S.routine = [];
    expect(toleranciaDescanso()).toBe(1);
  });
});

describe('currentStreak', () => {
  it('sin sesiones es 0', () => {
    expect(currentStreak()).toBe(0);
  });

  it('entrenar hoy es una racha de 1', () => {
    entrenoEn(0);
    expect(currentStreak()).toBe(1);
  });

  it('EL DESCANSO NO CORTA: días alternados cuentan todos', () => {
    // Es el punto que pidió Enzo — "si un día no se entrenó automáticamente
    // califica como descanso". Entrené hoy, anteayer y hace 4 días: los días
    // sin ir del medio están dentro de la tolerancia, así que la racha son los
    // 5 días corridos, no 3 sesiones sueltas.
    entrenoEn(0, 2, 4);
    expect(currentStreak()).toBe(5);
  });

  it('un hueco más largo que la tolerancia corta la racha ahí', () => {
    // Tolerancia 2: tres días seguidos sin entrenar (1, 2, 3) es una falta.
    entrenoEn(0, 4);
    expect(currentStreak()).toBe(1);
  });

  it('no haber entrenado HOY no rompe nada: seguís a tiempo', () => {
    entrenoEn(1);
    expect(currentStreak()).toBe(2);
  });

  it('pero si ya pasaste la tolerancia sin ir, la racha es 0', () => {
    entrenoEn(3);   // hoy, ayer y anteayer sin entrenar, con tolerancia 2
    expect(currentStreak()).toBe(0);
  });

  it('con más descansos en la rutina, aguanta más', () => {
    S.routine = [workout('a'), rest('b'), rest('c'), rest('d')];  // tolerancia 4
    entrenoEn(3);
    expect(currentStreak()).toBe(4);
  });

  it('una sesión parcial cuenta igual: ir es ir', () => {
    // La racha mira la FECHA, no cuántas series hiciste — incluidas las
    // anotadas a mano, que no tienen series.
    S.sessions = [{ id: 'r', date: hace(0), entries: [], retro: true }];
    expect(currentStreak()).toBe(1);
  });

  it('dos sesiones el mismo día no cuentan doble', () => {
    S.sessions = [{ id: 'a', date: hace(0) }, { id: 'b', date: hace(0) }];
    expect(currentStreak()).toBe(1);
  });
});

describe('bestStreak', () => {
  it('encuentra la mejor tanda aunque la actual esté cortada', () => {
    // Tres días seguidos hace tiempo, después un hueco enorme, después hoy.
    S.sessions = [
      { id: '1', date: hace(30) }, { id: '2', date: hace(29) }, { id: '3', date: hace(28) },
      { id: '4', date: hace(0) },
    ];
    expect(bestStreak()).toBe(3);
    expect(currentStreak()).toBe(1);
  });

  it('nunca es menor que la racha actual', () => {
    entrenoEn(0, 2, 4);
    expect(bestStreak()).toBeGreaterThanOrEqual(currentStreak());
  });
});

describe('streakHeatmap', () => {
  it('distingue descanso de falta: un día suelto sin ir NO es una falta', () => {
    entrenoEn(0, 2);
    const m = streakHeatmap();
    const de = f => m.days.find(d => d.date === f)?.status;
    expect(de(hace(0))).toBe('done');
    expect(de(hace(1))).toBe('rest');   // dentro de la tolerancia
    expect(de(hace(2))).toBe('done');
  });

  it('una tanda más larga que la tolerancia sí se marca como falta', () => {
    entrenoEn(0, 6);
    const m = streakHeatmap();
    for (const n of [1, 2, 3, 4, 5]) {
      expect(m.days.find(d => d.date === hace(n)).status, `hace ${n}`).toBe('miss');
    }
  });

  it('devuelve 56 días y un porcentaje entre 0 y 100', () => {
    entrenoEn(0, 2, 4);
    const m = streakHeatmap();
    expect(m.days).toHaveLength(56);
    expect(m.pct).toBeGreaterThanOrEqual(0);
    expect(m.pct).toBeLessThanOrEqual(100);
  });
});

describe('dayTrained', () => {
  it('es exactamente "hay una sesión con esa fecha"', () => {
    entrenoEn(1);
    expect(dayTrained(hace(1))).toBe(true);
    expect(dayTrained(hace(0))).toBe(false);
  });
});
