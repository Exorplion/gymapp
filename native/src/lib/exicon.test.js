// Tests de exicon.js — cubren los casos de orden específico→genérico que el
// propio comentario de la tabla llama out explícitamente: nombres que se
// pisan entre sí, donde matchear la entrada equivocada primero rompería el
// pictograma mostrado.
import { iconOf } from './exicon.js';

describe('iconOf', () => {
  it('"curl femoral" cae en legcurl, no en curl (bíceps)', () => {
    expect(iconOf({ name: 'Curl femoral' })).toBe('legcurl');
  });

  it('"leg extension" cae en legext, no en pushdown (tríceps)', () => {
    expect(iconOf({ name: 'Leg extension' })).toBe('legext');
  });

  it('"jm press" cae en pushdown (tríceps), no en militar/banca', () => {
    expect(iconOf({ name: 'JM press unilateral' })).toBe('pushdown');
  });

  it('"press militar" cae en militar (hombro), no en banca', () => {
    expect(iconOf({ name: 'Press militar' })).toBe('militar');
  });

  it('"press inclinado" cae en inclinado, no en el genérico banca de "press"', () => {
    expect(iconOf({ name: 'Press inclinado' })).toBe('inclinado');
  });

  it('"press banca" cae en banca vía la entrada genérica final "press"', () => {
    expect(iconOf({ name: 'Press banca plano' })).toBe('banca');
  });

  it('acepta un string en vez de un objeto entry', () => {
    expect(iconOf('Curl femoral')).toBe('legcurl');
  });

  it('devuelve generico para un ejercicio no reconocido', () => {
    expect(iconOf({ name: 'Ejercicio inventado xyz' })).toBe('generico');
  });

  it('devuelve generico si no hay nombre', () => {
    expect(iconOf({})).toBe('generico');
  });
});
