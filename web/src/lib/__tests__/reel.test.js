import { describe, it, expect } from 'vitest';
import { reelValues } from '../reel.js';

describe('reelValues', () => {
  it('no repite el valor del piso (el "1" que se repetía muchas veces)', () => {
    // Reps: step 1, mínimo 1, con el valor ya en el piso. Antes cada diente
    // por debajo del mínimo se recortaba a 1 y la rueda mostraba veinte "1"
    // seguidos, así que arrastrar hacia abajo no hacía nada visible.
    const vals = reelValues(1, 1, 1);
    expect(new Set(vals).size).toBe(vals.length);
    expect(Math.min(...vals)).toBe(1);
  });

  it('mantiene la cantidad de dientes aunque el centro esté en el piso', () => {
    expect(reelValues(1, 1, 1)).toHaveLength(41);
    expect(reelValues(0.5, 2.5, 0.5, 41)).toHaveLength(41);
  });

  it('el piso se redondea al primer múltiplo de step (rueda gruesa)', () => {
    // Con mínimo 0.5 kg y pasos de 2.5, los dientes siguen siendo múltiplos.
    const vals = reelValues(2.5, 2.5, 0.5);
    expect(vals[0]).toBe(2.5);
    expect(vals.every(v => Math.abs(v / 2.5 - Math.round(v / 2.5)) < 1e-9)).toBe(true);
  });

  it('con el centro lejos del piso sigue centrado como antes', () => {
    const vals = reelValues(60, 2.5, 0.5);
    expect(vals[Math.floor(vals.length / 2)]).toBe(60);
  });

  it('nunca devuelve valores por debajo del mínimo', () => {
    expect(Math.min(...reelValues(2, 1, 1))).toBeGreaterThanOrEqual(1);
  });
});

// H7: la rueda se centra sin medir el DOM. La cuenta sólo vale si el ancho del
// diente del JS es el mismo del CSS y el relleno de la pista es medio diente.
import { reelScrollLeft, reelNearestIndex, REEL_DIENTE } from '../reel.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

describe('rueda sin layout forzado (H7)', () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'styles.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  it('el diente de reel.ts es el --reel-diente de styles.css', () => {
    expect(css).toContain(`--reel-diente:${REEL_DIENTE}px`);
    expect(css).toMatch(/\.reel-tooth\{[^}]*width:var\(--reel-diente\)/);
    expect(css).toMatch(/\.reel-track\{[^}]*padding:0 calc\(50% - var\(--reel-diente\) \/ 2\)/);
  });

  it('el diente idx se centra en idx × diente', () => {
    expect(reelScrollLeft(0)).toBe(0);
    expect(reelScrollLeft(20)).toBe(20 * REEL_DIENTE);
    expect(reelScrollLeft(-3)).toBe(0);
  });

  it('el diente más cercano sale de scrollLeft, sin leer los 41 dientes', () => {
    const pista = (scrollLeft, n = 41) => ({
      scrollLeft,
      children: Array.from({ length: n }, () => ({
        get offsetLeft() { throw new Error('no debería leer offsetLeft'); },
      })),
    });
    expect(reelNearestIndex(pista(20 * REEL_DIENTE))).toBe(20);
    expect(reelNearestIndex(pista(20 * REEL_DIENTE + REEL_DIENTE * 0.4))).toBe(20);
    expect(reelNearestIndex(pista(20 * REEL_DIENTE + REEL_DIENTE * 0.6))).toBe(21);
    expect(reelNearestIndex(pista(99999))).toBe(40);
    expect(reelNearestIndex(pista(0, 0))).toBe(-1);
  });

  it('los dientes no animan font-size (layout): el tamaño cambia por transform', () => {
    const regla = css.match(/\.reel-tooth\{([^}]*)\}/)[1];
    expect(regla).not.toMatch(/transition:[^;]*font-size/);
    expect(regla).toMatch(/transform:scale\(/);
  });
});
