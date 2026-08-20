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
    for (const { cara } of todas()) {
      expect(cara.zonas.length).toBeGreaterThan(10);
      expect(cara.zonas.every(z => z.d.length > 0)).toBe(true);
    }
  });

  it('cada cara declara su viewBox', () => {
    for (const { cara } of todas()) {
      expect(cara.viewBox).toMatch(/^-?\d+(\.\d+)? -?\d+(\.\d+)? \d+(\.\d+)? \d+(\.\d+)?$/);
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
    for (const { cara } of todas()) {
      for (const z of cara.zonas) {
        for (const d of z.d) expect(d).toMatch(/^[Mm]\s*-?[\d.]/);
      }
    }
  });

  it('sólo usa categorías que FIERRO conoce', () => {
    const validas = new Set([...MUSCLE_CATS, 'pelo', null]);
    for (const { cara } of todas()) {
      for (const z of cara.zonas) expect(validas.has(z.cat)).toBe(true);
    }
  });

  // Si un grupo no aparece en ninguna cara, tocarlo en la app sería imposible y
  // el mapa muscular mentiría por omisión.
  it('los nueve grupos aparecen en algún lado, en los dos cuerpos', () => {
    for (const sexo of ['m', 'f']) {
      const presentes = new Set();
      for (const c of ['frente', 'espalda']) CUERPOS[sexo][c].zonas.forEach(z => z.cat && presentes.add(z.cat));
      for (const g of MUSCLE_CATS) expect(presentes.has(g)).toBe(true);
    }
  });

  it('los dos cuerpos tienen pelo', () => {
    for (const sexo of ['m', 'f']) {
      const conPelo = ['frente', 'espalda'].some(c => CUERPOS[sexo][c].zonas.some(z => z.cat === 'pelo'));
      expect(conPelo).toBe(true);
    }
  });

  it('cada zona dice de qué músculo salió', () => {
    for (const { cara } of todas()) {
      for (const z of cara.zonas) expect(typeof z.slug).toBe('string');
    }
  });
});
