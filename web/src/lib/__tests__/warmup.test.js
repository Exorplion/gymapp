import { describe, it, expect } from 'vitest';
import { warmupSets, tocaCalentar, RAMPA, DESCANSO } from '../warmup.js';

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

describe('tocaCalentar', () => {
  const draft = extra => ({ entries: {}, ...extra });

  it('corresponde al abrir la sesión, antes de registrar nada', () => {
    expect(tocaCalentar(draft(), 'e1')).toBe(true);
  });

  // Con una serie ya hecha el momento pasó: la tarjeta dejaría de ser un
  // recordatorio para ser un estorbo.
  it('no corresponde si ya registraste una serie', () => {
    expect(tocaCalentar(draft({ entries: { e1: { sets: [{ w: 60, r: 8 }] } } }), 'e1')).toBe(false);
  });

  it('una entrada sin series todavía no cuenta como empezado', () => {
    expect(tocaCalentar(draft({ entries: { e1: { sets: [] } } }), 'e1')).toBe(true);
  });

  it('no vuelve a aparecer si ya lo hiciste o lo saltaste', () => {
    expect(tocaCalentar(draft({ warmDone: true }), 'e1')).toBe(false);
  });

  it('sin sesión o sin ejercicio, no', () => {
    expect(tocaCalentar(null, 'e1')).toBe(false);
    expect(tocaCalentar(draft(), null)).toBe(false);
  });
});
