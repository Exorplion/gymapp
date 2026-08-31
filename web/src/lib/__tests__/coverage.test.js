import { describe, it, expect } from 'vitest';
import { coberturaDe, FIBRAS_DEL_GRUPO } from '../coverage.js';

describe('coberturaDe', () => {
  it('cubre clavicular y costal con inclinado + declinado', () => {
    const c = coberturaDe('Pecho', ['Press inclinado', 'Press declinado']);
    expect(c.cubiertas.sort()).toEqual(['Clavicular', 'Costal'].sort());
    expect(c.faltan).toEqual([]);
  });

  it('marca lo que falta si sólo se elige una fibra', () => {
    const c = coberturaDe('Pecho', ['Press inclinado']);
    expect(c.cubiertas).toEqual(['Clavicular']);
    expect(c.faltan).toEqual(['Costal']);
  });

  it('overhead y pushdown de tríceps cubren cabezas distintas', () => {
    const c = coberturaDe('Tríceps', ['Extensión sobre cabeza', 'Extensión tríceps polea']);
    expect(c.cubiertas.sort()).toEqual(['Tríceps', 'Tríceps cabeza larga'].sort());
  });

  it('devuelve null para grupos sin fibras distinguibles (ej. Bíceps)', () => {
    expect(coberturaDe('Bíceps', ['Curl con barra'])).toBe(null);
  });

  it('no fabrica una distinción entre vasto interno y externo', () => {
    // A propósito: Pierna sólo trackea Femoral/Glúteo acá, no los vastos —
    // ver el comentario de coverage.js sobre por qué.
    expect(FIBRAS_DEL_GRUPO.Pierna).not.toContain('Vasto interno');
    expect(FIBRAS_DEL_GRUPO.Pierna).not.toContain('Vasto externo');
  });

  it('ejercicio desconocido no rompe nada', () => {
    const c = coberturaDe('Pecho', ['Zarandaja voladora']);
    expect(c.cubiertas).toEqual([]);
    expect(c.faltan).toEqual(['Clavicular', 'Costal']);
  });
});
