import { describe, it, expect } from 'vitest';
import { TEMPLATES } from './templates.js';
import { catOf } from './muscle.ts';

/* Un turno con `null` en vez de lista de ejercicios es un DESCANSO
   (ver applyTemplate en templates.js). Todo recorrido de ejercicios tiene
   que saltearlos, o revienta con "not iterable" — pasó al agregar los
   descansos a antpost y es la forma en que estos tests lo cuidan. */
const esDescanso = ([, lista]) => lista === null;

describe('plantilla antpost — Anterior / Posterior', () => {
  const t = TEMPLATES.find(x => x.id === 'antpost');

  it('existe y mantiene el id antpost (otros lugares lo referencian)', () => {
    expect(t).toBeTruthy();
  });

  it('el ciclo es A · P · R · A · P · R · R', () => {
    // Enzo, 2026-09-17: "te olvidaste de poner los días de descanso,
    // es AP R AP RR". Siete turnos: cuatro de entrenamiento, tres de
    // descanso.
    expect(t.secuencia.map(([name, lista]) => (lista === null ? 'R' : name[0])))
      .toEqual(['A', 'P', 'R', 'A', 'P', 'R', 'R']);
  });

  it('los dos turnos de entrenamiento se repiten IGUALES, sin desincronizarse', () => {
    const [, ant1] = t.secuencia[0];
    const [, ant2] = t.secuencia[3];
    const [, pos1] = t.secuencia[1];
    const [, pos2] = t.secuencia[4];
    // Misma referencia: las listas viven en una sola constante justamente
    // para que editar una no deje la otra vieja.
    expect(ant1).toBe(ant2);
    expect(pos1).toBe(pos2);
  });

  it('Anterior tiene 11 ejercicios y Posterior 10, como dictó Enzo', () => {
    expect(t.secuencia[0][1]).toHaveLength(11);
    expect(t.secuencia[1][1]).toHaveLength(10);
  });

  it('no se atribuye a Enzo: es una plantilla más', () => {
    // Pidió explícitamente que no diga que es su rutina.
    expect(JSON.stringify(t)).not.toMatch(/enzo/i);
  });

  it('cada ejercicio de antpost es reconocido por catOf() — ninguno cae en "Sin grupo"', () => {
    const sinGrupo = [];
    for (const turno of t.secuencia) {
      if (esDescanso(turno)) continue;
      for (const [nombre] of turno[1]) {
        if (!catOf(nombre)) sinGrupo.push(nombre);
      }
    }
    expect(sinGrupo).toEqual([]);
  });
});

describe('todas las plantillas', () => {
  it('tienen forma [nombre, series, reps] válida, y los descansos son null', () => {
    for (const tpl of TEMPLATES) {
      for (const turno of tpl.secuencia) {
        if (esDescanso(turno)) continue;
        for (const [nombre, series, reps] of turno[1]) {
          expect(typeof nombre).toBe('string');
          expect(Number.isInteger(series)).toBe(true);
          expect(Number.isInteger(reps)).toBe(true);
        }
      }
    }
  });

  it('declaran tantos días/sem como turnos de entrenamiento tienen', () => {
    /* El texto de `days` es lo que se muestra en "Mis rutinas", así que si
       miente se ve. antpost decía "4 días/sem" con dos turnos cargados
       (antes de los descansos) y "2 días/sem" después de una corrección a
       medias — este test lo ata al contenido real. */
    for (const tpl of TEMPLATES) {
      const entrenos = tpl.secuencia.filter(s => !esDescanso(s)).length;
      const declarados = parseInt(tpl.days, 10);
      expect(declarados, `${tpl.id} declara "${tpl.days}" pero tiene ${entrenos} turnos de entrenamiento`)
        .toBe(entrenos);
    }
  });
});
