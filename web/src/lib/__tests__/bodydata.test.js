import { describe, it, expect } from 'vitest';
import { CUERPOS, cuerpo } from '../bodydata.js';
import { MUSCLE_CATS } from '../muscle.js';

const CARAS = [['m', 'frente'], ['m', 'espalda'], ['f', 'frente'], ['f', 'espalda']];
const todas = () => CARAS.map(([s, c]) => ({ s, c, cara: CUERPOS[s][c] }));

describe('cuerpo()', () => {
  it("'f' devuelve el cuerpo femenino", () => {
    expect(cuerpo('f')).toBe(CUERPOS.f);
  });

  it('cualquier otra cosa devuelve el masculino, incluido no elegir', () => {
    for (const v of ['m', undefined, null, '', 'x']) expect(cuerpo(v)).toBe(CUERPOS.m);
  });
});

describe('la lámina', () => {
  it('tiene las cuatro caras con trazos', () => {
    for (const { s, c, cara } of todas()) {
      expect(cara.zonas.length, `${s}.${c}`).toBeGreaterThan(10);
      expect(cara.zonas.every(z => z.d.length > 0), `${s}.${c}`).toBe(true);
    }
  });

  it('cada cara declara su viewBox', () => {
    for (const { s, c, cara } of todas()) {
      expect(cara.viewBox, `${s}.${c}`).toMatch(/^-?\d+(\.\d+)? -?\d+(\.\d+)? \d+(\.\d+)? \d+(\.\d+)?$/);
    }
  });

  // Los dos cuerpos están DIBUJADOS por separado, no es uno deformado a partir
  // del otro: por eso sus lienzos no miden lo mismo.
  it('el cuerpo femenino no es el masculino estirado', () => {
    expect(CUERPOS.f.frente.viewBox).not.toBe(CUERPOS.m.frente.viewBox);
    expect(CUERPOS.f.frente.zonas.map(z => z.d.join()))
      .not.toEqual(CUERPOS.m.frente.zonas.map(z => z.d.join()));
  });

  it('todos los trazos son paths SVG que arrancan con un movimiento', () => {
    for (const { s, c, cara } of todas()) {
      for (const z of cara.zonas) {
        for (const d of z.d) expect(d, `${s}.${c}/${z.slug}`).toMatch(/^[Mm]\s*-?[\d.]/);
      }
    }
  });

  it('sólo usa categorías que FIERRO conoce', () => {
    const validas = new Set([...MUSCLE_CATS, 'pelo', null]);
    for (const { s, c, cara } of todas()) {
      for (const z of cara.zonas) expect(validas.has(z.cat), `${s}.${c}/${z.slug} → ${z.cat}`).toBe(true);
    }
  });

  // Si un grupo no aparece en ninguna cara, tocarlo en la app sería imposible y
  // el mapa muscular mentiría por omisión.
  it('los nueve grupos aparecen en algún lado, en los dos cuerpos', () => {
    for (const sexo of ['m', 'f']) {
      const presentes = new Set();
      for (const c of ['frente', 'espalda']) CUERPOS[sexo][c].zonas.forEach(z => z.cat && presentes.add(z.cat));
      for (const g of MUSCLE_CATS) expect(presentes.has(g), `${sexo} sin ${g}`).toBe(true);
    }
  });

  it('los dos cuerpos tienen pelo', () => {
    for (const sexo of ['m', 'f']) {
      const conPelo = ['frente', 'espalda'].some(c => CUERPOS[sexo][c].zonas.some(z => z.cat === 'pelo'));
      expect(conPelo, `${sexo} sin pelo`).toBe(true);
    }
  });

  it('cada zona dice de qué músculo salió', () => {
    for (const { cara } of todas()) {
      for (const z of cara.zonas) expect(typeof z.slug).toBe('string');
    }
  });
});
