import { tocaCalentar, bloqueDe, DESCANSO, warmupSets, RAMPA } from './warmup.js';

describe('warmup.js', () => {
  test('DESCANSO es 165 segundos', () => {
    expect(DESCANSO).toBe(165);
  });

  test('bloqueDe clasifica superior/inferior por categoría', () => {
    expect(bloqueDe({ cat: 'Pecho' })).toBe('superior');
    expect(bloqueDe({ cat: 'Pierna' })).toBe('inferior');
    expect(bloqueDe({ cat: 'Sin Categoria Rara' })).toBeNull();
  });

  test('bloque nuevo (no calentado todavía en la sesión) sí pide calentamiento', () => {
    const draft = { warmBlocks: [] };
    const ex = { cat: 'Pecho' };
    expect(tocaCalentar(draft, ex)).toBe(true);
  });

  test('bloque ya calentado en la sesión no vuelve a pedir calentamiento', () => {
    const draft = { warmBlocks: ['superior'] };
    const ex = { cat: 'Hombro' };
    expect(tocaCalentar(draft, ex)).toBe(false);
  });

  test('cruzar de superior a inferior sí pide calentamiento aunque ya se calentó superior', () => {
    const draft = { warmBlocks: ['superior'] };
    const ex = { cat: 'Pierna' };
    expect(tocaCalentar(draft, ex)).toBe(true);
  });

  test('sin draft o sin ejercicio no pide calentamiento', () => {
    expect(tocaCalentar(null, { cat: 'Pecho' })).toBe(false);
    expect(tocaCalentar({ warmBlocks: [] }, null)).toBe(false);
  });

  test('ejercicio sin categoría reconocible no dispara calentamiento', () => {
    const draft = { warmBlocks: [] };
    expect(tocaCalentar(draft, { cat: 'Rareza' })).toBe(false);
  });

  test('warmupSets redondea cada peso al paso dado', () => {
    const sets = warmupSets(83, 5);
    expect(sets).toHaveLength(RAMPA.length);
    expect(sets.map(s => s.w)).toEqual([40, 60, 75]);
  });

  test('warmupSets nunca baja del paso, aun con un peso de trabajo muy liviano', () => {
    const sets = warmupSets(3, 2.5);
    expect(sets.every(s => s.w >= 2.5)).toBe(true);
  });

  test('warmupSets devuelve [] si no hay peso de trabajo (top <= 0)', () => {
    expect(warmupSets(0)).toEqual([]);
    expect(warmupSets(-10)).toEqual([]);
    expect(warmupSets(null)).toEqual([]);
  });

  test('warmupSets devuelve [] si el paso no es positivo', () => {
    expect(warmupSets(100, 0)).toEqual([]);
    expect(warmupSets(100, -2.5)).toEqual([]);
  });
});
