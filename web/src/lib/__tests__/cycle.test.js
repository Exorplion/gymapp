import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { trainedOn, trainingFraction, cycledGoals, cycleExplain } from '../cycle.js';

vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn() } }));

const HOY = '2026-09-10';
const diasAtras = n => {
  const d = new Date(HOY + 'T12:00:00');
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

/** `entrenados` = offsets en días hacia atrás desde HOY. Se agrega siempre una
    sesión vieja de 30 días para que la ventana de historial esté cubierta:
    sin eso trainingFraction() devuelve null a propósito. */
function conSesiones(entrenados) {
  S.sessions = [{ date: diasAtras(30) }, ...entrenados.map(n => ({ date: diasAtras(n) }))];
}

beforeEach(() => {
  S.sessions = [];
  S.cfg.goals = { kcal: 2600, p: 160, c: 280, f: 80 };
});

describe('trainedOn', () => {
  it('sigue las sesiones reales, no lo que la rutina decía que tocaba', () => {
    conSesiones([0, 2]);
    expect(trainedOn(HOY)).toBe(true);
    expect(trainedOn(diasAtras(1))).toBe(false);
  });
});

describe('trainingFraction', () => {
  it('cuenta los días distintos con sesión dentro de la ventana', () => {
    conSesiones([0, 2, 4, 6, 8, 10, 12]); // 7 de 14
    expect(trainingFraction(14, HOY)).toBe(0.5);
  });

  it('dos sesiones el mismo día cuentan como un día', () => {
    S.sessions = [{ date: diasAtras(30) }, { date: HOY }, { date: HOY }, { date: diasAtras(2) }];
    expect(trainingFraction(14, HOY)).toBeCloseTo(2 / 14, 5);
  });

  it('sin historial suficiente devuelve null, no un promedio cómodo', () => {
    S.sessions = [{ date: HOY }]; // la app se estrenó hoy
    expect(trainingFraction(14, HOY)).toBe(null);
  });

  it('sin ninguna sesión devuelve null', () => {
    expect(trainingFraction(14, HOY)).toBe(null);
  });

  it('entrenando TODOS los días devuelve null: no hay descanso contra el cual comparar', () => {
    conSesiones(Array.from({ length: 14 }, (_, i) => i));
    expect(trainingFraction(14, HOY)).toBe(null);
  });
});

describe('cycledGoals', () => {
  it('el día de entreno suma carbos y el de descanso los resta', () => {
    conSesiones([0, 2, 4, 6, 8, 10, 12]); // f = 0.5
    const entreno = cycledGoals(HOY);
    const descanso = cycledGoals(diasAtras(1));
    expect(entreno.tipo).toBe('entreno');
    expect(entreno.deltaCarbs).toBeGreaterThan(0);
    expect(descanso.tipo).toBe('descanso');
    expect(descanso.deltaCarbs).toBeLessThan(0);
  });

  it('LA MEDIA SEMANAL NO SE MUEVE — es toda la premisa del ajuste', () => {
    // Es un cambio de CUÁNDO, no de CUÁNTO: si esto se rompe, ciclar pasa a
    // ser comer de más (o de menos) sin que nadie lo haya pedido, y el
    // déficit del perfil deja de significar lo que dice.
    for (const nEntrenos of [2, 3, 4, 5, 7, 10]) {
      conSesiones(Array.from({ length: nEntrenos }, (_, i) => i * 2).filter(n => n < 14));
      const f = trainingFraction(14, HOY);
      if (f == null) continue;
      const dias = Array.from({ length: 14 }, (_, i) => diasAtras(i));
      const total = dias.reduce((a, d) => a + cycledGoals(d).c, 0);
      const plano = 14 * S.cfg.goals.c;
      // Tolerancia de 14 g: un gramo de redondeo por día como mucho.
      expect(Math.abs(total - plano)).toBeLessThanOrEqual(14);
    }
  });

  it('la proteína y la grasa NO se ciclan', () => {
    conSesiones([0, 2, 4, 6, 8, 10, 12]);
    for (const d of [HOY, diasAtras(1)]) {
      expect(cycledGoals(d).p).toBe(160);
      expect(cycledGoals(d).f).toBe(80);
    }
  });

  it('las calorías se mueven exactamente 4 kcal por gramo de carbo', () => {
    conSesiones([0, 2, 4, 6, 8, 10, 12]);
    const g = cycledGoals(HOY);
    expect(g.kcal - 2600).toBe(g.deltaCarbs * 4);
  });

  it('sin objetivo de carbos devuelve null en vez de ciclar sobre cero', () => {
    conSesiones([0, 2, 4, 6, 8, 10, 12]);
    S.cfg.goals = { kcal: 2600, p: 160, c: 0, f: 80 };
    expect(cycledGoals(HOY)).toBe(null);
  });

  it('sin ritmo de entrenamiento devuelve null y el llamador usa la meta plana', () => {
    expect(cycledGoals(HOY)).toBe(null);
  });
});

describe('cycleExplain', () => {
  it('dice el número concreto y de dónde sale', () => {
    conSesiones([0, 2, 4, 6, 8, 10, 12]);
    const texto = cycleExplain(cycledGoals(HOY));
    expect(texto).toContain('g de carbohidratos');
    expect(texto).toContain('el total de la semana no cambia');
  });
});
