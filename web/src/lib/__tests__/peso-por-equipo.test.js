import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { sufijoPeso, rotuloPeso, discosPorLado, textoDiscos } from '../equip.js';
import { setBarra } from '../session.js';

vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../rutina-logic.js', () => ({ persistSlot: vi.fn() }));

// Enzo, 2026-10-06: "si son mancuernas de 17 kilos, debería decir 17 kilos
// por lado"; y la barra del curl predicador pesa 30 con todo, mientras que en
// una olímpica quiere saber cuánto poner de cada lado. El dato guardado no
// cambia (siempre el total, o por mano en mancuernas): cambia lo que se lee.
describe('qué es el número del peso', () => {
  it('mancuernas: el número es por mancuerna', () => {
    expect(sufijoPeso({ equip: 'mancuernas' })).toBe(' c/u');
    expect(rotuloPeso({ equip: 'mancuernas' })).toBe(' / mancuerna');
  });

  it('en unilateral manda "por lado" y no se repite el c/u', () => {
    expect(sufijoPeso({ equip: 'mancuernas' }, true)).toBe('');
    expect(rotuloPeso({ equip: 'mancuernas' }, true)).toBe(' / lado');
    expect(rotuloPeso({ equip: 'placas' }, true)).toBe(' / lado');
  });

  it('barra: el número es el total', () => {
    expect(rotuloPeso({ equip: 'barra' })).toBe(' total');
    expect(sufijoPeso({ equip: 'barra' })).toBe('');
  });

  it('el resto queda como siempre', () => {
    expect(rotuloPeso({ equip: 'placas' })).toBe('');
    expect(rotuloPeso({})).toBe('');
    expect(sufijoPeso(null)).toBe('');
  });
});

describe('discos por lado en barra olímpica', () => {
  const olimpica = { equip: 'barra', barraKg: 20 };

  it('reparte lo que no es la barra en dos lados', () => {
    expect(discosPorLado(olimpica, 60)).toEqual({ barra: 20, lado: 20 });
    expect(discosPorLado(olimpica, 45)).toEqual({ barra: 20, lado: 12.5 });
  });

  it('barra fija (sin peso de barra): el número ya es todo, no hay reparto', () => {
    expect(discosPorLado({ equip: 'barra' }, 30)).toBe(null);
  });

  it('un peso de barra que quedó de otro equipo no cuenta', () => {
    expect(discosPorLado({ equip: 'mancuernas', barraKg: 20 }, 30)).toBe(null);
  });

  it('el texto se lee como se carga', () => {
    const f = n => String(n);
    expect(textoDiscos(olimpica, 60, f)).toBe('barra 20 + 20 por lado');
    expect(textoDiscos(olimpica, 20, f)).toBe('sólo la barra');
    expect(textoDiscos(olimpica, 15, f)).toBe('menos que la barra (20)');
    expect(textoDiscos({ equip: 'barra' }, 30, f)).toBe('');
  });
});

describe('setBarra', () => {
  beforeEach(() => {
    S.routine = [{ id: 's1', type: 'workout', name: 'Brazos', exercises: [{ id: 'p', name: 'Curl predicador', sets: 3, reps: 10, equip: 'barra' }] }];
    S.draft = { id: 'd', slotId: 's1', entries: {}, order: ['p'], extras: [{ id: 'x', name: 'Curl barra', sets: 3, reps: 10, equip: 'barra' }] };
  });

  it('olímpica guarda el peso de la barra en el ejercicio de la rutina', async () => {
    await setBarra('p', 20);
    expect(S.routine[0].exercises[0].barraKg).toBe(20);
  });

  it('fija lo borra', async () => {
    S.routine[0].exercises[0].barraKg = 20;
    await setBarra('p', null);
    expect(S.routine[0].exercises[0].barraKg).toBeUndefined();
  });

  it('también sirve para un ejercicio agregado sólo hoy', async () => {
    await setBarra('x', 10);
    expect(S.draft.extras[0].barraKg).toBe(10);
  });
});
