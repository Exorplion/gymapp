import { describe, it, expect } from 'vitest';
import { ANTERIOR, POSTERIOR, ANTERIOR_F, POSTERIOR_F, cuerpo } from '../bodydata.js';

/** Ancho de UN grupo muscular. Se mide el grupo y no el cuerpo entero porque a
    la altura de la cadera los puntos más extremos son las manos, no la cadera:
    medir el total contestaría otra pregunta. */
function anchoDe(zonas, cat) {
  let min = Infinity, max = -Infinity;
  for (const z of zonas) {
    if (z.cat !== cat) continue;
    for (const p of z.pts) {
      const n = p.split(' ').map(Number);
      for (let i = 0; i < n.length; i += 2) { min = Math.min(min, n[i]); max = Math.max(max, n[i]); }
    }
  }
  return max - min;
}

describe('cuerpo()', () => {
  it("'f' devuelve la variante femenina", () => {
    expect(cuerpo('f').frente).toBe(ANTERIOR_F);
    expect(cuerpo('f').espalda).toBe(POSTERIOR_F);
  });

  it('cualquier otra cosa devuelve la masculina, incluido no elegir', () => {
    for (const v of ['m', undefined, null, '', 'x']) {
      expect(cuerpo(v).frente).toBe(ANTERIOR);
      expect(cuerpo(v).espalda).toBe(POSTERIOR);
    }
  });
});

describe('la variante femenina', () => {
  it('mantiene los mismos grupos musculares', () => {
    expect(ANTERIOR_F.map(z => z.cat)).toEqual(ANTERIOR.map(z => z.cat));
    expect(POSTERIOR_F.map(z => z.cat)).toEqual(POSTERIOR.map(z => z.cat));
  });

  it('mantiene la misma cantidad de polígonos y de puntos', () => {
    ANTERIOR.forEach((z, i) => {
      expect(ANTERIOR_F[i].pts.length).toBe(z.pts.length);
      z.pts.forEach((p, j) => {
        expect(ANTERIOR_F[i].pts[j].split(' ').length).toBe(p.split(' ').length);
      });
    });
  });

  // Lo que define la silueta: hombro más angosto, cadera más ancha.
  it('tiene los hombros más angostos que el modelo masculino', () => {
    expect(anchoDe(ANTERIOR_F, 'Hombro')).toBeLessThan(anchoDe(ANTERIOR, 'Hombro'));
  });

  it('tiene el glúteo más ancho', () => {
    expect(anchoDe(POSTERIOR_F, 'Glúteo')).toBeGreaterThan(anchoDe(POSTERIOR, 'Glúteo'));
  });

  it('tiene la cintura más angosta', () => {
    expect(anchoDe(ANTERIOR_F, 'Abs')).toBeLessThan(anchoDe(ANTERIOR, 'Abs'));
  });

  // El ajuste es del tronco: si arrastrara los brazos, además de salirse del
  // lienzo estaría diciendo que una cadera ancha te separa las manos.
  it('casi no mueve los brazos', () => {
    const bic = anchoDe(ANTERIOR, 'Bíceps'), bicF = anchoDe(ANTERIOR_F, 'Bíceps');
    expect(Math.abs(bicF - bic) / bic).toBeLessThan(0.12);
  });

  it('no toca las alturas: sólo cambia el ancho', () => {
    const alturas = z => z.flatMap(g => g.pts.flatMap(p => p.split(' ').filter((_, i) => i % 2 === 1)));
    expect(alturas(ANTERIOR_F)).toEqual(alturas(ANTERIOR));
  });

  it('sigue centrada en el eje del cuerpo', () => {
    const centro = zonas => {
      let min = Infinity, max = -Infinity;
      for (const z of zonas) for (const p of z.pts) {
        const n = p.split(' ').map(Number);
        for (let i = 0; i < n.length; i += 2) { min = Math.min(min, n[i]); max = Math.max(max, n[i]); }
      }
      return (min + max) / 2;
    };
    expect(centro(ANTERIOR_F)).toBeCloseTo(centro(ANTERIOR), 0);
  });

  it('no se sale del lienzo de 100 × 200', () => {
    for (const zonas of [ANTERIOR_F, POSTERIOR_F]) {
      for (const z of zonas) for (const p of z.pts) {
        const n = p.split(' ').map(Number);
        for (let i = 0; i < n.length; i += 2) {
          expect(n[i]).toBeGreaterThanOrEqual(0);
          expect(n[i]).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});
