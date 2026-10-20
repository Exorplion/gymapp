// RIR propio por ejercicio y "Fallo" separado de RIR 0 (Enzo, 2026-10-20).
// Spec: docs/superpowers/specs/2026-10-20-importar-rutina-y-rir-design.md
import { describe, it, expect } from 'vitest';
import { rirDeEjercicio, rirPedido, rpeFromRir, rirLabel, rirCorto, RIR_OPTS, FALLO } from '../rir.js';

describe('rirDeEjercicio', () => {
  it('sin rir propio usa la regla de la app', () => {
    expect(rirDeEjercicio({ name: 'Press banca', sets: 4 })).toEqual([3, 2, 1, 0]);
  });
  it('con rir del largo justo lo devuelve tal cual', () => {
    expect(rirDeEjercicio({ name: 'Press banca', sets: 3, rir: [2, 2, 'F'] })).toEqual([2, 2, 'F']);
  });
  it('más series que valores repite el último', () => {
    expect(rirDeEjercicio({ name: 'x', sets: 4, rir: [3, 1] })).toEqual([3, 1, 1, 1]);
  });
  it('menos series recorta', () => {
    expect(rirDeEjercicio({ name: 'x', sets: 2, rir: [3, 2, 1] })).toEqual([3, 2]);
  });
  it('n pisa ex.sets (series reales en la sesión)', () => {
    expect(rirDeEjercicio({ name: 'x', sets: 3, rir: [2] }, 5)).toEqual([2, 2, 2, 2, 2]);
  });
  it('un rir vacío vale como automático', () => {
    expect(rirDeEjercicio({ name: 'Press banca', sets: 2, rir: [] })).toEqual([1, 0]);
  });
});

describe('Fallo', () => {
  it('es la primera opción y no es el 0', () => {
    expect(RIR_OPTS).toEqual([FALLO, 0, 1, 2, 3, 4]);
    expect(rirLabel(FALLO)).toBe('Fallo');
    expect(rirLabel(0)).toBe('0');
    expect(rirCorto(FALLO)).toBe('F');
    expect(rirCorto(4)).toBe('4+');
  });
  it('se guarda como rpe 10', () => {
    expect(rpeFromRir(FALLO)).toBe(10);
    expect(rpeFromRir(0)).toBe(10);
  });
  it('rirPedido lo deja pasar', () => {
    expect(rirPedido([2, 'F'], 1)).toBe('F');
    expect(rirPedido([2, 'F'], 9)).toBe('F');
    expect(rirPedido([6], 0)).toBe(4);
  });
});
