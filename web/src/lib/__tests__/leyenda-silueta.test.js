// La leyenda de "Tu cuerpo" tiene que decir lo que pinta el cuerpo
// (auditoría 2026-09-27, B1). Estaba escrita a mano con otros colores: el
// cuerpo pintaba 7+ días en naranja y la leyenda decía gris; "hoy" no estaba.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TONOS, LeyendaTonos, claseDeZona } from '../../components/Silhouette.jsx';

const zona = { cat: 'Hombro' };
const clase = d => claseDeZona(zona, { Hombro: d });

describe('leyenda de la silueta', () => {
  it('cada tramo de la leyenda es exactamente el que pinta la zona', () => {
    let desde = 0;
    for (const t of TONOS) {
      expect(clase(desde), `${desde} d`).toBe(t.clase);
      if (Number.isFinite(t.hasta)) {
        expect(clase(t.hasta), `${t.hasta} d`).toBe(t.clase);
        desde = t.hasta + 1;
      }
    }
  });

  it('hoy entra en la leyenda y 10 días es el naranja, nombrado', () => {
    const hoy = TONOS.find(t => t.clase === clase(0));
    expect(hoy.etiqueta).toMatch(/hoy/);
    const diez = TONOS.find(t => t.clase === clase(10));
    expect(diez.clase).toBe('sil-d3');
    expect(diez.etiqueta).toMatch(/7\+/);
  });

  it('las muestras usan las mismas clases que el cuerpo, más "sin registro"', () => {
    const html = renderToStaticMarkup(createElement(LeyendaTonos));
    for (const t of TONOS) {
      expect(html).toContain(`class="${t.clase}"`);
      expect(html).toContain(t.etiqueta);
    }
    expect(html).toContain('class="sil-none"');
    expect(clase(null)).toBe('sil-none');
  });
});

// Pieza 4 del rediseño de color: el mapa muscular sigue al acento. Los stops
// de los degradados tienen que nombrar tokens (--mapa-*), no hex: un
// stopColor escrito a mano deja el cuerpo azul con cualquier acento, y como
// la leyenda usa las mismas clases, la leyenda también.
describe('el mapa muscular sale de los tokens', () => {
  for (const archivo of ['Silhouette.jsx', 'BodyMini.jsx']) {
    it(`${archivo}: ningún stopColor literal`, () => {
      const src = readFileSync(join(import.meta.dirname, '../../components', archivo), 'utf8');
      const literales = src.match(/stopColor=["{]\s*["']?(#|rgb)/g) || [];
      expect(literales).toEqual([]);
      expect(src).toMatch(/mapa-0/);
    });
  }
});
