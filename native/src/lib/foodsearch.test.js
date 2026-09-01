import { S } from './state.js';
import { defaultGrams, macrosFor, foodIndex, searchFoods } from './foodsearch.js';

describe('foodsearch.js — índice y búsqueda de alimentos', () => {
  beforeEach(() => {
    S.foods = [];
    S.meals = [];
  });

  describe('defaultGrams()', () => {
    it('devuelve el unit del alimento si existe', () => {
      expect(defaultGrams({ unit: 200 })).toBe(200);
    });
    it('devuelve 100 si no hay unit', () => {
      expect(defaultGrams({})).toBe(100);
      expect(defaultGrams(null)).toBe(100);
    });
  });

  describe('macrosFor()', () => {
    it('escala por 100g cuando base es "100g"', () => {
      const food = { kcal: 165, p: 31, c: 0, f: 3.6, base: '100g', unit: 150 };
      const m = macrosFor(food, 300);
      expect(m.kcal).toBe(495); // 300/100 * 165
      expect(m.p).toBe(93); // 300/100 * 31
    });

    it('escala por unit (porción) cuando base no es "100g"', () => {
      const food = { kcal: 200, p: 10, c: 20, f: 5, base: 'portion', unit: 200 };
      const m = macrosFor(food, 200);
      expect(m).toEqual({ kcal: 200, p: 10, c: 20, f: 5 });
    });

    it('no explota con food null/undefined', () => {
      expect(macrosFor(null, 100)).toEqual({ kcal: 0, p: 0, c: 0, f: 0 });
      expect(macrosFor(undefined, 100)).toEqual({ kcal: 0, p: 0, c: 0, f: 0 });
    });
  });

  describe('foodIndex()', () => {
    it('devuelve la tabla incorporada cuando no hay alimentos propios', () => {
      const idx = foodIndex();
      expect(idx.length).toBeGreaterThan(0);
      expect(idx.every(f => f.source === 'table')).toBe(true);
    });

    it('tus alimentos ganan sobre la tabla con el mismo nombre normalizado', () => {
      S.foods = [{ id: '1', name: 'Pollo', kcal: 999, p: 1, c: 1, f: 1 }];
      const idx = foodIndex();
      const pollo = idx.find(f => f.key === 'pollo');
      expect(pollo.source).toBe('mine');
      expect(pollo.kcal).toBe(999);
    });

    it('deduplica por nombre normalizado', () => {
      S.foods = [{ id: '1', name: 'Pollo' }, { id: '2', name: 'pollo' }];
      const idx = foodIndex();
      expect(idx.filter(f => f.key === 'pollo').length).toBe(1);
    });
  });

  describe('searchFoods()', () => {
    it('con query vacía y sin uso previo, devuelve []', () => {
      expect(searchFoods('')).toEqual([]);
    });

    it('con query vacía devuelve sugerencias por frecuencia de uso', () => {
      S.meals = [
        { name: 'pollo', date: '2026-08-01', slot: 'almuerzo' },
        { name: 'pollo', date: '2026-08-02', slot: 'almuerzo' },
        { name: 'arroz', date: '2026-08-01', slot: 'almuerzo' },
      ];
      const result = searchFoods('', { slot: 'almuerzo' });
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].key).toBe('pollo');
    });

    it('busca por coincidencia exacta primero', () => {
      const result = searchFoods('pollo');
      expect(result[0].key).toBe('pollo');
    });

    it('prioriza nombre sobre alias en el desempate ("po" -> pollo antes que pizza)', () => {
      const result = searchFoods('po');
      expect(result[0].key).toBe('pollo');
    });

    it('sin coincidencias devuelve []', () => {
      expect(searchFoods('xyzxyzxyz')).toEqual([]);
    });
  });
});
