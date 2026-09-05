import { describe, it, expect } from 'vitest';
import {
  hexToHsl, hslToHex, contrastRatio, paletaDesde,
  COLOR_DEFECTO, BG, ON_GRAD_OSCURO, ON_GRAD_CLARO,
} from '../theme.js';

describe('hexToHsl / hslToHex', () => {
  it('convierte y vuelve al mismo color (redondeando)', () => {
    for (const hex of ['#2E7DFF', '#FF5D73', '#2EE6A8', '#7FD1FF']) {
      const { h, s, l } = hexToHsl(hex);
      const vuelta = hslToHex(h, s, l);
      expect(vuelta.toLowerCase()).toBe(hex.toLowerCase());
    }
  });

  it('acepta hex corto (#fff) y sin #', () => {
    expect(hexToHsl('#fff')).toEqual({ h: 0, s: 0, l: 100 });
    expect(hexToHsl('2E7DFF')).not.toBe(null);
  });

  it('negro y blanco no tienen matiz ni saturación', () => {
    expect(hexToHsl('#000000')).toEqual({ h: 0, s: 0, l: 0 });
    expect(hexToHsl('#ffffff')).toEqual({ h: 0, s: 0, l: 100 });
  });

  it('con texto que no es un color, no rompe — devuelve null', () => {
    expect(hexToHsl('no soy un color')).toBe(null);
    expect(hexToHsl('')).toBe(null);
    expect(hexToHsl(undefined)).toBe(null);
  });
});

describe('contrastRatio', () => {
  it('blanco contra negro es el máximo, 21:1', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0);
  });

  it('un color contra sí mismo es 1:1 — sin contraste', () => {
    expect(contrastRatio('#7FD1FF', '#7FD1FF')).toBeCloseTo(1, 5);
  });

  it('no importa el orden de los dos colores', () => {
    expect(contrastRatio('#ffffff', '#04070F')).toBeCloseTo(contrastRatio('#04070F', '#ffffff'), 5);
  });
});

describe('paletaDesde', () => {
  /* Este test comprobaba que paletaDesde(COLOR_DEFECTO) reprodujera EXACTO
     la paleta de styles.css, hex por hex. Ese invariante murió con la
     reformulación "hierro y encendido", y no por un bug: la paleta de fábrica
     dejó de ser una sola familia de matiz.

     Ahora hay dos a propósito — naranja caliente para la ACCIÓN y azul para
     los DATOS (series de gráfico) — mientras que la receta de este módulo, por
     diseño, colapsa todos los roles en UNA familia rotada al matiz que elijas.
     O sea que la receta no puede reproducir una paleta de dos familias, y
     exigirlo sería pedirle al sistema de tema algo que nunca prometió.

     Lo que SÍ se sigue exigiendo, porque es lo que de verdad protege contra
     que theme.js y styles.css se separen en silencio: que el color de fábrica
     sea el mismo matiz que el acento del CSS, y que la paleta derivada sea
     coherente (todos los roles en la misma familia cálida). */
  it('el color de fábrica ancla la receta en su propio matiz', () => {
    const p = paletaDesde(COLOR_DEFECTO);
    const base = hexToHsl(COLOR_DEFECTO).h;

    // `blue` es el ancla de la receta (dh=0): tiene que salir con el matiz
    // exacto del color de entrada, no una aproximación.
    expect(hexToHsl(p.blue).h).toBeCloseTo(base, 0);

    // Y toda la paleta derivada queda en la misma familia: la receta corre el
    // matiz entre -30 y +15 grados según el rol, nunca lo manda a otro lado.
    for (const rol of ['deep', 'blue2', 'blue3', 'accent', 'cyan']) {
      // distancia circular entre dos ángulos, en [0,180]
      const dh = Math.abs(((hexToHsl(p[rol]).h - base + 540) % 360) - 180);
      expect(dh).toBeLessThanOrEqual(30);
    }
  });

  it('el color de fábrica es cálido, no el azul de la paleta vieja', () => {
    // Guarda contra volver a #2E7DFF por accidente en un merge: el matiz de
    // fábrica tiene que estar en el rango naranja (0-45 grados).
    const h = hexToHsl(COLOR_DEFECTO).h;
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(45);
  });

  it('con un color inválido no arma nada — null, no una paleta rota', () => {
    expect(paletaDesde('esto no es un color')).toBe(null);
  });

  it('el degradado usa los tonos derivados, no el color crudo de entrada', () => {
    const p = paletaDesde('#FF0000');   // rojo puro
    expect(p.grad).toContain(p.deep);
    expect(p.grad2).toContain(p.blue2);
  });

  // La garantía de lectura: sin importar qué matiz elijas, accent y blue3
  // —los dos tonos que esta app usa como texto suelto sobre el fondo— tienen
  // que superar el contraste mínimo. Se prueba con matices adversos: el azul
  // puro (el que menos "pesa" en la fórmula de contraste WCAG), gris puro
  // (sin matiz) y un color casi negro (el caso límite real: alguien que
  // elige un color oscuro de entrada).
  describe('garantía de contraste (accent y blue3 contra el fondo)', () => {
    const MIN = 3;
    const casos = [
      ['azul puro', '#0000FF'],
      ['rojo puro', '#FF0000'],
      ['verde puro', '#00FF00'],
      ['gris, sin matiz', '#888888'],
      ['casi negro', '#0A0A12'],
      ['casi blanco', '#F8F8FF'],
      ['violeta', '#7A1FA2'],
      ['el azul de fábrica', COLOR_DEFECTO],
    ];
    it.each(casos)('%s (%s)', (_nombre, hex) => {
      const p = paletaDesde(hex);
      expect(contrastRatio(p.accent, BG)).toBeGreaterThanOrEqual(MIN);
      expect(contrastRatio(p.blue3, BG)).toBeGreaterThanOrEqual(MIN);
    });
  });

  it('onGrad elige, entre negro y blanco, el que de verdad da más contraste', () => {
    for (const hex of ['#0000FF', '#FFD700', '#8B0000', COLOR_DEFECTO]) {
      const p = paletaDesde(hex);
      // Los candidatos se IMPORTAN, no se repiten acá: cuando estaban
      // escritos a mano, cambiar la paleta hacía fallar el test por
      // duplicación desincronizada y no por un bug real.
      const negro = contrastRatio(ON_GRAD_OSCURO, p.blue2);
      const blanco = contrastRatio(ON_GRAD_CLARO, p.blue2);
      const ganador = (negro >= blanco ? ON_GRAD_OSCURO : ON_GRAD_CLARO).toLowerCase();
      expect(p.onGrad.toLowerCase()).toBe(ganador);
    }
  });
});
