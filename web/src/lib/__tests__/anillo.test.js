import { describe, it, expect } from 'vitest';
import { tramosAnillo, progresoEn, curva } from '../anillo.js';

/* El anillo del descanso lo dibuja un worker en un OffscreenCanvas (G3,
   auditoría 2026-09): cualquier animación en el hilo principal —aunque sea
   UNA sola, lineal— obliga a recorrer el ciclo de pintado de toda la página
   en cada frame (medido a 6×: ~800 ms ocupados por segundo). El worker no
   tiene CSS que le resuelva los keyframes, así que la cuenta vive acá. */
describe('curva (cubic-bezier)', () => {
  it('linear es la identidad', () => {
    const f = curva('linear');
    for (const x of [0, 0.25, 0.5, 0.9, 1]) expect(f(x)).toBeCloseTo(x, 6);
  });

  it('respeta los extremos y es monótona', () => {
    const f = curva('cubic-bezier(.4,0,.2,1)');
    expect(f(0)).toBe(0);
    expect(f(1)).toBe(1);
    let prev = 0;
    for (let i = 1; i <= 20; i++) { const y = f(i / 20); expect(y).toBeGreaterThanOrEqual(prev); prev = y; }
  });

  it('coincide con la curva estándar de CSS en el medio', () => {
    // cubic-bezier(.4,0,.2,1) en x=.5 vale ≈ .7756 (bisección sobre la curva)
    expect(curva('cubic-bezier(.4,0,.2,1)')(0.5)).toBeCloseTo(0.7756, 3);
  });
});

describe('progresoEn: el anillo en un instante del tramo', () => {
  it('tramo lineal: baja parejo hasta cero', () => {
    const k = tramosAnillo({ previo: 0.5, desde: 0.5, ms: 45000 });
    expect(progresoEn(k, 0)).toBeCloseTo(0.5, 6);
    expect(progresoEn(k, 0.5)).toBeCloseTo(0.25, 6);
    expect(progresoEn(k, 1)).toBe(0);
  });

  it('con llegada: arranca en el valor anterior y empalma sin escalón', () => {
    const k = tramosAnillo({ previo: 0.5, desde: 1, ms: 60000, llegada: 900 });
    expect(progresoEn(k, 0)).toBeCloseTo(0.5, 6);
    const empalme = 900 / 60000;
    expect(progresoEn(k, empalme)).toBeCloseTo(k[1].p, 6);
    expect(progresoEn(k, empalme + 1e-6)).toBeCloseTo(k[1].p, 4);
    expect(progresoEn(k, 1)).toBe(0);
  });

  it('antes y después del tramo se queda en los extremos', () => {
    const k = tramosAnillo({ previo: 1, desde: 1, ms: 1000 });
    expect(progresoEn(k, -1)).toBe(1);
    expect(progresoEn(k, 2)).toBe(0);
  });
});
