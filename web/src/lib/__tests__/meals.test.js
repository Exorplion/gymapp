import { describe, it, expect, beforeEach } from 'vitest';
import { S } from '../state.js';
import { slotForTime, slotOf, mealsBySlot } from '../meals.js';

describe('slotForTime', () => {
  it('reparte el día en cuatro momentos', () => {
    expect(slotForTime('07:30')).toBe('desayuno');
    expect(slotForTime('10:59')).toBe('desayuno');
    expect(slotForTime('11:00')).toBe('almuerzo');
    expect(slotForTime('15:59')).toBe('almuerzo');
    expect(slotForTime('16:00')).toBe('cena');
    expect(slotForTime('20:59')).toBe('cena');
    expect(slotForTime('21:00')).toBe('snack');
    expect(slotForTime('02:00')).toBe('desayuno');
  });

  it('sin hora cae en snack', () => {
    expect(slotForTime('')).toBe('snack');
    expect(slotForTime(undefined)).toBe('snack');
  });
});

describe('slotOf', () => {
  it('usa el slot guardado si existe', () => {
    expect(slotOf({ slot: 'cena', t: '08:00' })).toBe('cena');
  });

  it('lo infiere de la hora si la comida es vieja y no lo tiene', () => {
    expect(slotOf({ t: '08:00' })).toBe('desayuno');
  });
});

describe('mealsBySlot', () => {
  beforeEach(() => { S.meals = []; });

  it('agrupa el día en bloques con su subtotal, en orden canónico', () => {
    S.meals = [
      { id: '1', date: '2026-08-04', name: 'Cena', t: '20:00', kcal: 700, p: 40, c: 60, f: 20 },
      { id: '2', date: '2026-08-04', name: 'Avena', t: '08:00', kcal: 300, p: 10, c: 50, f: 6 },
      { id: '3', date: '2026-08-04', name: 'Huevos', t: '08:30', kcal: 200, p: 18, c: 1, f: 14 },
      { id: '4', date: '2026-08-03', name: 'Otro día', t: '08:00', kcal: 999, p: 0, c: 0, f: 0 },
    ];
    const b = mealsBySlot('2026-08-04');
    expect(b.map(x => x.k)).toEqual(['desayuno', 'cena']);
    expect(b[0].kcal).toBe(500);
    expect(b[0].meals).toHaveLength(2);
    expect(b[1].kcal).toBe(700);
  });

  it('respeta el slot guardado por encima de la hora', () => {
    S.meals = [{ id: '1', date: '2026-08-04', name: 'Post-entreno', t: '08:00', slot: 'snack', kcal: 200, p: 20, c: 10, f: 2 }];
    expect(mealsBySlot('2026-08-04').map(x => x.k)).toEqual(['snack']);
  });

  it('un día sin comidas no devuelve bloques', () => {
    expect(mealsBySlot('2026-08-04')).toEqual([]);
  });
});
