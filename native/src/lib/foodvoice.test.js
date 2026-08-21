import { parseFoodSpeech, sumItems } from './foodvoice.js';

describe('foodvoice.js — dictado de comidas', () => {
  describe('parseFoodSpeech()', () => {
    it('reconoce cantidad + unidad + alimento de la tabla', () => {
      const out = parseFoodSpeech('200 gramos de pollo', []);
      expect(out).toHaveLength(1);
      expect(out[0].name).toBe('pollo');
      expect(out[0].source).toBe('table');
      expect(out[0].grams).toBe(200);
      expect(out[0].kcal).toBe(Math.round(165 * 2));
    });

    it('reconoce números en palabras y unidad natural ("dos huevos")', () => {
      const out = parseFoodSpeech('dos huevos', []);
      expect(out).toHaveLength(1);
      expect(out[0].name).toBe('huevo');
      expect(out[0].grams).toBe(110); // 2 * 55
    });

    it('separa varios trozos con "y"', () => {
      const out = parseFoodSpeech('200 gramos de pollo y dos huevos', []);
      expect(out).toHaveLength(2);
      expect(out[0].name).toBe('pollo');
      expect(out[1].name).toBe('huevo');
    });

    it('usa un alimento propio (S.foods) por sobre la tabla, multiplicando la porción', () => {
      const userFoods = [{ name: 'Mi Avena Especial', kcal: 300, p: 10, c: 40, f: 5 }];
      const out = parseFoodSpeech('dos mi avena especial', userFoods);
      expect(out).toHaveLength(1);
      expect(out[0].source).toBe('mine');
      expect(out[0].kcal).toBe(600);
      expect(out[0].p).toBe(20);
    });

    it('marca como unknown lo que no reconoce, sin inventar macros', () => {
      const out = parseFoodSpeech('un poco de xyzalimentoinventado', []);
      expect(out).toHaveLength(1);
      expect(out[0].unknown).toBe(true);
      expect(out[0].kcal).toBeUndefined();
    });

    it('plato completo con "con" no se parte si existe como plato de la tabla', () => {
      const out = parseFoodSpeech('un plato de arroz con pollo', []);
      expect(out).toHaveLength(1);
      expect(out[0].name).toBe('arroz con pollo');
    });

    it('con texto vacío o sólo separadores, no explota y devuelve []', () => {
      expect(parseFoodSpeech('', [])).toEqual([]);
      expect(parseFoodSpeech('   ', [])).toEqual([]);
      expect(parseFoodSpeech(',,,', [])).toEqual([]);
      expect(parseFoodSpeech(undefined, undefined)).toEqual([]);
    });
  });

  describe('sumItems()', () => {
    it('suma kcal/p/c/f de varios items, ignorando los unknown', () => {
      const items = [
        { kcal: 100, p: 10, c: 5, f: 2 },
        { kcal: 50, p: 5, c: 2.5, f: 1 },
        { unknown: true, name: 'algo' },
      ];
      expect(sumItems(items)).toEqual({ kcal: 150, p: 15, c: 7.5, f: 3 });
    });

    it('sin items devuelve todo en cero, no explota', () => {
      expect(sumItems([])).toEqual({ kcal: 0, p: 0, c: 0, f: 0 });
      expect(sumItems(null)).toEqual({ kcal: 0, p: 0, c: 0, f: 0 });
      expect(sumItems(undefined)).toEqual({ kcal: 0, p: 0, c: 0, f: 0 });
    });
  });
});
