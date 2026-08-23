import { tocaCalentar, bloqueDe, DESCANSO } from './warmup.js';

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
});
