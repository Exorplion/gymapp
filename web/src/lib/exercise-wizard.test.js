import { describe, it, expect } from 'vitest';
import { resolvedCat } from './exercise-wizard.js';

describe('exercise-wizard — grupo muscular detectado', () => {
  it('usa catOf() cuando no hay elección manual', () => {
    expect(resolvedCat({ name: 'Press banca', cat: '' })).toBe('Pecho');
  });

  it('la elección manual gana sobre el automático', () => {
    expect(resolvedCat({ name: 'Press banca', cat: 'Hombro' })).toBe('Hombro');
  });

  it('sin nombre reconocible devuelve vacío, no un grupo inventado', () => {
    expect(resolvedCat({ name: 'Ejercicio raro xyz123', cat: '' })).toBe('');
  });
});
