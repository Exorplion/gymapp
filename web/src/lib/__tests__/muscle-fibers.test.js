// porcionesDe(): qué porciones REALES de la lámina (bodydata.js) se están
// entrenando y con cuánto volumen, a partir de los ejercicios elegidos. Es la
// lógica pura detrás de MuscleFibers.jsx, separada para poder testearla sin
// renderizar nada ni medir SVG.
import { describe, it, expect } from 'vitest';
import { porcionesDe } from '../../components/MuscleFibers.jsx';
import { CUERPOS } from '../bodydata.js';

describe('porcionesDe', () => {
  it('distingue press plano de press inclinado en Pecho: clavicular y costal, ambos presentes', () => {
    const out = porcionesDe('Pecho', [
      { name: 'Press plano', sets: 3 },
      { name: 'Press inclinado', sets: 4 },
    ]);
    const subs = out.map(x => x.sub);
    // press plano toca clavicular+costal; press inclinado sólo clavicular.
    // Las dos porciones tienen que aparecer, y no repetirse.
    expect(subs).toContain('Clavicular');
    expect(subs).toContain('Costal');
    expect(new Set(subs).size).toBe(subs.length);
  });

  it('un ejercicio que sólo toca Clavicular enciende ese parche y NO el Costal', () => {
    const out = porcionesDe('Pecho', [{ name: 'Press inclinado', sets: 3 }]);
    expect(out).toEqual([{ sub: 'Clavicular', sets: 3 }]);
  });

  it('un ejercicio que fibras.js no reconoce no rompe y no inventa porción', () => {
    const out = porcionesDe('Pecho', [{ name: 'Ejercicio inventado que no existe', sets: 3 }]);
    expect(out).toEqual([]);
  });

  it('lista vacía o undefined no explota (turno de descanso sin exercises)', () => {
    expect(porcionesDe('Pecho', [])).toEqual([]);
    expect(porcionesDe('Pecho', undefined)).toEqual([]);
  });

  it('un grupo sin porciones reales en la lámina (Bíceps) siempre devuelve vacío', () => {
    // El bíceps es UNA forma por lado en la lámina: mostrar una porción ahí
    // sería inventar geometría.
    const out = porcionesDe('Bíceps', [{ name: 'Curl martillo', sets: 4 }]);
    expect(out).toEqual([]);
  });

  it('Glúteo: el hip thrust enciende el mayor y el abductor el medio', () => {
    expect(porcionesDe('Glúteo', [{ name: 'Hip thrust', sets: 4 }])).toEqual([{ sub: 'Glúteo mayor', sets: 4 }]);
    expect(porcionesDe('Glúteo', [{ name: 'Abductor en máquina', sets: 3 }])).toEqual([{ sub: 'Glúteo medio', sets: 3 }]);
  });

  it('un ejercicio que nombra el GRUPO entero cuenta para todas sus hermanas', () => {
    // Pushdown dice 'Tríceps' (no hay estudio que diga qué cabeza prioriza):
    // entrenó el tríceps entero, no ninguna cabeza.
    const out = porcionesDe('Tríceps', [{ name: 'Tricep pushdown', sets: 3 }]);
    expect(out.map(p => p.sub).sort()).toEqual(['Tríceps cabeza larga', 'Tríceps cabeza lateral']);
    expect(out.every(p => p.sets === 3)).toBe(true);
  });

  it('gemelos sentado va al sóleo, el genérico a las dos piezas', () => {
    expect(porcionesDe('Gemelos', [{ name: 'Gemelos sentado', sets: 4 }])).toEqual([{ sub: 'Sóleo', sets: 4 }]);
    expect(porcionesDe('Gemelos', [{ name: 'Calf raise', sets: 4 }]).map(p => p.sub).sort()).toEqual(['Gastrocnemio', 'Sóleo']);
  });

  it('Espalda tiene sus porciones como zonas HERMANAS (sin parche): un jalón enciende Dorsal bajo y NO Trapecio/Dorsal alto', () => {
    // A diferencia de Pecho (base + parches encima), en bodydata.js Espalda
    // no tiene una zona "base" sin sub: Trapecio, Dorsal alto y Dorsal bajo
    // son tres regiones propias que entre las tres arman la espalda entera.
    // Igual son porciones reales y honestas, sólo que dibujadas distinto.
    const out = porcionesDe('Espalda', [{ name: 'Jalón al pecho', sets: 4 }]);
    expect(out).toEqual([{ sub: 'Dorsal bajo', sets: 4 }]);
  });

  it('Espalda: un remo que sólo toca dorsal alto no enciende dorsal bajo ni trapecio', () => {
    const out = porcionesDe('Espalda', [{ name: 'Remo neutro', sets: 3 }]);
    expect(out).toEqual([{ sub: 'Dorsal alto', sets: 3 }]);
  });

  it('el volumen (series) se suma cuando dos ejercicios tocan la misma porción', () => {
    const out = porcionesDe('Pecho', [
      { name: 'Press plano', sets: 3 },
      { name: 'Press declinado', sets: 2 }, // sólo costal
    ]);
    const costal = out.find(x => x.sub === 'Costal');
    expect(costal.sets).toBe(5); // 3 (plano) + 2 (declinado)
  });

  it('sin dato de sets numérico, cuenta como presente sin inventar volumen', () => {
    const out = porcionesDe('Pecho', [{ name: 'Press inclinado' }]);
    expect(out.find(x => x.sub === 'Clavicular').sets).toBe(1);
  });

  it('Abs mezcla los dos modelos: Serrato/Abdomen superior/Abdomen inferior son parches, Oblicuos es hermana', () => {
    // Un crunch (Abdomen superior, parche) y un ejercicio de oblicuo
    // (hermana) a la vez: los dos tienen que aparecer, cada uno resuelto por
    // su propio modelo de dibujo sin que uno tape al otro.
    const out = porcionesDe('Abs', [
      { name: 'Crunch', sets: 3 },
      { name: 'Oblicuo en polea', sets: 2 },
    ]);
    expect(out).toEqual(expect.arrayContaining([
      { sub: 'Abdomen superior', sets: 3 },
      { sub: 'Oblicuos', sets: 2 },
    ]));
    expect(out.some(x => x.sub === 'Abdomen inferior')).toBe(false);
  });
});

// El renderizado en sí (qué se pinta apagado vs. encendido) no se testea acá
// a propósito — este archivo evita @testing-library (ver a11y-markup.test.js
// para el razonamiento). Lo que SÍ se puede fijar sin montar nada es la
// invariante de la que depende ese renderizado: para que Espalda nunca se
// vea "mutilada" (dos porciones encendidas y la tercera directamente
// ausente), bodydata.js tiene que seguir dando las tres zonas hermanas
// completas, sin parche, para que MuscleFibers las dibuje TODAS —apagada la
// que no se entrenó, encendida la que sí.
describe('bodydata.js: Espalda son tres zonas hermanas, no un parche sobre una base', () => {
  it('las tres —Trapecio, Dorsal alto, Dorsal bajo— existen en la cara de espalda, ninguna es parche', () => {
    const espaldaCara = CUERPOS.m.espalda.zonas.filter(z => z.cat === 'Espalda');
    const subs = espaldaCara.map(z => z.sub).sort();
    expect(subs).toEqual(['Dorsal alto', 'Dorsal bajo', 'Trapecio'].sort());
    expect(espaldaCara.every(z => !z.parche)).toBe(true);
  });
});
