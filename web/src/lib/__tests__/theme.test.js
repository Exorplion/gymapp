import { describe, it, expect } from 'vitest';
import { hexToHsl, hslToHex, contrastRatio, paletaDesde, COLOR_DEFECTO } from '../theme.js';

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
  it('con el azul de fábrica reproduce la paleta original', () => {
    // El azul default (--blue) es el ancla de la receta (dh=0): la paleta
    // que sale de él tiene que ser la que ya estaba en styles.css, no una
    // aproximación — si no, "restablecer" y "elegir el azul de siempre a
    // mano" darían resultados distintos.
    const p = paletaDesde(COLOR_DEFECTO);
    expect(p.blue.toLowerCase()).toBe('#2e7dff');
    expect(p.blue2.toLowerCase()).toBe('#5ea2ff');
    expect(p.blue3.toLowerCase()).toBe('#8fc2ff');
    expect(p.accent.toLowerCase()).toBe('#7fd1ff');
    expect(p.cyan.toLowerCase()).toBe('#22d3ee');
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
      expect(contrastRatio(p.accent, '#04070F')).toBeGreaterThanOrEqual(MIN);
      expect(contrastRatio(p.blue3, '#04070F')).toBeGreaterThanOrEqual(MIN);
    });
  });

  it('onGrad elige, entre negro y blanco, el que de verdad da más contraste', () => {
    for (const hex of ['#0000FF', '#FFD700', '#8B0000', COLOR_DEFECTO]) {
      const p = paletaDesde(hex);
      const negro = contrastRatio('#03121F', p.blue2), blanco = contrastRatio('#F5FAFF', p.blue2);
      const ganador = negro >= blanco ? '#03121f' : '#f5faff';
      expect(p.onGrad.toLowerCase()).toBe(ganador);
    }
  });
});
