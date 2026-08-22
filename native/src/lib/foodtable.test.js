import { FOOD_TABLE, UNITS, NUM_WORDS } from './foodtable.js';

describe('foodtable.js — tabla de alimentos', () => {
  it('FOOD_TABLE no está vacía y cada entrada tiene la forma esperada', () => {
    expect(FOOD_TABLE.length).toBeGreaterThan(0);
    FOOD_TABLE.forEach(it => {
      expect(typeof it.n).toBe('string');
      expect(Array.isArray(it.a)).toBe(true);
      expect(typeof it.kcal).toBe('number');
      expect(typeof it.p).toBe('number');
      expect(typeof it.c).toBe('number');
      expect(typeof it.f).toBe('number');
      expect(typeof it.u).toBe('number');
    });
  });

  it('incluye alimentos conocidos con sus macros', () => {
    const pollo = FOOD_TABLE.find(it => it.n === 'pollo');
    expect(pollo).toBeDefined();
    expect(pollo.kcal).toBe(165);
    expect(pollo.p).toBe(31);
    expect(pollo.u).toBe(150);
  });

  it('UNITS contiene unidades esperadas con su peso en gramos', () => {
    const gramo = UNITS.find(u => u.k.includes('gramo'));
    expect(gramo.g).toBe(1);
    const kilo = UNITS.find(u => u.k.includes('kilo'));
    expect(kilo.g).toBe(1000);
    const plato = UNITS.find(u => u.k.includes('plato'));
    expect(plato.g).toBeNull();
  });

  it('NUM_WORDS mapea números en palabras a valores numéricos', () => {
    expect(NUM_WORDS['dos']).toBe(2);
    expect(NUM_WORDS['medio']).toBe(0.5);
    expect(NUM_WORDS['doce']).toBe(12);
  });
});
