import { describe, it, expect, beforeEach } from 'vitest';
import { S } from '../state.js';
import { foodIndex, searchFoods, macrosFor, defaultGrams } from '../foodsearch.js';

beforeEach(() => { S.foods = []; S.meals = []; });

describe('foodIndex', () => {
  it('incluye la tabla incorporada', () => {
    expect(foodIndex().some(f => f.name === 'pollo')).toBe(true);
  });

  it('tus alimentos ganan sobre la tabla con el mismo nombre', () => {
    S.foods = [{ id: '1', name: 'Pollo', kcal: 999, p: 1, c: 1, f: 1, base: '100g' }];
    const pollos = foodIndex().filter(f => f.key === 'pollo');
    expect(pollos).toHaveLength(1);
    expect(pollos[0].kcal).toBe(999);
    expect(pollos[0].source).toBe('mine');
  });

  it('un alimento viejo sin base se lee como porción', () => {
    S.foods = [{ id: '1', name: 'Mi batido', kcal: 300, p: 30, c: 20, f: 5 }];
    expect(foodIndex().find(f => f.key === 'mi batido').base).toBe('portion');
  });
});

describe('searchFoods', () => {
  it('el prefijo exacto va primero', () => {
    expect(searchFoods('pollo')[0].name).toBe('pollo');
  });

  it('encuentra por alias', () => {
    expect(searchFoods('pechuga').some(f => f.name === 'pollo')).toBe(true);
  });

  it('un match por nombre le gana a uno por alias de la misma calidad', () => {
    // "po" es prefijo del nombre "pollo", y también de los alias "porción de
    // pizza" y "porotos". Quien escribe "po" quiere pollo, no pizza.
    const r = searchFoods('po').map(f => f.name);
    expect(r[0]).toBe('pollo');
    expect(r.indexOf('pollo')).toBeLessThan(r.indexOf('pizza'));
    expect(r.indexOf('pollo')).toBeLessThan(r.indexOf('frijoles'));
  });

  it('el nombre más corto gana entre dos que empiezan igual', () => {
    const r = searchFoods('pollo').map(f => f.name);
    expect(r.indexOf('pollo')).toBeLessThan(r.indexOf('pollo a la brasa'));
  });

  it('ignora acentos y mayúsculas', () => {
    expect(searchFoods('PLATANO').some(f => f.name === 'plátano')).toBe(true);
  });

  it('una consulta vacía devuelve sugerencias acotadas, no todo', () => {
    const r = searchFoods('', { limit: 5 });
    expect(r.length).toBeLessThanOrEqual(5);
  });

  it('prioriza lo que comés en ese momento del día', () => {
    S.meals = [
      { id: 'm1', name: 'Avena', slot: 'desayuno', date: '2026-08-01', kcal: 100, p: 1, c: 1, f: 1 },
      { id: 'm2', name: 'Avena', slot: 'desayuno', date: '2026-08-02', kcal: 100, p: 1, c: 1, f: 1 },
    ];
    expect(searchFoods('a', { slot: 'desayuno' })[0].name.toLowerCase()).toBe('avena');
  });

  it('sin coincidencias devuelve lista vacía', () => {
    expect(searchFoods('zarandajaxyz')).toEqual([]);
  });
});

describe('macrosFor', () => {
  it('escala un alimento por 100 g', () => {
    const f = { kcal: 165, p: 31, c: 0, f: 3.6, base: '100g' };
    expect(macrosFor(f, 150)).toEqual({ kcal: 248, p: 46.5, c: 0, f: 5.4 });
  });

  it('un alimento por porción con unidad escala contra esa unidad', () => {
    const f = { kcal: 200, p: 20, c: 10, f: 5, base: 'portion', unit: 100 };
    expect(macrosFor(f, 200)).toEqual({ kcal: 400, p: 40, c: 20, f: 10 });
  });

  it('un alimento por porción sin unidad trata 100 g como una porción', () => {
    const f = { kcal: 200, p: 20, c: 10, f: 5, base: 'portion' };
    expect(macrosFor(f, 100)).toEqual({ kcal: 200, p: 20, c: 10, f: 5 });
  });

  it('cero gramos da cero macros', () => {
    expect(macrosFor({ kcal: 165, p: 31, c: 0, f: 3.6, base: '100g' }, 0)).toEqual({ kcal: 0, p: 0, c: 0, f: 0 });
  });
});

describe('defaultGrams', () => {
  it('usa la unidad natural si existe', () => {
    expect(defaultGrams({ base: '100g', unit: 55 })).toBe(55);
  });

  it('sin unidad natural propone 100 g', () => {
    expect(defaultGrams({ base: '100g' })).toBe(100);
  });
});
