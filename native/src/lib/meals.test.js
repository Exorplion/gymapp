import { S } from './state.js';
import {
  mealsOf, SLOTS, slotForTime, slotOf, mealsBySlot, macroCls, nutriFeedback, frequentMeals,
} from './meals.js';

describe('meals.js — nutrición', () => {
  beforeEach(() => {
    S.meals = [];
  });

  describe('mealsOf()', () => {
    it('filtra por fecha y ordena por hora', () => {
      S.meals = [
        { name: 'cena', date: '2026-08-20', t: '20:00' },
        { name: 'desayuno', date: '2026-08-20', t: '08:00' },
        { name: 'otro dia', date: '2026-08-19', t: '10:00' },
      ];
      const out = mealsOf('2026-08-20');
      expect(out).toHaveLength(2);
      expect(out[0].name).toBe('desayuno');
      expect(out[1].name).toBe('cena');
    });

    it('sin comidas ese día devuelve []', () => {
      expect(mealsOf('2026-08-20')).toEqual([]);
    });
  });

  describe('slotForTime()', () => {
    it('clasifica según los cortes peruanos', () => {
      expect(slotForTime('08:00')).toBe('desayuno');
      expect(slotForTime('13:00')).toBe('almuerzo');
      expect(slotForTime('19:00')).toBe('cena');
      expect(slotForTime('23:00')).toBe('snack');
    });

    it('sin hora válida cae a snack', () => {
      expect(slotForTime(null)).toBe('snack');
      expect(slotForTime('')).toBe('snack');
      expect(slotForTime('ab:cd')).toBe('snack');
    });
  });

  describe('slotOf()', () => {
    it('usa el slot guardado si existe', () => {
      expect(slotOf({ slot: 'cena', t: '08:00' })).toBe('cena');
    });
    it('infiere de la hora si no hay slot guardado', () => {
      expect(slotOf({ t: '08:00' })).toBe('desayuno');
    });
    it('no explota con meal null/undefined', () => {
      expect(slotOf(null)).toBe('snack');
      expect(slotOf(undefined)).toBe('snack');
    });
  });

  describe('mealsBySlot()', () => {
    it('agrupa por bloque y suma kcal, sólo bloques con datos', () => {
      S.meals = [
        { name: 'a', date: '2026-08-20', t: '08:00', kcal: 300 },
        { name: 'b', date: '2026-08-20', t: '08:30', kcal: 200 },
        { name: 'c', date: '2026-08-20', t: '13:00', kcal: 500 },
      ];
      const out = mealsBySlot('2026-08-20');
      expect(out).toHaveLength(2);
      const desayuno = out.find(b => b.k === 'desayuno');
      expect(desayuno.kcal).toBe(500);
      expect(desayuno.meals).toHaveLength(2);
    });

    it('sin comidas devuelve []', () => {
      expect(mealsBySlot('2026-08-20')).toEqual([]);
    });
  });

  describe('macroCls() — tag semántico ok/warn/red/""', () => {
    const m = { protMin: 150, protMax: 190, fatMin: 50, fatMax: 90 };

    it('sin objetivo de macros (m null) devuelve ""', () => {
      expect(macroCls(100, 'prot', null)).toBe('');
    });

    it('proteína: ok si >= protMin, warn si >= 75%, "" si menos', () => {
      expect(macroCls(150, 'prot', m)).toBe('ok');
      expect(macroCls(120, 'prot', m)).toBe('warn'); // 150*0.75=112.5
      expect(macroCls(50, 'prot', m)).toBe('');
    });

    it('grasa: red si > fatMax*1.1, warn si > fatMax, ok si >= fatMin, "" si menos', () => {
      expect(macroCls(100, 'fat', m)).toBe('red'); // 90*1.1=99
      expect(macroCls(95, 'fat', m)).toBe('warn');
      expect(macroCls(60, 'fat', m)).toBe('ok');
      expect(macroCls(10, 'fat', m)).toBe('');
    });
  });

  describe('nutriFeedback() — { dot, text, warn }', () => {
    const m = { protMin: 150, fatMax: 90 };
    const g = { kcal: 2200, p: 160, c: 250, f: 70 };

    it('sin comidas registradas (kc=0) devuelve dot "empty" y no explota', () => {
      const fb = nutriFeedback(0, 0, 0, g, m);
      expect(fb.dot).toBe('empty');
      expect(fb.text).toBe('Registra tu primera comida del día.');
      expect(fb.warn).toBeNull();
    });

    it('sobrante grande (rem > 150): dot "blue", menciona kcal y proteína si falta', () => {
      const fb = nutriFeedback(1000, 50, 30, g, m); // rem = 1200, pg = 110
      expect(fb.dot).toBe('blue');
      expect(fb.text).toContain('Te quedan 1200 kcal');
      expect(fb.text).toContain('110g de proteína');
      expect(fb.text).toContain('Prioriza proteína');
    });

    it('sobrante grande con proteína ya cumplida: no menciona proteína', () => {
      const fb = nutriFeedback(1000, 200, 30, g, m); // rem = 1200, pg = max(0,160-200)=0
      expect(fb.dot).toBe('blue');
      expect(fb.text).not.toContain('proteína');
      expect(fb.text).toContain('Buen margen');
    });

    it('en objetivo (-150 <= rem <= 150): dot "ok"', () => {
      const fb = nutriFeedback(2150, 160, 60, g, m); // rem = 50
      expect(fb.dot).toBe('ok');
      expect(fb.text).toContain('En el objetivo del día');
    });

    it('pasado (rem < -150): dot "red"', () => {
      const fb = nutriFeedback(2500, 160, 60, g, m); // rem = -300
      expect(fb.dot).toBe('red');
      expect(fb.text).toContain('Te pasaste 300 kcal');
    });

    it('grasa alta sube dot "ok" a "warn" y llena warn', () => {
      const fb = nutriFeedback(2150, 160, 100, g, m); // rem=50 (ok), tf=100 > 90*1.1=99
      expect(fb.dot).toBe('warn');
      expect(fb.warn).toContain('Grasa alta: 100g');
      expect(fb.warn).toContain('máx 90g');
    });

    it('grasa alta NO sobreescribe dot "red" (sólo sube "ok")', () => {
      const fb = nutriFeedback(2500, 160, 100, g, m); // rem=-300 (red), grasa alta
      expect(fb.dot).toBe('red');
      expect(fb.warn).toContain('Grasa alta');
    });

    it('proteína baja agrega warn sin cambiar dot, sólo si rem <= 150', () => {
      const fb = nutriFeedback(2150, 100, 60, g, m); // rem=50, tp=100 < protMin=150
      expect(fb.dot).toBe('ok');
      expect(fb.warn).toContain('Proteína baja: 100g');
      expect(fb.warn).toContain('mín 150g');
    });

    it('proteína baja NO se marca si rem > 150', () => {
      const fb = nutriFeedback(1000, 50, 30, g, m); // rem=1200 > 150
      expect(fb.warn).toBeNull();
    });

    it('sin objetivo de macros (m null/undefined) no explota y no agrega warn', () => {
      const fb = nutriFeedback(2150, 100, 100, g, null);
      expect(fb.warn).toBeNull();
      expect(fb.dot).toBe('ok');
    });
  });

  describe('frequentMeals()', () => {
    it('agrupa por nombre normalizado y ordena por frecuencia', () => {
      S.meals = [
        { name: 'Pollo', date: '2026-08-01', t: '12:00', kcal: 300, p: 30, c: 0, f: 5 },
        { name: 'pollo', date: '2026-08-02', t: '12:00', kcal: 320, p: 31, c: 0, f: 6 },
        { name: 'Arroz', date: '2026-08-01', t: '12:30', kcal: 200, p: 4, c: 40, f: 1 },
      ];
      const out = frequentMeals();
      expect(out[0].name.toLowerCase()).toBe('pollo');
      expect(out[0].count).toBe(2);
      // usa los macros del registro más reciente
      expect(out[0].kcal).toBe(320);
    });

    it('respeta el límite', () => {
      S.meals = Array.from({ length: 10 }, (_, i) => ({
        name: `comida${i}`, date: '2026-08-01', t: '12:00', kcal: 100, p: 1, c: 1, f: 1,
      }));
      expect(frequentMeals(3)).toHaveLength(3);
    });

    it('sin comidas devuelve []', () => {
      expect(frequentMeals()).toEqual([]);
    });
  });
});
