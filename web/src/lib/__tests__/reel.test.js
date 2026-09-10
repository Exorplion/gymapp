import { describe, it, expect } from 'vitest';
import { reelValues } from '../reel.js';

describe('reelValues', () => {
  it('no repite el valor del piso (el "1" que se repetía muchas veces)', () => {
    // Reps: step 1, mínimo 1, con el valor ya en el piso. Antes cada diente
    // por debajo del mínimo se recortaba a 1 y la rueda mostraba veinte "1"
    // seguidos, así que arrastrar hacia abajo no hacía nada visible.
    const vals = reelValues(1, 1, 1);
    expect(new Set(vals).size).toBe(vals.length);
    expect(Math.min(...vals)).toBe(1);
  });

  it('mantiene la cantidad de dientes aunque el centro esté en el piso', () => {
    expect(reelValues(1, 1, 1)).toHaveLength(41);
    expect(reelValues(0.5, 2.5, 0.5, 41)).toHaveLength(41);
  });

  it('el piso se redondea al primer múltiplo de step (rueda gruesa)', () => {
    // Con mínimo 0.5 kg y pasos de 2.5, los dientes siguen siendo múltiplos.
    const vals = reelValues(2.5, 2.5, 0.5);
    expect(vals[0]).toBe(2.5);
    expect(vals.every(v => Math.abs(v / 2.5 - Math.round(v / 2.5)) < 1e-9)).toBe(true);
  });

  it('con el centro lejos del piso sigue centrado como antes', () => {
    const vals = reelValues(60, 2.5, 0.5);
    expect(vals[Math.floor(vals.length / 2)]).toBe(60);
  });

  it('nunca devuelve valores por debajo del mínimo', () => {
    expect(Math.min(...reelValues(2, 1, 1))).toBeGreaterThanOrEqual(1);
  });
});
