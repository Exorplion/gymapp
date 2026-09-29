// Auditoría total, P2: el eje del gráfico marcaba 54.3 / 56.4 / 58.6 / 60.7.
import { describe, it, expect } from 'vitest';
import { marcasLindas } from '../charts.ts';

describe('marcasLindas', () => {
  it('pasos redondos para el rango de Carga', () => {
    const e = marcasLindas(54.3, 60.7);
    expect(e.paso).toBe(2.5);
    expect(e.marcas).toEqual([52.5, 55, 57.5, 60, 62.5]);
    expect(e.mn).toBeLessThanOrEqual(54.3);
    expect(e.mx).toBeGreaterThanOrEqual(60.7);
  });
  it('peso corporal', () => {
    expect(marcasLindas(73.1, 75.4).marcas).toEqual([73, 74, 75, 76]);
  });
  it('rangos grandes', () => {
    expect(marcasLindas(1800, 2650).marcas).toEqual([1500, 2000, 2500, 3000]);
  });
  it('todas las marcas son múltiplos del paso', () => {
    for (const [a, b] of [[0.3, 0.9], [12, 13], [101, 187], [5.5, 5.8]]) {
      const e = marcasLindas(a, b);
      for (const m of e.marcas) expect(Math.abs(m / e.paso - Math.round(m / e.paso))).toBeLessThan(1e-6);
      expect(e.marcas.length).toBeGreaterThanOrEqual(2);
      expect(e.marcas.length).toBeLessThanOrEqual(6);
    }
  });
});
