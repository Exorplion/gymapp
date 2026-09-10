import { describe, it, expect } from 'vitest';
import { subCatOf, subBlocksOf, catOf } from '../muscle.js';

// El caso que lo pidió, con las palabras de Enzo: un turno "Anterior" tiene
// que dividirse en pecho, hombro, tríceps, pierna "siendo específicos, quads,
// isquios, etc" y abs — no salir entero como "Pierna" y "Pecho".
describe('subCatOf', () => {
  const CASOS = [
    ['Sentadilla', 'Cuádriceps'],
    ['Prensa', 'Cuádriceps'],
    ['Leg press', 'Cuádriceps'],
    ['Leg extension', 'Cuádriceps'],
    ['Curl femoral', 'Isquiotibiales'],
    ['Hamstring curl', 'Isquiotibiales'],
    ['Peso muerto rumano', 'Isquiotibiales'],
    ['Hip thrust', 'Glúteo'],
    ['Aductor', 'Aductores'],
    ['Standing calf raise', 'Gemelos'],
    ['Jalón al pecho', 'Dorsal'],
    ['Remo espalda alta', 'Espalda alta'],
    ['Kelso shrug', 'Espalda alta'],
    ['Press inclinado', 'Pecho superior'],
    // El press de banca trabaja las DOS porciones del pecho: afinarlo a una
    // sería una precisión inventada. Se queda en el grupo.
    ['Press banca', 'Pecho'],
    ['Press militar', 'Hombro anterior'],
  ];

  it.each(CASOS)('%s → %s', (nombre, esperado) => {
    expect(subCatOf(nombre)).toBe(esperado);
  });

  it('NUNCA contradice a catOf: el subgrupo es una precisión, no otra opinión', () => {
    // Si un ejercicio saliera "Cuádriceps" en el subgrupo y "Espalda" en el
    // grupo, las dos pantallas dirían cosas distintas del mismo ejercicio.
    const PERTENECE = {
      Cuádriceps: 'Pierna', Isquiotibiales: 'Pierna', Aductores: 'Pierna',
      Glúteo: 'Glúteo', Gemelos: 'Gemelos',
      Dorsal: 'Espalda', 'Espalda alta': 'Espalda',
      'Pecho superior': 'Pecho', Pecho: 'Pecho',
      Hombro: 'Hombro', 'Hombro anterior': 'Hombro',
      Bíceps: 'Bíceps', Braquiorradial: 'Bíceps',
      Tríceps: 'Tríceps', Abs: 'Abs', Oblicuos: 'Abs',
    };
    for (const [nombre] of CASOS) {
      const sub = subCatOf(nombre), grupo = catOf(nombre);
      if (PERTENECE[sub]) expect(PERTENECE[sub], `${nombre}: ${sub} vs ${grupo}`).toBe(grupo);
    }
  });

  it('sin reconocer el ejercicio cae al grupo, no adivina un subgrupo', () => {
    // "Elevaciones laterales" no tiene porción propia en la tabla de fibras:
    // devolver "Hombro" es decir menos, que es lo correcto.
    expect(subCatOf('Elevaciones laterales')).toBe(catOf('Elevaciones laterales'));
  });

  it('un ejercicio con dos porciones de subgrupos distintos NO se afina', () => {
    // Es la regla que evita la precisión inventada, y la destapó un test.
    expect(subCatOf('Press banca')).toBe('Pecho');
  });

  it('un ejercicio que nadie reconoce devuelve null, no "Otros"', () => {
    expect(subCatOf('Zzzz inventado')).toBe(null);
  });
});

describe('subBlocksOf', () => {
  it('divide un turno de pierna en sus subgrupos, en orden de aparición', () => {
    const exs = [
      { id: '1', name: 'Sentadilla' },
      { id: '2', name: 'Prensa' },
      { id: '3', name: 'Curl femoral' },
      { id: '4', name: 'Standing calf raise' },
    ];
    expect(subBlocksOf(exs).map(b => b.cat)).toEqual(['Cuádriceps', 'Isquiotibiales', 'Gemelos']);
    expect(subBlocksOf(exs)[0].exs).toHaveLength(2);
  });

  it('no pierde ningún ejercicio', () => {
    const exs = [
      { id: '1', name: 'Press banca' }, { id: '2', name: 'Zzzz inventado' },
      { id: '3', name: 'Elevaciones laterales' },
    ];
    expect(subBlocksOf(exs).flatMap(b => b.exs)).toHaveLength(3);
  });
});
