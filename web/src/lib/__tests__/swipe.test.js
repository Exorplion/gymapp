import { describe, it, expect } from 'vitest';
import { clasificarSwipe, empiezaExcluido, pintaHorizontal } from '../swipe.js';

describe('clasificarSwipe', () => {
  it('un swipe largo hacia la izquierda avanza', () => {
    expect(clasificarSwipe(-120, 5)).toBe(1);
  });

  it('un swipe largo hacia la derecha retrocede', () => {
    expect(clasificarSwipe(120, 5)).toBe(-1);
  });

  it('por debajo del umbral no es un swipe', () => {
    expect(clasificarSwipe(30, 2)).toBe(null);
  });

  // Un scroll vertical normal también mueve el dedo un poco para los costados
  // — la relación con dy es lo que separa "quiero cambiar de pantalla" de
  // "estoy scrolleando".
  it('más vertical que horizontal no cuenta, aunque el total sea largo', () => {
    expect(clasificarSwipe(70, 200)).toBe(null);
  });

  it('el umbral es inclusive: justo en el límite ya corresponde', () => {
    expect(clasificarSwipe(60, 0)).toBe(-1);
    expect(clasificarSwipe(59, 0)).toBe(null);
  });
});

describe('empiezaExcluido', () => {
  const el = (matches) => ({ closest: () => (matches ? {} : null) });

  it('un toque dentro de algo con su propio gesto horizontal queda excluido', () => {
    expect(empiezaExcluido(el(true))).toBe(true);
  });

  it('un toque en cualquier otro lado no queda excluido', () => {
    expect(empiezaExcluido(el(false))).toBe(false);
  });

  it('sin target no explota', () => {
    expect(empiezaExcluido(null)).toBe(false);
    expect(empiezaExcluido(undefined)).toBe(false);
  });

  it('un target sin .closest (no es un Element) no explota', () => {
    expect(empiezaExcluido({})).toBe(false);
  });
});

describe('pintaHorizontal', () => {
  it('con muy poco movimiento todavía no se sabe (null)', () => {
    expect(pintaHorizontal(3, 2)).toBe(null);
  });

  it('ya pinta horizontal con poco movimiento, mucho antes del umbral de swipe', () => {
    expect(pintaHorizontal(15, 2)).toBe(true);
  });

  it('ya pinta vertical con poco movimiento', () => {
    expect(pintaHorizontal(3, 15)).toBe(false);
  });

  it('vertical dominante aunque el total ya sea grande', () => {
    expect(pintaHorizontal(20, 100)).toBe(false);
  });
});
