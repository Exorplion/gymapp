import { describe, it, expect, beforeEach } from 'vitest';
import { S } from '../state.js';
import { catOf, muscleVolume, uncategorized } from '../muscle.js';

// Los 18 ejercicios de la rutina real de Enzo que HOY no matchean: son el
// motivo de este bloque, así que son el test.
const REALES = [
  ['Press plano máquina', 'Pecho'],
  ['Press inclinado', 'Pecho'],
  ['Pec deck unilateral', 'Pecho'],
  ['Extensión tríceps unilateral', 'Tríceps'],
  ['JM press unilateral', 'Tríceps'],
  ['Leg press', 'Pierna'],
  ['Leg extension', 'Pierna'],
  ['Abs polea', 'Abs'],
  ['Jalón ancho', 'Espalda'],
  ['Remo espalda alta', 'Espalda'],
  ['Remo neutro', 'Espalda'],
  ['Curl predicador', 'Bíceps'],
  ['SLDL', 'Pierna'],
  ['Hamstring curl', 'Pierna'],
  ['Standing calf raise', 'Gemelos'],
  ['Back extension 45°', 'Espalda'],
  ['Aductor', 'Pierna'],
  ['Abductor', 'Pierna'],
];

describe('catOf', () => {
  it.each(REALES)('clasifica %s como %s', (nombre, esperado) => {
    expect(catOf(nombre)).toBe(esperado);
  });

  it('los que ya funcionaban siguen funcionando', () => {
    expect(catOf('Elevaciones laterales')).toBe('Hombro');
    expect(catOf('Press militar máquina')).toBe('Hombro');
    expect(catOf('Curl martillo')).toBe('Bíceps');
    expect(catOf('Hip thrust')).toBe('Glúteo');
  });

  it('el orden de la tabla importa: lo específico gana a lo genérico', () => {
    // "curl" solo es Bíceps, pero femoral/hamstring son Pierna
    expect(catOf('Curl femoral')).toBe('Pierna');
    expect(catOf('Curl con barra')).toBe('Bíceps');
    // "press" solo es Pecho, pero militar es Hombro y JM es Tríceps
    expect(catOf('Press militar')).toBe('Hombro');
    expect(catOf('Press banca')).toBe('Pecho');
  });

  it('un cat explícito gana sobre cualquier adivinanza', () => {
    expect(catOf({ name: 'Press banca', cat: 'Tríceps' })).toBe('Tríceps');
    expect(catOf({ name: 'Cosa rarísima', cat: 'Abs' })).toBe('Abs');
  });

  it('acepta objeto o string', () => {
    expect(catOf({ name: 'Jalón ancho' })).toBe('Espalda');
    expect(catOf('Jalón ancho')).toBe('Espalda');
  });

  it('lo que no reconoce devuelve null, no una categoría inventada', () => {
    expect(catOf('Zarandaja voladora')).toBe(null);
    expect(catOf('')).toBe(null);
    expect(catOf(null)).toBe(null);
  });

  it('ignora acentos y mayúsculas', () => {
    expect(catOf('JALON ANCHO')).toBe('Espalda');
    expect(catOf('extension triceps')).toBe('Tríceps');
  });
});

describe('muscleVolume', () => {
  beforeEach(() => { S.sessions = []; });

  it('cuenta las series de los ejercicios que antes se descartaban', () => {
    S.sessions = [{
      id: 's1', date: new Date().toISOString().slice(0, 10), start: 1,
      entries: [
        { name: 'Jalón ancho', sets: [{ w: 80, r: 7 }, { w: 80, r: 6 }] },
        { name: 'Leg press', sets: [{ w: 180, r: 9 }] },
      ],
    }];
    const v = muscleVolume(7);
    expect(v.Espalda).toBe(2);
    expect(v.Pierna).toBe(1);
  });

  it('respeta el cat guardado en la entrada, no el de la rutina de hoy', () => {
    S.sessions = [{
      id: 's1', date: new Date().toISOString().slice(0, 10), start: 1,
      entries: [{ name: 'Press banca', cat: 'Hombro', sets: [{ w: 60, r: 8 }] }],
    }];
    expect(muscleVolume(7).Hombro).toBe(1);
    expect(muscleVolume(7).Pecho).toBeUndefined();
  });
});

describe('uncategorized', () => {
  it('lista los ejercicios de la rutina sin grupo, para poder avisarlo', () => {
    S.routine = {
      1: { weekday: 1, name: 'A', exercises: [
        { id: 'a', name: 'Jalón ancho' },
        { id: 'b', name: 'Zarandaja voladora' },
        { id: 'c', name: 'Otra cosa rara' },
      ] },
    };
    expect(uncategorized().map(e => e.name)).toEqual(['Zarandaja voladora', 'Otra cosa rara']);
  });

  it('con todo clasificado devuelve lista vacía', () => {
    S.routine = { 1: { weekday: 1, name: 'A', exercises: [{ id: 'a', name: 'Jalón ancho' }] } };
    expect(uncategorized()).toEqual([]);
  });
});
