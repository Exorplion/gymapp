import { S } from './state.js';
import { logMeal, addMealFromFood } from './meal-logic.js';
import { idb } from './db.js';
import { mealsOf, mealsBySlot, frequentMeals } from './meals.js';

jest.mock('./db.js', () => ({ idb: { put: jest.fn(), clear: jest.fn(), del: jest.fn(), all: jest.fn() } }));

describe('meal-logic', () => {
  beforeEach(() => {
    S.meals = [];
    S.foods = [];
    S.nutriDate = '2026-08-21';
    idb.put.mockClear();
  });

  it('logMeal escribe en idb, pushea a S.meals, y el shape sirve para mealsOf/mealsBySlot/frequentMeals', async () => {
    const f = { id: 'food1', name: 'Pollo', kcal: 300, p: 40, c: 0, f: 10 };
    await logMeal(f, 'almuerzo');

    expect(idb.put).toHaveBeenCalledWith('meals', expect.objectContaining({
      date: '2026-08-21', name: 'Pollo', kcal: 300, p: 40, c: 0, f: 10, slot: 'almuerzo',
    }));
    expect(S.meals.length).toBe(1);
    const saved = S.meals[0];

    // campos exactos que leen mealsOf/mealsBySlot/frequentMeals
    expect(saved).toHaveProperty('id');
    expect(saved).toHaveProperty('date', '2026-08-21');
    expect(saved).toHaveProperty('name', 'Pollo');
    expect(saved).toHaveProperty('kcal', 300);
    expect(saved).toHaveProperty('p', 40);
    expect(saved).toHaveProperty('c', 0);
    expect(saved).toHaveProperty('f', 10);
    expect(saved).toHaveProperty('t');
    expect(saved).toHaveProperty('slot', 'almuerzo');

    expect(mealsOf('2026-08-21')).toEqual([saved]);
    const bySlot = mealsBySlot('2026-08-21');
    expect(bySlot.find(b => b.k === 'almuerzo').meals).toEqual([saved]);
    expect(frequentMeals()[0]).toMatchObject({ name: 'Pollo', kcal: 300, p: 40, c: 0, f: 10, count: 1 });
  });

  it('logMeal sin slot explícito lo infiere de la hora vía slotForTime', async () => {
    const f = { name: 'Snack nocturno', kcal: 100, p: 2, c: 10, f: 3 };
    await logMeal(f);
    expect(S.meals[0].slot).toMatch(/desayuno|almuerzo|cena|snack/);
  });

  it('addMealFromFood delega en logMeal cuando el id existe en S.foods', async () => {
    S.foods = [{ id: 'food1', name: 'Arroz', kcal: 200, p: 4, c: 45, f: 1 }];
    await addMealFromFood('food1');
    expect(S.meals.length).toBe(1);
    expect(S.meals[0].name).toBe('Arroz');
    expect(idb.put).toHaveBeenCalledTimes(1);
  });

  it('addMealFromFood con id inexistente no explota y no registra nada', async () => {
    S.foods = [{ id: 'food1', name: 'Arroz', kcal: 200, p: 4, c: 45, f: 1 }];
    await expect(addMealFromFood('nope')).resolves.not.toThrow();
    expect(S.meals.length).toBe(0);
    expect(idb.put).not.toHaveBeenCalled();
  });
});
