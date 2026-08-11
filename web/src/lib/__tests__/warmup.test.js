import { describe, it, expect } from 'vitest';
import { warmupSets, tocaCalentar, bloqueDe, MOVILIDAD, RAMPA, DESCANSO } from '../warmup.js';

const press = { id: 'e1', name: 'Press banca', cat: 'Pecho' };
const sentadilla = { id: 'e2', name: 'Sentadilla', cat: 'Pierna' };
const abs = { id: 'e3', name: 'Crunch', cat: 'Abs' };

describe('warmupSets', () => {
  it('arma las tres series del protocolo: 5, 3 y 1', () => {
    const w = warmupSets(100);
    expect(w).toHaveLength(3);
    expect(w.map(s => s.reps)).toEqual([5, 3, 1]);
    expect(w.map(s => s.pct)).toEqual([0.5, 0.75, 0.9]);
  });

  it('calcula 50, 75 y 90 por ciento del peso de trabajo', () => {
    expect(warmupSets(100).map(s => s.w)).toEqual([50, 75, 90]);
  });

  // Un calentamiento que dice 46.25 kg no se puede armar con discos: te deja
  // haciendo aritmética en vez de levantando.
  it('redondea al incremento que se puede cargar de verdad', () => {
    expect(warmupSets(92.5).map(s => s.w)).toEqual([47.5, 70, 82.5]);
    expect(warmupSets(85).map(s => s.w)).toEqual([42.5, 65, 77.5]);
  });

  it('acepta otro paso, para mancuernas', () => {
    expect(warmupSets(100, 5).map(s => s.w)).toEqual([50, 75, 90]);
    expect(warmupSets(30, 5).map(s => s.w)).toEqual([15, 25, 25]);
  });

  // Redondear un peso liviano puede dar cero, y "calentá con 0 kg" no es una
  // instrucción.
  it('nunca baja de un paso', () => {
    expect(warmupSets(2, 2.5).map(s => s.w)).toEqual([2.5, 2.5, 2.5]);
    expect(warmupSets(4, 2.5)[0].w).toBeGreaterThanOrEqual(2.5);
  });

  it('sin peso de trabajo no inventa nada', () => {
    for (const v of [0, null, undefined, -10, NaN, 'x']) {
      expect(warmupSets(v)).toEqual([]);
    }
  });

  it('la rampa sube y nunca llega al peso de trabajo', () => {
    const w = warmupSets(120);
    expect(w[0].w).toBeLessThan(w[1].w);
    expect(w[1].w).toBeLessThan(w[2].w);
    expect(w[2].w).toBeLessThan(120);
  });

  it('el descanso es el que pidió Enzo: entre dos y medio y tres minutos', () => {
    expect(DESCANSO).toBeGreaterThanOrEqual(150);
    expect(DESCANSO).toBeLessThanOrEqual(180);
    expect(RAMPA).toHaveLength(3);
  });
});

describe('bloqueDe', () => {
  it('pecho, espalda, hombro, brazos y abs son tren superior', () => {
    expect(bloqueDe(press)).toBe('superior');
    expect(bloqueDe(abs)).toBe('superior');
  });

  it('pierna, glúteo y gemelos son tren inferior', () => {
    expect(bloqueDe(sentadilla)).toBe('inferior');
  });

  it('un ejercicio que no se puede clasificar no rompe nada', () => {
    expect(bloqueDe({ id: 'x', name: 'xyz sin grupo' })).toBe(null);
  });
});

describe('MOVILIDAD', () => {
  it('tiene una lista para cada bloque', () => {
    expect(MOVILIDAD.superior.length).toBeGreaterThan(0);
    expect(MOVILIDAD.inferior.length).toBeGreaterThan(0);
  });
});

describe('tocaCalentar', () => {
  const draft = extra => ({ entries: {}, ...extra });

  it('corresponde al primer ejercicio del día', () => {
    expect(tocaCalentar(draft(), press)).toBe(true);
  });

  // El caso que antes no existía: la sesión ya calentó tren superior, pero
  // cruza a piernas — un bloque nuevo, así que corresponde de nuevo.
  it('corresponde otra vez al cruzar de tren superior a inferior', () => {
    expect(tocaCalentar(draft({ warmBlocks: ['superior'] }), sentadilla)).toBe(true);
  });

  it('NO corresponde para otro ejercicio del MISMO bloque ya calentado', () => {
    expect(tocaCalentar(draft({ warmBlocks: ['superior'] }), abs)).toBe(false);
  });

  it('con los dos bloques ya calentados, no vuelve a aparecer para ninguno', () => {
    const d = draft({ warmBlocks: ['superior', 'inferior'] });
    expect(tocaCalentar(d, press)).toBe(false);
    expect(tocaCalentar(d, sentadilla)).toBe(false);
  });

  it('un ejercicio sin grupo reconocible no dispara nada', () => {
    expect(tocaCalentar(draft(), { id: 'x', name: 'xyz sin grupo' })).toBe(false);
  });

  it('sin sesión o sin ejercicio, no', () => {
    expect(tocaCalentar(null, press)).toBe(false);
    expect(tocaCalentar(draft(), null)).toBe(false);
  });

  it('un borrador viejo (warmDone booleano, sin warmBlocks) no rompe', () => {
    expect(tocaCalentar(draft({ warmDone: true }), press)).toBe(true);
  });
});
