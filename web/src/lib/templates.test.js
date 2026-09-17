import { describe, it, expect } from 'vitest';
import { TEMPLATES } from './templates.js';
import { catOf } from './muscle.ts';

describe('plantilla antpost — rutina real de Enzo', () => {
  const t = TEMPLATES.find(x => x.id === 'antpost');

  it('existe y mantiene el id antpost (otros lugares lo referencian)', () => {
    expect(t).toBeTruthy();
  });

  it('tiene exactamente dos turnos: Anterior y Posterior', () => {
    expect(t.secuencia.map(([name]) => name)).toEqual(['Anterior', 'Posterior']);
  });

  it('Anterior tiene 11 ejercicios y Posterior 10, como dictó Enzo', () => {
    const [, anterior] = t.secuencia[0];
    const [, posterior] = t.secuencia[1];
    expect(anterior).toHaveLength(11);
    expect(posterior).toHaveLength(10);
  });

  it('cada ejercicio de antpost es reconocido por catOf() — ninguno cae en "Sin grupo"', () => {
    const sinGrupo = [];
    for (const [, ejercicios] of t.secuencia) {
      for (const [nombre] of ejercicios) {
        if (!catOf(nombre)) sinGrupo.push(nombre);
      }
    }
    expect(sinGrupo).toEqual([]);
  });

  it('todas las plantillas siguen teniendo forma [nombre, series, reps] válida', () => {
    for (const tpl of TEMPLATES) {
      for (const [, ejercicios] of tpl.secuencia) {
        for (const [nombre, series, reps] of ejercicios) {
          expect(typeof nombre).toBe('string');
          expect(Number.isInteger(series)).toBe(true);
          expect(Number.isInteger(reps)).toBe(true);
        }
      }
    }
  });
});
