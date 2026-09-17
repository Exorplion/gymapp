// D3/D4/D6 (docs/superpowers/specs/2026-09-17-unilateral-design.md):
// la lateralidad separa historial y gráficos, pero SIN partir el pasado en
// dos — el criterio crítico es que una entrada vieja sin el campo
// `unilateral` siga leyéndose exactamente igual que hoy.
import { describe, it, expect, beforeEach } from 'vitest';
import { S } from '../state.js';
import { exKey, puedeSerUnilateral } from '../equip.js';
import { exerciseSeries } from '../charts.js';

describe('exKey — D3: lateralidad como sufijo', () => {
  it('un ejercicio unilateral tiene clave distinta del mismo bilateral', () => {
    const bilateral = { name: 'Curl de bíceps', equip: 'mancuernas' };
    const unilateral = { name: 'Curl de bíceps', equip: 'mancuernas', unilateral: true };
    expect(exKey(unilateral)).not.toBe(exKey(bilateral));
  });

  it('CRÍTICO: sin el campo `unilateral` la clave es idéntica a la de siempre (con equipo)', () => {
    const historicoViejo = { name: 'Curl de bíceps', equip: 'mancuernas' };
    expect(exKey(historicoViejo)).toBe('curl de bíceps·mancuernas');
  });

  it('CRÍTICO: sin el campo `unilateral` la clave es idéntica a la de siempre (sin equipo)', () => {
    const historicoViejo = { name: 'Curl de bíceps' };
    expect(exKey(historicoViejo)).toBe('curl de bíceps');
  });

  it('unilateral: false se comporta igual que undefined', () => {
    const conFalse = { name: 'Curl de bíceps', equip: 'mancuernas', unilateral: false };
    const sinCampo = { name: 'Curl de bíceps', equip: 'mancuernas' };
    expect(exKey(conFalse)).toBe(exKey(sinCampo));

    const conFalseSinEquip = { name: 'Curl de bíceps', unilateral: false };
    const sinCampoSinEquip = { name: 'Curl de bíceps' };
    expect(exKey(conFalseSinEquip)).toBe(exKey(sinCampoSinEquip));
  });
});

describe('puedeSerUnilateral — D6: default mostrar el chip', () => {
  it('false para los claramente bilaterales por naturaleza', () => {
    expect(puedeSerUnilateral({ name: 'Sentadilla' })).toBe(false);
    expect(puedeSerUnilateral({ name: 'Peso muerto' })).toBe(false);
    expect(puedeSerUnilateral({ name: 'Press de banca' })).toBe(false);
    expect(puedeSerUnilateral({ name: 'Dominadas' })).toBe(false);
    expect(puedeSerUnilateral({ name: 'Prensa de pierna' })).toBe(false);
    expect(puedeSerUnilateral({ name: 'Hip Thrust' })).toBe(false);
  });

  it('true (default) para el resto', () => {
    expect(puedeSerUnilateral({ name: 'Curl de bíceps' })).toBe(true);
    expect(puedeSerUnilateral({ name: 'Extensión de tríceps' })).toBe(true);
    expect(puedeSerUnilateral({ name: 'Remo con mancuerna' })).toBe(true);
    expect(puedeSerUnilateral({ name: 'Peck deck' })).toBe(true);
    expect(puedeSerUnilateral({ name: 'Elevaciones laterales' })).toBe(true);
  });
});

describe('exerciseSeries — D4: separar bilateral de unilateral', () => {
  beforeEach(() => {
    S.sessions = [];
    S.body = [];
  });

  it('el mismo nombre con y sin lateralidad cae en dos claves distintas', () => {
    S.sessions = [
      {
        id: 's1', date: '2026-09-01', start: 1,
        entries: [{ name: 'Curl de bíceps', sets: [{ w: 40, r: 10 }] }],
      },
      {
        id: 's2', date: '2026-09-08', start: 2,
        entries: [{ name: 'Curl de bíceps', unilateral: true, sets: [{ w: 25, r: 10 }] }],
      },
    ];
    const series = exerciseSeries();
    expect(Object.keys(series).sort()).toEqual(['Curl de bíceps', 'Curl de bíceps (unilateral)']);
    expect(series['Curl de bíceps'][0].w).toBe(40);
    expect(series['Curl de bíceps (unilateral)'][0].w).toBe(25);
  });
});
